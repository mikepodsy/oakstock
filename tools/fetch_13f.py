#!/usr/bin/env python3
"""
fetch_13f.py — Fetches 13F filings from SEC EDGAR for tracked whale investors
and caches the holdings data in Supabase for fast frontend consumption.

Usage:
  python tools/fetch_13f.py                   # fetch latest quarter for all managers
  python tools/fetch_13f.py --manager buffett  # specific manager only
  python tools/fetch_13f.py --quarters 4       # fetch last N quarters (default: 2)
"""

import os
import re
import sys
import time
import argparse
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, date
from supabase import create_client

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://eqwbeubkjzpqnrnufwbp.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    ""
)

EDGAR_BASE      = "https://data.sec.gov"
EDGAR_HEADERS   = {
    "User-Agent": "Oakstock research@oakstock.app",  # SEC requires this
    "Accept-Encoding": "gzip, deflate",
}
REQUEST_DELAY   = 0.12   # Stay under SEC's 10 req/s rate limit
OPENFIGI_URL    = "https://api.openfigi.com/v3/mapping"

# ── Supabase client ────────────────────────────────────────────────────────────
def get_supabase():
    key = SUPABASE_KEY
    if not key:
        # Try reading from .env.local
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
        if os.path.exists(env_path):
            for line in open(env_path):
                line = line.strip()
                if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                    key = line.split("=", 1)[1]
                    break
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY not set")
    return create_client(SUPABASE_URL, key)


# ── EDGAR helpers ──────────────────────────────────────────────────────────────
def edgar_get(url: str) -> requests.Response:
    time.sleep(REQUEST_DELAY)
    r = requests.get(url, headers=EDGAR_HEADERS, timeout=30)
    r.raise_for_status()
    return r


def get_filings_list(cik: str, form_type: str = "13F-HR", max_count: int = 8):
    """Return list of (accession_no, filing_date, period_of_report) sorted newest-first."""
    padded = cik.lstrip("0").zfill(10)
    url = f"{EDGAR_BASE}/submissions/CIK{padded}.json"
    data = edgar_get(url).json()

    recent = data.get("filings", {}).get("recent", {})
    forms        = recent.get("form", [])
    accessions   = recent.get("accessionNumber", [])
    filed_dates  = recent.get("filingDate", [])
    periods      = recent.get("reportDate", [])

    results = []
    for form, acc, filed, period in zip(forms, accessions, filed_dates, periods):
        if form == form_type:
            results.append({
                "accession": acc.replace("-", ""),
                "accession_fmt": acc,
                "filed_date": filed,
                "period": period,
            })
        if len(results) >= max_count:
            break
    return results


def get_13f_xml_url(cik: str, accession: str) -> str | None:
    """Find the primary XML infotable file in a 13F filing."""
    padded = cik.lstrip("0").zfill(10)
    acc_fmt = f"{accession[:10]}-{accession[10:12]}-{accession[12:]}"
    index_url = f"{EDGAR_BASE}/Archives/edgar/data/{padded.lstrip('0')}/{accession}/{acc_fmt}-index.json"

    try:
        index = edgar_get(index_url).json()
    except Exception:
        # Fallback: try the txt index
        return None

    for item in index.get("directory", {}).get("item", []):
        name = item.get("name", "")
        if "infotable" in name.lower() and name.endswith(".xml"):
            return f"{EDGAR_BASE}/Archives/edgar/data/{padded.lstrip('0')}/{accession}/{name}"
    # Broader search
    for item in index.get("directory", {}).get("item", []):
        name = item.get("name", "")
        if name.endswith(".xml") and name not in ("primary_doc.xml",):
            return f"{EDGAR_BASE}/Archives/edgar/data/{padded.lstrip('0')}/{accession}/{name}"
    return None


# ── 13F XML parser ─────────────────────────────────────────────────────────────
NS_MAP = {
    "ns1": "http://www.sec.gov/edgar/document/thirteenf/informationtable",
    "":    "http://www.sec.gov/edgar/document/thirteenf/informationtable",
}

