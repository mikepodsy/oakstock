"""A strategy driven by a rule spec rather than hand-written Python.

This is the bridge between the natural-language composer and the engine. Once
constructed it is an ordinary `Strategy` — the runner, risk model, executor, and
metrics neither know nor care that its signal came from a sentence someone
typed. That's the point: a composed strategy inherits signal lag, vol targeting,
stops, costs, and the point-in-time guarantee for free.
"""

from __future__ import annotations

import pandas as pd

from oakbt.engine.rules import evaluate, spec_features, validate_spec
from oakbt.engine.strategy import Strategy


class RuleStrategy(Strategy):
    name = "rule"

    def __init__(self, spec: dict | None = None, **_ignored):
        if not spec:
            raise ValueError("RuleStrategy needs a `spec`")
        validate_spec(spec)
        super().__init__(spec=spec)
        self.spec = spec

    @property
    def required_features(self) -> list[str]:
        return spec_features(self.spec)

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        unsupported = self.spec.get("unsupported")
        if unsupported:
            raise ValueError(f"this strategy cannot be expressed: {unsupported}")

        rules = self.spec.get("rules") or []
        hold_between = bool(self.spec.get("hold_between", True))

        # NaN marks "no rule matched here" so the hold/flat decision below can
        # tell it apart from a rule that deliberately set 0.
        weights = pd.Series(float("nan"), index=df.index, dtype=float)

        # First match wins: fill only bars still unset by an earlier rule.
        for rule in rules:
            matched = evaluate(rule["when"], df)
            target = float(rule["weight"])
            weights = weights.mask(matched & weights.isna(), target)

        if hold_between:
            weights = weights.ffill()

        # Bars before any rule has ever matched are flat — never forward-filled
        # from nothing, which would invent a position the signal never implied.
        return weights.fillna(0.0).clip(-1.0, 1.0)
