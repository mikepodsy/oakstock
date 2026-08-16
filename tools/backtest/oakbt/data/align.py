"""Project weekly COT reports onto a daily bar calendar, without lookahead.

The whole point-in-time contract lives in one argument:
`merge_asof(..., allow_exact_matches=False)`. That turns the join condition into
`released_at < bar_date` (strictly), so a report published Friday at 3:30pm ET
first becomes tradable on Monday's bar rather than Friday's.

Flip that flag to True and every backtest in this repo silently gains three days
of hindsight while still looking plausible. It is the single highest-leverage
line in the codebase.
"""

from __future__ import annotations

import pandas as pd

# Columns that get pivoted per category, e.g. net -> cot_net_lev_money.
_VALUE_COLUMNS = ("longs", "shorts", "net")


def align_cot_to_daily(
    cot: pd.DataFrame, dates: pd.DatetimeIndex
) -> pd.DataFrame:
    """Return a frame indexed by `dates` carrying the latest *published* COT values.

    Bars before the first release are NaN — never 0, which is a real position and
    would read as genuine data.
    """
    if not dates.is_monotonic_increasing:
        raise ValueError("dates must be sorted ascending and unique")

    if cot is None or cot.empty:
        return pd.DataFrame(index=pd.DatetimeIndex(dates, name="date"))

    frame = cot.copy()
    frame["report_date"] = pd.to_datetime(frame["report_date"])
    frame["released_at"] = pd.to_datetime(frame["released_at"])

    wide = frame.pivot_table(
        index=["released_at", "report_date"],
        columns="category",
        values=list(_VALUE_COLUMNS),
        aggfunc="first",
    )
    # ('net', 'lev_money') -> 'cot_net_lev_money'
    wide.columns = [f"cot_{value}_{category}" for value, category in wide.columns]
    wide = wide.reset_index()

    # Open interest is per-report, not per-category.
    oi = (
        frame.groupby(["released_at", "report_date"], as_index=False)["open_interest"]
        .first()
        .rename(columns={"open_interest": "cot_open_interest"})
    )
    wide = wide.merge(oi, on=["released_at", "report_date"], how="left")
    wide = wide.sort_values("released_at")

    left = pd.DataFrame({"date": pd.DatetimeIndex(dates)})
    merged = pd.merge_asof(
        left,
        wide,
        left_on="date",
        right_on="released_at",
        direction="backward",
        # THE point-in-time guarantee: strict `<`, so release day itself is excluded.
        allow_exact_matches=False,
    )

    merged = merged.rename(
        columns={"released_at": "cot_released_at", "report_date": "cot_report_date"}
    )
    return merged.set_index("date")
