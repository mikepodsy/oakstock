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

export async function PUT(req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: portfolioId, holdingId } = await params;
  if (!(await verifyOwnership(userId, portfolioId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("holdings")
    .update(body)
    .eq("id", holdingId)
    .eq("portfolio_id", portfolioId)
    .select("*, lots(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: portfolioId, holdingId } = await params;
  if (!(await verifyOwnership(userId, portfolioId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("holdings")
    .delete()
    .eq("id", holdingId)
    .eq("portfolio_id", portfolioId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
