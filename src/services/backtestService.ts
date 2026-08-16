import type { BacktestDetail, BacktestRun } from "@/types/backtest";

export async function fetchBacktestRuns(
  signal?: AbortSignal
): Promise<BacktestRun[]> {
  const res = await fetch("/api/backtest/runs", { signal });
  if (!res.ok) {
    throw new Error("Failed to fetch backtest runs");
  }
  return res.json();
}

export async function fetchBacktestRun(
  id: string,
  signal?: AbortSignal
): Promise<BacktestDetail> {
  const res = await fetch(`/api/backtest/runs/${id}`, { signal });
  if (!res.ok) {
    throw new Error(
      res.status === 404 ? "Backtest run not found" : "Failed to fetch backtest run"
    );
  }
  return res.json();
}
