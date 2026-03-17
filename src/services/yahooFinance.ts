import type { QuoteData, HistoricalDataPoint, FinancialData } from "@/types";

export async function fetchQuote(ticker: string): Promise<QuoteData> {
  const res = await fetch(`/api/quote?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`Failed to fetch quote for ${ticker}`);
  return res.json();
}

export async function fetchQuotes(tickers: string[]): Promise<QuoteData[]> {
  if (tickers.length === 0) return [];
  const res = await fetch(
    `/api/quotes?tickers=${tickers.map(encodeURIComponent).join(",")}`
  );
  if (!res.ok) throw new Error("Failed to fetch quotes");
  return res.json();
}

export async function searchTickers(
  query: string
): Promise<
  { ticker: string; name: string; exchange: string; type: string }[]
> {
  if (!query) return [];
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function fetchHistory(
  ticker: string,
  period: string = "1y"
): Promise<HistoricalDataPoint[]> {
  const res = await fetch(
    `/api/history?ticker=${encodeURIComponent(ticker)}&period=${period}`
  );
  if (!res.ok) throw new Error(`Failed to fetch history for ${ticker}`);
  return res.json();
}

export async function fetchFinancials(ticker: string): Promise<FinancialData> {
  const res = await fetch(`/api/financials?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`Failed to fetch financials for ${ticker}`);
  return res.json();
}
