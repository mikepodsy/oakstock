import type { CotReport } from "@/types";

export async function fetchCotData(signal?: AbortSignal): Promise<CotReport[]> {
  const res = await fetch("/api/cot", { signal });
  if (!res.ok) throw new Error(`COT fetch failed: ${res.status}`);
  return res.json();
}
