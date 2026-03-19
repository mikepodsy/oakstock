import { subDays, subMonths, subYears } from "date-fns";

export function getPeriodStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1d":
      return subDays(now, 1);
    case "5d":
      return subDays(now, 5);
    case "1w":
      return subDays(now, 7);
    case "1m":
      return subMonths(now, 1);
    case "3m":
      return subMonths(now, 3);
    case "6m":
      return subMonths(now, 6);
    case "1y":
      return subYears(now, 1);
    case "5y":
      return subYears(now, 5);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "3y":
      return subYears(now, 3);
    case "max":
      return new Date("2000-01-01");
    default:
      return subYears(now, 1);
  }
}

export function getInterval(period: string): "1d" | "1wk" {
  return ["1d", "5d", "1w", "1m"].includes(period) ? "1d" : "1wk";
}
