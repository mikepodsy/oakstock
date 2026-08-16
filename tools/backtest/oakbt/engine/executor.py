"""The bar loop — the only path-dependent code in the engine.

Everything else (signals, vol targeting, metrics) is a vectorized function of
its inputs. Stops are not: whether Tuesday's stop fires depends on Monday's
fill. That single fact is why this loop exists, and why it is kept as small as
possible and tested harder than anything else here.

Ordering within a bar matters and is deliberate:
  1. Check the stop against this bar's low/high — it happens intrabar, before
     any close-based signal could be observed.
  2. Apply the lagged target weight at this bar's open.
  3. Accrue P&L from the open to the close on whatever position is held.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from oakbt.config import ExecutionConfig, Trade


def _atr(df: pd.DataFrame, window: int) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr.rolling(window, min_periods=1).mean()


def _stop_level(entry_price: float, direction: int, cfg: ExecutionConfig,
                atr_value: float) -> float | None:
    """Price at which the position is closed. None when stops are disabled."""
    if cfg.stop_pct is not None:
        distance = entry_price * cfg.stop_pct
    elif cfg.stop_atr_mult is not None and np.isfinite(atr_value):
        distance = atr_value * cfg.stop_atr_mult
    else:
        return None
    return entry_price - distance if direction > 0 else entry_price + distance


def run(
    weights: pd.Series, df: pd.DataFrame, config: ExecutionConfig
) -> tuple[pd.Series, list[Trade]]:
    """Simulate. Returns (equity curve indexed like df, closed trades)."""
    cfg = config
    targets = weights.reindex(df.index).fillna(0.0)
    if cfg.signal_lag:
        targets = targets.shift(cfg.signal_lag).fillna(0.0)

    opens = df["open"].to_numpy(dtype=float)
    highs = df["high"].to_numpy(dtype=float)
    lows = df["low"].to_numpy(dtype=float)
    closes = df["close"].to_numpy(dtype=float)
    target_w = targets.to_numpy(dtype=float)
    atr = _atr(df, cfg.atr_window).to_numpy(dtype=float)

    cost_rate = (cfg.commission_bps + cfg.slippage_bps) / 10_000.0

    equity = np.empty(len(df), dtype=float)
    position = np.zeros(len(df), dtype=float)

    cash_equity = cfg.initial_equity
    weight = 0.0           # currently held target weight
    entry_price = np.nan
    entry_idx: int | None = None
    stop_level: float | None = None
    trades: list[Trade] = []

    def close_trade(i: int, exit_price: float, reason: str) -> None:
        nonlocal weight, entry_price, entry_idx, stop_level
        direction = 1 if weight > 0 else -1
        ret = (exit_price / entry_price - 1.0) * direction
        trades.append(
            Trade(
                entry_date=df.index[entry_idx].date(),
                exit_date=df.index[i].date(),
                direction="long" if direction > 0 else "short",
                entry_price=float(entry_price),
                exit_price=float(exit_price),
                size=abs(weight),
                pnl=float(ret * abs(weight) * cfg.initial_equity),
                return_pct=float(ret),
                exit_reason=reason,
                bars_held=i - entry_idx,
            )
        )
        weight = 0.0
        entry_price = np.nan
        entry_idx = None
        stop_level = None

    for i in range(len(df)):
        bar_open, bar_close = opens[i], closes[i]
        ref_price = bar_open if np.isfinite(bar_open) else bar_close

        # 1. Overnight gap, earned by the position carried into this bar.
        #    Skipping this would silently discard every close-to-open move — for
        #    an always-invested strategy that is most of the return.
        if i > 0 and weight != 0.0:
            prev_close = closes[i - 1]
            if np.isfinite(prev_close) and prev_close > 0:
                cash_equity *= 1.0 + (ref_price / prev_close - 1.0) * weight

        # 2. Execute the lagged target at this bar's open. The target came from
        #    the previous bar's close, so it is known before this open.
        desired = target_w[i]
        if desired != weight:
            cash_equity *= 1.0 - cost_rate * abs(desired - weight)

            desired_dir = 0 if desired == 0.0 else (1 if desired > 0 else -1)
            current_dir = 0 if weight == 0.0 else (1 if weight > 0 else -1)

            if desired_dir != current_dir:
                # A genuine entry, exit, or reversal.
                if weight != 0.0:
                    close_trade(i, ref_price, "signal")
                weight = desired
                if desired != 0.0:
                    entry_price = ref_price
                    entry_idx = i
                    stop_level = _stop_level(ref_price, desired_dir, cfg, atr[i])
            else:
                # Same direction, different size — vol targeting rescales the
                # position on almost every bar. Treating that as a round trip
                # would report thousands of "trades" for a weekly signal and
                # make hit rate and trade count meaningless. Resize in place;
                # the trade stays open and its stop keeps its original level.
                weight = desired

        # 3. Stop check — intrabar, against this bar's extremes.
        if weight != 0.0 and stop_level is not None:
            hit = lows[i] <= stop_level if weight > 0 else highs[i] >= stop_level
            if hit and np.isfinite(ref_price) and ref_price > 0:
                cash_equity *= 1.0 + (stop_level / ref_price - 1.0) * weight
                cash_equity *= 1.0 - cost_rate * abs(weight)
                close_trade(i, stop_level, "stop")
                position[i] = 0.0
                equity[i] = cash_equity
                continue

        # 4. Accrue the remainder of the bar, open to close.
        if weight != 0.0 and np.isfinite(ref_price) and ref_price > 0:
            cash_equity *= 1.0 + (bar_close / ref_price - 1.0) * weight

            # Trail the stop up (long) or down (short) behind the close.
            if cfg.trailing_stop and stop_level is not None:
                trailed = _stop_level(bar_close, 1 if weight > 0 else -1, cfg, atr[i])
                if trailed is not None:
                    stop_level = (
                        max(stop_level, trailed) if weight > 0
                        else min(stop_level, trailed)
                    )

        position[i] = weight
        equity[i] = cash_equity

    if weight != 0.0 and entry_idx is not None:
        close_trade(len(df) - 1, closes[-1], "end_of_data")

    return (
        pd.Series(equity, index=df.index, name="equity"),
        trades,
    )


def position_series(weights: pd.Series, df: pd.DataFrame,
                    config: ExecutionConfig) -> pd.Series:
    """Positions actually held, for exposure and turnover metrics."""
    targets = weights.reindex(df.index).fillna(0.0)
    if config.signal_lag:
        targets = targets.shift(config.signal_lag).fillna(0.0)
    return targets
