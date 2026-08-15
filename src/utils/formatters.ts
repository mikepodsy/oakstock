import { format, parseISO } from "date-fns";

export function formatCurrency(
  value: number,
  currency: "USD" | "CAD" = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, yyyy");
}

/**
 * Yahoo's period key as an axis label: `3Q2025` → `Q3 '25`.
 *
 * A plain year (the annual series) passes through untouched, so callers can
 * hand it either granularity without branching.
 */
export function formatFiscalPeriod(label: string): string {
  const m = /^(\d)Q(\d{4})$/.exec(label);
  return m ? `Q${m[1]} '${m[2].slice(2)}` : label;
}

export function formatTicker(ticker: string): string {
  return ticker.toUpperCase();
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatContracts(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatSignedContracts(value: number): string {
  return new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" }).format(value);
}
