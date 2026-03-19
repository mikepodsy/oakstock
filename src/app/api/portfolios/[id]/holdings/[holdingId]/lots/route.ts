import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type Params = Promise<{ id: string; holdingId: string }>;

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

export async function POST(req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: portfolioId, holdingId } = await params;
  if (!(await verifyOwnership(userId, portfolioId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { shares, costPerShare, purchaseDate, notes } = body;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lots")
    .insert({
      holding_id: holdingId,
      shares,
      cost_per_share: costPerShare,
      purchase_date: purchaseDate,
      notes,
    })
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
