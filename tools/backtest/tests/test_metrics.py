import numpy as np
import pandas as pd
import pytest

from oakbt.config import Trade
from oakbt.engine.metrics import compute_metrics, max_drawdown

TRADING_DAYS = 252


def _equity(values, start="2020-01-01"):
    idx = pd.bdate_range(start, periods=len(values))
    return pd.Series(values, index=idx, dtype=float)


def _trade(pnl, ret, entry="2020-01-01", exit_="2020-01-10", reason="signal"):
    return Trade(
        entry_date=pd.Timestamp(entry).date(),
        exit_date=pd.Timestamp(exit_).date(),
        direction="long" if pnl >= 0 else "short",
        entry_price=100.0,
        exit_price=100.0 + pnl,
        size=1.0,
        pnl=pnl,
        return_pct=ret,
        exit_reason=reason,
        bars_held=5,
    )


def test_cagr_matches_a_known_compounding_series():
    # Exactly one year of +0.1% per bar.
    equity = _equity(100.0 * (1.001 ** np.arange(TRADING_DAYS + 1)))
    m = compute_metrics(equity, [], None)
    expected = 1.001**TRADING_DAYS - 1
    assert m["cagr"] == pytest.approx(expected, rel=1e-3)


def test_max_drawdown_of_a_halving_and_recovery():
    assert max_drawdown(_equity([100, 75, 50, 75, 100])) == pytest.approx(-0.5)


def test_max_drawdown_of_a_monotonic_rise_is_zero():
    assert max_drawdown(_equity([100, 110, 120, 130])) == pytest.approx(0.0)


def test_sharpe_of_a_zero_variance_series_is_zero_not_inf():
    m = compute_metrics(_equity([100.0] * 100), [], None)
    assert m["sharpe"] == 0.0
    assert np.isfinite(m["sharpe"])
    assert np.isfinite(m["sortino"])


def test_sortino_ignores_upside_volatility():
    """Two series, same downside, different upside — Sortino must not punish the upside."""
    steady = _equity(100.0 * np.cumprod(np.r_[1.0, np.full(60, 1.001)]))
    spiky = steady.copy()
    spiky.iloc[30:] *= 1.10  # one big upward jump

    m_steady = compute_metrics(steady, [], None)
    m_spiky = compute_metrics(spiky, [], None)
    assert m_spiky["sortino"] >= m_steady["sortino"]


def test_hit_rate_and_profit_factor():
    trades = [_trade(10, 0.10), _trade(-5, -0.05), _trade(20, 0.20), _trade(-5, -0.05)]
    m = compute_metrics(_equity([100, 120]), trades, None)
    assert m["hit_rate"] == pytest.approx(0.5)
    assert m["profit_factor"] == pytest.approx(30 / 10)
    assert m["trade_count"] == 4
    assert m["avg_win"] == pytest.approx(0.15)
    assert m["avg_loss"] == pytest.approx(-0.05)


def test_empty_trade_list_gives_zeros_not_nan():
    m = compute_metrics(_equity([100, 101, 102]), [], None)
    assert m["hit_rate"] == 0.0
    assert m["profit_factor"] == 0.0
    assert m["trade_count"] == 0
    for key, value in m.items():
        if isinstance(value, float):
            assert np.isfinite(value), f"{key} is not finite"


def test_all_winning_trades_do_not_divide_by_zero():
    m = compute_metrics(_equity([100, 130]), [_trade(10, 0.1), _trade(20, 0.2)], [])
    assert m["hit_rate"] == 1.0
    assert np.isfinite(m["profit_factor"])


def test_benchmark_metrics_are_nested():
    equity = _equity([100, 105, 110])
    bench = _equity([100, 102, 104])
    m = compute_metrics(equity, [], bench)
    assert "benchmark" in m
    assert m["benchmark"]["cagr"] < m["cagr"]
    assert "sharpe" in m["benchmark"]


def test_time_in_market_counts_non_zero_positions():
    equity = _equity([100.0] * 10)
    position = pd.Series([0, 0, 1, 1, 1, 0, -1, -1, 0, 0], index=equity.index)
    m = compute_metrics(equity, [], None, position=position)
    assert m["time_in_market"] == pytest.approx(0.5)


def test_turnover_sums_absolute_position_changes():
    equity = _equity([100.0] * 5)
    position = pd.Series([0.0, 1.0, 1.0, -1.0, 0.0], index=equity.index)
    m = compute_metrics(equity, [], None, position=position)
    # |1-0| + |1-1| + |-1-1| + |0-(-1)| = 4
    assert m["turnover"] == pytest.approx(4.0)


def test_single_point_equity_does_not_explode():
    m = compute_metrics(_equity([100.0]), [], None)
    assert np.isfinite(m["cagr"])
    assert m["max_drawdown"] == 0.0


def test_exit_reason_counts_are_reported():
    trades = [_trade(1, 0.01, reason="stop"), _trade(1, 0.01, reason="signal"),
              _trade(1, 0.01, reason="stop")]
    m = compute_metrics(_equity([100, 110]), trades, None)
    assert m["exit_reasons"]["stop"] == 2
    assert m["exit_reasons"]["signal"] == 1
