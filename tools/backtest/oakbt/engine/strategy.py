"""The strategy contract.

A strategy is a pure function from a daily frame to target weights in [-1, 1].
It does not size positions, pay costs, place stops, or know about execution —
the engine owns all of that. What a strategy owns is the opinion.

Keeping it this narrow is what makes strategies a few lines each and testable
without any market data.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd


class Strategy(ABC):
    #: Registry key, also stored on the run row.
    name: str = "unnamed"

    #: Feature columns this strategy needs. The runner resolves these against the
    #: provider registry and raises before simulating if any are unavailable, so
    #: a typo fails loudly instead of yielding an all-NaN signal that trades zero.
    required_features: list[str] = []

    def __init__(self, **params):
        self.params = params

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """Target portfolio weight per bar, in [-1, 1]. Must never return NaN."""

    def __repr__(self) -> str:
        return f"{type(self).__name__}({self.params})"


def threshold_signal(
    series: pd.Series, long_below: float, short_above: float
) -> pd.Series:
    """Long below one threshold, short above another, hold in between.

    Holding rather than flattening in the middle is the point of a positioning
    signal: the thesis is that extremes revert, so the position should persist
    until the opposite extreme, not flicker around the midpoint.
    """
    raw = pd.Series(float("nan"), index=series.index)
    raw[series < long_below] = 1.0
    raw[series > short_above] = -1.0
    return raw.ffill().fillna(0.0)
