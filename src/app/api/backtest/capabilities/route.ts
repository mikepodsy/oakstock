import { apiHandler } from "@/lib/apiHandler";

// The composer needs a local Python process, so it only exists when the local
// runner is explicitly enabled. On the deployed site the flag is unset and
// /backtesting stays the read-only viewer.
export const GET = apiHandler("backtest-capabilities", async () => {
  return Response.json(
    {
      composer:
        process.env.BACKTEST_LOCAL_RUNNER === "1" &&
        Boolean(process.env.ANTHROPIC_API_KEY),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
