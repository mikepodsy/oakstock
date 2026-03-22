import type { EconomicDataPoint } from "@/types";

/**
 * Downsample time series data to reduce payload size.
 * - Last 2 years: keep daily data
 * - 2–10 years ago: keep weekly (one point per week)
 * - Older than 10 years: keep monthly (one point per month)
 * Always keeps the very first and last data points.
 */
export function downsample(data: EconomicDataPoint[]): EconomicDataPoint[] {
  if (data.length <= 500) return data;

  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(now.getFullYear() - 2);
  const tenYearsAgo = new Date(now);
  tenYearsAgo.setFullYear(now.getFullYear() - 10);

  const cutoffDaily = twoYearsAgo.toISOString().split("T")[0];
  const cutoffWeekly = tenYearsAgo.toISOString().split("T")[0];

  const result: EconomicDataPoint[] = [];
  let lastWeek = "";
  let lastMonth = "";

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const isFirst = i === 0;
    const isLast = i === data.length - 1;

    if (isFirst || isLast || point.date >= cutoffDaily) {
      // Keep all daily points for the last 2 years
      result.push(point);
    } else if (point.date >= cutoffWeekly) {
      // Weekly: keep one point per ISO week
      const week = getWeekKey(point.date);
      if (week !== lastWeek) {
        result.push(point);
        lastWeek = week;
      }
    } else {
      // Monthly: keep one point per month
      const month = point.date.slice(0, 7); // "YYYY-MM"
      if (month !== lastMonth) {
        result.push(point);
        lastMonth = month;
      }
    }
  }

  return result;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  // Get ISO week number
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
