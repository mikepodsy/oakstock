import type { CotReport } from "@/types";

export async function fetchCotData(): Promise<CotReport[]> {
  const res = await fetch("/api/cot");
  if (!res.ok) throw new Error(`COT fetch failed: ${res.status}`);
  return res.json();
}
