# oakbt — Oakstock backtesting engine

A general-purpose daily-bar backtester. Strategies plug in as small classes; the
signals they consume are just columns on a DataFrame. The first strategies use
CFTC Commitment of Traders positioning, but nothing in the engine knows what COT
is — technical indicators and fundamental screens are new *feature providers*,
not engine changes.

Design spec: `docs/superpowers/specs/2026-08-15-backtesting-design.md`

## Setup

```bash
cd tools/backtest
pip install -e ".[dev]"
pytest
```

Credentials come from `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`,
falling back to the repo-root `.env.local` — the same convention as
`tools/fetch_13f.py`. Nothing new to configure.

Node is required for price fetching (see *Why Node* below).

## Usage

```bash
# Pull history into Supabase. Idempotent, so re-running is a cheap top-up.
python -m oakbt.cli backfill --years 4
python -m oakbt.cli backfill --years 15 --markets SP500,GOLD   # deeper history

# Run a backtest and save it
python -m oakbt.cli run --strategy cot_index_reversal --market SP500
python -m oakbt.cli run --strategy cot_net_zscore --market GOLD --stop-pct 0.08
python -m oakbt.cli run --strategy buy_and_hold --ticker SPY --target-vol 0

# List saved runs
python -m oakbt.cli list
```

Results land in Supabase and render at `/backtesting`.

`--market` and `--ticker` are mutually exclusive. `--market` resolves the ETF
proxy; `--ticker` reverse-resolves the market when the ticker is a known proxy.

## How a run works

```
load_frame()                      daily OHLCV + point-in-time features
  → Strategy.generate_signals()   target weights in [-1, 1]        (your code)
  → RiskModel.apply()             vol targeting, leverage cap      (vectorized)
  → Executor.run()                the one bar loop: lag, fills, stops, costs
  → compute_metrics()             CAGR, Sharpe, Sortino, maxDD, hit rate, ...
```

Strategies are vectorized and pure, so they are trivial to test. The only
path-dependent code is `Executor` — written once, tested hard, untouched when
strategies are added.

## The thing that matters most

**COT reports describe Tuesday's positions but are not published until Friday
3:30pm ET.** Keying signals off `report_date` hands a strategy three days of
hindsight and manufactures returns that could never have been traded.

`oakbt/data/calendar.py` derives the real publication date (delaying one
business day per intervening federal holiday, which is why Thanksgiving weeks
publish the following Monday), and `oakbt/data/align.py` joins with
`merge_asof(..., allow_exact_matches=False)` so a bar sees only data released
*strictly* before it.

Flipping that one flag to `True` silently grants every backtest three days of
lookahead while still looking plausible. `tests/test_align.py` fails loudly if
anyone does.

## Adding a strategy

1. Create `oakbt/strategies/my_strategy.py`:

```python
from oakbt.engine.strategy import Strategy, threshold_signal

class MyStrategy(Strategy):
    name = "my_strategy"

    def __init__(self, threshold: float = 50.0):
        super().__init__(threshold=threshold)
        self.threshold = threshold

    @property
    def required_features(self) -> list[str]:
        return ["cot_index_lev_money"]

    def generate_signals(self, df):
        return threshold_signal(df["cot_index_lev_money"], 20, 80)
```

2. Register it in `oakbt/strategies/__init__.py`.

`required_features` is checked against the provider registry *before* any
simulation, so a typo fails by name instead of producing an all-NaN signal that
trades nothing and reports a flat curve.

## Adding a feature (e.g. a technical indicator)

This is the seam that makes the framework general — no engine change needed.

```python
# oakbt/data/features.py
class RsiProvider:
    provides = ["rsi_14"]

    def compute(self, ctx, aligned):
        # ctx.ticker, ctx.market_code, ctx.dates
        aligned["rsi_14"] = ...
        return aligned

register(RsiProvider())
```

A strategy then declares `required_features = ["rsi_14"]` and the runner wires
it up. Price-only providers ignore `ctx.market_code`.

## Interpreting results honestly

- **Trade counts are small.** At the default 4-year depth a threshold strategy
  turns over roughly 6–12 times. Sharpe estimated from ~10 trades has a standard
  error wide enough that skill and noise are not separable. Treat results as
  directional. `--years 15` when you want statistical power.
- **USO and UNG are flagged `degraded`.** Both roll front-month futures monthly,
  and in contango that bleeds several percent a year against spot. WTI and
  natural gas results measure the roll as much as the signal.
- **The benchmark enters one bar earlier** than the strategy (bar 0's close vs
  bar 1's open under the default `signal_lag=1`), so tiny differences on a
  buy-and-hold control are expected, not drift.

## Why Node for prices

Yahoo's public chart endpoint now answers plain HTTP clients with 429 on both
query hosts, regardless of User-Agent or cookies — it wants the cookie/crumb
handshake. Rather than reimplement that, `fetch_prices.mjs` uses
`yahoo-finance2`, which the app already depends on and which keeps that working.
`oakbt/data/prices.py` shells out to it and falls back to direct HTTP.

## Layout

```
oakbt/
  config.py            RunConfig, ExecutionConfig, Trade, RunResult, errors
  cli.py               backfill / run / list
  api.py               FastAPI app (built, not deployed)
  data/
    universe.py        market_code -> cftc_name, dataset, ETF proxy, quality
    calendar.py        federal holidays + COT release dates
    cftc.py            paginated Socrata client
    prices.py          daily bars (via fetch_prices.mjs)
    align.py           weekly COT -> daily bars, point-in-time
    features.py        provider registry + COT features
    store.py           Supabase read/write
  engine/
    strategy.py        Strategy ABC
    risk.py            vol targeting
    executor.py        the bar loop
    metrics.py         performance statistics
    runner.py          orchestration + feature resolution
  strategies/          buy_and_hold, cot_index_reversal, cot_net_zscore
  persist/writer.py    run persistence
```
