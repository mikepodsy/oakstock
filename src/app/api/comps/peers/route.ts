import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiHandler } from "@/lib/apiHandler";
import { fetchSummary } from "@/lib/comps/load";
import { getPeers, normalizeTicker } from "@/lib/comps/peers";

// GET /api/comps/peers?ticker=NVDA[&refresh=1] → PeerResult
export const GET = apiHandler("comps/peers", async (request: NextRequest) => {
  const raw = request.nextUrl.searchParams.get("ticker");
  if (!raw) throw new ApiError(400, "ticker parameter is required");
  const ticker = normalizeTicker(raw);
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  let name = ticker;
  let industry: string | null = null;
  try {
    const s = await fetchSummary(ticker);
    name = s.price?.longName ?? s.price?.shortName ?? ticker;
    industry = s.assetProfile?.industry ?? null;
  } catch {
    throw new ApiError(404, `Unknown ticker ${ticker}`);
  }

  const result = await getPeers(ticker, { name, industry }, { refresh });
  return NextResponse.json(result);
});
