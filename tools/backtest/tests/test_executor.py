import numpy as np
import pandas as pd
import pytest

from oakbt.config import ExecutionConfig
from oakbt.engine.executor import run

NO_COST = ExecutionConfig(
    commission_bps=0.0, slippage_bps=0.0, target_vol=None, signal_lag=1
)


def frame(closes, opens=None, highs=None, lows=None):
    idx = pd.bdate_range("2024-01-01", periods=len(closes))
    closes = np.asarray(closes, dtype=float)
    opens = np.asarray(opens if opens is not None else closes, dtype=float)
    highs = np.asarray(highs if highs is not None else np.maximum(opens, closes),
                       dtype=float)
    lows = np.asarray(lows if lows is not None else np.minimum(opens, closes),
                      dtype=float)
    return pd.DataFrame(
        {"open": opens, "high": highs, "low": lows, "close": closes}, index=idx
    )


def weights(values, df):
    return pd.Series(values, index=df.index, dtype=float)


# ── Lag and fills ─────────────────────────────────────────────────────────────

def test_signal_on_bar_t_fills_at_the_next_bars_open():
    df = frame(closes=[100, 100, 100, 100, 100], opens=[100, 100, 100, 110, 110])
    w = weights([0, 0, 1, 1, 1], df)
    equity, trades = run(w, df, NO_COST)

    # Weight set on bar 2 fills at bar 3's OPEN of 110, so the position is
    # entered there, not at bar 2's close.
    assert trades[0].entry_date == df.index[3].date()
    assert trades[0].entry_price == pytest.approx(110.0)


def test_zero_lag_fills_on_the_same_bars_open():
    df = frame(closes=[100, 100, 100], opens=[100, 105, 105])
    w = weights([1, 1, 1], df)
    _, trades = run(w, df, ExecutionConfig(signal_lag=0, commission_bps=0,
                                           slippage_bps=0, target_vol=None))
    assert trades[0].entry_date == df.index[0].date()


# ── P&L correctness ───────────────────────────────────────────────────────────

def test_long_pnl_tracks_the_price():
    df = frame(closes=[100, 100, 110, 110], opens=[100, 100, 100, 110])
    w = weights([1, 1, 1, 1], df)
    equity, _ = run(w, df, NO_COST)
    # Entered at bar 1's open (100), price ends at 110 -> +10%.
    assert equity.iloc[-1] / equity.iloc[0] - 1 == pytest.approx(0.10, rel=1e-6)


def test_short_pnl_has_the_opposite_sign():
    df = frame(closes=[100, 100, 90, 90], opens=[100, 100, 100, 90])
    w = weights([-1, -1, -1, -1], df)
    equity, _ = run(w, df, NO_COST)
    # Short into a 10% decline earns +10%.
    assert equity.iloc[-1] / equity.iloc[0] - 1 == pytest.approx(0.10, rel=1e-6)


def test_held_position_earns_the_overnight_gap():
    """Regression: accruing only open->close discards every close->open move.

    Here the price only ever moves overnight — each bar opens 10% above the
    previous close and closes flat. A held long must still compound those gaps.
    """
    df = frame(
        closes=[100, 100, 110, 121],
        opens=[100, 100, 110, 121],
    )
    equity, _ = run(weights([1, 1, 1, 1], df), df, NO_COST)
    # Entered at bar 1's open (100), price reaches 121 -> +21%.
    assert equity.iloc[-1] / equity.iloc[0] - 1 == pytest.approx(0.21, rel=1e-6)


