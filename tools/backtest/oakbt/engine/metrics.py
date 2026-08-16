"""Performance statistics.

Pure functions over an equity curve and a trade list. Every division is guarded:
a backtest that returns inf or NaN for Sharpe is worse than useless, because
those values propagate into the UI and look like results.
"""

from __future__ import annotations

from collections import Counter

import numpy as np
import pandas as pd

from oakbt.config import Trade

TRADING_DAYS = 252

# Floating-point noise means a genuinely flat series has a std of ~1e-18 rather
# than exactly 0. Dividing by that yields a Sharpe of 1e17, which is worse than
# useless because it renders in the UI as if it were a result.
_EPS = 1e-12


def _returns(equity: pd.Series) -> pd.Series:
    return equity.pct_change().dropna()


def cagr(equity: pd.Series) -> float:
    if len(equity) < 2:
        return 0.0
    start, end = float(equity.iloc[0]), float(equity.iloc[-1])
    if start <= 0 or end <= 0:
        return 0.0
    # n observations span n-1 return periods, so 253 daily points is exactly
    # one year, not 253/252 of one.
    years = (len(equity) - 1) / TRADING_DAYS
    if years <= 0:
        return 0.0
    return (end / start) ** (1 / years) - 1


def annualized_vol(equity: pd.Series) -> float:
    r = _returns(equity)
    if len(r) < 2:
        return 0.0
    return float(r.std() * np.sqrt(TRADING_DAYS))


def sharpe(equity: pd.Series, risk_free: float = 0.045) -> float:
    r = _returns(equity)
    if len(r) < 2:
        return 0.0
    excess = r - risk_free / TRADING_DAYS
    sd = excess.std()
    if not np.isfinite(sd) or sd < _EPS:
        return 0.0
    return float(excess.mean() / sd * np.sqrt(TRADING_DAYS))


def sortino(equity: pd.Series, risk_free: float = 0.045) -> float:
    r = _returns(equity)
    if len(r) < 2:
        return 0.0
    excess = r - risk_free / TRADING_DAYS
    downside = excess[excess < 0]
    if len(downside) == 0:
        return 0.0
    dd = downside.std()
    if not np.isfinite(dd) or dd < _EPS:
        return 0.0
    return float(excess.mean() / dd * np.sqrt(TRADING_DAYS))


def max_drawdown(equity: pd.Series) -> float:
    if len(equity) < 2:
        return 0.0
    peak = equity.cummax()
    dd = equity / peak - 1.0
    return float(dd.min())


def drawdown_series(equity: pd.Series) -> pd.Series:
    if equity.empty:
        return equity
    return equity / equity.cummax() - 1.0


def calmar(equity: pd.Series) -> float:
    mdd = max_drawdown(equity)
    if mdd == 0:
        return 0.0
    return float(cagr(equity) / abs(mdd))


def _trade_stats(trades: list[Trade]) -> dict:
    if not trades:
        return {
            "trade_count": 0,
            "hit_rate": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "profit_factor": 0.0,
            "avg_bars_held": 0.0,
            "exit_reasons": {},
        }

    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl <= 0]
    gross_win = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))

    return {
        "trade_count": len(trades),
        "hit_rate": len(wins) / len(trades),
        "avg_win": float(np.mean([t.return_pct for t in wins])) if wins else 0.0,
        "avg_loss": float(np.mean([t.return_pct for t in losses])) if losses else 0.0,
        # No losers means an undefined ratio, not an infinite one.
        "profit_factor": float(gross_win / gross_loss) if gross_loss > 0 else 0.0,
        "avg_bars_held": float(np.mean([t.bars_held for t in trades])),
        "exit_reasons": dict(Counter(t.exit_reason for t in trades)),
    }


def _core(equity: pd.Series, risk_free: float) -> dict:
    return {
        "total_return": (
            float(equity.iloc[-1] / equity.iloc[0] - 1) if len(equity) > 1 else 0.0
        ),
        "cagr": cagr(equity),
        "volatility": annualized_vol(equity),
        "sharpe": sharpe(equity, risk_free),
        "sortino": sortino(equity, risk_free),
        "max_drawdown": max_drawdown(equity),
        "calmar": calmar(equity),
    }


def compute_metrics(
    equity: pd.Series,
    trades: list[Trade],
    benchmark: pd.Series | None = None,
    position: pd.Series | None = None,
    risk_free: float = 0.045,
) -> dict:
    metrics = _core(equity, risk_free)
    metrics.update(_trade_stats(trades))

    if position is not None and len(position) > 0:
        metrics["time_in_market"] = float((position != 0).mean())
        metrics["turnover"] = float(position.diff().abs().sum())
    else:
        metrics["time_in_market"] = 0.0
        metrics["turnover"] = 0.0

    if benchmark is not None and len(benchmark) > 1:
        metrics["benchmark"] = _core(benchmark, risk_free)
        metrics["excess_cagr"] = metrics["cagr"] - metrics["benchmark"]["cagr"]

    return metrics
