# Backtesting Framework Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Python backtesting engine (`tools/backtest/`) over a new Supabase-backed point-in-time history store, plus a read-only `/backtesting` page that renders saved runs.

**Architecture:** Three layers with hard boundaries. `oakbt.data` backfills CFTC COT and Yahoo prices into Supabase and serves aligned daily frames. `oakbt.engine` turns a vectorized target-weight signal into an equity curve through a risk model and a single bar loop. The Next.js page only ever reads results from Supabase, so it has no runtime dependency on Python. Strategies and features are registries, so extending past COT means adding a file, not editing the engine.

**Tech Stack:** Python 3.13, pandas 2.2, numpy 2.2, pydantic, supabase-py, pytest. Next.js 16 App Router, React 19, Tailwind v4, visx.

**Spec:** `docs/superpowers/specs/2026-08-15-backtesting-design.md`

---

## Chunk 1: Phase 1 — Data Layer

### Task 1: Package scaffolding

**Files:**
- Create: `tools/backtest/pyproject.toml`, `tools/backtest/README.md`, `tools/backtest/oakbt/__init__.py`, `tools/backtest/tests/__init__.py`

- [ ] **Step 1:** Write `pyproject.toml` with `[project]` name `oakbt`, requires-python `>=3.11`, deps `pandas>=2.2`, `numpy>=2.0`, `requests>=2.31`, `supabase>=2.0`, `pydantic>=2.0`; `[project.optional-dependencies] dev = ["pytest>=8.0"]`; `[tool.setuptools.packages.find] include = ["oakbt*"]`. Add `[tool.pytest.ini_options] testpaths = ["tests"]`.
- [ ] **Step 2:** `cd tools/backtest && pip install -e ".[dev]"` — expect success.
- [ ] **Step 3:** `pytest` — expect "no tests ran", exit 5. That is the correct empty state.
- [ ] **Step 4:** Add `tools/backtest/*.egg-info/`, `__pycache__/`, `.pytest_cache/` to `.gitignore`.
- [ ] **Step 5:** Commit `chore(backtest): scaffold oakbt python package`.

### Task 2: Universe registry

**Files:**
- Create: `tools/backtest/oakbt/data/universe.py`, `tools/backtest/oakbt/data/__init__.py`
- Test: `tools/backtest/tests/test_universe.py`
- Reference: `src/app/api/cot/route.ts:25` (`INSTRUMENTS` — source of `cftc_name` strings)

- [ ] **Step 1:** Write failing tests: every `Market` has non-empty `cftc_name` and `dataset` in `{tff, disaggregated, legacy}`; `get_market("SP500").proxy == "SPY"`; `market_for_ticker("SPY").market_code == "SP500"`; `market_for_ticker("AAPL") is None`; `proxy_quality` in `{good, degraded}` for all; `USO`/`UNG` markets are `degraded`; codes are unique and proxies are unique.
- [ ] **Step 2:** `pytest tests/test_universe.py -v` — expect ImportError.
- [ ] **Step 3:** Implement frozen `@dataclass Market` and `MARKETS: dict[str, Market]` with the 16 entries from the spec. Copy `cftc_name` verbatim from the COT route. Financial markets (`SP500`, `NASDAQ100`, `RUSSELL2000`, `UST30Y`, `UST10Y`, `USDINDEX`, `EUR`, `JPY`, `GBP`, `CAD`) use `dataset="tff"`; commodities (`GOLD`, `SILVER`, `COPPER`, `WTI`, `NATGAS`) use `dataset="disaggregated"`. Add `get_market()`, `market_for_ticker()`, `all_markets()`.
- [ ] **Step 4:** `pytest tests/test_universe.py -v` — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): market universe with CFTC names and ETF proxies`.

### Task 3: Release-date derivation (point-in-time core)

**Files:**
- Create: `tools/backtest/oakbt/data/calendar.py`
- Test: `tools/backtest/tests/test_calendar.py`

This is the highest-risk correctness code in the project. Test it before anything depends on it.

- [ ] **Step 1:** Write failing tests for `release_date(report_date)`:
  - Normal week: Tue 2024-01-09 → Fri 2024-01-12.
  - Thanksgiving 2024 (Thu 11-28): Tue 2024-11-26 → Mon 2024-12-02, not Fri 11-29. (CFTC delays a business day per intervening holiday.)
  - July 4 2024 (Thu): Tue 2024-07-02 → Mon 2024-07-08.
  - Christmas 2024 (Wed): Tue 2024-12-24 → Mon 2024-12-30.
  - Result is always strictly after `report_date` and never a weekend.
- [ ] **Step 2:** `pytest tests/test_calendar.py -v` — expect ImportError.
- [ ] **Step 3:** Implement `US_HOLIDAYS` (a generated set covering 2004-2030: New Year, MLK, Presidents, Good Friday, Memorial, Juneteenth, Independence, Labor, Thanksgiving, Christmas, with weekend observation shifts) and `release_date()`: start at `report_date + 3 days`, then push forward one business day for each holiday falling in `(report_date, candidate]`, skipping weekends.
- [ ] **Step 4:** `pytest tests/test_calendar.py -v` — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): CFTC release-date derivation with holiday shifts`.

