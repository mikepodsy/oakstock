"""Position sizing.

Vol targeting is what makes a weight of 1.0 mean the same thing across
instruments. Without it, "fully long GLD" and "fully long UNG" are wildly
different bets, and a multi-market comparison measures the instruments'
volatility rather than the signal's skill.

Vectorized on purpose: everything here is a function of trailing data, so it
needs no bar loop. The one path-dependent concern (stops) lives in executor.py.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from oakbt.config import ExecutionConfig

TRADING_DAYS = 252
_EPS = 1e-8


def realized_vol(df: pd.DataFrame, halflife: int = 20) -> pd.Series:
    """Annualized EWMA volatility, shifted so a bar never sees its own move.

    The shift matters: sizing off a window that includes today means the model
    shrinks the position on the very bar the loss happens, which is not
    something you could have done in real time.
    """
    returns = df["close"].pct_change()
    vol = returns.ewm(halflife=halflife, min_periods=10).std() * np.sqrt(TRADING_DAYS)
    return vol.shift(1)


class VolTargetRiskModel:
    def __init__(self, config: ExecutionConfig):
        self.config = config

    def apply(self, weights: pd.Series, df: pd.DataFrame) -> pd.Series:
        cfg = self.config
        if cfg.target_vol is None:
            return weights

        vol = realized_vol(df, cfg.vol_halflife).reindex(weights.index)

        # A flat or near-flat window would ask for infinite size; cap it instead.
        scale = pd.Series(cfg.max_leverage, index=weights.index, dtype=float)
        usable = vol > _EPS
        scale[usable] = cfg.target_vol / vol[usable]
        scale = scale.clip(upper=cfg.max_leverage)

        scaled = weights * scale
        return scaled.clip(-cfg.max_leverage, cfg.max_leverage)
