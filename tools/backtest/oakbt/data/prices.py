"""Daily OHLCV from Yahoo.

Two paths, because Yahoo's public chart endpoint now answers plain HTTP clients
with 429 regardless of User-Agent or cookies — it wants the cookie/crumb
handshake. Rather than reimplement that here, the primary path shells out to
fetch_prices.mjs, which uses the yahoo-finance2 client the app already depends
on and which keeps that handshake working.

The direct HTTP path is kept as a fallback for environments without node, and
because parse_chart() is worth having tested either way.
"""

from __future__ import annotations

import json
import subprocess
import time
from datetime import date, datetime, timezone
from pathlib import Path

import requests

_NODE_SCRIPT = Path(__file__).resolve().parents[2] / "fetch_prices.mjs"

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}
TIMEOUT = 30
MAX_RETRIES = 3


def parse_chart(payload: dict, ticker: str) -> list[dict]:
    chart = (payload or {}).get("chart") or {}
    if chart.get("error"):
        raise RuntimeError(f"Yahoo error for {ticker}: {chart['error']}")

    results = chart.get("result") or []
    if not results:
        return []

    result = results[0]
    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    quote = (indicators.get("quote") or [{}])[0]
    adj_block = (indicators.get("adjclose") or [{}])[0]
    adj_series = adj_block.get("adjclose") or []

    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    rows: list[dict] = []
    for i, ts in enumerate(timestamps):
        close = closes[i] if i < len(closes) else None
        # Yahoo pads non-trading days with nulls. Keeping them would inject NaN
        # into every return derived from the series, so drop them outright.
        if close is None:
            continue
        adj = adj_series[i] if i < len(adj_series) else None
        rows.append(
            {
                "ticker": ticker,
                "date": datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat(),
                "open": opens[i] if i < len(opens) else None,
                "high": highs[i] if i < len(highs) else None,
                "low": lows[i] if i < len(lows) else None,
                "close": close,
                "adj_close": adj if adj is not None else close,
                "volume": volumes[i] if i < len(volumes) else None,
            }
        )
    return rows


def normalize_node_rows(rows: list[dict], ticker: str) -> list[dict]:
    """Map fetch_prices.mjs output onto price_history's column names."""
    return [
        {
            "ticker": ticker,
            "date": r["date"],
            "open": r.get("open"),
            "high": r.get("high"),
            "low": r.get("low"),
            "close": r["close"],
            "adj_close": r.get("adjclose", r["close"]),
            "volume": r.get("volume"),
        }
        for r in rows
        if r.get("close") is not None
    ]


def fetch_via_node(ticker: str, start: date, end: date | None = None) -> list[dict]:
    end = end or datetime.now().date()
    proc = subprocess.run(
        ["node", str(_NODE_SCRIPT), ticker, start.isoformat(), end.isoformat()],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"fetch_prices.mjs failed for {ticker}: {proc.stderr.strip()[:200]}"
        )
    return normalize_node_rows(json.loads(proc.stdout or "[]"), ticker)


def fetch_daily(ticker: str, start: date, end: date | None = None) -> list[dict]:
    """Node path first; fall back to direct HTTP if node is unavailable."""
    if _NODE_SCRIPT.exists():
        try:
            return fetch_via_node(ticker, start, end)
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
            print(f"    (node fetch unavailable for {ticker}: {exc}; trying HTTP)")

    return fetch_daily_http(ticker, start, end)


def fetch_daily_http(ticker: str, start: date, end: date | None = None) -> list[dict]:
    end = end or datetime.now().date()
    params = {
        "interval": "1d",
        "period1": int(datetime.combine(start, datetime.min.time()).timestamp()),
        "period2": int(datetime.combine(end, datetime.max.time()).timestamp()),
        "events": "div,splits",
    }

    last: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            res = requests.get(
                CHART_URL.format(ticker=ticker),
                params=params,
                headers=HEADERS,
                timeout=TIMEOUT,
            )
            if res.status_code == 200:
                return parse_chart(res.json(), ticker)
            last = RuntimeError(f"Yahoo {res.status_code} for {ticker}")
        except requests.RequestException as exc:
            last = exc
        time.sleep(2**attempt)
    raise RuntimeError(f"Yahoo request failed for {ticker}: {last}")
