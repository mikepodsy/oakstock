import { NextResponse } from "next/server";
import { refreshMomentum } from "@/lib/momentumRefresh";
import { ETF_UNIVERSE } from "@/utils/constants";

// Bulk momentum refresh for the ETF universe (RADAR categories minus
// leveraged/inverse). Mirrors the large-cap refresh via the shared engine,
// upserting into `etf_momentum_status`. Triggered daily by Vercel cron and
// on-demand by the Alerts page. ~300 histories runs longer than the large-cap
// pass, hence the extended maxDuration.
export const maxDuration = 300;

export async function GET() {
  try {
    const result = await refreshMomentum(ETF_UNIVERSE, "etf_momentum_status");
    return NextResponse.json({ ...result, errors: result.errors.slice(0, 20) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "Failed to refresh ETF momentum", detail }, { status: 500 });
  }
}