### Task 4: Supabase DDL

**Files:**
- Create: `supabase/backtesting.sql`

- [ ] **Step 1:** Write the five tables verbatim from the spec's Data Schema section, including FK `on delete cascade`, all indexes, and the `error` column.
- [ ] **Step 2:** Apply via the Supabase MCP `apply_migration` tool (name `backtesting_tables`).
- [ ] **Step 3:** Verify with `list_tables` — expect `cot_history`, `price_history`, `backtest_runs`, `backtest_equity`, `backtest_trades`.
- [ ] **Step 4:** Commit `feat(backtest): supabase schema for history and results`.

### Task 5: Supabase store

**Files:**
- Create: `tools/backtest/oakbt/data/store.py`
- Test: `tools/backtest/tests/test_store.py`

- [ ] **Step 1:** Write failing tests for the credential resolver only (no network): `_load_env()` returns env vars when set; falls back to parsing repo-root `.env.local`; raises `RuntimeError` naming `SUPABASE_SERVICE_ROLE_KEY` when absent. Use `monkeypatch` and `tmp_path`.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `_load_env()` (mirroring `tools/fetch_13f.py`), a memoized `client()`, and:
  - `upsert_cot(rows: list[dict]) -> int` — chunked upserts of 500.
  - `upsert_prices(rows: list[dict]) -> int` — same.
  - `load_cot(market_code, start, end) -> pd.DataFrame`
  - `load_prices(ticker, start, end) -> pd.DataFrame`
  - `latest_cot_report_date(market_code) -> date | None` (for incremental top-ups)
  Paginate reads in 1000-row pages — supabase-py caps default selects.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): supabase read/write for history tables`.

### Task 6: CFTC client

**Files:**
- Create: `tools/backtest/oakbt/data/cftc.py`
- Test: `tools/backtest/tests/test_cftc.py`

- [ ] **Step 1:** Write failing tests against a fixture Socrata payload (one dict per dataset, no network — monkeypatch the fetch fn): `parse_records()` maps TFF columns (`lev_money_positions_long_all` etc.) to rows with `category`, `longs`, `shorts`, `net`; `net == longs - shorts`; every row carries `released_at` from `release_date()`; disaggregated maps `m_money_*` and the irregular `swap__positions_short_all` (double underscore) correctly; malformed/missing numeric fields become `None`, not a crash.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `DATASETS = {"tff": "gpe5-46if", "disaggregated": "72hh-3qpy", "legacy": "6dca-aqww"}`, `CATEGORY_COLUMNS` per dataset, `fetch_market(market, years) -> list[dict]` paginating with `$limit`/`$offset` (1000/page, `$order=report_date_as_yyyy_mm_dd DESC`, stop past the cutoff), and `parse_records()`. Retry 3× with exponential backoff on non-2xx.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): paginated CFTC Socrata client`.

