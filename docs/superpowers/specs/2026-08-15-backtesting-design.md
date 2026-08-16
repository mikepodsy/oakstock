# Backtesting Framework — Design Spec

**Date:** 2026-08-15
**Status:** Approved

---

## Overview

A reusable Python backtesting engine plus a `/backtesting` page that displays saved results.

The engine is general-purpose: strategies plug in as small classes, and the signals they consume
are just columns on a daily DataFrame. The first strategies use CFTC Commitment of Traders
positioning, but nothing in the engine knows what COT is. Technical indicators and fundamental
screens later become new feature providers, not engine changes.

Two problems are solved together, because the second is worthless without the first:

1. **There is no historical data store.** Oakstock fetches COT from the CFTC Socrata API and
   prices from Yahoo/Questrade on demand, into in-memory TTL caches. Nothing is persisted.
   A backtest needs reproducible point-in-time history, so this spec builds one.
2. **There is no simulation engine.** Nothing in the repo evaluates a rule over history.
   (`api/experts/[manager]/performance` holds today's 13F weights constant backwards — a
   static reconstruction, not a backtest.)

---

## Architecture

Three pieces with hard boundaries. Each is usable and testable without the others.

```
CFTC Socrata ──┐
               ├─→  oakbt.data  ──→  Supabase (cot_history, price_history)
Yahoo chart ───┘                          │
                                          ↓
                              oakbt.engine (signals → risk → execution → metrics)
                                          │
                                          ↓
                          Supabase (backtest_runs, _equity, _trades)
                                          │
                                          ↓
              /api/backtest/* ──→ backtestService ──→ useBacktestRuns ──→ /backtesting
```

The Python service **only writes**. The Next.js app **only reads**, via the existing
service-role client in `src/lib/supabase.ts`. The page therefore has no runtime dependency on
Python — it renders stored runs whether or not the engine is running anywhere.

This mirrors the precedent already set by `src/lib/dolthub.ts` (see its module header comment on
offline backfill) and `scripts/seed-volatility-history.mjs`: deep history is backfilled offline by
a script, then lives in Supabase for the app to read.

**Runtime:** CLI-first. `python -m oakbt.cli` is the entry point, with a Dockerfile for
reproducibility and a FastAPI app (`oakbt/api.py`) written but **not deployed**. When
browser-triggered runs are wanted later, the service is ready to deploy and the page gains a
POST route; neither requires reworking the engine.

---

## Implementation Phases

The spec is written as one design but should be executed as three plans, in order. Each phase
is independently verifiable and leaves the repo in a working state.

| Phase | Scope | Done when |
|---|---|---|
| **1. Data** | `supabase/backtesting.sql`, `oakbt/data/*`, backfill CLI, their tests | `cot_history` + `price_history` populate and the point-in-time tests pass |
| **2. Engine** | `oakbt/engine/*`, `oakbt/strategies/*`, `oakbt/persist/*`, run CLI, their tests | `buy_and_hold` on SPY reproduces SPY's actual return; runs persist |
| **3. Page** | `/api/backtest/*`, `/backtesting`, components, sidebar link | Stored runs render with equity curve, drawdown, metrics, trade log |

---

## Point-in-Time Correctness

**The single most important requirement in this spec.**

CFTC COT reports carry positions as of **Tuesday**, but are not released until **Friday
3:30pm ET**. Indexing signals by report date grants the strategy three days of lookahead and
will manufacture returns that cannot be traded.

Rules:

- `cot_history` stores both `report_date` and `released_at`.
- `released_at` = `report_date + 3 days`, shifted forward one business day per intervening US
  federal holiday (the CFTC delays releases on holiday weeks).
- The alignment step guarantees a bar dated *d* sees only rows with `released_at < d`.
- COT values are forward-filled onto daily bars from their release date, never their report date.

