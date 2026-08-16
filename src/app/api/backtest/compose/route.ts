import Anthropic from "@anthropic-ai/sdk";
import { ApiError, apiHandler } from "@/lib/apiHandler";
import {
  FEATURES,
  MARKETS,
  RULE_SPEC_SCHEMA,
  SpecValidationError,
  normalizeSpec,
  validateSpec,
} from "@/lib/strategySpec";

const MAX_PROMPT_CHARS = 2000;

function buildSystemPrompt(): string {
  const marketLines = MARKETS.map(
    (m) =>
      `  ${m.code.padEnd(12)} ${m.label.padEnd(20)} trades ${m.proxy.padEnd(5)} ` +
      `dataset=${m.dataset}${m.quality === "degraded" ? "  (contango-prone proxy)" : ""}`
  ).join("\n");

  return `You translate a plain-English trading strategy into a typed rule spec that a
backtesting engine interprets. You do not write code — you emit JSON matching the
provided schema.

## Grammar

An expression is an object with EXACTLY ONE key:
  Comparison:  {"lt": [A, B]}  also: lte, gt, gte, eq
  Logical:     {"and": [expr, expr, ...]}  {"or": [...]}  {"not": expr}
  Crossover:   {"crosses_above": [A, B]}  {"crosses_below": [A, B]}
               (true only on the bar the crossing happens, not while merely above)

Each operand A/B is EITHER a feature name from the list below OR a number.
Nothing else is valid — no arithmetic, no functions, no other strings.

## Features

${FEATURES.map((f) => `  ${f}`).join("\n")}

Meaning:
  cot_index_<category>  Where that trader category's net position sits within its
                        3-year range, scaled 0-100. 0 = most short it has been,
                        100 = most long. "Washed out"/"capitulated" is a LOW value;
                        "crowded"/"stretched"/"extreme long" is a HIGH value.
  cot_z_<category>      Z-score of net positioning over a 3-year window.
                        Roughly: |z| > 2 is extreme.
  cot_oi_index          Total open interest within its 3-year range, 0-100.

Categories by report type — using the wrong one yields no data:
  TFF markets (indices, FX, bonds): lev_money (hedge funds), asset_mgr
    (institutions), dealer
  Disaggregated markets (metals, energy): m_money (managed money — the
    speculator cohort), swap, prod_merc (producers/hedgers)
  Either: commercial, noncommercial (legacy report)

## Markets

${marketLines}

## Rules

- \`rules\` are evaluated IN ORDER; the FIRST match sets that bar's weight.
- \`weight\` is the target position in [-1, 1]. 1 = fully long, -1 = fully short,
  0 = flat. Use fractional weights only if the user asks for partial sizing.
- \`hold_between\`: true means hold the previous position when no rule matches.
  This is almost always right for positioning signals — the thesis is that
  extremes revert, so the position should persist until the opposite extreme
  rather than flickering. Use false only if the user describes a signal that
  should flatten between triggers.
- \`execution.stop_pct\` is fractional (8% -> 0.08). \`target_vol\` defaults to
  0.15 annualised; set null only if the user asks for unscaled full-notional.

## Mean reversion is the default reading

"Fade", "when everyone is long", "crowded", "washed out", "capitulated",
"contrarian" all mean: go AGAINST the crowd. Long when the index is LOW, short
when it is HIGH. Only invert this if the user explicitly asks to follow or
trend-follow the positioning.

## When you cannot express the request

Set \`unsupported\` to a short explanation and leave \`rules\` empty. Do this when:
  - it needs data no feature above provides (RSI, moving averages, price
    patterns, earnings, valuation, volume, fundamentals)
  - it needs more than one instrument
  - it is too vague to pin to a specific threshold and you would have to invent
    the numbers

Say what is missing and, when there is one, suggest the nearest thing that IS
expressible. Never approximate silently — a backtest of a strategy the user did
not describe is worse than no backtest.

\`explanation\` restates what you built in one or two sentences, including the
actual thresholds, so the user can check you understood them.`;
}

export const POST = apiHandler("backtest-compose", async (request: Request) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ApiError(503, "ANTHROPIC_API_KEY is not configured");
  }

  const body = (await request.json()) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    throw new ApiError(400, "prompt is required");
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new ApiError(400, `prompt must be under ${MAX_PROMPT_CHARS} characters`);
  }

  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-5",
    // Thinking is on by default on Opus 5 and shares this budget with the
    // response, so leave real headroom even though the spec itself is small.
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: RULE_SPEC_SCHEMA },
    },
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: prompt }],
  });

  // Opus 5 runs safety classifiers; a decline returns HTTP 200 with empty
  // content, so check before indexing into it.
  if (res.stop_reason === "refusal") {
    throw new ApiError(502, "The model declined to answer this request");
  }

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ApiError(502, "No spec in the model response");
  }

  let spec: unknown;
  try {
    // The model emits flat condition lists (structured outputs can't express a
    // recursive tree); normalize into the engine's expression form.
    spec = normalizeSpec(JSON.parse(textBlock.text));
  } catch {
    throw new ApiError(502, "Model returned invalid JSON");
  }

  // The model is not trusted to have obeyed its own schema.
  try {
    validateSpec(spec);
  } catch (err) {
    if (err instanceof SpecValidationError) {
      throw new ApiError(422, `Model produced an invalid strategy: ${err.message}`);
    }
    throw err;
  }

  return Response.json({ prompt, spec }, {
    headers: { "Cache-Control": "no-store" },
  });
});
