"""Fade statistically extreme net positioning.

Same thesis as cot_index_reversal, measured differently: a z-score responds to
how unusual the current position is relative to its own distribution, rather
than to where it sits between the window's high and low. It is less sensitive to
a single historical outlier defining the range.
"""

from __future__ import annotations

import pandas as pd

from oakbt.engine.strategy import Strategy, threshold_signal


class CotNetZScore(Strategy):
    name = "cot_net_zscore"

    def __init__(self, category: str = "lev_money", threshold: float = 1.5):
        super().__init__(category=category, threshold=threshold)
        self.category = category
        self.threshold = threshold

    @property
    def required_features(self) -> list[str]:
        return [f"cot_z_{self.category}"]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        z = df[f"cot_z_{self.category}"]
        # Crowded long (high z) is faded short, hence the inverted thresholds.
        return threshold_signal(
            z, long_below=-self.threshold, short_above=self.threshold
        )
