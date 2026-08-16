"""Command line entry point.

    python -m oakbt.cli backfill --years 4
    python -m oakbt.cli run --strategy cot_index_reversal --market SP500
    python -m oakbt.cli list
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import date

from oakbt.data import cftc, prices, store
from oakbt.data.universe import MARKETS, all_markets, get_market, market_for_ticker


@dataclass(frozen=True)
class Target:
    ticker: str
    market_code: str | None
    dataset: str | None
    proxy_quality: str | None


def resolve_target(market: str | None, ticker: str | None) -> Target:
    """Exactly one of --market / --ticker. See the spec's CLI section."""
    if bool(market) == bool(ticker):
        raise SystemExit("error: pass exactly one of --market or --ticker")

    if market:
        try:
            m = get_market(market)
        except KeyError as exc:
            raise SystemExit(f"error: {exc}") from None
        return Target(m.proxy, m.market_code, m.dataset, m.proxy_quality)

    m = market_for_ticker(ticker)
    if m is None:
        # Fine for price-only strategies; COT strategies raise later, by name.
        return Target(ticker.upper(), None, None, None)
    return Target(m.proxy, m.market_code, m.dataset, m.proxy_quality)


def parse_params(pairs: list[str]) -> dict:
    """--param k=v, with light coercion so thresholds arrive as numbers."""
    out: dict = {}
    for pair in pairs or []:
        if "=" not in pair:
            raise SystemExit(f"error: --param expects key=value, got {pair!r}")
        key, _, raw = pair.partition("=")
        out[key.strip()] = _coerce(raw.strip())
    return out


# The two report families name the speculator cohort differently: TFF calls it
# Leveraged Funds, disaggregated calls it Managed Money. Asking for lev_money on
# gold produces no column at all, so pick the right default per dataset unless
# the caller was explicit.
DEFAULT_CATEGORY = {"tff": "lev_money", "disaggregated": "m_money",
                    "legacy": "noncommercial"}


def default_category(params: dict, dataset: str | None,
                     strategy_cls: type | None = None) -> dict:
    if "category" in params or not dataset:
        return params
    # buy_and_hold and other price-only strategies take no category.
    if strategy_cls is not None:
        import inspect

        if "category" not in inspect.signature(strategy_cls.__init__).parameters:
            return params
    category = DEFAULT_CATEGORY.get(dataset)
    return {**params, "category": category} if category else params


def _coerce(raw: str):
    low = raw.lower()
    if low in ("true", "false"):
        return low == "true"
    if low in ("none", "null"):
        return None
    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        return raw


# ── backfill ──────────────────────────────────────────────────────────────────

def cmd_backfill(args) -> int:
    since = cftc.years_ago(args.years)
    selected = (
        [get_market(c.strip()) for c in args.markets.split(",")]
        if args.markets
        else all_markets()
    )

    if not args.prices_only:
        for m in selected:
            for dataset in (m.dataset, "legacy"):
                try:
                    rows = cftc.fetch_market(m, dataset, since)
                    written = store.upsert_cot(rows)
                    print(f"  cot  {m.market_code:<12} {dataset:<14} {written:>6} rows")
                except Exception as exc:  # noqa: BLE001 - one market must not kill the run
                    print(f"  cot  {m.market_code:<12} {dataset:<14} FAILED: {exc}")

    if not args.cot_only:
        for m in selected:
            try:
                rows = prices.fetch_daily(m.proxy, since)
                written = store.upsert_prices(rows)
                print(f"  px   {m.proxy:<12} {'':<14} {written:>6} rows")
            except Exception as exc:  # noqa: BLE001
                print(f"  px   {m.proxy:<12} {'':<14} FAILED: {exc}")

    return 0


# ── run / list ────────────────────────────────────────────────────────────────

