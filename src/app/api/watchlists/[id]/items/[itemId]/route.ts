import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type Params = Promise<{ id: string; itemId: string }>;

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

export async function PUT(req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: watchlistId, itemId } = await params;
  if (!(await verifyOwnership(userId, watchlistId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const supabase = createServerSupabaseClient();

  const updates: Record<string, unknown> = {};
  if (body.targetPrice !== undefined) updates.target_price = body.targetPrice;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data, error } = await supabase
    .from("watchlist_items")
    .update(updates)
    .eq("id", itemId)
    .eq("watchlist_id", watchlistId)
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

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: watchlistId, itemId } = await params;
  if (!(await verifyOwnership(userId, watchlistId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", itemId)
    .eq("watchlist_id", watchlistId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
