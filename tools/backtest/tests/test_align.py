import pandas as pd
import pytest

from oakbt.data.align import align_cot_to_daily


def _cot(rows: list[tuple[str, str, str, int]]) -> pd.DataFrame:
    """rows: (report_date, released_at, category, net)"""
    return pd.DataFrame(
        [
            {
                "report_date": pd.Timestamp(r),
                "released_at": pd.Timestamp(rel),
                "category": cat,
                "longs": net + 1000,
                "shorts": 1000,
                "net": net,
                "open_interest": 500_000,
            }
            for r, rel, cat, net in rows
        ]
    )


def _days(start: str, end: str) -> pd.DatetimeIndex:
    return pd.bdate_range(start, end)


def test_data_is_invisible_on_its_own_release_day():
    """The 3:30pm ET release is too late to trade that day's close."""
    cot = _cot([("2024-01-09", "2024-01-12", "lev_money", 500)])
    out = align_cot_to_daily(cot, _days("2024-01-10", "2024-01-16"))

    assert pd.isna(out.loc[pd.Timestamp("2024-01-11"), "cot_net_lev_money"])
    # Friday the 12th is release day — still not visible.
    assert pd.isna(out.loc[pd.Timestamp("2024-01-12"), "cot_net_lev_money"])
    # Monday the 15th is the first tradable bar.
    assert out.loc[pd.Timestamp("2024-01-15"), "cot_net_lev_money"] == 500


def test_values_forward_fill_until_the_next_release():
    cot = _cot(
        [
            ("2024-01-09", "2024-01-12", "lev_money", 500),
            ("2024-01-16", "2024-01-19", "lev_money", 900),
        ]
    )
    out = align_cot_to_daily(cot, _days("2024-01-15", "2024-01-25"))

    assert out.loc[pd.Timestamp("2024-01-15"), "cot_net_lev_money"] == 500
    assert out.loc[pd.Timestamp("2024-01-18"), "cot_net_lev_money"] == 500
    assert out.loc[pd.Timestamp("2024-01-19"), "cot_net_lev_money"] == 500
    assert out.loc[pd.Timestamp("2024-01-22"), "cot_net_lev_money"] == 900


def test_bars_before_the_first_release_are_nan_not_zero():
    # Zero is a real position. Filling unknown history with it would let a
    # strategy trade on data that did not exist yet.
    cot = _cot([("2024-01-09", "2024-01-12", "lev_money", 500)])
    out = align_cot_to_daily(cot, _days("2024-01-01", "2024-01-16"))
    early = out.loc[: pd.Timestamp("2024-01-12"), "cot_net_lev_money"]
    assert early.isna().all()


def test_holiday_delayed_release_lands_on_the_following_business_day():
    # Thanksgiving 2024: report 11-26 published Mon 12-02, tradable from 12-03.
    cot = _cot([("2024-11-26", "2024-12-02", "lev_money", 750)])
    out = align_cot_to_daily(cot, _days("2024-11-27", "2024-12-05"))

    assert pd.isna(out.loc[pd.Timestamp("2024-11-29"), "cot_net_lev_money"])
    assert pd.isna(out.loc[pd.Timestamp("2024-12-02"), "cot_net_lev_money"])
    assert out.loc[pd.Timestamp("2024-12-03"), "cot_net_lev_money"] == 750


def test_multiple_categories_become_separate_columns():
    cot = _cot(
        [
            ("2024-01-09", "2024-01-12", "lev_money", 500),
            ("2024-01-09", "2024-01-12", "asset_mgr", -200),
        ]
    )
    out = align_cot_to_daily(cot, _days("2024-01-15", "2024-01-17"))
    assert out.loc[pd.Timestamp("2024-01-15"), "cot_net_lev_money"] == 500
    assert out.loc[pd.Timestamp("2024-01-15"), "cot_net_asset_mgr"] == -200
    assert out.loc[pd.Timestamp("2024-01-15"), "cot_longs_lev_money"] == 1500


def test_open_interest_and_report_date_are_carried_through():
    cot = _cot([("2024-01-09", "2024-01-12", "lev_money", 500)])
    out = align_cot_to_daily(cot, _days("2024-01-15", "2024-01-17"))
    assert out.loc[pd.Timestamp("2024-01-15"), "cot_open_interest"] == 500_000
    assert out.loc[pd.Timestamp("2024-01-15"), "cot_report_date"] == pd.Timestamp(
        "2024-01-09"
    )


def test_no_lookahead_anywhere_in_a_long_series():
    """The guarantee, swept exhaustively: every bar's source released strictly earlier."""
    reports = pd.bdate_range("2022-01-04", "2024-12-31", freq="W-TUE")
    rows = [
        (d.strftime("%Y-%m-%d"), (d + pd.Timedelta(days=3)).strftime("%Y-%m-%d"),
         "lev_money", i * 10)
        for i, d in enumerate(reports)
    ]
    cot = _cot(rows)
    dates = _days("2022-01-04", "2024-12-31")
    out = align_cot_to_daily(cot, dates)

    joined = out.dropna(subset=["cot_released_at"])
    assert len(joined) > 100, "sanity: the join produced almost nothing"
    assert (joined["cot_released_at"] < joined.index).all(), "lookahead detected"


def test_empty_cot_frame_yields_all_nan_columns_without_raising():
    out = align_cot_to_daily(pd.DataFrame(), _days("2024-01-01", "2024-01-05"))
    assert len(out) == 5
    assert out.isna().all().all()


def test_requires_a_sorted_unique_date_index():
    cot = _cot([("2024-01-09", "2024-01-12", "lev_money", 500)])
    with pytest.raises(ValueError, match="sorted"):
        align_cot_to_daily(
            cot, pd.DatetimeIndex(["2024-01-16", "2024-01-15"])
        )
