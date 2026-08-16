import { formatCompactNumber, formatFiscalPeriod } from "@/utils/formatters";
import type { FinancialStatement, StatementPeriod } from "@/types";

const usd = (v: number | null) =>
  v == null ? "—" : `$${formatCompactNumber(Math.abs(v))}`;
const per = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const num = (v: number | null) => (v == null ? "—" : v.toFixed(2));

function marginPct(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || whole === 0) return null;
  return +((part / whole) * 100).toFixed(1);
}

function debtToEquity(s: FinancialStatement): number | null {
  if (s.totalDebt == null || s.stockholdersEquity == null || s.stockholdersEquity === 0)
    return null;
  return +(s.totalDebt / s.stockholdersEquity).toFixed(2);
}

export interface SummaryRow {
  label: string;
  fmt: (s: FinancialStatement) => string;
}

/**
 * The metric rows, shared by the annual table and the quarterly dialog so the
 * two always show the same lines in the same order.
 */
export const SUMMARY_ROWS: SummaryRow[] = [
  { label: "Revenue", fmt: (s) => usd(s.revenue) },
  { label: "Gross Profit", fmt: (s) => usd(s.grossProfit) },
  { label: "Gross Margin", fmt: (s) => per(marginPct(s.grossProfit, s.revenue)) },
  { label: "Operating Income", fmt: (s) => usd(s.operatingIncome) },
  { label: "Net Income", fmt: (s) => usd(s.netIncome) },
  { label: "Net Margin", fmt: (s) => per(marginPct(s.netIncome, s.revenue)) },
  { label: "EPS (Diluted)", fmt: (s) => num(s.eps) },
  { label: "EPS (Basic)", fmt: (s) => num(s.epsBasic) },
  { label: "Operating Cash Flow", fmt: (s) => usd(s.operatingCashFlow) },
  { label: "Capital Expenditure", fmt: (s) => usd(s.capex) },
  { label: "Free Cash Flow", fmt: (s) => usd(s.freeCashFlow) },
  { label: "Total Debt", fmt: (s) => usd(s.totalDebt) },
  { label: "Shareholders' Equity", fmt: (s) => usd(s.stockholdersEquity) },
  { label: "Debt / Equity", fmt: (s) => num(debtToEquity(s)) },
  { label: "Buybacks", fmt: (s) => usd(s.buybacks) },
  { label: "Dividends Paid", fmt: (s) => usd(s.dividendsPaid) },
];

/**
 * The most recent `count` periods, newest first. Both series arrive from the
 * API sorted oldest-first; the tables read left-to-right newest-first.
 */
export function latestPeriods(
  statements: FinancialStatement[],
  count: number
): FinancialStatement[] {
  return statements.slice(-count).reverse();
}

/**
 * The period to actually render: the requested one when it has data, otherwise
 * whichever series does. Null when neither does, so the section can bow out.
 */
export function resolvePeriod(
  series: { quarterly: FinancialStatement[]; annual: FinancialStatement[] },
  requested: StatementPeriod
): StatementPeriod | null {
  if (series[requested].length > 0) return requested;
  const other: StatementPeriod =
    requested === "quarterly" ? "annual" : "quarterly";
  return series[other].length > 0 ? other : null;
}

/** `FY 2025`, read in UTC so a midnight period-end doesn't slip a year. */
export function annualLabel(s: FinancialStatement): string {
  return `FY ${new Date(s.date).getUTCFullYear()}`;
}

/**
 * `Sep '25` — the month the fiscal quarter ends in, read in UTC.
 *
 * Deliberately not a `Qn` label. Off-calendar fiscal years break that: KO's
 * quarters end Apr 3 and Jun 30, both of which fall in calendar Q2, so two
 * adjacent columns would read "Q2 '26". Recovering the true fiscal quarter
 * needs the company's year-end and a rank within it; the period-end month is
 * always unambiguous and needs no inference.
 */
export function quarterlyLabel(s: FinancialStatement): string {
  const d = new Date(s.date);
  const iso = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return formatFiscalPeriod(iso);
}