**Resulting timeline, stated explicitly** (this is a deliberate modeling choice, not an accident
of two independent rules): positions as of Tuesday → released Friday 3:30pm → strictly-less-than
makes them visible on Monday's bar → `signal_lag=1` fills at Tuesday's open. That is ~2 trading
days between release and fill. It is intentionally conservative, since the 3:30pm release lands
too close to the close to trade reliably. `signal_lag=0` (fill at Monday's open) is defensible
and configurable, but 1 is the default.

This gets dedicated tests, including a holiday-week case (e.g. Thanksgiving) and an assertion
that no feature value is visible on a bar before its `released_at`.

---

## Engine Pipeline

```python
load_frame(ticker, start, end, features)   # daily OHLCV + point-in-time features → DataFrame
  → Strategy.generate_signals(df)          # → pd.Series of target weights in [-1, 1]  (user code)
  → RiskModel.apply(weights, df)           # vol targeting + leverage cap       (vectorized)
  → Executor.run(weights, df, config)      # ONE bar loop: lag, fills, stops, costs
  → compute_metrics(equity, trades, benchmark)   # performance statistics
```

Strategies are vectorized and pure, so they are trivial to test. The only path-dependent code
is `Executor` — written once, tested hard, untouched when strategies are added.

### Unit contracts

| Unit | Interface | Depends on |
|---|---|---|
| `Strategy` (ABC) | `name: str`, `params: dict`, `required_features: list[str]`, `generate_signals(df) -> pd.Series` | nothing (pure) |
| `FeatureProvider` (Protocol) | `provides: list[str]`, `compute(ctx: FeatureContext) -> pd.DataFrame` | data store |
| `RiskModel` | `apply(weights, df) -> pd.Series` | nothing (pure) |
| `Executor` | `run(weights, df, config) -> (equity: pd.Series, trades: list[Trade])` | nothing (pure) |
| `metrics` | `compute_metrics(equity, trades, benchmark) -> dict` | nothing (pure) |
| `runner` | `run_backtest(cfg: RunConfig) -> RunResult` | all of the above + store |
| `writer` | `persist(result: RunResult) -> uuid` | Supabase |

Everything below `runner` is a pure function of its inputs. That is what makes the test suite
cheap and the results reproducible.

### Feature resolution (the `load_frame` ↔ `FeatureProvider` boundary)

Providers are registered by the names they produce:

```python
@dataclass(frozen=True)
class FeatureContext:
    ticker: str            # tradable proxy, e.g. "SPY"
    market_code: str | None  # COT market, e.g. "SP500" — None for price-only strategies
    dates: pd.DatetimeIndex  # the daily bar calendar to align onto

REGISTRY: dict[str, FeatureProvider]   # feature name → provider that produces it
```

`FeatureProvider.provides` lists the exact column names it writes, so a provider declaring
`["cot_index_lev_money", "cot_net_lev_money"]` claims those registry keys at import time.
Duplicate registration raises.

`runner` resolves in this order, before any simulation:

1. Take `strategy.required_features`.
2. Look each up in `REGISTRY`. **Any miss raises `UnknownFeatureError` naming the feature and
   listing available ones** — this is what makes the error-table guarantee implementable.
3. Resolve `market_code` from `ticker` via the universe mapping (or take it from `RunConfig`).
   COT providers require a non-`None` `market_code` and raise `MissingMarketCodeError` if the
   ticker has no COT counterpart.
4. Call each distinct provider once with a `FeatureContext`, then join the returned frames onto
   the OHLCV frame by date.

This is the seam that makes the framework general: adding RSI means writing a provider whose
`provides` is `["rsi_14"]` and ignoring `market_code`. No engine change.

### Execution model

- **Signal lag:** weights computed on bar *t* execute on bar *t+1*'s open (`signal_lag=1`,
  configurable).
- **Vol targeting:** position scaled by `target_vol / trailing_realized_vol` (EWMA of daily
  returns, 20-day default half-life), clipped to `max_leverage` (default 2.0). Prevents a
  1x notional position in GLD and in UNG from representing wildly different risk.
- **Stops:** fixed-percent or ATR-multiple, optionally trailing. Evaluated intrabar against
  the bar's low/high. Every trade records an `exit_reason` (`signal`, `stop`, `end_of_data`)
  so it is visible what closed each position.
- **Costs:** `(commission_bps + slippage_bps) * |Δweight|` charged on every weight change.
  Defaults 1.0 bps + 2.0 bps.
