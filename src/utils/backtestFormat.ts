// Formatting for backtest metrics.
//
// Everything here treats "no value" as a dash rather than 0. A backtest that
// prints 0.00% when it means "not computed" reads as a real result, which is
// worse than showing nothing.

const DASH = "—";

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 0.1234 -> "+12.34%" */
export function formatPct(value: unknown, digits = 2, signed = false): string {
  if (!isNum(value)) return DASH;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

/** 1.234 -> "1.23" */
export function formatRatio(value: unknown, digits = 2): string {
  if (!isNum(value)) return DASH;
  return value.toFixed(digits);
}

export function formatMoney(value: unknown, digits = 2): string {
  if (!isNum(value)) return DASH;
  return `$${value.toFixed(digits)}`;
}

export function formatInt(value: unknown): string {
  if (!isNum(value)) return DASH;
  return Math.round(value).toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toISOString().slice(0, 10);
}

/** Strategy registry keys are snake_case; show them as words. */
export function formatStrategyName(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatParams(params: Record<string, unknown> | null): string {
  if (!params || Object.keys(params).length === 0) return DASH;
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

/** Green for good, red for bad. Some metrics invert: a bigger drawdown is worse. */
export function metricTone(
  value: unknown,
  higherIsBetter = true
): "positive" | "negative" | "neutral" {
  if (!isNum(value) || value === 0) return "neutral";
  const good = higherIsBetter ? value > 0 : value < 0;
  return good ? "positive" : "negative";
}
