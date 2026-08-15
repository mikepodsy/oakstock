import type { EconomicDataPoint } from "@/types";

/**
 * Collapse an intraday series into one point per UTC calendar day, keeping the
 * day's last bar as that day's close. Output is keyed by day (YYYY-MM-DD) and
 * sorted, so the input need not be chronological. US cash-session bars fall
 * between 13:30 and 21:00 UTC, so the UTC day is also the trading day.
 */
export function rollupToDaily(points: EconomicDataPoint[]): EconomicDataPoint[] {
  const lastOfDay = new Map<string, EconomicDataPoint>();

  for (const point of points) {
    const day = point.date.slice(0, 10);
    const seen = lastOfDay.get(day);
    if (!seen || point.date >= seen.date) {
      lastOfDay.set(day, point);
    }
  }

  return [...lastOfDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, point]) => ({ date: day, value: point.value }));
}
