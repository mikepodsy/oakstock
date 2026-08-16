import numpy as np
import pandas as pd
import pytest

from oakbt.strategies import STRATEGIES, get_strategy


@pytest.fixture
def frame():
    idx = pd.bdate_range("2022-01-03", periods=400)
    rng = np.random.default_rng(4)
    close = 100 * np.cumprod(1 + rng.normal(0, 0.01, len(idx)))
    return pd.DataFrame(
        {
            "open": close,
            "high": close * 1.01,
            "low": close * 0.99,
            "close": close,
            "cot_index_lev_money": np.linspace(0, 100, len(idx)),
            "cot_z_lev_money": np.linspace(-3, 3, len(idx)),
            "cot_net_lev_money": np.linspace(-5000, 5000, len(idx)),
        },
        index=idx,
    )


def test_registry_is_not_empty():
    assert {"buy_and_hold", "cot_index_reversal", "cot_net_zscore"} <= set(STRATEGIES)


def test_unknown_strategy_raises_and_lists_the_known_ones():
    with pytest.raises(KeyError, match="buy_and_hold"):
        get_strategy("does_not_exist")


@pytest.mark.parametrize("name", ["buy_and_hold", "cot_index_reversal", "cot_net_zscore"])
def test_every_strategy_returns_bounded_aligned_weights(name, frame):
    strategy = get_strategy(name)()
    w = strategy.generate_signals(frame)

    assert isinstance(w, pd.Series)
    pd.testing.assert_index_equal(w.index, frame.index)
    assert w.notna().all(), "weights must never be NaN — the executor would trade 0"
    assert w.between(-1.0, 1.0).all()


@pytest.mark.parametrize("name", ["cot_index_reversal", "cot_net_zscore"])
def test_cot_strategies_declare_their_features(name):
    strategy = get_strategy(name)()
    assert strategy.required_features, f"{name} declares no features"
    assert all(f.startswith("cot_") for f in strategy.required_features)


def test_buy_and_hold_is_always_fully_long(frame):
    w = get_strategy("buy_and_hold")().generate_signals(frame)
    assert (w == 1.0).all()


def test_buy_and_hold_needs_no_features():
    assert get_strategy("buy_and_hold")().required_features == []


# ── cot_index_reversal ────────────────────────────────────────────────────────

def test_index_reversal_goes_long_when_positioning_is_washed_out(frame):
    s = get_strategy("cot_index_reversal")(long_below=20, short_above=80)
    w = s.generate_signals(frame)
    low = frame["cot_index_lev_money"] < 20
    assert (w[low] == 1.0).all()


def test_index_reversal_goes_short_when_positioning_is_crowded(frame):
    s = get_strategy("cot_index_reversal")(long_below=20, short_above=80)
    w = s.generate_signals(frame)
    high = frame["cot_index_lev_money"] > 80
    assert (w[high] == -1.0).all()


def test_index_reversal_holds_its_position_between_thresholds(frame):
    s = get_strategy("cot_index_reversal")(long_below=20, short_above=80)
    w = s.generate_signals(frame)
    # Rising index: long early, hold through the middle, short at the top.
    middle = w[(frame["cot_index_lev_money"] > 30) & (frame["cot_index_lev_money"] < 70)]
    assert set(middle.unique()) <= {1.0}, "should hold the prior long, not flatten"


def test_index_reversal_starts_flat_before_any_threshold_is_crossed():
    idx = pd.bdate_range("2022-01-03", periods=10)
    df = pd.DataFrame({"cot_index_lev_money": [50.0] * 10}, index=idx)
    w = get_strategy("cot_index_reversal")().generate_signals(df)
    assert (w == 0.0).all()


def test_index_reversal_tolerates_missing_early_data():
    idx = pd.bdate_range("2022-01-03", periods=10)
    df = pd.DataFrame(
        {"cot_index_lev_money": [np.nan] * 5 + [10.0, 10.0, 90.0, 90.0, 90.0]},
        index=idx,
    )
    w = get_strategy("cot_index_reversal")().generate_signals(df)
    assert w.notna().all()
    assert (w.iloc[:5] == 0.0).all()
    assert w.iloc[5] == 1.0
    assert w.iloc[-1] == -1.0


def test_index_reversal_category_is_configurable(frame):
    s = get_strategy("cot_index_reversal")(category="m_money")
    assert s.required_features == ["cot_index_m_money"]


# ── cot_net_zscore ────────────────────────────────────────────────────────────

def test_zscore_respects_its_neutral_band(frame):
    s = get_strategy("cot_net_zscore")(threshold=1.5)
    w = s.generate_signals(frame)
    neutral = frame["cot_z_lev_money"].abs() < 1.5
    # Inside the band the strategy holds, so it can only be flat or a prior signal.
    assert w[neutral].isin([-1.0, 0.0, 1.0]).all()


def test_zscore_fades_extremes(frame):
    s = get_strategy("cot_net_zscore")(threshold=1.5)
    w = s.generate_signals(frame)
    # Crowded long (high z) is faded short, and vice versa.
    assert w[frame["cot_z_lev_money"] > 1.5].eq(-1.0).all()
    assert w[frame["cot_z_lev_money"] < -1.5].eq(1.0).all()


def test_params_are_recorded_for_persistence():
    s = get_strategy("cot_index_reversal")(long_below=25, short_above=75)
    assert s.params["long_below"] == 25
    assert s.params["short_above"] == 75
