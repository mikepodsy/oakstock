import type { FundamentalsData } from "@/types";
import { getCik } from "./cik";
import { fetchCompanyFacts } from "./client";
import { parseCompanyFacts, type CompanyFacts } from "./parse";

// Fetch and parse SEC EDGAR fundamentals for a ticker. Returns null whenever
// EDGAR can't supply usable data (no CIK, fetch failure, or no parseable
// periods), which is the signal for the caller to fall back to Yahoo.
export async function getEdgarFundamentals(
  ticker: string,
): Promise<FundamentalsData | null> {
  const cik = await getCik(ticker);
  if (!cik) return null;

  const companyfacts = (await fetchCompanyFacts(cik)) as CompanyFacts | null;
  if (!companyfacts) return null;

  return parseCompanyFacts(ticker.toUpperCase(), companyfacts);
}

export { parseCompanyFacts };
