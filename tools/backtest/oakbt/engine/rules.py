"""The rule DSL: a typed expression tree that compiles to boolean Series.

This is what lets a strategy be described in English without anyone executing
generated code. An expression is a one-key dict; an operand is either a
*registered feature name* or a number. Nothing else parses — no arithmetic, no
attribute access, no callables, no eval. A hostile or hallucinated spec fails
validation instead of doing anything.

Deliberately small. Every form below is one the composer can be trusted to emit
correctly and a reader can verify at a glance.
"""

from __future__ import annotations

from numbers import Real
from typing import Any

import pandas as pd

from oakbt.config import UnknownFeatureError
from oakbt.data.features import available_features
from oakbt.data.universe import MARKETS, market_for_ticker


class RuleSpecError(ValueError):
    """A rule spec is structurally invalid."""


COMPARISONS = {
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "eq": lambda a, b: a == b,
}
LOGICAL = ("and", "or", "not")
CROSSINGS = ("crosses_above", "crosses_below")

MAX_DEPTH = 12


def _is_number(value: Any) -> bool:
    # bool is a subclass of int; a bare True is not a valid operand.
    return isinstance(value, Real) and not isinstance(value, bool)


def _resolve_operand(operand: Any, df: pd.DataFrame) -> pd.Series:
    """A feature name or a number — nothing else."""
    if _is_number(operand):
        return pd.Series(float(operand), index=df.index)

    if isinstance(operand, str):
        if operand not in available_features():
            raise UnknownFeatureError(
                f"unknown feature {operand!r}. Available: "
                f"{', '.join(available_features())}"
            )
        if operand not in df.columns:
            raise RuleSpecError(
                f"feature {operand!r} is registered but absent from this frame — "
                f"it likely belongs to a different COT dataset than this market's"
            )
        return pd.to_numeric(df[operand], errors="coerce")

    raise RuleSpecError(
        f"invalid operand {operand!r}: expected a feature name or a number"
    )


def evaluate(expr: Any, df: pd.DataFrame, _depth: int = 0) -> pd.Series:
    """Compile an expression to a boolean Series indexed like `df`."""
    if _depth > MAX_DEPTH:
        raise RuleSpecError(f"expression nested deeper than {MAX_DEPTH} levels")

    if not isinstance(expr, dict):
        raise RuleSpecError(
            f"invalid expression {expr!r}: expected an object like "
            '{"lt": ["cot_index_lev_money", 20]}'
        )
    if len(expr) != 1:
        raise RuleSpecError(
            f"expression must have exactly one operator, got {sorted(expr)}"
        )

    (op, args), = expr.items()

    if op in COMPARISONS:
        if not isinstance(args, (list, tuple)) or len(args) != 2:
            raise RuleSpecError(f"{op!r} takes exactly two operands")
        left = _resolve_operand(args[0], df)
        right = _resolve_operand(args[1], df)
        # NaN comparisons are False, which is what we want: an unformed feature
        # window must not trigger a rule.
        return COMPARISONS[op](left, right).fillna(False).astype(bool)

    if op in CROSSINGS:
        if not isinstance(args, (list, tuple)) or len(args) != 2:
            raise RuleSpecError(f"{op!r} takes exactly two operands")
        left = _resolve_operand(args[0], df)
        right = _resolve_operand(args[1], df)
        prev_left, prev_right = left.shift(1), right.shift(1)
        if op == "crosses_above":
            crossed = (prev_left <= prev_right) & (left > right)
        else:
            crossed = (prev_left >= prev_right) & (left < right)
        # The first bar has no predecessor, so it can never be a crossing.
        return crossed.fillna(False).astype(bool)

    if op == "not":
        return ~evaluate(args, df, _depth + 1)

    if op in ("and", "or"):
        if not isinstance(args, (list, tuple)) or len(args) < 2:
            raise RuleSpecError(f"{op!r} takes a list of at least two expressions")
        parts = [evaluate(a, df, _depth + 1) for a in args]
        out = parts[0]
        for part in parts[1:]:
            out = (out & part) if op == "and" else (out | part)
        return out.astype(bool)

    raise RuleSpecError(
        f"unknown operator {op!r}. Supported: "
        f"{', '.join(sorted([*COMPARISONS, *LOGICAL, *CROSSINGS]))}"
    )


