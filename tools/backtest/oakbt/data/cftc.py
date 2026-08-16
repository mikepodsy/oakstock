"""CFTC Commitment of Traders client (Socrata).

The app's /api/cot route caps itself at 208 weeks because that's all a dashboard
needs. A backtest wants everything, so this pages.

Category column names are ported from src/app/api/cot/route.ts. Note
`swap__positions_short_all` — the double underscore is CFTC's, not a typo.
"""

from __future__ import annotations

import time
from datetime import date, datetime

import requests

from oakbt.data.calendar import release_date
from oakbt.data.universe import Market

BASE = "https://publicreporting.cftc.gov/resource"

DATASET_IDS = {
    "tff": "gpe5-46if",
    "disaggregated": "72hh-3qpy",
    "legacy": "6dca-aqww",
}

# category key -> (long column, short column)
CATEGORY_COLUMNS: dict[str, dict[str, tuple[str, str]]] = {
    "tff": {
        "asset_mgr": ("asset_mgr_positions_long", "asset_mgr_positions_short"),
        "lev_money": ("lev_money_positions_long", "lev_money_positions_short"),
        "dealer": ("dealer_positions_long_all", "dealer_positions_short_all"),
        "other_rept": ("other_rept_positions_long", "other_rept_positions_short"),
        "nonreportable": ("nonrept_positions_long_all", "nonrept_positions_short_all"),
    },
    "disaggregated": {
        "swap": ("swap_positions_long_all", "swap__positions_short_all"),
        "m_money": ("m_money_positions_long_all", "m_money_positions_short_all"),
        "prod_merc": ("prod_merc_positions_long", "prod_merc_positions_short"),
        "other_rept": ("other_rept_positions_long", "other_rept_positions_short"),
        "nonreportable": ("nonrept_positions_long_all", "nonrept_positions_short_all"),
    },
    "legacy": {
        "commercial": ("comm_positions_long_all", "comm_positions_short_all"),
        "noncommercial": ("noncomm_positions_long_all", "noncomm_positions_short_all"),
        "nonreportable": ("nonrept_positions_long_all", "nonrept_positions_short_all"),
    },
}

PAGE_SIZE = 1000
TIMEOUT = 30
MAX_RETRIES = 3


def _num(record: dict, col: str) -> int | None:
    """Parse a Socrata numeric. Missing or malformed yields None, never 0.

    This matters: a zero position is a real, tradable state, so coercing absent
    data to 0 would feed a strategy fiction that looks like fact.
    """
    raw = record.get(col)
    if raw is None or raw == "":
        return None
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return None


def _report_date(record: dict) -> str:
    # Socrata returns ISO timestamps like "2024-01-09T00:00:00.000".
    return str(record.get("report_date_as_yyyy_mm_dd") or "")[:10]


def parse_records(records: list[dict], market: Market, dataset: str) -> list[dict]:
    """Flatten Socrata rows into one row per (report, category)."""
    columns = CATEGORY_COLUMNS[dataset]
    out: list[dict] = []

    for rec in records:
        rd = _report_date(rec)
        if not rd:
            continue
        try:
            released = release_date(date.fromisoformat(rd)).isoformat()
        except ValueError:
            continue

        oi = _num(rec, "open_interest_all")
        for category, (long_col, short_col) in columns.items():
            longs = _num(rec, long_col)
            shorts = _num(rec, short_col)
            net = None if longs is None or shorts is None else longs - shorts
            out.append(
                {
                    "market_code": market.market_code,
                    "dataset": dataset,
                    "report_date": rd,
                    "released_at": released,
                    "category": category,
                    "longs": longs,
                    "shorts": shorts,
                    "net": net,
                    "open_interest": oi,
                }
            )
    return out


def _socrata_get(dataset_id: str, params: dict) -> list[dict]:
    url = f"{BASE}/{dataset_id}.json"
    last: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            res = requests.get(url, params=params, timeout=TIMEOUT)
            if res.status_code == 200:
                return res.json()
            last = RuntimeError(f"CFTC {res.status_code}: {res.text[:200]}")
        except requests.RequestException as exc:
            last = exc
        time.sleep(2**attempt)
    raise RuntimeError(f"CFTC request failed after {MAX_RETRIES} attempts: {last}")


def fetch_market(market: Market, dataset: str, since: date) -> list[dict]:
    """All records for a market back to `since`, newest-first, paged."""
    dataset_id = DATASET_IDS[dataset]
    cutoff = since.isoformat()
    collected: list[dict] = []
    offset = 0

    while True:
        params = {
            "$where": f"market_and_exchange_names='{market.cftc_name}'",
            "$order": "report_date_as_yyyy_mm_dd DESC",
            "$limit": PAGE_SIZE,
            "$offset": offset,
        }
        page = _socrata_get(dataset_id, params)
        if not page:
            break

        parsed = parse_records(page, market, dataset)
        collected.extend(r for r in parsed if r["report_date"] >= cutoff)

        oldest = min((_report_date(r) for r in page if _report_date(r)), default="")
        if oldest and oldest < cutoff:
            break
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return collected


def years_ago(years: int) -> date:
    today = datetime.now().date()
    try:
        return today.replace(year=today.year - years)
    except ValueError:  # Feb 29
        return today.replace(month=2, day=28, year=today.year - years)