### Task 7: Price client

**Files:**
- Create: `tools/backtest/oakbt/data/prices.py`
- Test: `tools/backtest/tests/test_prices.py`

- [ ] **Step 1:** Write failing tests against a fixture Yahoo `chart` JSON: `parse_chart()` returns rows with `date, open, high, low, close, adj_close, volume`; `None` entries in the quote arrays are dropped rather than becoming NaN rows; dates are ISO strings.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `fetch_daily(ticker, start, end)` hitting `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}` with `interval=1d`, `events=div,splits`, a browser `User-Agent` (Yahoo 429s without one), and `parse_chart()` reading `indicators.quote[0]` + `indicators.adjclose[0]`.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): yahoo daily bar client`.

### Task 8: Alignment (point-in-time join)

**Files:**
- Create: `tools/backtest/oakbt/data/align.py`
- Test: `tools/backtest/tests/test_align.py`

- [ ] **Step 1:** Write failing tests for `align_cot_to_daily(cot_df, dates)`:
  - A report released Fri 01-12 is **absent** on 01-12's bar and **present** from 01-15 (Mon) onward — strict `<`.
  - Values forward-fill until the next release.
  - Bars before the first release are `NaN`, never 0.
  - The holiday case from Task 3 propagates: a Mon 12-02 release first appears on 12-03.
  - Explicit no-lookahead sweep: for every bar and every column, the source row's `released_at < bar_date`.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement using `pd.merge_asof(dates, cot, left_on="date", right_on="released_at", direction="backward", allow_exact_matches=False)` — `allow_exact_matches=False` is what enforces strict `<`. Pivot categories to columns first.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): point-in-time COT to daily alignment`.

### Task 9: Feature registry + COT provider

**Files:**
- Create: `tools/backtest/oakbt/config.py`, `tools/backtest/oakbt/data/features.py`
- Test: `tools/backtest/tests/test_features.py`, `tools/backtest/tests/test_registry.py`

- [ ] **Step 1:** Write failing tests: 3yr COT index is 0.0 at the rolling-window low and 100.0 at the high; a flat series yields 50.0 (not a divide-by-zero); z-score of a known series matches `(x - mean) / std`; registry raises on duplicate `provides` names; `resolve_features(["nope"])` raises `UnknownFeatureError` naming `nope`.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** In `config.py` define `FeatureContext`, `RunConfig`, `ExecutionConfig`, `Trade`, `RunResult`, plus `UnknownFeatureError` and `MissingMarketCodeError`. In `features.py` define the `FeatureProvider` protocol, `REGISTRY`, `register()`, `resolve_features()`, and `CotFeatureProvider` producing `cot_index_{cat}`, `cot_net_{cat}`, `cot_z_{cat}` for categories `lev_money`, `asset_mgr`, `dealer`, `m_money`, `commercial`, plus `oi_index`.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): feature registry and COT feature provider`.

### Task 10: Backfill CLI

**Files:**
- Create: `tools/backtest/oakbt/cli.py`
- Test: `tools/backtest/tests/test_cli.py`

- [ ] **Step 1:** Write failing tests for argument resolution: `--market SP500` → `(ticker="SPY", market_code="SP500", proxy_quality="good")`; `--ticker SPY` → same triple; `--ticker AAPL` → `("AAPL", None, None)`; both or neither raises `SystemExit`.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `argparse` with `backfill` / `run` / `list` subcommands and `resolve_target()`. Wire `backfill` only for now (`--years` default 4, `--markets`, `--cot-only`, `--prices-only`); `run`/`list` raise `NotImplementedError` until Chunk 2.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Run for real: `python -m oakbt.cli backfill --years 4 --markets SP500,GOLD`. Verify rows land in both tables.
- [ ] **Step 6:** Commit `feat(backtest): backfill CLI for COT and price history`.

---

## Chunk 2: Phase 2 — Engine

### Task 11: Metrics

**Files:**
- Create: `tools/backtest/oakbt/engine/metrics.py`, `tools/backtest/oakbt/engine/__init__.py`
- Test: `tools/backtest/tests/test_metrics.py`

- [ ] **Step 1:** Write failing tests with analytically known answers: 252 bars of +0.1%/day → CAGR ≈ `1.001**252 - 1`; a path 100→50→100 → max drawdown `-0.5`; zero-variance returns → Sharpe `0.0` not `inf`/NaN; empty trade list → hit rate `0.0`, profit factor `0.0`; Sortino ignores upside deviation; `time_in_market` counts non-zero positions.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `compute_metrics(equity, trades, benchmark, risk_free=0.045)` returning the full metric dict plus a nested `benchmark` dict. Guard every division.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): performance metrics`.