def cmd_run(args) -> int:
    from oakbt.config import ExecutionConfig, RunConfig
    from oakbt.engine.runner import run_backtest
    from oakbt.persist.writer import persist
    from oakbt.strategies import get_strategy

    target = resolve_target(args.market, args.ticker)
    execution = ExecutionConfig(
        signal_lag=args.signal_lag,
        commission_bps=args.commission_bps,
        slippage_bps=args.slippage_bps,
        # 0 (or negative) disables vol targeting, so a full-notional control run
        # is expressible: --target-vol 0.
        target_vol=args.target_vol if args.target_vol and args.target_vol > 0 else None,
        max_leverage=args.max_leverage,
        stop_pct=args.stop_pct,
        stop_atr_mult=args.stop_atr_mult,
        trailing_stop=args.trailing_stop,
    )
    cfg = RunConfig(
        strategy=args.strategy,
        ticker=target.ticker,
        market_code=target.market_code,
        dataset=target.dataset,
        proxy_quality=target.proxy_quality,
        params=default_category(
            parse_params(args.param), target.dataset, get_strategy(args.strategy)
        ),
        start=date.fromisoformat(args.start) if args.start else None,
        end=date.fromisoformat(args.end) if args.end else None,
        execution=execution,
    )

    result = run_backtest(cfg)
    run_id = persist(result)

    m = result.metrics
    print(f"\n  run {run_id}")
    print(f"  {cfg.strategy} on {cfg.ticker}  "
          f"{result.equity.index[0].date()} → {result.equity.index[-1].date()}")
    print(f"  CAGR {m['cagr']:+.2%}   Sharpe {m['sharpe']:.2f}   "
          f"MaxDD {m['max_drawdown']:.2%}   trades {m['trade_count']}")
    bench = m.get("benchmark") or {}
    if bench:
        print(f"  benchmark  CAGR {bench['cagr']:+.2%}   Sharpe {bench['sharpe']:.2f}"
              f"   MaxDD {bench['max_drawdown']:.2%}")
    return 0


def ensure_data(market_code: str | None, ticker: str, dataset: str | None,
                years: int = 4, log=print) -> None:
    """Backfill anything this run needs that isn't stored yet.

    The loaders are idempotent upserts, so this is safe to call on every run —
    it's a no-op once the market has history.
    """
    from oakbt.data.universe import get_market

    since = cftc.years_ago(years)

    if store.latest_price_date(ticker) is None:
        log(f"  backfilling prices for {ticker}…")
        store.upsert_prices(prices.fetch_daily(ticker, since))

    if market_code and dataset:
        market = get_market(market_code)
        if store.latest_cot_report_date(market_code, dataset) is None:
            log(f"  backfilling {dataset} COT for {market_code}…")
            store.upsert_cot(cftc.fetch_market(market, dataset, since))


def cmd_run_spec(args) -> int:
    """Run a rule spec supplied as JSON on stdin.

    Stdin rather than argv on purpose: the spec originates from a text box, and
    nothing user-authored should ever be assembled into a command line.
    """
    import json

    from oakbt.config import ExecutionConfig, RunConfig
    from oakbt.engine.rules import RuleSpecError, validate_spec
    from oakbt.engine.runner import run_backtest
    from oakbt.persist.writer import persist

    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        return _emit_error(f"invalid JSON on stdin: {exc}")

    spec = payload.get("spec") or payload
    prompt = payload.get("prompt")

    try:
        validate_spec(spec)
    except (RuleSpecError, Exception) as exc:  # noqa: BLE001 - reported as JSON
        return _emit_error(str(exc))

    if spec.get("unsupported"):
        return _emit_error(f"strategy not expressible: {spec['unsupported']}")

    try:
        target = resolve_target(spec.get("market"), spec.get("ticker"))
    except SystemExit as exc:
        return _emit_error(str(exc))

    ex = spec.get("execution") or {}
    execution = ExecutionConfig(
        signal_lag=int(ex.get("signal_lag", 1)),
        commission_bps=float(ex.get("commission_bps", 1.0)),
        slippage_bps=float(ex.get("slippage_bps", 2.0)),
        target_vol=ex.get("target_vol", 0.15),
        max_leverage=float(ex.get("max_leverage", 2.0)),
        stop_pct=ex.get("stop_pct"),
        stop_atr_mult=ex.get("stop_atr_mult"),
        trailing_stop=bool(ex.get("trailing_stop", False)),
    )

    cfg = RunConfig(
        strategy="rule",
        ticker=target.ticker,
        market_code=target.market_code,
        dataset=target.dataset,
        proxy_quality=target.proxy_quality,
        params={"spec": spec},
        start=date.fromisoformat(spec["start"]) if spec.get("start") else None,
        end=date.fromisoformat(spec["end"]) if spec.get("end") else None,
        execution=execution,
    )

    try:
        if not args.no_backfill:
            ensure_data(target.market_code, target.ticker, target.dataset,
                        years=args.years, log=lambda m: print(m, file=sys.stderr))
        result = run_backtest(cfg)
        run_id = persist(result, prompt=prompt, spec=spec)
    except Exception as exc:  # noqa: BLE001 - the bridge needs a JSON error
        return _emit_error(str(exc))

    print(json.dumps({
        "ok": True,
        "run_id": run_id,
        "ticker": cfg.ticker,
        "market_code": cfg.market_code,
        "metrics": _json_safe(result.metrics),
    }))
    return 0


