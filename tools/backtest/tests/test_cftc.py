from datetime import date

from oakbt.data import cftc
from oakbt.data.universe import get_market

TFF_RECORD = {
    "report_date_as_yyyy_mm_dd": "2024-01-09T00:00:00.000",
    "open_interest_all": "2500000",
    "asset_mgr_positions_long": "800000",
    "asset_mgr_positions_short": "300000",
    "lev_money_positions_long": "400000",
    "lev_money_positions_short": "600000",
    "dealer_positions_long_all": "200000",
    "dealer_positions_short_all": "250000",
    "other_rept_positions_long": "100000",
    "other_rept_positions_short": "90000",
    "nonrept_positions_long_all": "50000",
    "nonrept_positions_short_all": "40000",
}

DISAGG_RECORD = {
    "report_date_as_yyyy_mm_dd": "2024-01-09T00:00:00.000",
    "open_interest_all": "500000",
    "swap_positions_long_all": "120000",
    # CFTC really does publish this one with a double underscore.
    "swap__positions_short_all": "90000",
    "m_money_positions_long_all": "200000",
    "m_money_positions_short_all": "60000",
    "prod_merc_positions_long": "80000",
    "prod_merc_positions_short": "210000",
    "other_rept_positions_long": "30000",
    "other_rept_positions_short": "25000",
    "nonrept_positions_long_all": "15000",
    "nonrept_positions_short_all": "12000",
}


def test_parses_tff_categories_with_net_equal_to_long_minus_short():
    rows = cftc.parse_records([TFF_RECORD], get_market("SP500"), "tff")
    by_cat = {r["category"]: r for r in rows}

    assert by_cat["asset_mgr"]["longs"] == 800000
    assert by_cat["asset_mgr"]["shorts"] == 300000
    assert by_cat["asset_mgr"]["net"] == 500000
    # Leveraged funds are net short here — the sign must survive.
    assert by_cat["lev_money"]["net"] == -200000
    for row in rows:
        assert row["net"] == row["longs"] - row["shorts"]


def test_parses_the_double_underscore_swap_short_column():
    rows = cftc.parse_records([DISAGG_RECORD], get_market("GOLD"), "disaggregated")
    swap = next(r for r in rows if r["category"] == "swap")
    assert swap["longs"] == 120000
    assert swap["shorts"] == 90000
    assert swap["net"] == 30000


def test_managed_money_is_extracted_for_disaggregated_markets():
    rows = cftc.parse_records([DISAGG_RECORD], get_market("GOLD"), "disaggregated")
    mm = next(r for r in rows if r["category"] == "m_money")
    assert mm["net"] == 140000


def test_every_row_carries_market_dataset_and_derived_release_date():
    rows = cftc.parse_records([TFF_RECORD], get_market("SP500"), "tff")
    for row in rows:
        assert row["market_code"] == "SP500"
        assert row["dataset"] == "tff"
        assert row["report_date"] == "2024-01-09"
        # Tue 2024-01-09 publishes Fri 2024-01-12.
        assert row["released_at"] == "2024-01-12"
        assert row["open_interest"] == 2500000


def test_release_date_reflects_holiday_delays():
    rec = dict(TFF_RECORD, report_date_as_yyyy_mm_dd="2024-11-26T00:00:00.000")
    rows = cftc.parse_records([rec], get_market("SP500"), "tff")
    assert rows[0]["released_at"] == "2024-12-02"  # Thanksgiving week


def test_missing_and_malformed_numerics_become_none_not_zero():
    # A missing column must not silently read as a flat zero position — that would
    # look like real data to a strategy.
    rec = dict(TFF_RECORD)
    del rec["asset_mgr_positions_long"]
    rec["lev_money_positions_long"] = "not-a-number"
    rows = cftc.parse_records([rec], get_market("SP500"), "tff")
    by_cat = {r["category"]: r for r in rows}
    assert by_cat["asset_mgr"]["longs"] is None
    assert by_cat["asset_mgr"]["net"] is None
    assert by_cat["lev_money"]["longs"] is None


def test_rows_without_a_report_date_are_skipped():
    rec = dict(TFF_RECORD, report_date_as_yyyy_mm_dd="")
    assert cftc.parse_records([rec], get_market("SP500"), "tff") == []


def test_legacy_dataset_yields_the_commercial_split():
    rec = {
        "report_date_as_yyyy_mm_dd": "2024-01-09T00:00:00.000",
        "open_interest_all": "100",
        "comm_positions_long_all": "500",
        "comm_positions_short_all": "700",
        "noncomm_positions_long_all": "400",
        "noncomm_positions_short_all": "150",
        "nonrept_positions_long_all": "50",
        "nonrept_positions_short_all": "40",
    }
    rows = cftc.parse_records([rec], get_market("SP500"), "legacy")
    cats = {r["category"] for r in rows}
    assert cats == {"commercial", "noncommercial", "nonreportable"}
    comm = next(r for r in rows if r["category"] == "commercial")
    assert comm["net"] == -200


def test_fetch_market_pages_until_the_cutoff(monkeypatch):
    """Socrata caps a page at 1000 rows, so deep history needs paging."""
    pages: list[dict] = []

    def fake_get(dataset_id, params):
        pages.append(params)
        offset = params["$offset"]
        if offset == 0:
            return [
                dict(TFF_RECORD, report_date_as_yyyy_mm_dd=f"2024-01-{d:02d}T00:00:00.000")
                for d in range(9, 10)
            ] * cftc.PAGE_SIZE
        return [dict(TFF_RECORD, report_date_as_yyyy_mm_dd="2000-01-04T00:00:00.000")]

    monkeypatch.setattr(cftc, "_socrata_get", fake_get)
    rows = cftc.fetch_market(get_market("SP500"), "tff", since=date(2020, 1, 1))

    assert len(pages) == 2, "expected a second page request"
    assert pages[0]["$offset"] == 0
    assert pages[1]["$offset"] == cftc.PAGE_SIZE
    # The 2000 record is older than the cutoff and must be dropped.
    assert all(r["report_date"] >= "2020-01-01" for r in rows)
