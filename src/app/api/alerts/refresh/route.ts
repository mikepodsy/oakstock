import { NextResponse } from "next/server";
import { refreshMomentum } from "@/lib/momentumRefresh";
import { LARGECAP_UNIVERSE } from "@/utils/constants";

// Bulk momentum refresh for the large-cap universe. Delegates to the shared
// `refreshMomentum` engine, which fetches ~2y of daily candles per ticker via
// Yahoo, computes 50d/200d momentum, and upserts into `momentum_status`.
// Triggered daily by Vercel cron and on-demand by the page's Refresh button.
// Fetching hundreds of histories takes ~20-40s, hence the extended maxDuration.
export const maxDuration = 300;

export async function GET() {
  try {
    const result = await refreshMomentum(
      LARGECAP_UNIVERSE as readonly string[],
      "momentum_status"
    );
    return NextResponse.json({ ...result, errors: result.errors.slice(0, 20) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "Failed to refresh momentum", detail }, { status: 500 });
  }
}
