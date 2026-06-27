import type { FinancialStatement, FundamentalsData } from "@/types";
import {
  DURATION_FIELDS,
  HELPER_FIELDS,
  INSTANT_FIELDS,
  type DurationField,
} from "./concepts";
import {
  annualFromDuration,
  deriveEbitda,
  deriveFreeCashFlow,
  instantByEnd,
  quarterlyFromDuration,
  type RawFact,
} from "./compute";

// Minimal shape of the SEC companyfacts payload we rely on.
export interface CompanyFacts {
  cik?: number;
  entityName?: string;
  facts?: {
    "us-gaap"?: Record<
      string,
      { units?: Record<string, RawFact[]> }
    >;
  };
}

function getFacts(companyfacts: CompanyFacts, concept: string): RawFact[] {
  const units = companyfacts.facts?.["us-gaap"]?.[concept]?.units;
  if (!units) return [];
  // EPS uses "USD/shares"; everything else "USD". Prefer USD, then per-share.
  const unitKey =
    "USD" in units ? "USD" : "USD/shares" in units ? "USD/shares" : Object.keys(units)[0];
  return unitKey ? units[unitKey] ?? [] : [];
}

// Overlay candidate concepts (priority order, first present wins per end date)
// into a single quarterly map.
function quarterlyField(
  companyfacts: CompanyFacts,
  field: DurationField,
): Map<string, number> {
  const merged = new Map<string, number>();
  // Iterate candidates from lowest to highest priority so higher-priority
  // (earlier) candidates overwrite.
  for (const concept of [...field.candidates].reverse()) {
    const facts = getFacts(companyfacts, concept);
    if (!facts.length) continue;
    for (const [end, val] of quarterlyFromDuration(facts, field.derivable)) {
      merged.set(end, val);
    }
  }
  return merged;
}

function annualField(
  companyfacts: CompanyFacts,
  field: DurationField,
): Map<string, number> {
  const merged = new Map<string, number>();
  for (const concept of [...field.candidates].reverse()) {
    const facts = getFacts(companyfacts, concept);
    if (!facts.length) continue;
    for (const [end, val] of annualFromDuration(facts)) merged.set(end, val);
  }
  return merged;
}

function instantField(
  companyfacts: CompanyFacts,
  candidates: string[],
): Map<string, number> {
  const merged = new Map<string, number>();
  for (const concept of [...candidates].reverse()) {
    const facts = getFacts(companyfacts, concept);
    if (!facts.length) continue;
    for (const [end, val] of instantByEnd(facts)) merged.set(end, val);
  }
  return merged;
}

// Look up an instant value at a period-end, tolerating small date offsets
// between the income-statement period end and the balance-sheet date.
function lookupInstant(
  map: Map<string, number>,
  end: string,
  toleranceDays = 7,
): number | null {
  const exact = map.get(end);
  if (exact != null) return exact;
  const target = Date.parse(end);
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const [k, v] of map) {
    const diff = Math.abs(Date.parse(k) - target);
    if (diff <= toleranceDays * 86_400_000 && diff < bestDiff) {
      bestDiff = diff;
      best = v;
    }
  }
  return best;
}

type FieldMaps = {
  duration: Record<string, Map<string, number>>;
  helper: Record<string, Map<string, number>>;
  instant: Record<string, Map<string, number>>;
};

function buildStatement(
  end: string,
  maps: FieldMaps,
): FinancialStatement {
  const d = (key: string) => maps.duration[key]?.get(end) ?? null;
  const h = (key: string) => maps.helper[key]?.get(end) ?? null;

  const revenue = d("revenue");
  const costOfRevenue = d("costOfRevenue");
  let grossProfit = d("grossProfit");
  if (grossProfit == null && revenue != null && costOfRevenue != null) {
    grossProfit = revenue - costOfRevenue;
  }
  const operatingIncome = d("operatingIncome");

  const equity = lookupInstant(maps.instant.stockholdersEquity, end);
  let totalDebt = lookupInstant(maps.instant.longTermDebt, end);
  if (totalDebt == null) {
    const noncurrent = lookupInstant(maps.instant.longTermDebtNoncurrent, end);
    const current = lookupInstant(maps.instant.longTermDebtCurrent, end);
    if (noncurrent != null || current != null) {
      totalDebt = (noncurrent ?? 0) + (current ?? 0);
    }
  }

  const buybacks = d("buybacks");
  const dividendsPaid = d("dividendsPaid");
  const operatingCashFlow = d("operatingCashFlow");
  const capex = d("capex");

  return {
    date: new Date(`${end}T00:00:00Z`).toISOString(),
    revenue,
    ebitda: deriveEbitda(operatingIncome, h("dna")),
    freeCashFlow: deriveFreeCashFlow(operatingCashFlow, capex),
    operatingCashFlow,
    capex,
    netIncome: d("netIncome"),
    grossProfit,
    operatingIncome,
    costOfRevenue,
    eps: d("eps"),
    epsBasic: d("epsBasic"),
    buybacks: buybacks != null ? Math.abs(buybacks) : null,
    dividendsPaid: dividendsPaid != null ? Math.abs(dividendsPaid) : null,
    totalDebt,
    stockholdersEquity: equity,
  };
}

// Parse a raw companyfacts payload into quarterly + annual statement series.
// Returns null when no usable revenue/net-income periods can be found, which
// signals the caller to fall back to another source.
export function parseCompanyFacts(
  ticker: string,
  companyfacts: CompanyFacts,
): FundamentalsData | null {
  const buildMaps = (
    pick: (cf: CompanyFacts, f: DurationField) => Map<string, number>,
  ): FieldMaps => ({
    duration: Object.fromEntries(
      Object.entries(DURATION_FIELDS).map(([k, f]) => [k, pick(companyfacts, f)]),
    ),
    helper: Object.fromEntries(
      Object.entries(HELPER_FIELDS).map(([k, f]) => [k, pick(companyfacts, f)]),
    ),
    instant: Object.fromEntries(
      Object.entries(INSTANT_FIELDS).map(([k, c]) => [
        k,
        instantField(companyfacts, c),
      ]),
    ),
  });

  const quarterlyMaps = buildMaps(quarterlyField);
  const annualMaps = buildMaps(annualField);

  const periodEnds = (maps: FieldMaps): string[] => {
    const ends = new Set<string>([
      ...maps.duration.revenue.keys(),
      ...maps.duration.netIncome.keys(),
    ]);
    return [...ends].sort();
  };

  const quarterly = periodEnds(quarterlyMaps).map((end) =>
    buildStatement(end, quarterlyMaps),
  );
  const annual = periodEnds(annualMaps).map((end) =>
    buildStatement(end, annualMaps),
  );

  if (quarterly.length === 0 && annual.length === 0) return null;

  return { ticker, quarterly, annual };
}