def parse_13f_xml(xml_text: str) -> list[dict]:
    """Parse 13F infotable XML and return list of holding dicts."""
    # Strip namespace for simpler parsing
    xml_clean = re.sub(r' xmlns[^"]*"[^"]*"', "", xml_text)
    xml_clean = re.sub(r'<\?xml[^?]*\?>', "", xml_clean)

    try:
        root = ET.fromstring(xml_clean)
    except ET.ParseError as e:
        print(f"  XML parse error: {e}")
        return []

    holdings = []
    for entry in root.findall(".//infoTable"):
        def txt(tag):
            el = entry.find(tag)
            return el.text.strip() if el is not None and el.text else ""

        value_raw = txt("value")
        shares_raw = txt("sshPrnamt")

        try:
            value_usd = int(value_raw.replace(",", "")) * 1000  # values are in thousands
        except (ValueError, AttributeError):
            value_usd = 0

        try:
            shares = int(shares_raw.replace(",", ""))
        except (ValueError, AttributeError):
            shares = 0

        holdings.append({
            "cusip":        txt("cusip"),
            "company_name": txt("nameOfIssuer"),
            "value_usd":    value_usd,
            "shares":       shares,
            "share_class":  txt("sshPrnamtType"),
            "option_type":  txt("putCall") or None,
        })

    return holdings


# ── CUSIP → Ticker via OpenFIGI ───────────────────────────────────────────────
def resolve_tickers(cusips: list[str]) -> dict[str, str]:
    """Batch-resolve CUSIPs to tickers using OpenFIGI (free, no auth needed for basic use)."""
    if not cusips:
        return {}

    ticker_map = {}
    batch_size = 100  # OpenFIGI max

    for i in range(0, len(cusips), batch_size):
        batch = cusips[i:i + batch_size]
        payload = [{"idType": "ID_CUSIP", "idValue": c} for c in batch]
        try:
            time.sleep(0.5)  # OpenFIGI rate limit
            r = requests.post(
                OPENFIGI_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=20,
            )
            if r.status_code == 200:
                results = r.json()
                for cusip, result in zip(batch, results):
                    if "data" in result and result["data"]:
                        # Prefer common stock on US exchange
                        for item in result["data"]:
                            exch = item.get("exchCode", "")
                            sec_type = item.get("securityType", "")
                            ticker = item.get("ticker", "")
                            if ticker and exch in ("US", "UQ", "UN", "UA", "UR", "UP"):
                                ticker_map[cusip] = ticker
                                break
                        if cusip not in ticker_map and result["data"]:
                            ticker_map[cusip] = result["data"][0].get("ticker", "")
        except Exception as e:
            print(f"  OpenFIGI error (batch {i}): {e}")

    return ticker_map


# ── Quarter helpers ────────────────────────────────────────────────────────────
def period_to_quarter(period_str: str) -> str:
    """'2024-12-31' → 'Q4 2024'"""
    try:
        d = datetime.strptime(period_str, "%Y-%m-%d")
        q = (d.month - 1) // 3 + 1
        return f"Q{q} {d.year}"
    except ValueError:
        return period_str


def compute_changes(
    current: list[dict], previous: list[dict]
) -> list[dict]:
    """Add change_type and shares_prev by comparing to previous quarter holdings."""
    prev_map = {
        (h["cusip"], h.get("option_type")): h["shares"]
        for h in previous
        if h.get("cusip")
    }
    # Track which CUSIPs existed in prev to detect sold positions
    prev_cusips = set(prev_map.keys())
    curr_cusips = set()

    enriched = []
    for h in current:
        key = (h["cusip"], h.get("option_type"))
        curr_cusips.add(key)
        prev_shares = prev_map.get(key)

        if prev_shares is None:
            change_type = "new"
            shares_prev = None
        elif h["shares"] > prev_shares:
            change_type = "increased"
            shares_prev = prev_shares
        elif h["shares"] < prev_shares:
            change_type = "decreased"
            shares_prev = prev_shares
        else:
            change_type = "unchanged"
            shares_prev = prev_shares

        enriched.append({**h, "change_type": change_type, "shares_prev": shares_prev})

    return enriched