- **Accounting:** equity compounds on a single cash account; no margin interest in v1.

### Metrics

CAGR, annualized volatility, Sharpe, Sortino, max drawdown, Calmar, hit rate, average
win/loss, profit factor, turnover, time-in-market, and the same set for a buy-and-hold
benchmark of the same instrument over the same window. Risk-free rate is a config field
(default 0.045, matching `api/experts/[manager]/performance/route.ts`).

---

## Universe

COT markets are not directly tradable, so each maps to a liquid ETF proxy in one config table
(`oakbt/data/universe.py`):

| COT market | Proxy | | COT market | Proxy |
|---|---|---|---|---|
| S&P 500 | SPY | | WTI Crude | USO ⚠ |
| Nasdaq 100 | QQQ | | Natural Gas | UNG ⚠ |
| Russell 2000 | IWM | | USD Index | UUP |
| Gold | GLD | | Euro FX | FXE |
| Silver | SLV | | Japanese Yen | FXY |
| Copper | CPER | | British Pound | FXB |
| UST 30Y | TLT | | Canadian Dollar | FXC |
| UST 10Y | IEF | | | |

⚠ **USO and UNG suffer severe contango drag** and are poor multi-year proxies for spot
WTI/natural gas. The mapping table carries a `proxy_quality` field (`good` | `degraded`), which
is copied onto the run and surfaced in the UI, so a result is never read as if it tracked the
underlying commodity.

---

## Data Schema (Supabase)

DDL lives in `supabase/backtesting.sql`, matching the repo's ad-hoc `.sql` convention
(`iv_history.sql` is the closest analog — no RLS on history-style tables).

```sql
create table if not exists cot_history (
  market_code   text   not null,   -- 'SP500', joins to universe config
  dataset       text   not null,   -- 'tff' | 'disaggregated' | 'legacy'
  report_date   date   not null,
  released_at   date   not null,   -- see Point-in-Time Correctness
  category      text   not null,   -- 'lev_money' | 'asset_mgr' | 'dealer' | 'commercial' | ...
  longs         bigint,
  shorts        bigint,
  net           bigint,
  open_interest bigint,
  primary key (market_code, dataset, report_date, category)
);
create index if not exists cot_history_release_idx
  on cot_history (market_code, released_at);

create table if not exists price_history (
  ticker    text not null,
  date      date not null,
  open      numeric,
  high      numeric,
  low       numeric,
  close     numeric,
  adj_close numeric,
  volume    bigint,
  primary key (ticker, date)
);

create table if not exists backtest_runs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  strategy      text not null,
  params        jsonb not null default '{}'::jsonb,
  ticker        text not null,
  market_code   text,
  proxy_quality text,
  start_date    date,
  end_date      date,
  config        jsonb not null default '{}'::jsonb,  -- costs, lag, vol target, stops
  metrics       jsonb,                               -- full metric set incl. benchmark
  code_version  text,                                -- git SHA — traces a chart to its code
  status        text not null default 'running',     -- 'running' | 'complete' | 'failed'
  error         text                                 -- populated when status = 'failed'
);
create index if not exists backtest_runs_created_idx
  on backtest_runs (created_at desc);

create table if not exists backtest_equity (
  run_id           uuid not null references backtest_runs(id) on delete cascade,
  date             date not null,
  equity           numeric not null,
  benchmark_equity numeric,
  drawdown         numeric,
  exposure         numeric,
  position         numeric,
  primary key (run_id, date)
);

create table if not exists backtest_trades (
  id          bigserial primary key,
  run_id      uuid not null references backtest_runs(id) on delete cascade,
  entry_date  date not null,
  exit_date   date,
  direction   text not null,          -- 'long' | 'short'
  entry_price numeric,
  exit_price  numeric,
  size        numeric,
  pnl         numeric,
  return_pct  numeric,
  exit_reason text,                   -- 'signal' | 'stop' | 'end_of_data'
  bars_held   int
);
create index if not exists backtest_trades_run_idx
  on backtest_trades (run_id, entry_date);
```

