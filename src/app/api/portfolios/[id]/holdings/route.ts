import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: portfolioId } = await params;
  const body = await req.json();
  const { ticker, name, currency = "USD", notes, lots: initialLots } = body;

  const supabase = createServerSupabaseClient();

  // Verify portfolio belongs to user
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .single();

  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });

  const { data: holding, error } = await supabase
    .from("holdings")
    .insert({ portfolio_id: portfolioId, ticker, name, currency, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Atomically insert initial lots if provided
  let lots: unknown[] = [];
  if (Array.isArray(initialLots) && initialLots.length > 0) {
    const { data: createdLots, error: lotError } = await supabase
      .from("lots")
      .insert(
        initialLots.map((l: { shares: number; costPerShare: number; purchaseDate: string; notes?: string }) => ({
          holding_id: holding.id,
          shares: l.shares,
          cost_per_share: l.costPerShare,
          purchase_date: l.purchaseDate,
          notes: l.notes,
        }))
      )
      .select();
    if (!lotError && createdLots) {
      lots = createdLots.map((l) => ({
        id: l.id,
        shares: l.shares,
        costPerShare: l.cost_per_share,
        purchaseDate: l.purchase_date,
        notes: l.notes,
      }));
    }
  }

  return NextResponse.json({ ...holding, lots });
}
