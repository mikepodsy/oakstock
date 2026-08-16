"""Fade crowded futures positioning.

The COT index places a trader category's net position within its own 3-year
range, 0-100. The premise is that when speculators are maximally long, the
marginal buyer is gone and the trade is crowded — so a reading near 100 is a
short signal, and one near 0 is a long signal.

Whether that premise holds is exactly what the backtest is for.
"""

from __future__ import annotations

import pandas as pd

from oakbt.engine.strategy import Strategy, threshold_signal


class CotIndexReversal(Strategy):
    name = "cot_index_reversal"

    def __init__(self, category: str = "lev_money", long_below: float = 20.0,
                 short_above: float = 80.0):
        super().__init__(
            category=category, long_below=long_below, short_above=short_above
        )
        self.category = category
        self.long_below = long_below
        self.short_above = short_above

    @property
    def required_features(self) -> list[str]:
        return [f"cot_index_{self.category}"]

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        column = f"cot_index_{self.category}"
        return threshold_signal(df[column], self.long_below, self.short_above)
