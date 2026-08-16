import numpy as np
import pandas as pd
import pytest

from oakbt.config import MissingMarketCodeError, UnknownFeatureError
from oakbt.data import features


def test_range_index_is_100_at_the_window_high():
    s = pd.Series(np.arange(0.0, 200.0))
    idx = features.range_index(s, window=50)
    assert idx.iloc[-1] == pytest.approx(100.0)


def test_range_index_is_0_at_the_window_low():
    s = pd.Series(np.arange(200.0, 0.0, -1.0))
    idx = features.range_index(s, window=50)
    assert idx.iloc[-1] == pytest.approx(0.0)


def test_range_index_of_a_flat_series_is_neutral_not_a_divide_by_zero():
    s = pd.Series([42.0] * 100)
    idx = features.range_index(s, window=50)
    assert idx.iloc[-1] == pytest.approx(50.0)
    assert np.isfinite(idx.iloc[-1])


def test_range_index_is_bounded_to_0_100():
    rng = np.random.default_rng(0)
    s = pd.Series(rng.normal(size=500).cumsum())
    idx = features.range_index(s, window=60).dropna()
    assert idx.min() >= 0.0 and idx.max() <= 100.0


def test_range_index_midpoint():
    # Value sits exactly halfway between the window low and high.
    s = pd.Series([0.0, 100.0, 50.0])
    idx = features.range_index(s, window=3)
    assert idx.iloc[-1] == pytest.approx(50.0)


def test_zscore_matches_the_definition():
    s = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
    z = features.zscore(s, window=5)
    expected = (5.0 - s.mean()) / s.std()
    assert z.iloc[-1] == pytest.approx(expected)


def test_zscore_of_a_flat_series_is_zero_not_inf():
    s = pd.Series([7.0] * 50)
    z = features.zscore(s, window=20)
    assert z.iloc[-1] == pytest.approx(0.0)
    assert np.isfinite(z.iloc[-1])


# ── Registry ──────────────────────────────────────────────────────────────────

def test_feature_registry_matches_the_typescript_catalog():
    """The composer's schema hardcodes this list in src/lib/strategySpec.ts.

    If a provider is added here without updating that file, Claude never learns
    the new feature exists — and a spec naming it would be rejected client-side.
    This test is the tripwire; update both together.
    """
    categories = [
        "lev_money", "asset_mgr", "dealer", "m_money",
        "swap", "prod_merc", "commercial", "noncommercial",
    ]
    expected = sorted(
        [f"cot_index_{c}" for c in categories]
        + [f"cot_z_{c}" for c in categories]
        + ["cot_oi_index"]
    )
    assert features.available_features() == expected, (
        "feature registry drifted — update FEATURES in src/lib/strategySpec.ts"
    )


def test_registry_exposes_cot_features():
    available = features.available_features()
    assert "cot_index_lev_money" in available
    assert "cot_z_m_money" in available
    assert "cot_oi_index" in available


def test_unknown_feature_raises_and_names_it():
    with pytest.raises(UnknownFeatureError, match="totally_made_up"):
        features.resolve_providers(["totally_made_up"])


def test_unknown_feature_error_lists_available_names():
    with pytest.raises(UnknownFeatureError, match="cot_index_lev_money"):
        features.resolve_providers(["nope"])


def test_resolve_dedupes_providers():
    provs = features.resolve_providers(["cot_index_lev_money", "cot_z_lev_money"])
    assert len(provs) == 1, "both come from the same provider"


def test_duplicate_registration_raises():
    class Clashing:
        provides = ["cot_index_lev_money"]

        def compute(self, ctx, df):  # pragma: no cover
            return df

    with pytest.raises(ValueError, match="already registered"):
        features.register(Clashing())


def test_cot_provider_requires_a_market_code():
    from oakbt.config import FeatureContext

    provider = features.resolve_providers(["cot_index_lev_money"])[0]
    ctx = FeatureContext(ticker="AAPL", market_code=None, dataset=None,
                         dates=pd.DatetimeIndex([]))
    with pytest.raises(MissingMarketCodeError, match="AAPL"):
        provider.compute(ctx, pd.DataFrame())


def test_cot_provider_derives_index_and_zscore_columns():
    from oakbt.config import FeatureContext

    dates = pd.bdate_range("2024-01-01", periods=300)
    aligned = pd.DataFrame(
        {"cot_net_lev_money": np.linspace(-1000, 1000, len(dates)),
         "cot_open_interest": np.linspace(1e6, 2e6, len(dates))},
        index=dates,
    )
    provider = features.resolve_providers(["cot_index_lev_money"])[0]
    ctx = FeatureContext(ticker="SPY", market_code="SP500", dataset="tff", dates=dates)
    out = provider.compute(ctx, aligned)

    assert "cot_index_lev_money" in out.columns
    assert "cot_z_lev_money" in out.columns
    assert "cot_oi_index" in out.columns
    # Monotonically rising net ends at its window high.
    assert out["cot_index_lev_money"].iloc[-1] == pytest.approx(100.0)
