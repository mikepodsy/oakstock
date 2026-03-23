import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const voterId = request.nextUrl.searchParams.get("voterId");

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker parameter is required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: votes, error } = await supabase
    .from("sentiment_votes")
    .select("vote, voter_id")
    .eq("ticker", ticker.toUpperCase());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = { bearish: 0, neutral: 0, bullish: 0 };
  let userVote: string | null = null;

  for (const row of votes ?? []) {
    if (row.vote in counts) {
      counts[row.vote as keyof typeof counts]++;
    }
    if (voterId && row.voter_id === voterId) {
      userVote = row.vote;
    }
  }

  return NextResponse.json({ counts, userVote });
}

export async function POST(request: NextRequest) {
  let body: { ticker?: string; vote?: string; voterId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ticker, vote, voterId } = body;

  if (!ticker || !vote || !voterId) {
    return NextResponse.json(
      { error: "ticker, vote, and voterId are required" },
      { status: 400 }
    );
  }

  if (!["bearish", "neutral", "bullish"].includes(vote)) {
    return NextResponse.json(
      { error: "vote must be bearish, neutral, or bullish" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();
  const upperTicker = ticker.toUpperCase();

  // Check if user already has this exact vote (toggle off)
  const { data: existing } = await supabase
    .from("sentiment_votes")
    .select("vote")
    .eq("ticker", upperTicker)
    .eq("voter_id", voterId)
    .single();

  if (existing?.vote === vote) {
    // Same vote = toggle off (delete)
    await supabase
      .from("sentiment_votes")
      .delete()
      .eq("ticker", upperTicker)
      .eq("voter_id", voterId);

    return NextResponse.json({ userVote: null });
  }

  // Upsert the vote
  const { error } = await supabase.from("sentiment_votes").upsert(
    { ticker: upperTicker, vote, voter_id: voterId },
    { onConflict: "ticker,voter_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ userVote: vote });
}
