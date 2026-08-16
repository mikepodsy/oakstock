from datetime import date, timedelta

import pytest

from oakbt.data.calendar import US_HOLIDAYS, is_holiday, release_date


def test_normal_week_releases_on_friday():
    # Positions as of Tue 2024-01-09 are published Fri 2024-01-12.
    assert release_date(date(2024, 1, 9)) == date(2024, 1, 12)
    assert release_date(date(2024, 1, 16)) == date(2024, 1, 19)


def test_thanksgiving_delays_release_to_monday():
    # Thanksgiving 2024 fell Thu 11-28, so the Fri 11-29 release slipped to Mon 12-02.
    assert release_date(date(2024, 11, 26)) == date(2024, 12, 2)


def test_independence_day_delays_release():
    # July 4 2024 was a Thursday; Fri 07-05 release slipped to Mon 07-08.
    assert release_date(date(2024, 7, 2)) == date(2024, 7, 8)


def test_christmas_delays_release():
    # Christmas 2024 was a Wednesday; Fri 12-27 release slipped to Mon 12-30.
    assert release_date(date(2024, 12, 24)) == date(2024, 12, 30)


def test_new_year_delays_release_across_the_year_boundary():
    # Wed 2025-01-01 intervenes between Tue 12-31 and Fri 01-03.
    assert release_date(date(2024, 12, 31)) == date(2025, 1, 6)


def test_holiday_before_the_report_date_does_not_delay():
    # MLK Mon 2024-01-15 precedes the Tue 01-16 report, so it must not shift anything.
    assert release_date(date(2024, 1, 16)) == date(2024, 1, 19)


def test_release_is_always_after_the_report_and_never_on_a_weekend():
    d = date(2015, 1, 6)
    while d < date(2030, 1, 1):
        r = release_date(d)
        assert r > d, f"{d}: release {r} not after report"
        assert r.weekday() < 5, f"{d}: release {r} lands on a weekend"
        assert not is_holiday(r), f"{d}: release {r} lands on a holiday"
        d += timedelta(days=7)


def test_holiday_set_covers_the_backtest_era():
    years = {h.year for h in US_HOLIDAYS}
    assert 2005 in years and 2030 in years


@pytest.mark.parametrize(
    "day",
    [
        date(2024, 1, 1),  # New Year's Day
        date(2024, 1, 15),  # MLK
        date(2024, 2, 19),  # Presidents' Day
        date(2024, 5, 27),  # Memorial Day
        date(2024, 6, 19),  # Juneteenth
        date(2024, 7, 4),  # Independence Day
        date(2024, 9, 2),  # Labor Day
        date(2024, 11, 28),  # Thanksgiving
        date(2024, 12, 25),  # Christmas
    ],
)
def test_known_federal_holidays_are_recognised(day):
    assert is_holiday(day)


def test_ordinary_weekday_is_not_a_holiday():
    assert not is_holiday(date(2024, 3, 12))
