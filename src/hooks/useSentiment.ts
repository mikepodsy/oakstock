"use client";

import { useState, useEffect, useCallback } from "react";

type Vote = "bearish" | "neutral" | "bullish";

interface SentimentCounts {
  bearish: number;
  neutral: number;
  bullish: number;
}

interface UseSentimentReturn {
  counts: SentimentCounts;
  userVote: Vote | null;
  vote: (v: Vote) => void;
  loading: boolean;
}

function getVoterId(): string {
  const key = "oakstock-voter-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function useSentiment(ticker: string): UseSentimentReturn {
  const [counts, setCounts] = useState<SentimentCounts>({
    bearish: 0,
    neutral: 0,
    bullish: 0,
  });
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [voterId, setVoterId] = useState<string | null>(null);

  useEffect(() => {
    setVoterId(getVoterId());
  }, []);

  useEffect(() => {
    if (!voterId) return;

    setLoading(true);
    fetch(`/api/sentiment?ticker=${ticker}&voterId=${voterId}`)
      .then((r) => r.json())
      .then((data) => {
        setCounts(data.counts);
        setUserVote(data.userVote ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, voterId]);

  const vote = useCallback(
    (v: Vote) => {
      if (!voterId) return;

      // Optimistic update
      const wasSelected = userVote === v;
      const prevCounts = { ...counts };
      const prevVote = userVote;

      if (wasSelected) {
        setCounts((c) => ({ ...c, [v]: Math.max(0, c[v] - 1) }));
        setUserVote(null);
      } else {
        setCounts((c) => {
          const next = { ...c, [v]: c[v] + 1 };
          if (prevVote) next[prevVote] = Math.max(0, next[prevVote] - 1);
          return next;
        });
        setUserVote(v);
      }

      fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, vote: v, voterId }),
      }).catch(() => {
        // Rollback on error
        setCounts(prevCounts);
        setUserVote(prevVote);
      });
    },
    [voterId, ticker, userVote, counts]
  );

  return { counts, userVote, vote, loading };
}
