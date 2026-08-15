import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = createServerSupabaseClient();

  // Only these are user-editable, and the client speaks camelCase. Anything else
  // in the body (user_id, id, created_at) is dropped rather than trusted.
  const columns: Record<string, string> = {
    name: "name",
    description: "description",
    benchmark: "benchmark",
    cashBalance: "cash_balance",
    cashCurrency: "cash_currency",
  };

  const updates: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(columns)) {
    if (key in body) updates[column] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  if (
    "cash_balance" in updates &&
    (typeof updates.cash_balance !== "number" ||
      !Number.isFinite(updates.cash_balance) ||
      updates.cash_balance < 0)
  ) {
    return NextResponse.json({ error: "Invalid cash balance" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("portfolios")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
