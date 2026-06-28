"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TickerSearch } from "@/components/search/TickerSearch";
import { useVolatility } from "@/hooks/useVolatility";
import { IvVrpSection } from "@/components/options/volatility/IvVrpSection";
import { TermStructureSection } from "@/components/options/volatility/TermStructureSection";
import { SkewSection } from "@/components/options/volatility/SkewSection";
import { IvHistorySection } from "@/components/options/volatility/IvHistorySection";

export default function VolatilityPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = (params.ticker as string)?.toUpperCase() ?? "";
  const { data, loading, error } = useVolatility(ticker);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display text-text-primary">{ticker}</h1>
          <span className="text-sm text-text-secondary">Volatility</span>
          {data?.spot != null && (
            <span className="text-sm font-financial text-text-tertiary">${data.spot.toFixed(2)}</span>
          )}
          <Link
            href={`/options/${ticker}`}
            className="text-xs text-green-primary hover:underline"
          >
            ← Builder
          </Link>
        </div>
        <div className="w-64">
          <TickerSearch onSelect={(r) => router.push(`/options/${r.ticker}/volatility`)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[340px] w-full rounded-xl" />
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-[320px] rounded-xl" />
            <Skeleton className="h-[320px] rounded-xl" />
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6">
          <p className="text-sm text-red-primary mb-1">Couldn’t load volatility data.</p>
          <p className="text-xs text-text-tertiary">{error}</p>
        </div>
      ) : data ? (
        <>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <LineChart className="h-3.5 w-3.5" />
            History: {data.history.length} days
            {data.source === "dolthub" && " · DoltHub"}
          </div>

          <IvVrpSection history={data.history} stats={data.stats} />

          <div className="grid md:grid-cols-2 gap-4">
            <TermStructureSection term={data.termStructure} />
            <SkewSection
              ticker={ticker}
              term={data.termStructure}
              initialSkew={data.skew}
              spot={data.spot}
            />
          </div>

          <IvHistorySection stats={data.stats} />
        </>
      ) : null}
    </div>
  );
}