def _emit_error(message: str) -> int:
    import json

    print(json.dumps({"ok": False, "error": message}))
    return 1


def _json_safe(value):
    import math

    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def cmd_list(args) -> int:
    res = (
        store.client()
        .table("backtest_runs")
        .select("id,created_at,strategy,ticker,status,metrics")
        .order("created_at", desc=True)
        .limit(args.limit)
        .execute()
    )
    for row in res.data or []:
        metrics = row.get("metrics") or {}
        cagr = metrics.get("cagr")
        sharpe = metrics.get("sharpe")
        cagr_s = f"{cagr:+.2%}" if isinstance(cagr, (int, float)) else "—"
        sharpe_s = f"{sharpe:.2f}" if isinstance(sharpe, (int, float)) else "—"
        print(f"  {row['id'][:8]}  {row['created_at'][:10]}  "
              f"{row['strategy']:<20} {row['ticker']:<6} {row['status']:<9} "
              f"CAGR {cagr_s:>8}  Sharpe {sharpe_s:>6}")
    return 0


# ── parser ────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="oakbt", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    b = sub.add_parser("backfill", help="pull COT and price history into Supabase")
    b.add_argument("--years", type=int, default=4,
                   help="history depth (default 4, matching the /cot page; "
                        "15 covers the full disaggregated/TFF era)")
    b.add_argument("--markets", help=f"comma-separated, from: {','.join(MARKETS)}")
    b.add_argument("--cot-only", action="store_true")
    b.add_argument("--prices-only", action="store_true")

    r = sub.add_parser("run", help="run a backtest and save the result")
    r.add_argument("--strategy", default="buy_and_hold")
    r.add_argument("--market")
    r.add_argument("--ticker")
    r.add_argument("--start")
    r.add_argument("--end")
    r.add_argument("--param", action="append", default=[], metavar="KEY=VALUE")
    r.add_argument("--signal-lag", type=int, default=1)
    r.add_argument("--commission-bps", type=float, default=1.0)
    r.add_argument("--slippage-bps", type=float, default=2.0)
    r.add_argument("--target-vol", type=float, default=0.15)
    r.add_argument("--max-leverage", type=float, default=2.0)
    r.add_argument("--stop-pct", type=float)
    r.add_argument("--stop-atr-mult", type=float)
    r.add_argument("--trailing-stop", action="store_true")

    rs = sub.add_parser(
        "run-spec",
        help="run a rule spec supplied as JSON on stdin (used by /backtesting)",
    )
    rs.add_argument("--no-backfill", action="store_true",
                    help="fail instead of fetching missing history")
    rs.add_argument("--years", type=int, default=4,
                    help="depth to backfill when data is missing")

    lst = sub.add_parser("list", help="list saved runs")
    lst.add_argument("--limit", type=int, default=20)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return {
        "backfill": cmd_backfill,
        "run": cmd_run,
        "run-spec": cmd_run_spec,
        "list": cmd_list,
    }[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
