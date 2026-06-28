import { NextRequest, NextResponse } from "next/server";
import { fetchStockNews } from "@/lib/news";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols");
  const symbols = (symbolsParam ?? "").split(",");
  const items = await fetchStockNews(symbols);
  return NextResponse.json(items, { headers: CACHE_HEADERS });
}