`runner` inserts the `backtest_runs` row with `status='running'` **before** simulating, then
updates it to `complete` (with metrics) or `failed` (with `error`). That is what gives
`'running'` a writer even in a synchronous CLI, and it means a crashed process leaves a visible
row rather than silence.

---

## Backfill

- **COT:** paginated CFTC Socrata pulls. The existing `/api/cot` route caps at
  `FETCH_WEEKS` (`HISTORY_WEEKS + INDEX_WEEKS` = 52 + 156 = 208); the loader paginates past that.
  Depth is the `--years` CLI parameter, **default 4** to match the app.
- **Prices:** Yahoo daily adjusted bars per proxy ticker, full available history.
- Both loaders are idempotent upserts on their primary keys, so re-running is safe and
  incremental top-ups are cheap.

**Credentials:** `oakbt/data/store.py` reads `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from the environment, falling back to parsing the repo-root
`.env.local` — exactly the convention `tools/fetch_13f.py` already uses. It raises a clear
error if the key is absent. No new secrets and no new secret location.

**Known limitation:** 4 years of weekly COT is ~208 observations, and a threshold strategy
turns over roughly 6–12 times per market in that window. Sharpe estimated from ~10 trades has
a standard error wide enough that skill and noise are not separable. Results at the default
depth should be treated as directional, not conclusive. `--years 15` covers the full
disaggregated/TFF era and is one flag away when statistical power matters.

---

## Strategies (v1)

| Strategy | Logic |
|---|---|
| `buy_and_hold` | Constant weight 1.0. Sanity check and benchmark. |
| `cot_index_reversal` | Long when the 3yr COT index of a chosen category is below `long_below`, short above `short_above`. Fades crowded positioning. |
| `cot_net_zscore` | Long/short on the z-score of net positioning over a rolling window, with a neutral band. |

Registered by name in `oakbt/strategies/__init__.py`, so the CLI takes
`--strategy cot_index_reversal` and adding a strategy means one file plus one registry line.

---

## CLI

```
python -m oakbt.cli backfill [--years 4] [--markets SP500,GOLD] [--prices-only|--cot-only]
python -m oakbt.cli run --strategy NAME (--ticker SPY | --market SP500)
                        [--start DATE] [--end DATE] [--param k=v ...]
