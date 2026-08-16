import numpy as np
import pandas as pd
import pytest

from oakbt.config import UnknownFeatureError
from oakbt.engine.rules import (
    RuleSpecError,
    collect_features,
    evaluate,
    validate_spec,
)


@pytest.fixture
def frame():
    idx = pd.bdate_range("2024-01-01", periods=10)
    return pd.DataFrame(
        {
            "cot_index_lev_money": [10.0, 20, 30, 40, 50, 60, 70, 80, 90, 95],
            "cot_z_lev_money": [-2.0, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5],
            "close": np.arange(100.0, 110.0),
        },
        index=idx,
    )


# ── Comparisons ───────────────────────────────────────────────────────────────

def test_lt_compares_feature_against_number(frame):
    out = evaluate({"lt": ["cot_index_lev_money", 35]}, frame)
    assert list(out) == [True, True, True, False, False, False, False, False, False, False]


def test_gt_gte_lte_eq(frame):
    assert evaluate({"gt": ["cot_index_lev_money", 90]}, frame).sum() == 1
    assert evaluate({"gte": ["cot_index_lev_money", 90]}, frame).sum() == 2
    assert evaluate({"lte": ["cot_index_lev_money", 10]}, frame).sum() == 1
    assert evaluate({"eq": ["cot_index_lev_money", 50]}, frame).sum() == 1


def test_two_features_can_be_compared(frame):
    out = evaluate({"gt": ["cot_index_lev_money", "cot_z_lev_money"]}, frame)
    assert out.all()


def test_number_vs_number_is_a_constant_series(frame):
    out = evaluate({"lt": [1, 2]}, frame)
    assert out.all()
    assert len(out) == len(frame)


def test_result_is_boolean_and_index_aligned(frame):
    out = evaluate({"lt": ["cot_index_lev_money", 35]}, frame)
    assert out.dtype == bool
    pd.testing.assert_index_equal(out.index, frame.index)


# ── Logical combination ───────────────────────────────────────────────────────

def test_and_requires_both(frame):
    out = evaluate(
        {"and": [
            {"gt": ["cot_index_lev_money", 20]},
            {"lt": ["cot_index_lev_money", 60]},
        ]},
        frame,
    )
    assert list(out) == [False, False, True, True, True, False, False, False, False, False]


def test_or_requires_either(frame):
    out = evaluate(
        {"or": [
            {"lt": ["cot_index_lev_money", 15]},
            {"gt": ["cot_index_lev_money", 90]},
        ]},
        frame,
    )
    assert out.sum() == 2


def test_not_inverts(frame):
    inner = {"lt": ["cot_index_lev_money", 35]}
    assert (evaluate({"not": inner}, frame) == ~evaluate(inner, frame)).all()


def test_deeply_nested_tree(frame):
    expr = {
        "and": [
            {"or": [
                {"lt": ["cot_index_lev_money", 15]},
                {"gt": ["cot_index_lev_money", 85]},
            ]},
            {"not": {"gt": ["cot_z_lev_money", 2.2]}},
        ]
    }
    out = evaluate(expr, frame)
    # index 0 (10, z=-2.0) qualifies; index 8 (90, z=2.0) qualifies;
    # index 9 (95, z=2.5) is excluded by the `not`.
    assert list(out) == [True, False, False, False, False, False, False, False, True, False]


# ── Crossovers ────────────────────────────────────────────────────────────────

def test_crosses_above_fires_only_on_the_crossing_bar(frame):
    out = evaluate({"crosses_above": ["cot_index_lev_money", 45]}, frame)
    # Series rises 10..95; it crosses 45 once, between bar 3 (40) and bar 4 (50).
    assert out.sum() == 1
    assert out.iloc[4]


def test_crosses_above_is_not_merely_being_above(frame):
    above = evaluate({"gt": ["cot_index_lev_money", 45]}, frame)
    crossing = evaluate({"crosses_above": ["cot_index_lev_money", 45]}, frame)
    assert above.sum() > crossing.sum()


def test_crosses_below(frame):
    falling = frame.assign(cot_index_lev_money=frame["cot_index_lev_money"][::-1].values)
    out = evaluate({"crosses_below": ["cot_index_lev_money", 45]}, falling)
    assert out.sum() == 1


