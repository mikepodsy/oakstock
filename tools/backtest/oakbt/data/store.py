"""Supabase persistence for history and results.

Credential handling mirrors tools/fetch_13f.py: prefer real environment
variables, fall back to parsing the repo-root .env.local. No new secrets and no
new place to keep them.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

URL_VAR = "NEXT_PUBLIC_SUPABASE_URL"
KEY_VAR = "SUPABASE_SERVICE_ROLE_KEY"

# PostgREST caps a default select at 1000 rows, so reads must page explicitly or
# they silently truncate — which in a backtest means silently wrong history.
PAGE_SIZE = 1000
UPSERT_CHUNK = 500

_REPO_ROOT = Path(__file__).resolve().parents[4]


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip("\"'")
    return values


def load_credentials(env_path: Path | None = None) -> tuple[str, str]:
    """Resolve (url, service_role_key). Environment beats file."""
    path = env_path if env_path is not None else _REPO_ROOT / ".env.local"
    file_values = _parse_env_file(path)

    url = os.environ.get(URL_VAR) or file_values.get(URL_VAR, "")
    key = os.environ.get(KEY_VAR) or file_values.get(KEY_VAR, "")

    if not url:
        raise RuntimeError(f"{URL_VAR} not set (checked environment and {path})")
    if not key:
        raise RuntimeError(f"{KEY_VAR} not set (checked environment and {path})")
    return url, key


@lru_cache(maxsize=1)
def client():
    from supabase import create_client

    url, key = load_credentials()
    return create_client(url, key)


def _chunked(rows: list[Any], size: int) -> Iterator[list[Any]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def _upsert(table: str, rows: list[dict], on_conflict: str) -> int:
    if not rows:
        return 0
    written = 0
    for chunk in _chunked(rows, UPSERT_CHUNK):
        client().table(table).upsert(chunk, on_conflict=on_conflict).execute()
        written += len(chunk)
    return written


def _select_all(table: str, columns: str, filters: dict[str, Any],
                gte: tuple[str, Any] | None = None,
                lte: tuple[str, Any] | None = None,
                order: str | None = None) -> list[dict]:
    """Paged select — PostgREST would otherwise cut us off at 1000 rows."""
    out: list[dict] = []
    offset = 0
    while True:
        q = client().table(table).select(columns)
        for col, val in filters.items():
            q = q.eq(col, val)
        if gte:
            q = q.gte(gte[0], gte[1])
        if lte:
            q = q.lte(lte[0], lte[1])
        if order:
            q = q.order(order)
        res = q.range(offset, offset + PAGE_SIZE - 1).execute()
        batch = res.data or []
        out.extend(batch)
        if len(batch) < PAGE_SIZE:
            return out
        offset += PAGE_SIZE


# ── Writes ────────────────────────────────────────────────────────────────────

def upsert_cot(rows: list[dict]) -> int:
    return _upsert("cot_history", rows, "market_code,dataset,report_date,category")


def upsert_prices(rows: list[dict]) -> int:
    return _upsert("price_history", rows, "ticker,date")


# ── Reads ─────────────────────────────────────────────────────────────────────

def load_cot(market_code: str, dataset: str, start: date | None = None,
             end: date | None = None) -> pd.DataFrame:
    rows = _select_all(
        "cot_history",
        "report_date,released_at,category,longs,shorts,net,open_interest",
        {"market_code": market_code, "dataset": dataset},
        gte=("report_date", start.isoformat()) if start else None,
        lte=("report_date", end.isoformat()) if end else None,
        order="report_date",
    )
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["report_date"] = pd.to_datetime(df["report_date"])
    df["released_at"] = pd.to_datetime(df["released_at"])
    return df


def load_prices(ticker: str, start: date | None = None,
                end: date | None = None) -> pd.DataFrame:
    rows = _select_all(
        "price_history",
        "date,open,high,low,close,adj_close,volume",
        {"ticker": ticker},
        gte=("date", start.isoformat()) if start else None,
        lte=("date", end.isoformat()) if end else None,
        order="date",
    )
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"])
    for col in ("open", "high", "low", "close", "adj_close"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.set_index("date").sort_index()


def latest_cot_report_date(market_code: str, dataset: str) -> date | None:
    """Most recent stored report, for incremental top-ups."""
    res = (
        client()
        .table("cot_history")
        .select("report_date")
        .eq("market_code", market_code)
        .eq("dataset", dataset)
        .order("report_date", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return date.fromisoformat(res.data[0]["report_date"])


def latest_price_date(ticker: str) -> date | None:
    res = (
        client()
        .table("price_history")
        .select("date")
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return date.fromisoformat(res.data[0]["date"])