### Task 12: Risk model

**Files:**
- Create: `tools/backtest/oakbt/engine/risk.py`
- Test: `tools/backtest/tests/test_risk.py`

- [ ] **Step 1:** Write failing tests: on synthetic returns of constant 1% daily vol, vol-targeted weights scale to hit `target_vol` within tolerance; near-zero trailing vol clips at `max_leverage` rather than exploding; `target_vol=None` passes weights through unchanged; sign is preserved for short weights.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `VolTargetRiskModel.apply(weights, df)` using an EWMA of daily returns (`halflife=20`), annualized by `sqrt(252)`, scaling by `target_vol / realized_vol`, then `.clip(-max_leverage, max_leverage)`. Shift the vol estimate by 1 bar so it uses only past data.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): volatility targeting risk model`.

### Task 13: Executor — the bar loop

**Files:**
- Create: `tools/backtest/oakbt/engine/executor.py`
- Test: `tools/backtest/tests/test_executor.py`

The only path-dependent code in the system. Test it hardest.

- [ ] **Step 1:** Write failing tests on hand-built 10-bar frames:
  - `signal_lag=1`: a weight set on bar 2 produces a fill at bar 3's **open**, not bar 2's close.
  - Costs: a flat weight across bars charges cost once (at the change), not every bar.
  - Long P&L: +10% price move on weight 1.0 → equity +10% minus costs.
  - Short P&L sign: -10% price move on weight -1.0 → equity **+10%**.
  - Stop: with a 5% stop, a bar whose **low** breaches the level exits at the stop price on that bar, with `exit_reason="stop"`.
  - A stop and a signal flip on the same bar resolve to the stop (it happens intrabar first).
  - An open position at the end produces a trade with `exit_reason="end_of_data"`.
  - Zero weights throughout → flat equity, no trades.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `run(weights, df, config) -> (equity: pd.Series, trades: list[Trade])`. Single loop over bars: shift weights by `signal_lag`, fill at next open, check stops against the bar's low/high before applying the new target, charge `(commission_bps + slippage_bps)/10000 * |Δweight|`, compound equity, and record `Trade` on every position close.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): bar-loop executor with stops and costs`.

### Task 14: Strategy base + registry + three strategies

**Files:**
- Create: `tools/backtest/oakbt/engine/strategy.py`, `tools/backtest/oakbt/strategies/{__init__,buy_and_hold,cot_index_reversal,cot_net_zscore}.py`
- Test: `tools/backtest/tests/test_strategies.py`

