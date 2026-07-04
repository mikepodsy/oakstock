"use client";

import Link from "next/link";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { TickerHoverCard } from "@/components/shared/TickerHoverCard";
import { useInsiderBuying } from "@/hooks/useInsiderBuying";
import { formatCompactNumber } from "@/utils/formatters";

export function InsiderBuyingPanel() {
  const { trades, loading, error } = useInsiderBuying();

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm uppercase tracking-wide text-text-secondary">
            Insider Buying{" "}
            {trades.length > 0 && (
              <span className="text-text-tertiary">({trades.length})</span>
            )}
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Recent open-market insider buys ≥ $50k across all companies, newest first
            (via Finviz).
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-primary bg-red-muted px-3 py-2 text-sm text-red-primary">
          {error}
        </div>
      )}

      {loading && trades.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-lg bg-bg-secondary animate-pulse"
            />
          ))}
        </div>
      ) : !error && trades.length === 0 ? (
        <div className="rounded-xl border border-border-primary bg-bg-secondary px-4 py-6 text-sm text-text-secondary">
          No insider buys ≥ $50k in the recent feed.
        </div>
      ) : trades.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border-primary bg-bg-secondary">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-primary text-[11px] uppercase tracking-wide text-text-tertiary">
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Insider</th>
                <th className="px-3 py-2 font-medium">Relationship</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Shares</th>
                <th className="px-3 py-2 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr
                  key={`${t.ticker}-${t.owner}-${t.date}-${i}`}
                  className="border-b border-border-primary last:border-0 hover:bg-bg-tertiary/40 transition-colors"
                >
                  <td className="px-3 py-1.5">
                    <TickerHoverCard ticker={t.ticker} name={t.company || null}>
                      <Link
                        href={`/stock/${t.ticker}`}
                        className="flex items-center gap-2 font-display text-[13px] text-text-primary hover:text-green-primary transition-colors"
                      >
                        <CompanyLogo
                          ticker={t.ticker}
                          className="w-5 h-5 rounded"
                          textClassName="text-[8px]"
                        />
                        {t.ticker}
                      </Link>
                    </TickerHoverCard>
                  </td>
                  <td className="px-3 py-1.5">
                    {t.secFormUrl ? (
                      <a
                        href={t.secFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-text-primary hover:text-green-primary hover:underline"
                      >
                        {t.owner}
                      </a>
                    ) : (
                      <span className="text-xs text-text-primary">{t.owner}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs text-text-secondary">
                      {t.relationship}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="text-[11px] text-text-tertiary">{t.date}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className="text-xs tabular-nums text-text-primary">
                      {formatCompactNumber(t.shares)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className="text-xs tabular-nums font-medium text-green-primary">
                      ${formatCompactNumber(t.value)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