def test_buy_and_hold_equals_the_underlying_over_a_random_walk():
    """The strongest accounting check: a full-notional long IS the instrument."""
    rng = np.random.default_rng(99)
    n = 300
    closes = 100 * np.cumprod(1 + rng.normal(0.0003, 0.01, n))
    # Opens gap away from the prior close, so any gap mishandling shows up.
    opens = closes * (1 + rng.normal(0, 0.003, n))
    df = frame(closes=closes, opens=opens,
               highs=np.maximum(opens, closes) * 1.002,
               lows=np.minimum(opens, closes) * 0.998)

    equity, _ = run(weights([1.0] * n, df), df, NO_COST)
    # Position is entered at bar 1's open and held to the final close.
    expected = closes[-1] / opens[1] - 1
    actual = equity.iloc[-1] / equity.iloc[0] - 1
    assert actual == pytest.approx(expected, rel=1e-9)


def test_flat_weights_produce_flat_equity_and_no_trades():
    df = frame(closes=[100, 120, 80, 95])
    equity, trades = run(weights([0, 0, 0, 0], df), df, NO_COST)
    assert trades == []
    assert equity.nunique() == 1


# ── Costs ─────────────────────────────────────────────────────────────────────

def test_costs_are_charged_only_when_the_weight_changes():
    cfg = ExecutionConfig(commission_bps=10.0, slippage_bps=0.0,
                          target_vol=None, signal_lag=1)
    df = frame(closes=[100] * 6)

    held = run(weights([1, 1, 1, 1, 1, 1], df), df, cfg)[0]
    flipped = run(weights([1, 0, 1, 0, 1, 0], df), df, cfg)[0]

    # Both start from one entry; the churning version pays far more.
    assert flipped.iloc[-1] < held.iloc[-1]


def test_cost_magnitude_matches_the_configured_bps():
    cfg = ExecutionConfig(commission_bps=10.0, slippage_bps=0.0,
                          target_vol=None, signal_lag=1)
    df = frame(closes=[100] * 4)
    equity, _ = run(weights([1, 1, 1, 1], df), df, cfg)
    # A single 0 -> 1 change at 10bps on a flat price.
    assert equity.iloc[-1] == pytest.approx(equity.iloc[0] * (1 - 0.001), rel=1e-6)


# ── Stops ─────────────────────────────────────────────────────────────────────

def test_stop_exits_on_the_bar_whose_low_breaches_it():
    cfg = ExecutionConfig(stop_pct=0.05, commission_bps=0.0, slippage_bps=0.0,
                          target_vol=None, signal_lag=1)
    # Enter at 100 on bar 1's open; bar 3 dips to 90, through the 95 stop.
    df = frame(
        closes=[100, 100, 100, 92, 92],
        opens=[100, 100, 100, 99, 92],
        highs=[100, 100, 100, 99, 92],
        lows=[100, 100, 100, 90, 92],
    )
    _, trades = run(weights([1, 1, 1, 1, 1], df), df, cfg)

    assert len(trades) >= 1
    stop_trade = trades[0]
    assert stop_trade.exit_reason == "stop"
    assert stop_trade.exit_date == df.index[3].date()
    assert stop_trade.exit_price == pytest.approx(95.0)


def test_short_stop_triggers_on_the_high():
    cfg = ExecutionConfig(stop_pct=0.05, commission_bps=0.0, slippage_bps=0.0,
                          target_vol=None, signal_lag=1)
    df = frame(
        closes=[100, 100, 100, 108, 108],
        opens=[100, 100, 100, 101, 108],
        highs=[100, 100, 100, 110, 108],
        lows=[100, 100, 100, 101, 108],
    )
    _, trades = run(weights([-1, -1, -1, -1, -1], df), df, cfg)
    assert trades[0].exit_reason == "stop"
    assert trades[0].exit_price == pytest.approx(105.0)


def test_stop_wins_when_a_signal_flip_lands_on_the_same_bar():
    """The stop is hit intrabar, before the close where the flip is observed."""
    cfg = ExecutionConfig(stop_pct=0.05, commission_bps=0.0, slippage_bps=0.0,
                          target_vol=None, signal_lag=1)
    df = frame(
        closes=[100, 100, 100, 92, 92],
        opens=[100, 100, 100, 99, 92],
        highs=[100, 100, 100, 99, 92],
        lows=[100, 100, 100, 90, 92],
    )
    _, trades = run(weights([1, 1, 1, -1, -1], df), df, cfg)
    assert trades[0].exit_reason == "stop"


