import numpy as np
import pandas as pd
import pytest

from oakbt.config import ExecutionConfig
from oakbt.engine.risk import VolTargetRiskModel, realized_vol


def _frame(returns: np.ndarray) -> pd.DataFrame:
    idx = pd.bdate_range("2020-01-01", periods=len(returns))
    close = 100.0 * np.cumprod(1.0 + returns)
    return pd.DataFrame({"close": close, "open": close, "high": close, "low": close},
                        index=idx)


def test_no_target_vol_passes_weights_through_untouched():
    df = _frame(np.full(200, 0.001))
    weights = pd.Series(1.0, index=df.index)
    model = VolTargetRiskModel(ExecutionConfig(target_vol=None))
    pd.testing.assert_series_equal(model.apply(weights, df), weights)


def test_scales_toward_the_target_volatility():
    rng = np.random.default_rng(7)
    # ~32% annualized: 0.02 daily * sqrt(252).
    df = _frame(rng.normal(0, 0.02, 600))
    weights = pd.Series(1.0, index=df.index)

    cfg = ExecutionConfig(target_vol=0.16, max_leverage=10.0)
    scaled = VolTargetRiskModel(cfg).apply(weights, df).dropna()

    # Target is half the realized vol, so weights should sit near 0.5.
    assert scaled.tail(300).mean() == pytest.approx(0.5, rel=0.25)


def test_near_zero_volatility_is_capped_not_infinite():
    df = _frame(np.full(300, 0.0))  # perfectly flat: zero realized vol
    weights = pd.Series(1.0, index=df.index)
    cfg = ExecutionConfig(target_vol=0.15, max_leverage=2.0)
    scaled = VolTargetRiskModel(cfg).apply(weights, df)

    assert np.isfinite(scaled.dropna()).all()
    assert scaled.abs().max() <= 2.0


def test_leverage_cap_binds():
    rng = np.random.default_rng(3)
    df = _frame(rng.normal(0, 0.0005, 400))  # very low vol -> wants huge leverage
    weights = pd.Series(1.0, index=df.index)
    cfg = ExecutionConfig(target_vol=0.40, max_leverage=1.5)
    scaled = VolTargetRiskModel(cfg).apply(weights, df)
    assert scaled.max() <= 1.5 + 1e-9


def test_short_weights_keep_their_sign():
    rng = np.random.default_rng(11)
    df = _frame(rng.normal(0, 0.01, 400))
    weights = pd.Series(-1.0, index=df.index)
    scaled = VolTargetRiskModel(ExecutionConfig(target_vol=0.15)).apply(weights, df)
    assert (scaled.dropna() <= 0).all()


def test_flat_weights_stay_flat():
    rng = np.random.default_rng(5)
    df = _frame(rng.normal(0, 0.01, 300))
    weights = pd.Series(0.0, index=df.index)
    scaled = VolTargetRiskModel(ExecutionConfig(target_vol=0.15)).apply(weights, df)
    assert (scaled.fillna(0.0) == 0.0).all()


def test_volatility_estimate_uses_only_past_data():
    """A vol spike must not shrink the position on the same bar it happens."""
    returns = np.full(300, 0.001)
    returns[200] = 0.25  # one enormous move
    df = _frame(returns)

    vol = realized_vol(df, halflife=20)
    # The estimate on the spike bar cannot yet know about the spike.
    assert vol.iloc[200] == vol.iloc[200]  # not NaN
    assert vol.iloc[200] < vol.iloc[201], "vol estimate leaked the current bar"
