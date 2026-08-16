import numpy as np
import pandas as pd
import pytest

from oakbt.strategies import get_strategy
from oakbt.strategies.rule_strategy import RuleStrategy


@pytest.fixture
def frame():
    idx = pd.bdate_range("2024-01-01", periods=10)
    return pd.DataFrame(
        {
            "cot_index_lev_money": [10.0, 20, 30, 40, 50, 60, 70, 80, 90, 95],
            "cot_z_lev_money": [-2.0, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5],
        },
        index=idx,
    )


def _spec(**over):
    base = {
        "market": "SP500",
        "rules": [
            {"when": {"lt": ["cot_index_lev_money", 25]}, "weight": 1.0},
            {"when": {"gt": ["cot_index_lev_money", 85]}, "weight": -1.0},
        ],
        "hold_between": True,
    }
    base.update(over)
    return base


def test_registered_in_the_strategy_registry():
    assert get_strategy("rule") is RuleStrategy


def test_first_matching_rule_wins(frame):
    # Two rules both match low readings; the first listed should decide.
    spec = _spec(rules=[
        {"when": {"lt": ["cot_index_lev_money", 50]}, "weight": 0.5},
        {"when": {"lt": ["cot_index_lev_money", 25]}, "weight": -1.0},
    ], hold_between=False)
    w = RuleStrategy(spec=spec).generate_signals(frame)
    assert w.iloc[0] == 0.5, "later rule overrode an earlier match"


def test_hold_between_forward_fills_the_prior_weight(frame):
    w = RuleStrategy(spec=_spec(hold_between=True)).generate_signals(frame)
    # Long below 25 (bars 0-1), then nothing matches until >85 (bars 8-9).
    assert w.iloc[0] == 1.0
    assert w.iloc[4] == 1.0, "should hold the prior long"
    assert w.iloc[8] == -1.0
    assert w.iloc[9] == -1.0


def test_hold_between_false_goes_flat(frame):
    w = RuleStrategy(spec=_spec(hold_between=False)).generate_signals(frame)
    assert w.iloc[0] == 1.0
    assert w.iloc[4] == 0.0, "should flatten when no rule matches"
    assert w.iloc[8] == -1.0


def test_bars_before_the_first_match_are_flat_not_forward_filled():
    idx = pd.bdate_range("2024-01-01", periods=6)
    df = pd.DataFrame({"cot_index_lev_money": [50.0, 50, 50, 10, 10, 10]}, index=idx)
    w = RuleStrategy(spec=_spec()).generate_signals(df)
    assert (w.iloc[:3] == 0.0).all(), "invented a position before any signal existed"
    assert (w.iloc[3:] == 1.0).all()


def test_weights_are_clipped_to_the_unit_range(frame):
    # validate_spec rejects out-of-range weights, but the strategy clips too so
    # a spec that bypasses validation still can't produce a 5x position.
    spec = _spec(rules=[{"when": {"lt": ["cot_index_lev_money", 100]}, "weight": 1.0}])
    w = RuleStrategy(spec=spec).generate_signals(frame)
    assert w.between(-1.0, 1.0).all()


def test_output_is_index_aligned_and_nan_free(frame):
    w = RuleStrategy(spec=_spec()).generate_signals(frame)
    pd.testing.assert_index_equal(w.index, frame.index)
    assert w.notna().all()
    assert w.dtype == float


def test_required_features_collects_every_referenced_name():
    spec = _spec(rules=[
        {"when": {"and": [
            {"lt": ["cot_index_lev_money", 20]},
            {"gt": ["cot_z_lev_money", -3]},
        ]}, "weight": 1.0},
        {"when": {"crosses_above": ["cot_oi_index", 80]}, "weight": -1.0},
    ])
    assert set(RuleStrategy(spec=spec).required_features) == {
        "cot_index_lev_money",
        "cot_z_lev_money",
        "cot_oi_index",
    }


def test_fractional_weights_are_preserved(frame):
    spec = _spec(rules=[{"when": {"lt": ["cot_index_lev_money", 25]}, "weight": 0.4}],
                 hold_between=False)
    w = RuleStrategy(spec=spec).generate_signals(frame)
    assert w.iloc[0] == pytest.approx(0.4)


def test_an_unsupported_spec_refuses_to_run(frame):
    spec = _spec(rules=[], unsupported="needs RSI, which no provider produces")
    with pytest.raises(ValueError, match="RSI"):
        RuleStrategy(spec=spec).generate_signals(frame)


def test_params_carry_the_spec_for_persistence():
    strategy = RuleStrategy(spec=_spec())
    assert strategy.params["spec"]["market"] == "SP500"


def test_crossover_rule_produces_a_one_bar_signal(frame):
    spec = _spec(
        rules=[{"when": {"crosses_above": ["cot_index_lev_money", 45]}, "weight": 1.0}],
        hold_between=False,
    )
    w = RuleStrategy(spec=spec).generate_signals(frame)
    assert (w != 0).sum() == 1


def test_crossover_rule_with_hold_between_stays_on(frame):
    spec = _spec(
        rules=[{"when": {"crosses_above": ["cot_index_lev_money", 45]}, "weight": 1.0}],
        hold_between=True,
    )
    w = RuleStrategy(spec=spec).generate_signals(frame)
    assert (w.iloc[4:] == 1.0).all()


def test_invalid_spec_raises_at_construction():
    from oakbt.engine.rules import RuleSpecError

    with pytest.raises(RuleSpecError):
        RuleStrategy(spec={"market": "SP500", "rules": [{"when": {"nope": [1, 2]},
                                                        "weight": 1.0}]})


def test_rejects_a_missing_spec():
    with pytest.raises(ValueError, match="spec"):
        RuleStrategy(spec=None)


def test_handles_a_frame_with_nan_features():
    idx = pd.bdate_range("2024-01-01", periods=6)
    df = pd.DataFrame(
        {"cot_index_lev_money": [np.nan, np.nan, 10.0, 10.0, 90.0, 90.0]}, index=idx
    )
    w = RuleStrategy(spec=_spec()).generate_signals(df)
    assert w.notna().all()
    # NaN bars must not trigger a rule.
    assert (w.iloc[:2] == 0.0).all()
    assert w.iloc[2] == 1.0
