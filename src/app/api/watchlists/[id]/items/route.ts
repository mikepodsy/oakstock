import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type Params = Promise<{ id: string }>;

async function verifyOwnership(userId: string, watchlistId: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("watchlists")
    .select("id")
    .eq("id", watchlistId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: watchlistId } = await params;
  if (!(await verifyOwnership(userId, watchlistId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { ticker, name, targetPrice, notes } = body;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({ watchlist_id: watchlistId, ticker, name, target_price: targetPrice, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    id: data.id,
    ticker: data.ticker,
    name: data.name,
    addedAt: data.added_at,
    targetPrice: data.target_price,
    notes: data.notes,
  });
}
