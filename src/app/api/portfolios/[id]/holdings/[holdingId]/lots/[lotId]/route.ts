import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type Params = Promise<{ id: string; holdingId: string; lotId: string }>;

async function verifyOwnership(userId: string, portfolioId: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function PUT(req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: portfolioId, holdingId, lotId } = await params;
  if (!(await verifyOwnership(userId, portfolioId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const supabase = createServerSupabaseClient();

  // Map camelCase to snake_case
  const updates: Record<string, unknown> = {};
  if (body.shares !== undefined) updates.shares = body.shares;
  if (body.costPerShare !== undefined) updates.cost_per_share = body.costPerShare;
  if (body.purchaseDate !== undefined) updates.purchase_date = body.purchaseDate;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data, error } = await supabase
    .from("lots")
    .update(updates)
    .eq("id", lotId)
    .eq("holding_id", holdingId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    id: data.id,
    shares: data.shares,
    costPerShare: data.cost_per_share,
    purchaseDate: data.purchase_date,
    notes: data.notes,
  });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: portfolioId, holdingId, lotId } = await params;
  if (!(await verifyOwnership(userId, portfolioId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("lots")
    .delete()
    .eq("id", lotId)
    .eq("holding_id", holdingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
