"use client";

import { useState, useMemo } from "react";
import { useQuotes } from "@/hooks/useQuotes";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Tab Types ────────────────────────────────────────
type MarketTab = "key-markets" | "sectors" | "commodities" | "currencies" | "bonds" | "crypto";

const TABS: { id: MarketTab; label: string }[] = [
  { id: "key-markets", label: "Key Markets" },
  { id: "sectors", label: "Sectors" },
  { id: "commodities", label: "Commodities" },
  { id: "currencies", label: "Currencies" },
  { id: "bonds", label: "Bonds" },
  { id: "crypto", label: "Crypto" },
];

// ─── Data Definitions ─────────────────────────────────
const KEY_MARKETS_GROUPS: { label: string; items: { ticker: string; name: string }[] }[] = [
  {
    label: "US Indices",
    items: [
      { ticker: "^GSPC", name: "S&P 500" },
      { ticker: "^DJI", name: "Dow Jones Industrial" },
      { ticker: "^IXIC", name: "NASDAQ Composite" },
      { ticker: "^NDX", name: "NASDAQ 100" },
      { ticker: "^RUT", name: "Russell 2000" },
      { ticker: "^MID", name: "S&P 400 Mid-Cap" },
    ],
  },
  {
    label: "International",
    items: [
      { ticker: "^GSPTSE", name: "TSX Composite" },
      { ticker: "^FTSE", name: "FTSE 100" },
      { ticker: "^GDAXI", name: "DAX" },
      { ticker: "^FCHI", name: "CAC 40" },
      { ticker: "^N225", name: "Nikkei 225" },
      { ticker: "^HSI", name: "Hang Seng" },
      { ticker: "^BVSP", name: "Bovespa" },
      { ticker: "^NSEI", name: "Nifty 50" },
    ],
  },
];

const SECTORS: { ticker: string; name: string; description: string }[] = [
  { ticker: "XLK", name: "Technology", description: "SPDR Technology Select Sector" },
  { ticker: "XLF", name: "Financials", description: "SPDR Financials Select Sector" },
  { ticker: "XLE", name: "Energy", description: "SPDR Energy Select Sector" },
  { ticker: "XLV", name: "Health Care", description: "SPDR Health Care Select Sector" },
  { ticker: "XLC", name: "Communication Services", description: "SPDR Communication Services" },
  { ticker: "XLY", name: "Consumer Discretionary", description: "SPDR Consumer Discretionary" },
  { ticker: "XLP", name: "Consumer Staples", description: "SPDR Consumer Staples Select Sector" },
  { ticker: "XLI", name: "Industrials", description: "SPDR Industrials Select Sector" },
  { ticker: "XLB", name: "Materials", description: "SPDR Materials Select Sector" },
  { ticker: "XLRE", name: "Real Estate", description: "SPDR Real Estate Select Sector" },
  { ticker: "XLU", name: "Utilities", description: "SPDR Utilities Select Sector" },
];

const COMMODITIES: { ticker: string; name: string; unit: string }[] = [
  { ticker: "GC=F", name: "Gold", unit: "oz" },
  { ticker: "SI=F", name: "Silver", unit: "oz" },
  { ticker: "CL=F", name: "Crude Oil (WTI)", unit: "bbl" },
  { ticker: "BZ=F", name: "Brent Crude Oil", unit: "bbl" },
  { ticker: "NG=F", name: "Natural Gas", unit: "MMBtu" },
  { ticker: "HG=F", name: "Copper", unit: "lb" },
  { ticker: "PL=F", name: "Platinum", unit: "oz" },
  { ticker: "ZC=F", name: "Corn", unit: "bu" },
  { ticker: "ZW=F", name: "Wheat", unit: "bu" },
  { ticker: "ZS=F", name: "Soybeans", unit: "bu" },
];

const CURRENCIES: { ticker: string; name: string; pair: string }[] = [
  { ticker: "DX-Y.NYB", name: "US Dollar Index", pair: "DXY" },
  { ticker: "EURUSD=X", name: "Euro / US Dollar", pair: "EUR/USD" },
  { ticker: "GBPUSD=X", name: "British Pound / US Dollar", pair: "GBP/USD" },
  { ticker: "JPY=X", name: "US Dollar / Japanese Yen", pair: "USD/JPY" },
  { ticker: "CAD=X", name: "US Dollar / Canadian Dollar", pair: "USD/CAD" },
  { ticker: "AUDUSD=X", name: "Australian Dollar / US Dollar", pair: "AUD/USD" },
  { ticker: "CHF=X", name: "US Dollar / Swiss Franc", pair: "USD/CHF" },
  { ticker: "CNY=X", name: "US Dollar / Chinese Yuan", pair: "USD/CNY" },
];

