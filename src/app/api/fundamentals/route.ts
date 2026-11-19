import { NextRequest, NextResponse } from "next/server";
import { getFundamentals } from "@/lib/fundamentals";
import { ApiError, apiHandler } from "@/lib/apiHandler";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
};

export const GET = apiHandler("fundamentals", async (request: NextRequest) => {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    throw new ApiError(400, "ticker parameter is required");
  }

  const data = await getFundamentals(ticker);
  if (!data) {
    return NextResponse.json(
      { error: `No financial data available for ${ticker}` },
      { status: 404 },
    );
  }
  return NextResponse.json(data, { headers: CACHE_HEADERS });
});