def test_no_stop_configured_means_no_stop_exits():
    df = frame(
        closes=[100, 100, 100, 50, 50],
        opens=[100, 100, 100, 99, 50],
        lows=[100, 100, 100, 40, 50],
    )
    _, trades = run(weights([1, 1, 1, 1, 1], df), df, NO_COST)
    assert all(t.exit_reason != "stop" for t in trades)


# ── Trade bookkeeping ─────────────────────────────────────────────────────────

def test_open_position_at_the_end_is_closed_as_end_of_data():
    df = frame(closes=[100, 100, 110])
    _, trades = run(weights([1, 1, 1], df), df, NO_COST)
    assert trades[-1].exit_reason == "end_of_data"
    assert trades[-1].exit_date == df.index[-1].date()


def test_signal_exit_is_labelled_signal():
    df = frame(closes=[100, 100, 110, 110, 110])
    _, trades = run(weights([1, 1, 0, 0, 0], df), df, NO_COST)
    assert trades[0].exit_reason == "signal"


def test_direction_and_return_are_recorded_per_trade():
    df = frame(closes=[100, 100, 120, 120], opens=[100, 100, 100, 120])
    _, trades = run(weights([1, 1, 1, 0], df), df, NO_COST)
    t = trades[0]
    assert t.direction == "long"
    assert t.return_pct == pytest.approx(0.20, rel=1e-6)
    assert t.bars_held >= 1


def test_resizing_within_the_same_direction_is_not_a_new_trade():
    """Regression: vol targeting rescales the weight nearly every bar.

    Counting each rescale as a round trip reported ~900 trades for a signal that
    actually turned over about ten times, making trade count and hit rate lies.
    """
    df = frame(closes=[100] * 8)
    w = weights([0.5, 0.6, 0.4, 0.9, 0.7, 0.55, 0.8, 0.65], df)
    _, trades = run(w, df, NO_COST)
    assert len(trades) == 1
    assert trades[0].exit_reason == "end_of_data"


def test_resizing_still_charges_cost_on_the_delta():
    cfg = ExecutionConfig(commission_bps=10.0, slippage_bps=0.0,
                          target_vol=None, signal_lag=1)
    df = frame(closes=[100] * 6)
    steady = run(weights([0.5] * 6, df), df, cfg)[0]
    churny = run(weights([0.5, 1.0, 0.5, 1.0, 0.5, 1.0], df), df, cfg)[0]
    assert churny.iloc[-1] < steady.iloc[-1]


def test_crossing_through_zero_closes_the_trade():
    df = frame(closes=[100] * 6)
    _, trades = run(weights([0.5, 0.5, 0.0, 0.0, 0.5, 0.5], df), df, NO_COST)
    assert len(trades) == 2


def test_a_flip_from_long_to_short_closes_one_trade_and_opens_another():
    df = frame(closes=[100] * 6)
    _, trades = run(weights([1, 1, 1, -1, -1, -1], df), df, NO_COST)
    assert len(trades) == 2
    assert trades[0].direction == "long"
    assert trades[1].direction == "short"


def test_equity_index_matches_the_input_frame():
    df = frame(closes=[100, 101, 102, 103])
    equity, _ = run(weights([0, 1, 1, 1], df), df, NO_COST)
    pd.testing.assert_index_equal(equity.index, df.index)


def test_equity_is_always_finite():
    rng = np.random.default_rng(42)
    closes = 100 * np.cumprod(1 + rng.normal(0, 0.02, 500))
    df = frame(closes=closes)
    w = weights(rng.choice([-1.0, 0.0, 1.0], 500), df)
    equity, _ = run(w, df, ExecutionConfig(target_vol=None))
    assert np.isfinite(equity).all()
    assert (equity > 0).all()
