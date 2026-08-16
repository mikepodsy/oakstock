"""Orchestration: config in, RunResult out.

Also owns feature resolution — the seam between "what a strategy asks for" and
"what a provider produces". Resolution happens *before* any simulation so a
missing feature is a loud error rather than an all-NaN signal that silently
trades nothing and reports a flat equity curve.
"""

from __future__ import annotations

import subprocess
from datetime import date

import pandas as pd

from oakbt.config import (
    MissingMarketCodeError,
    RunConfig,
    RunResult,
)
from oakbt.data import store
from oakbt.data.align import align_cot_to_daily
from oakbt.data.features import resolve_providers
from oakbt.engine import executor, metrics as metrics_mod
from oakbt.engine.risk import VolTargetRiskModel
from oakbt.engine.strategy import Strategy
from oakbt.strategies import get_strategy

OHLC = ("open", "high", "low", "close")


def code_version() -> str | None:
    """Git SHA of the code that produced a run, so a chart traces back to it."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=10,
        )
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def build_strategy(cfg: RunConfig) -> Strategy:
    return get_strategy(cfg.strategy)(**cfg.params)


def load_frame(cfg: RunConfig, strategy: Strategy) -> pd.DataFrame:
    """Daily OHLCV joined to point-in-time features the strategy asked for."""
    # Resolve first: a bad feature name must fail before we touch the network.
    providers = resolve_providers(strategy.required_features)

    if providers and not cfg.market_code:
        raise MissingMarketCodeError(
            f"{cfg.strategy} needs {strategy.required_features} but {cfg.ticker} "
            f"has no COT market. Pass --market, or use a ticker that is a known proxy."
        )

    prices = store.load_prices(cfg.ticker, cfg.start, cfg.end)
    if prices.empty:
        raise ValueError(
            f"no price history for {cfg.ticker}. Run: "
            f"python -m oakbt.cli backfill --markets {cfg.market_code or ''}"
        )

    frame = prices[list(OHLC)].copy()

    if providers:
        cot = store.load_cot(cfg.market_code, cfg.dataset or "tff", cfg.start, cfg.end)
        aligned = align_cot_to_daily(cot, frame.index)
        ctx_dates = frame.index
        from oakbt.config import FeatureContext

        ctx = FeatureContext(
            ticker=cfg.ticker,
            market_code=cfg.market_code,
            dataset=cfg.dataset,
            dates=ctx_dates,
        )
        for provider in providers:
            aligned = provider.compute(ctx, aligned)

        missing = [c for c in strategy.required_features if c not in aligned.columns]
        if missing:
            raise ValueError(
                f"features {missing} were not produced — is there COT data for "
                f"{cfg.market_code}/{cfg.dataset}? Try: python -m oakbt.cli backfill"
            )
        frame = frame.join(aligned[strategy.required_features], how="left")

        # Only trade once the signal actually exists. Bars before the first
        # release have no information, and treating them as flat would count
        # them as a deliberate decision.
        first_valid = frame[strategy.required_features].dropna().index
        if len(first_valid) == 0:
            raise ValueError(
                f"no overlapping COT and price history for {cfg.ticker}."
            )
        frame = frame.loc[first_valid[0] :]

    return frame.dropna(subset=list(OHLC))


def run_backtest(cfg: RunConfig) -> RunResult:
    strategy = build_strategy(cfg)
    frame = load_frame(cfg, strategy)

    raw_weights = strategy.generate_signals(frame).reindex(frame.index).fillna(0.0)
    sized = VolTargetRiskModel(cfg.execution).apply(raw_weights, frame).fillna(0.0)

    equity, trades = executor.run(sized, frame, cfg.execution)
    position = executor.position_series(sized, frame, cfg.execution)

    # Benchmark is buy-and-hold of the same instrument over the same window, so
    # the comparison isolates the signal rather than the market.
    close = frame["close"]
    benchmark = cfg.execution.initial_equity * (close / close.iloc[0])

    stats = metrics_mod.compute_metrics(
        equity, trades, benchmark, position=position,
        risk_free=cfg.execution.risk_free,
    )

    return RunResult(
        config=cfg,
        equity=equity,
        benchmark=benchmark,
        position=position,
        trades=trades,
        metrics=stats,
        code_version=code_version(),
    )


def window_of(result: RunResult) -> tuple[date, date]:
    return result.equity.index[0].date(), result.equity.index[-1].date()
