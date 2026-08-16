"""Always fully long.

Not a real strategy — a control. If buy_and_hold on SPY does not reproduce SPY's
actual return over the window, the accounting is broken and every other result
is noise. Run it first when anything looks surprising.
"""

from __future__ import annotations

import pandas as pd

from oakbt.engine.strategy import Strategy


class BuyAndHold(Strategy):
    name = "buy_and_hold"
    required_features: list[str] = []

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        return pd.Series(1.0, index=df.index)