def collect_features(expr: Any, _depth: int = 0) -> set[str]:
    """Every feature name referenced anywhere in the tree."""
    if _depth > MAX_DEPTH or not isinstance(expr, dict) or len(expr) != 1:
        return set()

    (op, args), = expr.items()

    if op in COMPARISONS or op in CROSSINGS:
        if not isinstance(args, (list, tuple)):
            return set()
        return {a for a in args if isinstance(a, str)}

    if op == "not":
        return collect_features(args, _depth + 1)

    if op in ("and", "or") and isinstance(args, (list, tuple)):
        found: set[str] = set()
        for a in args:
            found |= collect_features(a, _depth + 1)
        return found

    return set()


def validate_spec(spec: dict) -> None:
    """Reject a bad spec before anything touches the network or the engine."""
    if not isinstance(spec, dict):
        raise RuleSpecError("spec must be an object")

    unsupported = spec.get("unsupported")
    rules = spec.get("rules") or []

    if not isinstance(rules, list):
        raise RuleSpecError("`rules` must be a list")

    # A spec that declares itself inexpressible legitimately carries no rules.
    if not rules and not unsupported:
        raise RuleSpecError("spec has no `rules` and no `unsupported` explanation")

    market = spec.get("market")
    ticker = spec.get("ticker")
    if not unsupported:
        if not market and not ticker:
            raise RuleSpecError("spec needs a `market` or a `ticker`")
        if market and market.upper() not in MARKETS:
            raise RuleSpecError(
                f"unknown market {market!r}. Known: {', '.join(sorted(MARKETS))}"
            )
        if ticker and not market and market_for_ticker(ticker) is None:
            # Allowed — price-only strategies can name any ticker — but a rule
            # spec referencing COT features on an unmapped ticker fails later.
            pass

    for i, rule in enumerate(rules):
        if not isinstance(rule, dict):
            raise RuleSpecError(f"rule {i} must be an object")
        if "when" not in rule:
            raise RuleSpecError(f"rule {i} is missing `when`")

        weight = rule.get("weight")
        if not _is_number(weight):
            raise RuleSpecError(f"rule {i} has a non-numeric `weight`: {weight!r}")
        if not -1.0 <= float(weight) <= 1.0:
            raise RuleSpecError(
                f"rule {i} `weight` must be within [-1, 1], got {weight}"
            )

        # Walk the tree: unknown operators, malformed nodes, and hallucinated
        # feature names all surface here rather than mid-simulation.
        _validate_expr(rule["when"])


def _validate_expr(expr: Any, _depth: int = 0) -> None:
    if _depth > MAX_DEPTH:
        raise RuleSpecError(f"expression nested deeper than {MAX_DEPTH} levels")
    if not isinstance(expr, dict) or len(expr) != 1:
        raise RuleSpecError(
            f"invalid expression {expr!r}: expected an object with exactly one operator"
        )

    (op, args), = expr.items()

    if op in COMPARISONS or op in CROSSINGS:
        if not isinstance(args, (list, tuple)) or len(args) != 2:
            raise RuleSpecError(f"{op!r} takes exactly two operands")
        for operand in args:
            if _is_number(operand):
                continue
            if isinstance(operand, str):
                if operand not in available_features():
                    raise UnknownFeatureError(
                        f"unknown feature {operand!r}. Available: "
                        f"{', '.join(available_features())}"
                    )
                continue
            raise RuleSpecError(
                f"invalid operand {operand!r}: expected a feature name or a number"
            )
        return

    if op == "not":
        _validate_expr(args, _depth + 1)
        return

    if op in ("and", "or"):
        if not isinstance(args, (list, tuple)) or len(args) < 2:
            raise RuleSpecError(f"{op!r} takes a list of at least two expressions")
        for a in args:
            _validate_expr(a, _depth + 1)
        return

    raise RuleSpecError(
        f"unknown operator {op!r}. Supported: "
        f"{', '.join(sorted([*COMPARISONS, *LOGICAL, *CROSSINGS]))}"
    )


def spec_features(spec: dict) -> list[str]:
    """Every feature the spec needs, for the runner's resolution step."""
    found: set[str] = set()
    for rule in spec.get("rules") or []:
        found |= collect_features(rule.get("when"))
    return sorted(found)
