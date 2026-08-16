"""Shared types and errors.

These live in one place so no engine module has to import another engine module
just to name a type.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import pandas as pd


class UnknownFeatureError(KeyError):
    """A strategy asked for a feature no provider produces."""


class MissingMarketCodeError(ValueError):
    """A COT feature was requested for a ticker with no COT counterpart."""


@dataclass(frozen=True)
class FeatureContext:
    ticker: str
    market_code: str | None
    dataset: str | None
    dates: pd.DatetimeIndex


@dataclass(frozen=True)
class ExecutionConfig:
    """How signals become fills. Defaults are deliberately conservative."""

    # Weights computed on bar t execute at bar t+1's open. See the spec's
    # point-in-time section for why 1 rather than 0.
    signal_lag: int = 1
    commission_bps: float = 1.0
    slippage_bps: float = 2.0
    # Annualized volatility target. None disables vol targeting entirely.
    target_vol: float | None = 0.15
    vol_halflife: int = 20
    max_leverage: float = 2.0
    # Fractional stop (0.08 = 8%) or ATR multiple. None disables stops.
    stop_pct: float | None = None
    stop_atr_mult: float | None = None
    atr_window: int = 14
    trailing_stop: bool = False
    risk_free: float = 0.045
    initial_equity: float = 100.0


@dataclass(frozen=True)
class RunConfig:
    strategy: str
    ticker: str
    market_code: str | None = None
    dataset: str | None = None
    proxy_quality: str | None = None
    params: dict = field(default_factory=dict)
    start: date | None = None
    end: date | None = None
    execution: ExecutionConfig = field(default_factory=ExecutionConfig)


@dataclass
class Trade:
    entry_date: date
    exit_date: date | None
    direction: str  # 'long' | 'short'
    entry_price: float
    exit_price: float | None
    size: float
    pnl: float
    return_pct: float
    exit_reason: str  # 'signal' | 'stop' | 'end_of_data'
    bars_held: int


@dataclass
class RunResult:
    config: RunConfig
    equity: pd.Series
    benchmark: pd.Series
    position: pd.Series
    trades: list[Trade]
    metrics: dict
    code_version: str | None = None