const BONDS: { ticker: string; name: string; type: "yield" | "etf" }[] = [
  { ticker: "^IRX", name: "13-Week Treasury Yield", type: "yield" },
  { ticker: "^FVX", name: "5-Year Treasury Yield", type: "yield" },
  { ticker: "^TNX", name: "10-Year Treasury Yield", type: "yield" },
  { ticker: "^TYX", name: "30-Year Treasury Yield", type: "yield" },
  { ticker: "SHY", name: "iShares 1–3yr Treasury Bond (SHY)", type: "etf" },
  { ticker: "IEF", name: "iShares 7–10yr Treasury Bond (IEF)", type: "etf" },
  { ticker: "TLT", name: "iShares 20+yr Treasury Bond (TLT)", type: "etf" },
  { ticker: "LQD", name: "iShares Investment Grade Corp (LQD)", type: "etf" },
  { ticker: "HYG", name: "iShares High Yield Corp Bond (HYG)", type: "etf" },
];

const CRYPTO: { ticker: string; name: string }[] = [
  { ticker: "BTC-USD", name: "Bitcoin" },
  { ticker: "ETH-USD", name: "Ethereum" },
  { ticker: "SOL-USD", name: "Solana" },
  { ticker: "BNB-USD", name: "BNB" },
  { ticker: "XRP-USD", name: "XRP" },
  { ticker: "ADA-USD", name: "Cardano" },
  { ticker: "DOGE-USD", name: "Dogecoin" },
  { ticker: "AVAX-USD", name: "Avalanche" },
];

