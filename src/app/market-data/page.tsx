"use client";

import Link from "next/link";
import { useMarketTable, type MarketTableItem } from "@/hooks/useMarketTable";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Section Definitions ──────────────────────────────
const SECTIONS: {
  id: string;
  title: string;
  items: { ticker: string; name: string }[];
}[] = [
  {
    id: "us-equities",
    title: "U.S. EQUITIES",
    items: [
      { ticker: "SPY", name: "S&P 500" },
      { ticker: "DIA", name: "DJIA" },
      { ticker: "QQQ", name: "NASDAQ 100" },
      { ticker: "MDY", name: "Mid Cap" },
      { ticker: "IJR", name: "Small Cap" },
      { ticker: "IWC", name: "Micro Cap" },
    ],
  },
  {
    id: "us-sectors",
    title: "US EQUITY SECTORS",
    items: [
      { ticker: "XLK", name: "Technology" },
      { ticker: "XLV", name: "Healthcare" },
      { ticker: "XLP", name: "Consumer Staples" },
      { ticker: "XLU", name: "Utilities" },
      { ticker: "XLY", name: "Consumer Discr." },
      { ticker: "XLC", name: "Communication Svcs" },
      { ticker: "XLB", name: "Basic Materials" },
      { ticker: "XLF", name: "Financial Services" },
      { ticker: "XLI", name: "Industrials" },
      { ticker: "XLE", name: "Energy" },
      { ticker: "XLRE", name: "Real Estate" },
    ],
  },
  {
    id: "us-factors",
    title: "US EQUITY FACTORS",
    items: [
      { ticker: "IUSV", name: "Value" },
      { ticker: "IUSG", name: "Growth" },
      { ticker: "QUAL", name: "Quality" },
      { ticker: "USMV", name: "Low Volatility" },
      { ticker: "VYM", name: "High Dividend Yield" },
      { ticker: "MTUM", name: "Momentum" },
      { ticker: "DGRO", name: "Dividend Growth" },
      { ticker: "RSP", name: "Equal Weight" },
    ],
  },
  {
    id: "global-equities",
    title: "GLOBAL EQUITIES",
    items: [
      { ticker: "ACWI", name: "World Equities" },
      { ticker: "IEMG", name: "Emerging Markets" },
      { ticker: "SPDW", name: "World ex-US" },
      { ticker: "VEA", name: "Developed Markets" },
      { ticker: "IEFA", name: "EAFE" },
    ],
  },
  {
    id: "countries",
    title: "COUNTRIES",
    items: [
      { ticker: "EWZ", name: "Brazil" },
      { ticker: "EWQ", name: "France" },
      { ticker: "EWU", name: "U.K." },
      { ticker: "EWG", name: "Germany" },
      { ticker: "VTI", name: "U.S." },
      { ticker: "EWJ", name: "Japan" },
      { ticker: "MCHI", name: "China" },
    ],
  },
  {
    id: "bonds",
    title: "BONDS",
    items: [
      { ticker: "TLT", name: "20+ Year Treasury Bonds" },
      { ticker: "BND", name: "Aggregate Bonds - US" },
      { ticker: "TIP", name: "TIPS - US" },
      { ticker: "HYG", name: "High Yield Bonds - US" },
      { ticker: "BWX", name: "International Govt. Bonds" },
      { ticker: "VCSH", name: "Short Term Corporate" },
    ],
  },
  {
    id: "commodities",
    title: "COMMODITIES",
    items: [
      { ticker: "DBB", name: "Industrial Metals" },
      { ticker: "GLD", name: "Gold" },
      { ticker: "SLV", name: "Silver" },
      { ticker: "PPLT", name: "Platinum" },
      { ticker: "DBA", name: "Agricultural Commodities" },
      { ticker: "DBO", name: "Oil" },
      { ticker: "UNG", name: "Natural Gas" },
      { ticker: "CORN", name: "Corn" },
      { ticker: "SOYB", name: "Soybeans" },
    ],
  },
  {
    id: "currencies",
    title: "CURRENCIES",
    items: [
      { ticker: "UUP", name: "US Dollar" },
      { ticker: "FXB", name: "British Pound" },
      { ticker: "FXE", name: "Euro" },
      { ticker: "FXY", name: "Japanese Yen" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────
function fmtPrice(price: number): string {
  if (!price) return "—";
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

function fmtReturn(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
}

function returnClass(value: number | null): string {
  if (value === null || value === undefined) return "text-text-tertiary";
  if (value > 0) return "text-green-primary";
  if (value < 0) return "text-red-primary";
  return "text-text-secondary";
}

// ─── Table Row ────────────────────────────────────────
function DataRow({
  name,
  ticker,
  item,
  isLast,
}: {
  name: string;
  ticker: string;
  item: MarketTableItem | undefined;
  isLast: boolean;
}) {
  const r = item?.returns;
  return (
    <tr className={`group hover:bg-bg-tertiary transition-colors ${!isLast ? "border-b border-border-primary" : ""}`}>
      {/* Name */}
      <td className="py-2.5 pl-0 pr-4 text-sm text-text-primary whitespace-nowrap">{name}</td>
      {/* Symbol */}
      <td className="py-2.5 pr-6 text-sm font-medium text-green-primary whitespace-nowrap">
        <Link href={`/stock/${encodeURIComponent(item?.ticker ?? ticker)}`} className="hover:underline">
          {item?.ticker ?? ticker}
        </Link>
      </td>
      {/* Today */}
      <td className={`py-2.5 pr-4 text-sm tabular-nums text-right whitespace-nowrap font-medium ${returnClass(r?.today ?? null)}`}>
        {item ? fmtReturn(r?.today ?? null) : <Skeleton className="h-4 w-14 ml-auto" />}
      </td>
      {/* 5 Days */}
      <td className={`py-2.5 pr-4 text-sm tabular-nums text-right whitespace-nowrap ${returnClass(r?.fiveDays ?? null)} hidden sm:table-cell`}>
        {item ? fmtReturn(r?.fiveDays ?? null) : <Skeleton className="h-4 w-14 ml-auto" />}
      </td>
      {/* 1 Month */}
      <td className={`py-2.5 pr-4 text-sm tabular-nums text-right whitespace-nowrap ${returnClass(r?.oneMonth ?? null)} hidden md:table-cell`}>
        {item ? fmtReturn(r?.oneMonth ?? null) : <Skeleton className="h-4 w-16 ml-auto" />}
      </td>
      {/* YTD */}
      <td className={`py-2.5 pr-4 text-sm tabular-nums text-right whitespace-nowrap font-medium ${returnClass(r?.ytd ?? null)} hidden md:table-cell`}>
        {item ? fmtReturn(r?.ytd ?? null) : <Skeleton className="h-4 w-14 ml-auto" />}
      </td>
      {/* 1 Year */}
      <td className={`py-2.5 pr-4 text-sm tabular-nums text-right whitespace-nowrap ${returnClass(r?.oneYear ?? null)} hidden lg:table-cell`}>
        {item ? fmtReturn(r?.oneYear ?? null) : <Skeleton className="h-4 w-14 ml-auto" />}
      </td>
      {/* 3 Years */}
      <td className={`py-2.5 pr-4 text-sm tabular-nums text-right whitespace-nowrap ${returnClass(r?.threeYears ?? null)} hidden xl:table-cell`}>
        {item ? fmtReturn(r?.threeYears ?? null) : <Skeleton className="h-4 w-14 ml-auto" />}
      </td>
      {/* Day Range */}
      <td className="py-2.5 pr-4 text-sm tabular-nums text-right whitespace-nowrap hidden lg:table-cell">
        {item ? (
          item.dayLow !== null && item.dayHigh !== null ? (
            <span className="text-text-secondary">
              {fmtPrice(item.dayLow)}{" "}
              <span className="text-text-tertiary mx-1">–</span>
              {fmtPrice(item.dayHigh)}
            </span>
          ) : (
            <span className="text-text-tertiary">—</span>
          )
        ) : (
          <Skeleton className="h-4 w-24 ml-auto" />
        )}
      </td>
      {/* 52 Week Range */}
      <td className="py-2.5 text-sm tabular-nums text-right whitespace-nowrap hidden xl:table-cell">
        {item ? (
          item.weekLow52 !== null && item.weekHigh52 !== null ? (
            <span className="text-text-secondary">
              {fmtPrice(item.weekLow52)}{" "}
              <span className="text-text-tertiary mx-1">–</span>
              {fmtPrice(item.weekHigh52)}
            </span>
          ) : (
            <span className="text-text-tertiary">—</span>
          )
        ) : (
          <Skeleton className="h-4 w-28 ml-auto" />
        )}
      </td>
    </tr>
  );
}

// ─── Skeleton Rows ────────────────────────────────────
function SkeletonRow({ isLast }: { isLast: boolean }) {
  return (
    <tr className={!isLast ? "border-b border-border-primary" : ""}>
      <td className="py-2.5 pl-0 pr-4"><Skeleton className="h-4 w-32" /></td>
      <td className="py-2.5 pr-6"><Skeleton className="h-4 w-10" /></td>
      <td className="py-2.5 pr-4 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
      <td className="py-2.5 pr-4 text-right hidden sm:table-cell"><Skeleton className="h-4 w-14 ml-auto" /></td>
      <td className="py-2.5 pr-4 text-right hidden md:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
      <td className="py-2.5 pr-4 text-right hidden md:table-cell"><Skeleton className="h-4 w-14 ml-auto" /></td>
      <td className="py-2.5 pr-4 text-right hidden lg:table-cell"><Skeleton className="h-4 w-14 ml-auto" /></td>
      <td className="py-2.5 pr-4 text-right hidden xl:table-cell"><Skeleton className="h-4 w-14 ml-auto" /></td>
      <td className="py-2.5 pr-4 text-right hidden lg:table-cell"><Skeleton className="h-4 w-24 ml-auto" /></td>
      <td className="py-2.5 text-right hidden xl:table-cell"><Skeleton className="h-4 w-28 ml-auto" /></td>
    </tr>
  );
}

// ─── Section Component ────────────────────────────────
function MarketSection({
  title,
  items,
}: {
  title: string;
  items: { ticker: string; name: string }[];
}) {
  const tickers = items.map((i) => i.ticker);
  const { data, loading } = useMarketTable(tickers);
  const dataMap = new Map(data.map((d) => [d.ticker, d]));

  return (
    <section className="mb-10">
      <h2 className="text-base font-bold text-text-primary mb-3 tracking-tight">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Column headers */}
          <thead>
            <tr className="border-b-2 border-border-primary">
              <th className="pb-2 pl-0 pr-4 text-xs font-semibold text-text-secondary text-left whitespace-nowrap">Name</th>
              <th className="pb-2 pr-6 text-xs font-semibold text-text-secondary text-left whitespace-nowrap">Symbol</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-text-secondary text-right whitespace-nowrap">Today</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-text-secondary text-right whitespace-nowrap hidden sm:table-cell">5 Days</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-text-secondary text-right whitespace-nowrap hidden md:table-cell">1 Month</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-text-secondary text-right whitespace-nowrap hidden md:table-cell">YTD</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-text-secondary text-right whitespace-nowrap hidden lg:table-cell">1 Year</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-text-secondary text-right whitespace-nowrap hidden xl:table-cell">3 Years</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-text-secondary text-right whitespace-nowrap hidden lg:table-cell">Day Range</th>
              <th className="pb-2 text-xs font-semibold text-text-secondary text-right whitespace-nowrap hidden xl:table-cell">52 Week Range</th>
            </tr>
          </thead>

          <tbody>
            {loading && data.length === 0
              ? items.map((item, idx) => (
                  <SkeletonRow key={item.ticker} isLast={idx === items.length - 1} />
                ))
              : items.map((item, idx) => (
                  <DataRow
                    key={item.ticker}
                    name={item.name}
                    ticker={item.ticker}
                    item={dataMap.get(item.ticker)}
                    isLast={idx === items.length - 1}
                  />
                ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────
export default function MarketDataPage() {
  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <h1 className="font-display text-2xl font-bold text-text-primary mb-6 tracking-tight">
        MARKET DATA
      </h1>

      {/* Divider nav (visual only, matches SA style) */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-8 pb-4 border-b border-border-primary">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {s.title
              .split(" ")
              .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
              .join(" ")}
          </a>
        ))}
      </div>

      {/* All Sections */}
      {SECTIONS.map((section) => (
        <div key={section.id} id={section.id}>
          <MarketSection title={section.title} items={section.items} />
        </div>
      ))}

      {/* Footer note */}
      <p className="text-xs text-text-tertiary mt-4 pb-8">
        Today column is in real-time. Multi-period returns calculated from historical closes. Data sourced from Yahoo Finance.
      </p>
    </div>
  );
}
