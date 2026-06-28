import { NextResponse } from "next/server";
import { fetchMacroNews } from "@/lib/news";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

export async function GET() {
  const items = await fetchMacroNews();
  console.log(`Fetched ${items.length} macro news items`);
  return NextResponse.json(items, { headers: CACHE_HEADERS });
}
