"""The tradable universe: COT markets and the ETFs that stand in for them.

Single source of truth tying a canonical `market_code` to everything downstream
needs — the exact CFTC Socrata name, which dataset carries it, and the liquid ETF
a strategy actually trades.

The `cftc_name` strings are ported verbatim from the `INSTRUMENTS` array in
src/app/api/cot/route.ts, where they are already verified against live Socrata.
They matter: Socrata filters on an exact string match, so a typo returns zero
rows silently rather than erroring.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Market:
    market_code: str
    label: str
    cftc_name: str
    dataset: str  # 'tff' | 'disaggregated' | 'legacy'
    proxy: str
    proxy_quality: str  # 'good' | 'degraded'


def _m(
    code: str,
    label: str,
    cftc_name: str,
    dataset: str,
    proxy: str,
    quality: str = "good",
) -> Market:
    return Market(code, label, cftc_name, dataset, proxy, quality)


# Markets covered in v1. The COT route also tracks VIX, Dow, Nikkei, Brent, and
# the 5Y/2Y notes; they are omitted here because none has a clean long-history
# ETF proxy (VIX especially — VXX's roll decay makes it useless as a spot proxy).
# Adding one later is a single entry.
MARKETS: dict[str, Market] = {
    m.market_code: m
    for m in [
        # ── Indices ──
        _m("SP500", "S&P 500",
           "S&P 500 Consolidated - CHICAGO MERCANTILE EXCHANGE", "tff", "SPY"),
        _m("NASDAQ100", "Nasdaq 100",
           "NASDAQ-100 Consolidated - CHICAGO MERCANTILE EXCHANGE", "tff", "QQQ"),
        _m("RUSSELL2000", "Russell 2000",
           "RUSSELL E-MINI - CHICAGO MERCANTILE EXCHANGE", "tff", "IWM"),
        # ── Metals ──
        _m("GOLD", "Gold",
           "GOLD - COMMODITY EXCHANGE INC.", "disaggregated", "GLD"),
        _m("SILVER", "Silver",
           "SILVER - COMMODITY EXCHANGE INC.", "disaggregated", "SLV"),
        _m("COPPER", "Copper",
           "COPPER- #1 - COMMODITY EXCHANGE INC.", "disaggregated", "CPER"),
        # ── FX ──
        _m("USDINDEX", "US Dollar Index",
           "USD INDEX - ICE FUTURES U.S.", "tff", "UUP"),
        _m("EUR", "Euro",
           "EURO FX - CHICAGO MERCANTILE EXCHANGE", "tff", "FXE"),
        _m("JPY", "Japanese Yen",
           "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE", "tff", "FXY"),
        _m("GBP", "British Pound",
           "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE", "tff", "FXB"),
        _m("CAD", "Canadian Dollar",
           "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE", "tff", "FXC"),
        # ── Energy ──
        # USO and UNG roll front-month futures monthly. In contango that bleeds
        # several percent a year against spot, so multi-year results on these two
        # measure the roll as much as the signal. Flagged, not excluded.
        _m("WTI", "Crude Oil WTI",
           "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE", "disaggregated",
           "USO", "degraded"),
        _m("NATGAS", "Natural Gas",
           "NAT GAS NYME - NEW YORK MERCANTILE EXCHANGE", "disaggregated",
           "UNG", "degraded"),
        # ── Bonds ──
        _m("UST30Y", "30-Year T-Bond",
           "UST BOND - CHICAGO BOARD OF TRADE", "tff", "TLT"),
        _m("UST10Y", "10-Year T-Note",
           "UST 10Y NOTE - CHICAGO BOARD OF TRADE", "tff", "IEF"),
        _m("UST5Y", "5-Year T-Note",
           "UST 5Y NOTE - CHICAGO BOARD OF TRADE", "tff", "IEI"),
    ]
}

_BY_TICKER: dict[str, Market] = {m.proxy.upper(): m for m in MARKETS.values()}


def get_market(market_code: str) -> Market:
    """Look up a market by canonical code. Raises KeyError if unknown."""
    try:
        return MARKETS[market_code.upper()]
    except KeyError:
        raise KeyError(
            f"Unknown market {market_code!r}. Known: {', '.join(sorted(MARKETS))}"
        ) from None


def market_for_ticker(ticker: str) -> Market | None:
    """Reverse lookup: which market does this ETF stand in for? None if it's not a proxy."""
    return _BY_TICKER.get(ticker.upper())


def all_markets() -> list[Market]:
    return list(MARKETS.values())
