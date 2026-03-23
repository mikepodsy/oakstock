"use client";

import { TrendingDown, Minus, TrendingUp } from "lucide-react";
import { useSentiment } from "@/hooks/useSentiment";
import { Skeleton } from "@/components/ui/skeleton";

interface SentimentSectionProps {
  ticker: string;
}

const VOTE_OPTIONS = [
  {
    key: "bearish" as const,
    label: "Bearish",
    icon: TrendingDown,
    color: "var(--red-primary)",
    bgActive: "bg-red-muted",
    textActive: "text-red-primary",
  },
  {
    key: "neutral" as const,
    label: "Neutral",
    icon: Minus,
    color: "var(--text-tertiary)",
    bgActive: "bg-yellow-500/10",
    textActive: "text-yellow-500",
  },
  {
    key: "bullish" as const,
    label: "Bullish",
    icon: TrendingUp,
    color: "var(--green-primary)",
    bgActive: "bg-green-muted",
    textActive: "text-green-primary",
  },
] as const;

export function SentimentSection({ ticker }: SentimentSectionProps) {
  const { counts, userVote, vote, loading } = useSentiment(ticker);

  const total = counts.bearish + counts.neutral + counts.bullish;

  if (loading) {
    return <Skeleton className="h-[88px] w-full rounded-xl mb-6" />;
  }

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4 mb-6">
      <p className="text-sm font-medium text-text-primary mb-3">
        Community Sentiment
      </p>

      {/* Sentiment bar */}
      {total > 0 && (
        <div className="flex rounded-full overflow-hidden h-2 mb-3">
          {counts.bearish > 0 && (
            <div
              className="transition-all duration-300"
              style={{
                width: `${(counts.bearish / total) * 100}%`,
                backgroundColor: "var(--red-primary)",
              }}
            />
          )}
          {counts.neutral > 0 && (
            <div
              className="transition-all duration-300"
              style={{
                width: `${(counts.neutral / total) * 100}%`,
                backgroundColor: "var(--text-tertiary)",
              }}
            />
          )}
          {counts.bullish > 0 && (
            <div
              className="transition-all duration-300"
              style={{
                width: `${(counts.bullish / total) * 100}%`,
                backgroundColor: "var(--green-primary)",
              }}
            />
          )}
        </div>
      )}

      {/* Vote buttons */}
      <div className="flex gap-2">
        {VOTE_OPTIONS.map(({ key, label, icon: Icon, bgActive, textActive }) => {
          const isActive = userVote === key;
          return (
            <button
              key={key}
              onClick={() => vote(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? `${bgActive} ${textActive}`
                  : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {counts[key] > 0 && (
                <span className="opacity-60">{counts[key]}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
