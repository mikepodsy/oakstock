// Period math over raw XBRL facts. These functions are pure (no network) so the
// parsing logic can be validated against saved companyfacts fixtures.

export interface RawFact {
  start?: string; // ISO date; absent on instant facts
  end: string; // ISO date
  val: number;
  filed: string; // ISO date — used to pick the latest value on restatements
  form?: string;
}

// Fiscal calendars (e.g. Apple's 4-4-5) make periods 13 or 14 weeks, so we
// classify by day-count ranges, not exact lengths.
export type DurationKind = "Q" | "H" | "9M" | "FY" | null;

export function daysBetween(startISO: string, endISO: string): number {
  const start = Date.parse(startISO);
  const end = Date.parse(endISO);
  return Math.round((end - start) / 86_400_000);
}

export function classifyDuration(days: number): DurationKind {
  if (days >= 80 && days <= 100) return "Q";
  if (days >= 170 && days <= 200) return "H"; // 6-month YTD
  if (days >= 260 && days <= 285) return "9M"; // 9-month YTD
  if (days >= 350 && days <= 380) return "FY";
  return null;
}

// Collapse restatements: for a given (start,end) keep only the most recently
// filed value.
export function dedupeLatestFiled(facts: RawFact[]): RawFact[] {
  const byPeriod = new Map<string, RawFact>();
  for (const f of facts) {
    const key = `${f.start ?? ""}|${f.end}`;
    const prev = byPeriod.get(key);
    if (!prev || f.filed > prev.filed) byPeriod.set(key, f);
  }
  return [...byPeriod.values()];
}

// Build a map of single-quarter values (keyed by period-end ISO date) from
// duration facts.
//
//   - Natively-tagged 3-month facts are used directly (most authoritative).
//   - Remaining quarters are reconstructed from cumulative YTD facts: within a
//     fiscal year (same `start`), consecutive ends are subtracted, but only
//     when the gap between them is itself ~one quarter (guards against missing
//     intermediate filings producing a bogus multi-quarter "quarter").
export function quarterlyFromDuration(
  rawFacts: RawFact[],
  derivable: boolean,
): Map<string, number> {
  const facts = dedupeLatestFiled(rawFacts).filter((f) => f.start);
  const result = new Map<string, number>();

  if (derivable) {
    const byStart = new Map<string, RawFact[]>();
    for (const f of facts) {
      const arr = byStart.get(f.start!) ?? [];
      arr.push(f);
      byStart.set(f.start!, arr);
    }
    for (const group of byStart.values()) {
      group.sort((a, b) => a.end.localeCompare(b.end));
      for (let i = 0; i < group.length; i++) {
        const f = group[i];
        if (i === 0) {
          // First period of the fiscal year is a real quarter only if it is
          // itself ~3 months long.
          if (classifyDuration(daysBetween(f.start!, f.end)) === "Q") {
            result.set(f.end, f.val);
          }
          continue;
        }
        const prev = group[i - 1];
        if (classifyDuration(daysBetween(prev.end, f.end)) === "Q") {
          result.set(f.end, f.val - prev.val);
        }
      }
    }
  }

  // Native 3-month facts win over any derived value for the same end date.
  for (const f of facts) {
    if (classifyDuration(daysBetween(f.start!, f.end)) === "Q") {
      result.set(f.end, f.val);
    }
  }

  return result;
}

// Annual values keyed by fiscal-year-end ISO date. Full-year facts only — never
// derived.
export function annualFromDuration(rawFacts: RawFact[]): Map<string, number> {
  const facts = dedupeLatestFiled(rawFacts).filter((f) => f.start);
  const result = new Map<string, number>();
  for (const f of facts) {
    if (classifyDuration(daysBetween(f.start!, f.end)) === "FY") {
      result.set(f.end, f.val);
    }
  }
  return result;
}

// Instant facts valued at each period-end date (latest filed wins).
export function instantByEnd(rawFacts: RawFact[]): Map<string, number> {
  const result = new Map<string, number>();
  const filedByEnd = new Map<string, string>();
  for (const f of rawFacts) {
    const prevFiled = filedByEnd.get(f.end);
    if (!prevFiled || f.filed > prevFiled) {
      filedByEnd.set(f.end, f.filed);
      result.set(f.end, f.val);
    }
  }
  return result;
}

export function deriveEbitda(
  operatingIncome: number | null,
  dna: number | null,
): number | null {
  if (operatingIncome == null || dna == null) return null;
  return operatingIncome + dna;
}

export function deriveFreeCashFlow(
  operatingCashFlow: number | null,
  capex: number | null,
): number | null {
  if (operatingCashFlow == null || capex == null) return null;
  // capex is reported as a positive cash outflow.
  return operatingCashFlow - capex;
}
