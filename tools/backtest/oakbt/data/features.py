"""Feature providers — the seam that makes this framework general-purpose.

A feature is just a column on the daily frame. Providers declare the names they
produce; strategies declare the names they need; the runner wires them together.
Nothing in the engine knows what COT is.

Adding technical indicators later means writing a provider whose `provides` is
["rsi_14"] and ignoring market_code. No engine change, no strategy change.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import pandas as pd

from oakbt.config import FeatureContext, MissingMarketCodeError, UnknownFeatureError

# COT publishes weekly; ~3 years of weekly reports is 156 observations, which on
# a forward-filled daily calendar is about 756 trading days. The app's /api/cot
# route uses the same 3-year lookback for its COT index.
INDEX_WINDOW_DAYS = 756
ZSCORE_WINDOW_DAYS = 756
MIN_PERIODS = 60

COT_CATEGORIES = (
    "lev_money",
    "asset_mgr",
    "dealer",
    "m_money",
    "swap",
    "prod_merc",
    "commercial",
    "noncommercial",
)


def _min_periods(window: int, override: int | None) -> int:
    """pandas rejects min_periods > window, so clamp for short windows."""
    return override if override is not None else min(MIN_PERIODS, window)


def range_index(series: pd.Series, window: int = INDEX_WINDOW_DAYS,
                min_periods: int | None = None) -> pd.Series:
    """Where the current value sits in its rolling range, scaled 0-100.

    This is the classic COT index: 100 means the most extreme long positioning in
    the window, 0 the most extreme short. A flat window has no range to speak of,
    so it returns the neutral 50 rather than dividing by zero.
    """
    mp = _min_periods(window, min_periods)
    lo = series.rolling(window, min_periods=mp).min()
    hi = series.rolling(window, min_periods=mp).max()
    span = hi - lo
    idx = (series - lo) / span * 100.0
    return idx.where(span > 0, 50.0).clip(0.0, 100.0)


def zscore(series: pd.Series, window: int = ZSCORE_WINDOW_DAYS,
           min_periods: int | None = None) -> pd.Series:
    mp = _min_periods(window, min_periods)
    mean = series.rolling(window, min_periods=mp).mean()
    std = series.rolling(window, min_periods=mp).std()
    z = (series - mean) / std
    return z.where(std > 0, 0.0)


@runtime_checkable
class FeatureProvider(Protocol):
    provides: list[str]

    def compute(self, ctx: FeatureContext, aligned: pd.DataFrame) -> pd.DataFrame:
        ...


class CotFeatureProvider:
    """Derives positioning features from the point-in-time aligned COT frame."""

    provides = (
        [f"cot_index_{c}" for c in COT_CATEGORIES]
        + [f"cot_z_{c}" for c in COT_CATEGORIES]
        + ["cot_oi_index"]
    )

    def compute(self, ctx: FeatureContext, aligned: pd.DataFrame) -> pd.DataFrame:
        if not ctx.market_code:
            raise MissingMarketCodeError(
                f"{ctx.ticker} has no COT market. COT features need a market "
                f"(pass --market, or pick a ticker that is a known proxy)."
            )

        out = aligned.copy()
        for cat in COT_CATEGORIES:
            net_col = f"cot_net_{cat}"
            if net_col not in out.columns:
                continue
            net = pd.to_numeric(out[net_col], errors="coerce")
            out[f"cot_index_{cat}"] = range_index(net)
            out[f"cot_z_{cat}"] = zscore(net)

        if "cot_open_interest" in out.columns:
            oi = pd.to_numeric(out["cot_open_interest"], errors="coerce")
            out["cot_oi_index"] = range_index(oi)

        return out


REGISTRY: dict[str, FeatureProvider] = {}


def register(provider: FeatureProvider) -> None:
    for name in provider.provides:
        if name in REGISTRY:
            raise ValueError(f"feature {name!r} is already registered")
        REGISTRY[name] = provider


def available_features() -> list[str]:
    return sorted(REGISTRY)


def resolve_providers(required: list[str]) -> list[FeatureProvider]:
    """Map feature names to the providers that make them, deduped.

    Raises before any simulation runs, so a typo in a strategy fails loudly
    instead of producing an all-NaN signal that quietly trades nothing.
    """
    providers: list[FeatureProvider] = []
    for name in required:
        provider = REGISTRY.get(name)
        if provider is None:
            raise UnknownFeatureError(
                f"unknown feature {name!r}. Available: {', '.join(available_features())}"
            )
        if not any(p is provider for p in providers):
            providers.append(provider)
    return providers


register(CotFeatureProvider())
