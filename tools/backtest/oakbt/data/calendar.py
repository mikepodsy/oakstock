"""US federal holidays and the CFTC COT release schedule.

This module exists for one reason: COT reports describe positions as of Tuesday
but are not published until the following Friday at 3:30pm ET. Treating the
report date as the date the information was available hands a strategy three
days of hindsight and will invent returns that could never have been traded.

Everything downstream keys off `release_date()`, so this is the load-bearing
piece of the whole point-in-time story.

CFTC is a federal agency, so its release calendar follows *federal* holidays —
not exchange holidays. Good Friday is deliberately absent: markets close, but
the CFTC is open and publishes on schedule.
"""

from datetime import date, timedelta
from functools import lru_cache

_FIRST_YEAR = 2004
_LAST_YEAR = 2031


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """The nth <weekday> of a month (weekday: Mon=0). n is 1-based."""
    d = date(year, month, 1)
    offset = (weekday - d.weekday()) % 7
    return d + timedelta(days=offset + 7 * (n - 1))


def _last_weekday(year: int, month: int, weekday: int) -> date:
    """The last <weekday> of a month."""
    d = date(year, month, 28)
    while (d + timedelta(days=7)).month == month:
        d += timedelta(days=7)
    return d - timedelta(days=(d.weekday() - weekday) % 7)


def _observed(d: date) -> date:
    """Federal rule: a Saturday holiday is observed Friday, a Sunday one Monday."""
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def _holidays_for_year(year: int) -> set[date]:
    days = {
        _observed(date(year, 1, 1)),  # New Year's Day
        _nth_weekday(year, 1, 0, 3),  # MLK Day
        _nth_weekday(year, 2, 0, 3),  # Washington's Birthday
        _last_weekday(year, 5, 0),  # Memorial Day
        _observed(date(year, 7, 4)),  # Independence Day
        _nth_weekday(year, 9, 0, 1),  # Labor Day
        _nth_weekday(year, 10, 0, 2),  # Columbus Day
        _observed(date(year, 11, 11)),  # Veterans Day
        _nth_weekday(year, 11, 3, 4),  # Thanksgiving
        _observed(date(year, 12, 25)),  # Christmas
    }
    # Juneteenth became a federal holiday in June 2021.
    if year >= 2021:
        days.add(_observed(date(year, 6, 19)))
    return days


US_HOLIDAYS: frozenset[date] = frozenset(
    d for y in range(_FIRST_YEAR, _LAST_YEAR + 1) for d in _holidays_for_year(y)
)


def is_holiday(d: date) -> bool:
    return d in US_HOLIDAYS


def _next_business_day(d: date) -> date:
    d += timedelta(days=1)
    while d.weekday() >= 5 or is_holiday(d):
        d += timedelta(days=1)
    return d


@lru_cache(maxsize=4096)
def release_date(report_date: date) -> date:
    """When a COT report dated `report_date` (a Tuesday) actually became public.

    Base case is Tuesday + 3 days = Friday. Each federal holiday falling between
    the report date and that Friday pushes the release one business day later,
    which is why Thanksgiving weeks publish the following Monday.
    """
    candidate = report_date + timedelta(days=3)

    # Delay one business day per holiday in the window, rechecking after each
    # shift because moving the release can pull a further holiday into range
    # (Christmas/New Year weeks do exactly this). `counted` is what makes this
    # terminate — without it the same holiday shifts the date forever.
    counted: set[date] = set()
    while True:
        window: set[date] = set()
        d = report_date + timedelta(days=1)
        while d <= candidate:
            if is_holiday(d):
                window.add(d)
            d += timedelta(days=1)

        pending = window - counted
        if not pending:
            break
        counted |= pending
        for _ in pending:
            candidate = _next_business_day(candidate)

    # A Friday base case can still land on a weekend once shifted, and holidays
    # themselves are never release days.
    while candidate.weekday() >= 5 or is_holiday(candidate):
        candidate += timedelta(days=1)

    return candidate