// ─── Helpers ──────────────────────────────────────────
function formatPrice(price: number, currency?: string): string {
  if (price === 0) return "—";
  const decimals = price < 1 ? 6 : price < 10 ? 4 : price < 1000 ? 2 : 2;
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatChange(change: number): string {
  if (change === 0) return "0.00";
  const abs = Math.abs(change);
  const decimals = abs < 0.01 ? 4 : 2;
  return (change >= 0 ? "+" : "") + change.toFixed(decimals);
}

function formatPct(pct: number): string {
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

// ─── Sub-components ───────────────────────────────────
interface RowItem {
  ticker: string;
  name: string;
  subtitle?: string;
}

function MarketTable({
  label,
  items,
  quotes,
  loading,
  showSubtitle = false,
}: {
  label?: string;
  items: RowItem[];
  quotes: Record<string, { currentPrice: number; dayChange: number; dayChangePercent: number; currency: string }>;
  loading: boolean;
  showSubtitle?: boolean;
}) {
  return (
    <div className="mb-6">
      {label && (
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2 px-1">
          {label}
        </h2>
      )}
      <div className="rounded-xl border border-border-primary overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-bg-tertiary border-b border-border-primary">
          <span className="text-xs font-medium text-text-tertiary">Name</span>
          <span className="text-xs font-medium text-text-tertiary text-right w-24">Price</span>
          <span className="text-xs font-medium text-text-tertiary text-right w-24">Change</span>
          <span className="text-xs font-medium text-text-tertiary text-right w-20">% Change</span>
        </div>

        {/* Rows */}
        {items.map((item, idx) => {
          const quote = quotes[item.ticker];
          const isPositive = quote ? quote.dayChangePercent > 0 : false;
          const isNegative = quote ? quote.dayChangePercent < 0 : false;
          const isLast = idx === items.length - 1;

          return (
            <div
              key={item.ticker}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-bg-tertiary transition-colors ${
                !isLast ? "border-b border-border-primary" : ""
              }`}
            >
              {/* Name */}
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">{item.name}</div>
                <div className="text-xs text-text-tertiary font-mono mt-0.5">
                  {showSubtitle && item.subtitle ? item.subtitle : item.ticker}
                </div>
              </div>

              {/* Price */}
              <div className="w-24 text-right">
                {loading && !quote ? (
                  <Skeleton className="h-4 w-20 ml-auto" />
                ) : quote ? (
                  <span className="text-sm font-financial text-text-primary tabular-nums">
                    {formatPrice(quote.currentPrice, quote.currency)}
                  </span>
                ) : (
                  <span className="text-sm text-text-tertiary">—</span>
                )}
              </div>

              {/* Change $ */}
              <div className="w-24 text-right">
                {loading && !quote ? (
                  <Skeleton className="h-4 w-16 ml-auto" />
                ) : quote ? (
                  <span
                    className={`text-sm font-financial tabular-nums ${
                      isPositive
                        ? "text-green-primary"
                        : isNegative
                        ? "text-red-primary"
                        : "text-text-secondary"
                    }`}
                  >
                    {formatChange(quote.dayChange)}
                  </span>
                ) : (
                  <span className="text-sm text-text-tertiary">—</span>
                )}
              </div>

              {/* % Change */}
              <div className="w-20 text-right">
                {loading && !quote ? (
                  <Skeleton className="h-6 w-16 ml-auto rounded-full" />
                ) : quote ? (
                  <span
                    className={`inline-block text-xs font-financial font-medium tabular-nums px-2 py-0.5 rounded-full ${
                      isPositive
                        ? "bg-green-muted text-green-primary"
                        : isNegative
                        ? "bg-red-muted text-red-primary"
                        : "bg-bg-tertiary text-text-secondary"
                    }`}
                  >
                    {formatPct(quote.dayChangePercent)}
                  </span>
                ) : (
                  <span className="text-sm text-text-tertiary">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab Content Components ───────────────────────────
function KeyMarketsTab() {
  const allTickers = useMemo(
    () => KEY_MARKETS_GROUPS.flatMap((g) => g.items.map((i) => i.ticker)),
    []
  );
  const { quotes, loading, refetch } = useQuotes(allTickers);

  return (
    <div>
      {KEY_MARKETS_GROUPS.map((group) => (
        <MarketTable
          key={group.label}
          label={group.label}
          items={group.items}
          quotes={quotes}
          loading={loading}
        />
      ))}
    </div>
  );
}

function SectorsTab() {
  const tickers = useMemo(() => SECTORS.map((s) => s.ticker), []);
  const { quotes, loading } = useQuotes(tickers);
  const items = SECTORS.map((s) => ({ ticker: s.ticker, name: s.name, subtitle: s.description }));

  return (
    <MarketTable
      label="US Sector ETFs"
      items={items}
      quotes={quotes}
      loading={loading}
      showSubtitle
    />
  );
}

function CommoditiesTab() {
  const tickers = useMemo(() => COMMODITIES.map((c) => c.ticker), []);
  const { quotes, loading } = useQuotes(tickers);
  const items = COMMODITIES.map((c) => ({ ticker: c.ticker, name: c.name, subtitle: `per ${c.unit}` }));

  return (
    <MarketTable
      label="Commodities Futures"
      items={items}
      quotes={quotes}
      loading={loading}
      showSubtitle
    />
  );
}

function CurrenciesTab() {
  const tickers = useMemo(() => CURRENCIES.map((c) => c.ticker), []);
  const { quotes, loading } = useQuotes(tickers);
  const items = CURRENCIES.map((c) => ({ ticker: c.ticker, name: c.name, subtitle: c.pair }));

  return (
    <MarketTable
      label="Forex & Currency"
      items={items}
      quotes={quotes}
      loading={loading}
      showSubtitle
    />
  );
}

function BondsTab() {
  const yieldTickers = useMemo(() => BONDS.filter((b) => b.type === "yield").map((b) => b.ticker), []);
  const etfTickers = useMemo(() => BONDS.filter((b) => b.type === "etf").map((b) => b.ticker), []);
  const { quotes: yieldQuotes, loading: yieldLoading } = useQuotes(yieldTickers);
  const { quotes: etfQuotes, loading: etfLoading } = useQuotes(etfTickers);

  const yieldItems = BONDS.filter((b) => b.type === "yield").map((b) => ({ ticker: b.ticker, name: b.name }));
  const etfItems = BONDS.filter((b) => b.type === "etf").map((b) => ({ ticker: b.ticker, name: b.name }));

  return (
    <div>
      <MarketTable label="US Treasury Yields" items={yieldItems} quotes={yieldQuotes} loading={yieldLoading} />
      <MarketTable label="Bond ETFs" items={etfItems} quotes={etfQuotes} loading={etfLoading} />
    </div>
  );
}

function CryptoTab() {
  const tickers = useMemo(() => CRYPTO.map((c) => c.ticker), []);
  const { quotes, loading } = useQuotes(tickers);

  return (
    <MarketTable label="Cryptocurrency" items={CRYPTO} quotes={quotes} loading={loading} />
  );
}

// ─── Main Page ────────────────────────────────────────
export default function MarketDataPage() {
  const [activeTab, setActiveTab] = useState<MarketTab>("key-markets");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Market Data</h1>
        <p className="text-sm text-text-secondary mt-1">
          Live prices across indices, sectors, commodities, currencies, bonds, and crypto
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border-primary overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-green-primary text-green-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "key-markets" && <KeyMarketsTab />}
      {activeTab === "sectors" && <SectorsTab />}
      {activeTab === "commodities" && <CommoditiesTab />}
      {activeTab === "currencies" && <CurrenciesTab />}
      {activeTab === "bonds" && <BondsTab />}
      {activeTab === "crypto" && <CryptoTab />}
    </div>
  );
}