# ── Main fetch logic ───────────────────────────────────────────────────────────
def fetch_manager(manager: dict, supabase, num_quarters: int = 2):
    mid = manager["id"]
    cik = manager["cik"]
    name = manager["name"]

    print(f"\n{'='*60}")
    print(f"  {name} ({manager['fund']}) — CIK {cik}")
    print(f"{'='*60}")

    # 1. Get filing list
    filings = get_filings_list(cik, max_count=num_quarters + 1)
    if not filings:
        print("  No 13F filings found.")
        return

    print(f"  Found {len(filings)} filings.")

    # Check which quarters already exist in DB
    existing = (
        supabase.table("expert_holdings")
        .select("quarter")
        .eq("manager_id", mid)
        .execute()
    )
    existing_quarters = {row["quarter"] for row in (existing.data or [])}

    # Parse each quarter
    all_parsed = {}  # quarter → list[dict]

    for filing in filings[:num_quarters + 1]:
        quarter = period_to_quarter(filing["period"])
        print(f"\n  Quarter: {quarter} (filed {filing['filed_date']})")

        if quarter in existing_quarters:
            print(f"  → Already cached, skipping.")
            # Load from DB for change calc
            rows = (
                supabase.table("expert_holdings")
                .select("cusip,shares,option_type")
                .eq("manager_id", mid)
                .eq("quarter", quarter)
                .execute()
            )
            all_parsed[quarter] = rows.data or []
            continue

        # 2. Get XML URL
        xml_url = get_13f_xml_url(cik, filing["accession"])
        if not xml_url:
            print(f"  → Could not find XML file.")
            continue

        print(f"  → Fetching: {xml_url}")
        try:
            xml_resp = edgar_get(xml_url)
            holdings = parse_13f_xml(xml_resp.text)
        except Exception as e:
            print(f"  → Error fetching XML: {e}")
            continue

        print(f"  → Parsed {len(holdings)} holdings.")

        # 3. Resolve CUSIPs → tickers
        cusips = list({h["cusip"] for h in holdings if h["cusip"]})
        print(f"  → Resolving {len(cusips)} CUSIPs via OpenFIGI...")
        ticker_map = resolve_tickers(cusips)
        print(f"  → Resolved {len(ticker_map)} tickers.")

        # 4. Compute % of portfolio
        total_value = sum(h["value_usd"] for h in holdings)

        # 5. Get previous quarter data for change calc
        quarters_sorted = sorted(all_parsed.keys(), reverse=True)
        prev_holdings = all_parsed[quarters_sorted[0]] if quarters_sorted else []

        enriched = compute_changes(holdings, prev_holdings)

        # 6. Build DB rows
        rows = []
        for h in enriched:
            ticker = ticker_map.get(h["cusip"], "") or None
            pct = round(h["value_usd"] / total_value * 100, 3) if total_value > 0 else 0
            rows.append({
                "manager_id":     mid,
                "quarter":        quarter,
                "period_of_report": filing["period"],
                "filed_date":     filing["filed_date"],
                "cusip":          h["cusip"] or None,
                "ticker":         ticker,
                "company_name":   h["company_name"],
                "value_usd":      h["value_usd"],
                "shares":         h["shares"],
                "share_class":    h["share_class"] or None,
                "option_type":    h.get("option_type"),
                "change_type":    h["change_type"],
                "shares_prev":    h.get("shares_prev"),
                "pct_portfolio":  pct,
            })

        # 7. Upsert to Supabase
        if rows:
            print(f"  → Upserting {len(rows)} rows to Supabase...")
            # Upsert in batches of 500
            for batch_start in range(0, len(rows), 500):
                batch = rows[batch_start:batch_start + 500]
                supabase.table("expert_holdings").upsert(
                    batch, on_conflict="manager_id,quarter,cusip,option_type"
                ).execute()
            print(f"  → Done!")

        all_parsed[quarter] = enriched

    # Update manager's updated_at
    supabase.table("expert_managers").update(
        {"updated_at": datetime.utcnow().isoformat()}
    ).eq("id", mid).execute()


# ── CLI ────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Fetch 13F filings from SEC EDGAR")
    parser.add_argument("--manager", help="Manager ID (e.g. buffett). Omit for all.")
    parser.add_argument("--quarters", type=int, default=2, help="Number of quarters to fetch (default: 2)")
    args = parser.parse_args()

    supabase = get_supabase()

    # Fetch manager list from DB
    result = supabase.table("expert_managers").select("*").execute()
    managers = result.data or []

    if args.manager:
        managers = [m for m in managers if m["id"] == args.manager]
        if not managers:
            print(f"Manager '{args.manager}' not found.")
            sys.exit(1)

    print(f"Fetching {args.quarters} quarter(s) for {len(managers)} manager(s)...\n")

    for manager in managers:
        try:
            fetch_manager(manager, supabase, num_quarters=args.quarters)
        except Exception as e:
            print(f"  ERROR for {manager['id']}: {e}")
            import traceback; traceback.print_exc()

    print("\n✅ Done!")


if __name__ == "__main__":
    main()