python -m oakbt.cli list [--limit 20]
```

**`--ticker` / `--market` resolution rule** (exactly one is required; supplying both or neither
is an argument error):

- `--market SP500` → looks up the proxy in the universe map, sets `ticker='SPY'`,
  `market_code='SP500'`, and carries `proxy_quality`.
- `--ticker SPY` → sets `ticker='SPY'` and reverse-resolves `market_code` if that ticker is a
  known proxy, else leaves it `NULL`. A `NULL` market_code is fine for price-only strategies and
  raises `MissingMarketCodeError` if the strategy needs a COT feature.

This keeps `backtest_runs.ticker` non-null in every path.

---

## File Structure

### New — Python

Package root is `tools/backtest/`, with the importable package at `tools/backtest/oakbt/`.

| Path | Purpose |
|---|---|
| `tools/backtest/pyproject.toml` | Package + deps (pandas, numpy, requests, supabase, pydantic; dev: pytest) |
| `tools/backtest/Dockerfile` | Reproducible runtime; not deployed in v1 |
| `tools/backtest/README.md` | Setup, CLI usage, how to add a strategy or feature provider |
| `tools/backtest/oakbt/config.py` | `RunConfig`, `ExecutionConfig` (pydantic) |
| `tools/backtest/oakbt/data/cftc.py` | Paginated Socrata client, release-date derivation |
| `tools/backtest/oakbt/data/prices.py` | Yahoo daily bars |
| `tools/backtest/oakbt/data/store.py` | Supabase read/write for the history tables |
| `tools/backtest/oakbt/data/align.py` | Weekly COT → daily bars under the point-in-time rule |
| `tools/backtest/oakbt/data/features.py` | Provider registry + COT provider (3yr index, net, z-score, OI index) |
| `tools/backtest/oakbt/data/universe.py` | COT market → ETF proxy mapping + `proxy_quality` |
| `tools/backtest/oakbt/engine/strategy.py` | `Strategy` ABC |
| `tools/backtest/oakbt/engine/risk.py` | Vol targeting, leverage cap |
| `tools/backtest/oakbt/engine/executor.py` | The bar loop |
| `tools/backtest/oakbt/engine/metrics.py` | Performance statistics |
| `tools/backtest/oakbt/engine/runner.py` | Orchestration, feature resolution |
| `tools/backtest/oakbt/strategies/*.py` | The three v1 strategies + registry |
| `tools/backtest/oakbt/persist/writer.py` | Result persistence |
| `tools/backtest/oakbt/cli.py` | `backfill` / `run` / `list` |
| `tools/backtest/oakbt/api.py` | FastAPI app (built, not deployed) |
| `tools/backtest/tests/*.py` | pytest suite |

### New — TypeScript

| Path | Purpose |
|---|---|
| `supabase/backtesting.sql` | Table DDL |
| `src/app/backtesting/page.tsx` | Page (client component) |
| `src/app/api/backtest/runs/route.ts` | List runs |
| `src/app/api/backtest/runs/[id]/route.ts` | Run detail: metrics + equity + trades |
| `src/services/backtestService.ts` | Fetch wrappers |
| `src/hooks/useBacktestRuns.ts`, `useBacktestRun.ts` | Data hooks |
| `src/components/backtesting/RunList.tsx` | Saved runs, newest first |
| `src/components/backtesting/MetricsGrid.tsx` | Metric cards vs benchmark |
| `src/components/backtesting/EquityCurveChart.tsx` | Equity vs benchmark |
| `src/components/backtesting/DrawdownChart.tsx` | Underwater curve |
| `src/components/backtesting/TradeLogTable.tsx` | Trade table with exit reasons |
| `src/components/backtesting/BacktestLoadingSkeleton.tsx` | Loading state |
| `src/types/backtest.ts` | Shared types |

### Modified

| File | Change |
|---|---|
| `src/components/layout/Sidebar.tsx` | Add `{ href: "/backtesting", label: "Backtesting", icon: FlaskConical }` to `NAV_LINKS` |

No existing component is modified. See the charting note below for why.

---

## Frontend Conventions

Follows `src/app/cot/page.tsx`:

- `"use client"` page. Every feature page in this app is a client component; the only server
  components are the Clerk `sign-in`/`sign-up` catch-alls.
- Layering: page → `components/backtesting/` → `hooks/useX.ts` → `services/xService.ts` → `/api`.
- Hooks copy the `useCotData.ts` template: `data`/`loading`/`error` state, `useCallback` loader
  taking an `AbortSignal`, `useEffect` with `AbortController` cleanup, exported `refetch`.
- Page shell `<div className="p-6 max-w-6xl mx-auto">`, `<h1 className="font-display text-2xl text-text-primary">`,
  then mutually exclusive loading / error+retry / content / empty blocks. No `loading.tsx` or `error.tsx`.
- Cards are the literal class string `rounded-xl border border-border-primary bg-bg-secondary p-4`
  (there is no `Card` component in this UI kit).
- Trade log is a plain `<table>`, following `src/components/portfolio/HoldingsTable.tsx`
  (there is no `Table` component either).
- API routes use `apiHandler` from `src/lib/apiHandler.ts` (modeled on `api/fundamentals/route.ts`)
  and `createServerSupabaseClient()`. Cache header
  `public, s-maxage=300, stale-while-revalidate=300` — stored runs are immutable, only the list grows.

**Charts — build standalone, do not reuse `PerformanceChart`.** `PerformanceChart.tsx` looks like
a fit but is not one: it requires `period` and `onPeriodChange` props and renders a
`TimeRangePicker`, which is meaningless for a stored run with a fixed window; it hardcodes the
legend label `"Portfolio"` with no prop to change it; it formats the Y axis as currency; and it
draws a cost-basis `ReferenceLine` keyed to `PortfolioChartPoint`. Bending it to fit would mean
modifying a component three other pages depend on. `EquityCurveChart` and `DrawdownChart` are
therefore written fresh against the visx/bklit `src/components/charts/area-chart.tsx` kit, using
the existing CSS variables (`--green-primary`, `--red-primary`, `--chart-1..5`) — no new palette.

⚠ `bar-chart.tsx` and `bar.tsx` in `src/components/charts/` carry `LOCAL PATCH` comments and are
clobbered by re-running `shadcn add @bklit/*`. This work adds no registry components and does not
touch those two files.

---

## Error Handling

| Failure | Behavior |
|---|---|
| CFTC API down or rate-limited | Loader retries with backoff, then exits non-zero. Partial upserts already committed remain valid (idempotent). |
| Yahoo returns a gap or short history | Backtest window is clipped to available data; actual `start_date` is recorded on the run, so the chart never implies coverage it lacks. |
| Missing COT for a bar | Forward-filled from last release. If no release has occurred yet, the bar is excluded from the tradable window rather than assumed flat. |
| Strategy declares an unavailable feature | `runner` raises `UnknownFeatureError` before any simulation, naming the feature and listing available ones. |
| COT strategy on a ticker with no COT market | `runner` raises `MissingMarketCodeError` before simulating. |
| Vol target with near-zero trailing vol | Scaling is clipped to `max_leverage`, avoiding an infinite position. |
| Run fails mid-flight | Row persists with `status='failed'` and the message in `error`; the UI lists it as failed rather than hiding it. |
| Supabase unreachable from the page | `apiHandler` returns the standard `{ error, detail }` shape; the page shows its error block with retry. |
| No runs saved yet | Explicit empty state naming the CLI command that creates one. |

---

## Testing

**Python (pytest)** — the engine is pure logic, so tests use synthetic series with known answers:

- `test_align.py` — point-in-time rule, including a holiday-shifted release week; asserts no
  feature is visible on a bar before its `released_at`.
- `test_executor.py` — signal lag fills on the correct bar; stop triggers on the exact bar
  whose low breaches it; costs charged only on weight changes; short P&L sign; `exit_reason`
  correctness.
- `test_metrics.py` — constant +1%/day gives the analytically known CAGR; a known drawdown path
  gives the known max DD; zero-volatility input does not divide by zero.
- `test_risk.py` — vol targeting hits the target on synthetic constant-vol input; leverage cap binds.
- `test_features.py` — 3yr COT index is 0 at the window low and 100 at the window high.
- `test_registry.py` — duplicate provider registration raises; `UnknownFeatureError` names the
  missing feature; `MissingMarketCodeError` fires for a COT strategy on an unmapped ticker.
- `test_universe.py` — every mapped market resolves to a proxy, reverse lookup is consistent,
  and `proxy_quality` is set on every entry.
- `test_strategies.py` — each registered strategy returns weights within [-1, 1] on a fixture frame.

**TypeScript (vitest)** — `environment: "node"`, `include: src/**/*.{test,spec}.ts` (`.tsx` is not
in the glob and there is no jsdom, so no component tests). Colocated `.test.ts` files cover the
metric formatters and run-shaping helpers, following `src/lib/apiHandler.test.ts`.

---

## Out of Scope (v1)

Deliberately excluded, to be revisited only if wanted:

- Browser-triggered runs and job status polling (the page is a read-only viewer).
- Deployment of the FastAPI service.
- Multi-asset portfolios — a run is one strategy on one instrument.
- Parameter sweeps, optimization, and walk-forward analysis.
- Futures contract accounting (multipliers, margin, roll splicing).
- Intraday data; the engine is daily-bar only.
- Margin interest and borrow costs on shorts.

---

## Verification

1. `cd tools/backtest && pip install -e ".[dev]" && pytest` — full suite green.
2. Apply `supabase/backtesting.sql`; confirm the five tables exist.
3. `python -m oakbt.cli backfill --years 4` — confirm `cot_history` and `price_history` populate.
4. `python -m oakbt.cli run --strategy buy_and_hold --ticker SPY` — CAGR must match SPY's
   actual return over the window (the sanity check that the accounting is right).
5. `python -m oakbt.cli run --strategy cot_index_reversal --market SP500` — a run row appears
   with `status='complete'`.
6. `npm run dev` → `/backtesting` — run list renders, detail shows equity curve, drawdown,
   metrics, and trade log.
7. `npm test && npm run lint && npm run build` — all pass.