def test_first_bar_never_counts_as_a_crossing(frame):
    out = evaluate({"crosses_above": ["cot_index_lev_money", 5]}, frame)
    # Already above 5 on bar 0 — there is no prior bar, so no crossing.
    assert not out.iloc[0]
    assert out.sum() == 0


# ── Safety: only features and numbers parse ───────────────────────────────────

def test_unknown_feature_raises_by_name(frame):
    with pytest.raises(UnknownFeatureError, match="rsi_14"):
        evaluate({"lt": ["rsi_14", 30]}, frame)


def test_unknown_operator_raises(frame):
    with pytest.raises(RuleSpecError, match="__import__"):
        evaluate({"__import__": ["os", 1]}, frame)


def test_comparison_needs_exactly_two_operands(frame):
    with pytest.raises(RuleSpecError, match="two operands"):
        evaluate({"lt": ["cot_index_lev_money"]}, frame)


def test_non_dict_expression_raises(frame):
    with pytest.raises(RuleSpecError):
        evaluate("cot_index_lev_money < 30", frame)
    with pytest.raises(RuleSpecError):
        evaluate(["lt", "a", 1], frame)


def test_expression_with_multiple_keys_raises(frame):
    with pytest.raises(RuleSpecError, match="exactly one"):
        evaluate({"lt": ["cot_index_lev_money", 5], "gt": ["cot_index_lev_money", 1]}, frame)


def test_operand_of_wrong_type_raises(frame):
    with pytest.raises(RuleSpecError, match="operand"):
        evaluate({"lt": [{"nested": 1}, 5]}, frame)
    with pytest.raises(RuleSpecError, match="operand"):
        evaluate({"lt": [None, 5]}, frame)


def test_missing_column_that_is_a_known_feature_is_a_clear_error(frame):
    # cot_index_m_money is registered but not present on this GOLD-less frame.
    with pytest.raises(RuleSpecError, match="cot_index_m_money"):
        evaluate({"lt": ["cot_index_m_money", 20]}, frame)


# ── Feature collection ────────────────────────────────────────────────────────

def test_collect_features_finds_nested_names():
    expr = {
        "and": [
            {"lt": ["cot_index_lev_money", 20]},
            {"not": {"crosses_above": ["cot_z_lev_money", "cot_oi_index"]}},
        ]
    }
    assert collect_features(expr) == {
        "cot_index_lev_money",
        "cot_z_lev_money",
        "cot_oi_index",
    }


def test_collect_features_ignores_numbers():
    assert collect_features({"lt": [1, 2]}) == set()


# ── Spec validation ───────────────────────────────────────────────────────────

def _spec(**over):
    base = {
        "market": "SP500",
        "rules": [{"when": {"lt": ["cot_index_lev_money", 20]}, "weight": 1.0}],
        "hold_between": True,
    }
    base.update(over)
    return base


def test_valid_spec_passes():
    validate_spec(_spec())


def test_spec_requires_rules_unless_unsupported():
    with pytest.raises(RuleSpecError, match="rules"):
        validate_spec(_spec(rules=[]))
    # An unsupported spec legitimately carries no rules.
    validate_spec(_spec(rules=[], unsupported="needs RSI, which has no provider"))


def test_spec_rejects_out_of_range_weight():
    with pytest.raises(RuleSpecError, match="weight"):
        validate_spec(_spec(rules=[{"when": {"lt": ["cot_index_lev_money", 20]}, "weight": 5}]))


def test_spec_rejects_non_numeric_weight():
    with pytest.raises(RuleSpecError, match="weight"):
        validate_spec(_spec(rules=[{"when": {"lt": ["cot_index_lev_money", 20]}, "weight": "big"}]))


def test_spec_rejects_unknown_market():
    with pytest.raises(RuleSpecError, match="ATLANTIS"):
        validate_spec(_spec(market="ATLANTIS"))


def test_spec_rejects_unknown_feature_before_any_run():
    with pytest.raises(UnknownFeatureError, match="rsi_14"):
        validate_spec(_spec(rules=[{"when": {"lt": ["rsi_14", 30]}, "weight": 1.0}]))


def test_spec_requires_a_market_or_ticker():
    with pytest.raises(RuleSpecError, match="market"):
        validate_spec(_spec(market=None))
