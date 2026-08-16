import { spawn } from "node:child_process";
import path from "node:path";
import { ApiError, apiHandler } from "@/lib/apiHandler";
import { SpecValidationError, isRunnable, validateSpec } from "@/lib/strategySpec";

export const maxDuration = 300;

const TIMEOUT_MS = 180_000;
const PACKAGE_DIR = path.join(process.cwd(), "tools", "backtest");

// A backtest is CPU- and network-heavy; one at a time keeps a stray double-click
// from spawning parallel backfills of the same market.
let inFlight = false;

interface RunnerResult {
  ok: boolean;
  run_id?: string;
  ticker?: string;
  market_code?: string | null;
  error?: string;
}

function runSpec(payload: string): Promise<RunnerResult> {
  return new Promise((resolve, reject) => {
    // Spec goes over stdin, never argv: it originates from a text box, and
    // nothing user-authored should be assembled into a command line.
    const child = spawn("python3", ["-m", "oakbt.cli", "run-spec"], {
      cwd: PACKAGE_DIR,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGKILL");
      reject(new ApiError(504, `Backtest exceeded ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new ApiError(
          500,
          "Could not start the backtest engine",
          `${err.message} (is python3 on PATH?)`
        )
      );
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      // The CLI reports both success and failure as a JSON line on stdout.
      const line = stdout.trim().split("\n").filter(Boolean).pop();
      if (line) {
        try {
          resolve(JSON.parse(line) as RunnerResult);
          return;
        } catch {
          /* fall through to the stderr path */
        }
      }
      reject(
        new ApiError(
          500,
          "Backtest engine failed",
          `exit ${code}: ${stderr.trim().split("\n").slice(-4).join(" | ").slice(0, 500)}`
        )
      );
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

export const POST = apiHandler("backtest-run", async (request: Request) => {
  if (process.env.BACKTEST_LOCAL_RUNNER !== "1") {
    throw new ApiError(
      503,
      "Running backtests is disabled here",
      "Set BACKTEST_LOCAL_RUNNER=1 in .env.local and run the app locally."
    );
  }

  const body = (await request.json()) as { spec?: unknown; prompt?: unknown };

  try {
    validateSpec(body.spec);
  } catch (err) {
    if (err instanceof SpecValidationError) {
      throw new ApiError(400, `Invalid strategy: ${err.message}`);
    }
    throw err;
  }

  if (!isRunnable(body.spec)) {
    throw new ApiError(
      400,
      body.spec.unsupported || "This strategy cannot be expressed"
    );
  }

  if (inFlight) {
    throw new ApiError(429, "A backtest is already running — wait for it to finish");
  }

  inFlight = true;
  try {
    const result = await runSpec(
      JSON.stringify({
        spec: body.spec,
        prompt: typeof body.prompt === "string" ? body.prompt : null,
      })
    );

    if (!result.ok) {
      throw new ApiError(400, result.error || "Backtest failed");
    }

    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } finally {
    inFlight = false;
  }
});
