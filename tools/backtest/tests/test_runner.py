import numpy as np
import pandas as pd
import pytest

from oakbt.config import ExecutionConfig, MissingMarketCodeError, RunConfig, UnknownFeatureError
from oakbt.data import store
from oakbt.engine import runner
from oakbt.engine.strategy import Strategy
from oakbt.strategies import STRATEGIES

NO_VOL = ExecutionConfig(target_vol=None, commission_bps=0.0, slippage_bps=0.0)


@pytest.fixture
def stub_store(monkeypatch):
    """Deterministic price and COT history, no network."""
    dates = pd.bdate_range("2022-01-03", periods=500)
    close = pd.Series(100.0 * np.cumprod(1 + np.full(len(dates), 0.0005)), index=dates)
    prices = pd.DataFrame(
        {"open": close, "high": close * 1.005, "low": close * 0.995, "close": close,
         "adj_close": close, "volume": 1_000_000},
        index=dates,
    )
    prices.index.name = "date"

    reports = pd.bdate_range("2022-01-04", periods=100, freq="W-TUE")
    cot = pd.DataFrame(
        [
            {
                "report_date": d,
                "released_at": d + pd.Timedelta(days=3),
                "category": "lev_money",
                "longs": 1000 + i * 10,
                "shorts": 1000,
                "net": i * 10,
                "open_interest": 500_000,
            }
            for i, d in enumerate(reports)
        ]
    )

    monkeypatch.setattr(store, "load_prices", lambda *a, **k: prices)
    monkeypatch.setattr(store, "load_cot", lambda *a, **k: cot)
    return prices, cot


def test_unknown_feature_raises_before_any_simulation(stub_store):
    class Bogus(Strategy):
        name = "bogus"
        required_features = ["a_feature_that_does_not_exist"]

        def generate_signals(self, df):  # pragma: no cover - must not be reached
            raise AssertionError("simulation ran despite a missing feature")

    STRATEGIES["bogus"] = Bogus
    try:
        cfg = RunConfig(strategy="bogus", ticker="SPY", market_code="SP500",
                        dataset="tff", execution=NO_VOL)
        with pytest.raises(UnknownFeatureError, match="a_feature_that_does_not_exist"):
            runner.run_backtest(cfg)
    finally:
        del STRATEGIES["bogus"]


def test_cot_strategy_without_a_market_code_raises(stub_store):
    cfg = RunConfig(strategy="cot_index_reversal", ticker="AAPL", market_code=None,
                    execution=NO_VOL)
    with pytest.raises(MissingMarketCodeError, match="AAPL"):
        runner.run_backtest(cfg)


def test_price_only_strategy_works_without_a_market_code(stub_store):
    cfg = RunConfig(strategy="buy_and_hold", ticker="AAPL", market_code=None,
                    execution=NO_VOL)
    result = runner.run_backtest(cfg)
    assert len(result.equity) > 0


def test_buy_and_hold_reproduces_the_underlying_return(stub_store):
    """The control: if this drifts, the accounting is wrong."""
    prices, _ = stub_store
    cfg = RunConfig(strategy="buy_and_hold", ticker="SPY", execution=NO_VOL)
    result = runner.run_backtest(cfg)

    frame = prices.loc[result.equity.index]
    # Entered at bar 1's open under the default 1-bar lag, so compare from there.
    expected = frame["close"].iloc[-1] / frame["open"].iloc[1] - 1
    actual = result.equity.iloc[-1] / result.equity.iloc[0] - 1
    assert actual == pytest.approx(expected, rel=1e-3)


def test_result_carries_benchmark_position_and_metrics(stub_store):
    cfg = RunConfig(strategy="buy_and_hold", ticker="SPY", execution=NO_VOL)
    result = runner.run_backtest(cfg)

    assert len(result.benchmark) == len(result.equity)
    assert len(result.position) == len(result.equity)
    assert "cagr" in result.metrics
    assert "benchmark" in result.metrics


def test_cot_run_clips_the_window_to_where_the_signal_exists(stub_store):
    prices, _ = stub_store
    cfg = RunConfig(strategy="cot_index_reversal", ticker="SPY",
                    market_code="SP500", dataset="tff", execution=NO_VOL)
    result = runner.run_backtest(cfg)

    # The first COT release postdates the first price bar, so the run must start
    # later than the raw price history rather than pretending to know earlier.
    assert result.equity.index[0] > prices.index[0]


def test_empty_price_history_raises_with_a_usable_hint(monkeypatch):
    monkeypatch.setattr(store, "load_prices", lambda *a, **k: pd.DataFrame())
    cfg = RunConfig(strategy="buy_and_hold", ticker="NOPE", execution=NO_VOL)
    with pytest.raises(ValueError, match="backfill"):
        runner.run_backtest(cfg)


def test_metrics_are_all_json_safe(stub_store):
    cfg = RunConfig(strategy="cot_index_reversal", ticker="SPY",
                    market_code="SP500", dataset="tff", execution=NO_VOL)
    result = runner.run_backtest(cfg)

    def check(value):
        if isinstance(value, float):
            assert np.isfinite(value), "NaN/inf would break the JSON column"
        elif isinstance(value, dict):
            for v in value.values():
                check(v)

    check(result.metrics)
