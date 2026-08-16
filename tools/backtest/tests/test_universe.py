import pytest

from oakbt.data.universe import (
    MARKETS,
    all_markets,
    get_market,
    market_for_ticker,
)

VALID_DATASETS = {"tff", "disaggregated", "legacy"}
VALID_QUALITY = {"good", "degraded"}


def test_every_market_is_fully_populated():
    for code, m in MARKETS.items():
        assert m.market_code == code, f"{code} key/field mismatch"
        assert m.label, f"{code} has no label"
        assert m.cftc_name, f"{code} has no cftc_name"
        assert m.dataset in VALID_DATASETS, f"{code} has bad dataset {m.dataset!r}"
        assert m.proxy, f"{code} has no proxy"
        assert m.proxy_quality in VALID_QUALITY, f"{code} bad quality"


def test_market_codes_and_proxies_are_unique():
    proxies = [m.proxy for m in MARKETS.values()]
    assert len(proxies) == len(set(proxies)), "duplicate proxy ticker"


def test_get_market_resolves_proxy():
    assert get_market("SP500").proxy == "SPY"
    assert get_market("GOLD").proxy == "GLD"


def test_get_market_raises_on_unknown_code():
    with pytest.raises(KeyError, match="NOPE"):
        get_market("NOPE")


def test_reverse_lookup_by_ticker():
    assert market_for_ticker("SPY").market_code == "SP500"
    # Case-insensitive, since CLI input is freeform.
    assert market_for_ticker("spy").market_code == "SP500"


def test_reverse_lookup_returns_none_for_unmapped_ticker():
    assert market_for_ticker("AAPL") is None


def test_contango_prone_proxies_are_flagged_degraded():
    # USO and UNG suffer severe roll decay and must never be read as spot proxies.
    assert get_market("WTI").proxy_quality == "degraded"
    assert get_market("NATGAS").proxy_quality == "degraded"
    assert get_market("SP500").proxy_quality == "good"


def test_cftc_names_match_the_app_verbatim():
    # These strings are the Socrata `market_and_exchange_names` filter values and
    # are ported from src/app/api/cot/route.ts. A typo here silently returns zero
    # rows rather than erroring, so pin the exact values.
    assert (
        get_market("SP500").cftc_name
        == "S&P 500 Consolidated - CHICAGO MERCANTILE EXCHANGE"
    )
    assert get_market("GOLD").cftc_name == "GOLD - COMMODITY EXCHANGE INC."
    assert get_market("COPPER").cftc_name == "COPPER- #1 - COMMODITY EXCHANGE INC."
    assert get_market("WTI").cftc_name == "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE"


def test_financials_use_tff_and_commodities_use_disaggregated():
    assert get_market("SP500").dataset == "tff"
    assert get_market("EUR").dataset == "tff"
    assert get_market("GOLD").dataset == "disaggregated"
    assert get_market("NATGAS").dataset == "disaggregated"


def test_all_markets_returns_every_entry():
    assert len(all_markets()) == len(MARKETS)
    assert len(MARKETS) == 16