- [ ] **Step 1:** Write failing tests: every registered strategy returns a Series indexed like the input with all values in `[-1, 1]` and no NaN; `buy_and_hold` is all 1.0; `cot_index_reversal` is +1 below the low threshold, -1 above the high, and holds its previous value in between; `cot_net_zscore` respects its neutral band; `get_strategy("nope")` raises naming available strategies.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement the `Strategy` ABC (`name`, `params`, `required_features`, `generate_signals`), a name-keyed `STRATEGIES` registry, and the three strategies.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): strategy registry and three COT strategies`.

### Task 15: Runner + persistence + run CLI

**Files:**
- Create: `tools/backtest/oakbt/engine/runner.py`, `tools/backtest/oakbt/persist/writer.py`
- Modify: `tools/backtest/oakbt/cli.py`
- Test: `tools/backtest/tests/test_runner.py`

- [ ] **Step 1:** Write failing tests with a stubbed store: `run_backtest` raises `UnknownFeatureError` before any simulation when a strategy needs a missing feature; raises `MissingMarketCodeError` for a COT strategy on an unmapped ticker; a successful run returns a `RunResult` whose equity index matches the tradable window; the window is clipped to available price data and `start_date` reflects the clip.
- [ ] **Step 2:** Run — expect ImportError.
- [ ] **Step 3:** Implement `load_frame()` (prices + aligned features, resolution steps 1-4 from the spec) and `run_backtest()`. Implement `writer.persist()`: insert the run row with `status="running"` first, then equity/trades in chunks, then update to `complete` with metrics — or to `failed` with `error` on exception. Capture `code_version` from `git rev-parse --short HEAD`.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Wire `run` and `list` in the CLI.
- [ ] **Step 6:** **Sanity check:** `python -m oakbt.cli run --strategy buy_and_hold --ticker SPY` — the reported CAGR must match SPY's actual return over the window. If it doesn't, the accounting is wrong; stop and fix before continuing.
- [ ] **Step 7:** `python -m oakbt.cli run --strategy cot_index_reversal --market SP500` — expect a `complete` row.
- [ ] **Step 8:** Commit `feat(backtest): runner, persistence, and run CLI`.

### Task 16: Dockerfile, FastAPI shell, README

**Files:**
- Create: `tools/backtest/Dockerfile`, `tools/backtest/oakbt/api.py`

- [ ] **Step 1:** Dockerfile on `python:3.13-slim`, install the package, `ENTRYPOINT ["python", "-m", "oakbt.cli"]`.
- [ ] **Step 2:** `api.py` with FastAPI `POST /runs` and `GET /runs` delegating to `runner`/`store`, guarded by `if __name__ == "__main__"` uvicorn. Not deployed — imports of `fastapi` stay optional so the CLI works without it.
- [ ] **Step 3:** README covering setup, the CLI, and how to add a strategy and a feature provider.
- [ ] **Step 4:** `pytest` — full suite green.
- [ ] **Step 5:** Commit `feat(backtest): dockerfile, optional FastAPI shell, and docs`.

---

## Chunk 3: Phase 3 — Frontend

### Task 17: Types and API routes

**Files:**
- Create: `src/types/backtest.ts`, `src/app/api/backtest/runs/route.ts`, `src/app/api/backtest/runs/[id]/route.ts`
- Reference: `src/lib/apiHandler.ts`, `src/app/api/fundamentals/route.ts`, `src/lib/supabase.ts`

- [ ] **Step 1:** Define `BacktestRun`, `BacktestMetrics`, `EquityPoint`, `BacktestTrade`, `BacktestDetail` in `src/types/backtest.ts`.
- [ ] **Step 2:** Implement the list route with `apiHandler("backtest-runs", ...)`, selecting id/created_at/strategy/ticker/market_code/proxy_quality/status/start_date/end_date/metrics ordered by `created_at desc`, limit 50. Cache header `public, s-maxage=300, stale-while-revalidate=300`.
- [ ] **Step 3:** Implement the detail route: run row + equity + trades in parallel, `ApiError(404, ...)` when the run is missing.
- [ ] **Step 4:** `npx tsc --noEmit` — expect clean.
- [ ] **Step 5:** Commit `feat(backtest): API routes for runs and run detail`.

### Task 18: Service, hooks, formatters

**Files:**
- Create: `src/services/backtestService.ts`, `src/hooks/useBacktestRuns.ts`, `src/hooks/useBacktestRun.ts`, `src/utils/backtestFormat.ts`
- Test: `src/utils/backtestFormat.test.ts`
- Reference: `src/hooks/useCotData.ts` (copy the AbortController template verbatim)

- [ ] **Step 1:** Write failing vitest tests for `formatPct`, `formatRatio`, `formatMetricValue`: null/undefined → `"—"`, `0.1234` → `"12.34%"`, negative sign preserved, `NaN` → `"—"`.
- [ ] **Step 2:** `npm test -- backtestFormat` — expect FAIL.
- [ ] **Step 3:** Implement the formatters, the two fetch wrappers, and the two hooks following `useCotData.ts`.
- [ ] **Step 4:** `npm test -- backtestFormat` — expect PASS.
- [ ] **Step 5:** Commit `feat(backtest): service, hooks, and metric formatters`.

### Task 19: Components

**Files:**
- Create: `src/components/backtesting/{RunList,MetricsGrid,EquityCurveChart,DrawdownChart,TradeLogTable,BacktestLoadingSkeleton}.tsx`
- Reference: `src/components/charts/area-chart.tsx`, `src/components/portfolio/HoldingsTable.tsx`, `src/components/cot/CotLoadingSkeleton.tsx`

Do **not** reuse `PerformanceChart` — it requires `period`/`onPeriodChange` and hardcodes a "Portfolio" legend. See the spec.

- [ ] **Step 1:** `RunList` — clickable rows (strategy, ticker, window, CAGR, Sharpe, max DD, status badge). Failed runs show their `error`. `degraded` proxy quality gets a warning chip.
- [ ] **Step 2:** `MetricsGrid` — metric cards vs benchmark, green/red via `--green-primary`/`--red-primary`.
- [ ] **Step 3:** `EquityCurveChart` — `AreaChart` + two `Area`s (strategy, benchmark) from the visx kit.
- [ ] **Step 4:** `DrawdownChart` — single red underwater area.
- [ ] **Step 5:** `TradeLogTable` — plain `<table>` per `HoldingsTable`, with an `exit_reason` column.
- [ ] **Step 6:** `BacktestLoadingSkeleton` — matches the content heights.
- [ ] **Step 7:** `npx tsc --noEmit` — expect clean. Commit `feat(backtest): result viewer components`.

### Task 20: Page and navigation

**Files:**
- Create: `src/app/backtesting/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Reference: `src/app/cot/page.tsx`

- [ ] **Step 1:** Build the page: `"use client"`, `p-6 max-w-6xl mx-auto` shell, `font-display text-2xl` heading, master-detail (run list; selecting one loads detail), and the four mutually exclusive loading / error+retry / content / empty blocks. Empty state names the CLI command.
- [ ] **Step 2:** Add `{ href: "/backtesting", label: "Backtesting", icon: FlaskConical }` to `NAV_LINKS` and import the icon.
- [ ] **Step 3:** `npm run dev` → visit `/backtesting`. Confirm the list renders, a run opens, and all four charts/tables populate.
- [ ] **Step 4:** Commit `feat(backtest): /backtesting results page and nav link`.

### Task 21: Full verification

- [ ] **Step 1:** `cd tools/backtest && pytest -v` — all green.
- [ ] **Step 2:** `npm test` — all green.
- [ ] **Step 3:** `npm run lint` — clean.
- [ ] **Step 4:** `npm run build` — succeeds.
- [ ] **Step 5:** `git status` — confirm `src/proxy.ts` and the other pre-existing WIP files remain **unstaged**.
- [ ] **Step 6:** Push `feat/backtesting` to origin.
