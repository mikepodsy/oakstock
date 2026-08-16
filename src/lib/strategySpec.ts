// The rule DSL, mirrored on the TypeScript side.
//
// Two jobs: give Claude a JSON schema to emit against, and re-validate whatever
// comes back before it reaches a subprocess. The model is not trusted to have
// obeyed its own schema — a spec that fails here never launches Python.
//
// KEEP IN SYNC with tools/backtest/oakbt/engine/rules.py (grammar),
// oakbt/data/features.py (FEATURES), and oakbt/data/universe.py (MARKETS).
// test_features.py::test_feature_registry_matches_the_typescript_catalog fails
// if the Python registry drifts from the list below.

export const COMPARISON_OPS = ["lt", "lte", "gt", "gte", "eq"] as const;
export const CROSSING_OPS = ["crosses_above", "crosses_below"] as const;
export const LOGICAL_OPS = ["and", "or", "not"] as const;

const ALL_OPS: string[] = [...COMPARISON_OPS, ...CROSSING_OPS, ...LOGICAL_OPS];

/** Trader categories the COT provider produces features for. */
const COT_CATEGORIES = [
  "lev_money",
  "asset_mgr",
  "dealer",
  "m_money",
  "swap",
  "prod_merc",
  "commercial",
  "noncommercial",
] as const;

export const FEATURES: string[] = [
  ...COT_CATEGORIES.map((c) => `cot_index_${c}`),
  ...COT_CATEGORIES.map((c) => `cot_z_${c}`),
  "cot_oi_index",
].sort();

export interface MarketInfo {
  code: string;
  label: string;
  proxy: string;
  /** TFF markets expose lev_money; disaggregated ones expose m_money. */
  dataset: "tff" | "disaggregated";
  quality: "good" | "degraded";
}

export const MARKETS: MarketInfo[] = [
  { code: "SP500", label: "S&P 500", proxy: "SPY", dataset: "tff", quality: "good" },
  { code: "NASDAQ100", label: "Nasdaq 100", proxy: "QQQ", dataset: "tff", quality: "good" },
  { code: "RUSSELL2000", label: "Russell 2000", proxy: "IWM", dataset: "tff", quality: "good" },
  { code: "GOLD", label: "Gold", proxy: "GLD", dataset: "disaggregated", quality: "good" },
  { code: "SILVER", label: "Silver", proxy: "SLV", dataset: "disaggregated", quality: "good" },
  { code: "COPPER", label: "Copper", proxy: "CPER", dataset: "disaggregated", quality: "good" },
  { code: "USDINDEX", label: "US Dollar Index", proxy: "UUP", dataset: "tff", quality: "good" },
  { code: "EUR", label: "Euro", proxy: "FXE", dataset: "tff", quality: "good" },
  { code: "JPY", label: "Japanese Yen", proxy: "FXY", dataset: "tff", quality: "good" },
  { code: "GBP", label: "British Pound", proxy: "FXB", dataset: "tff", quality: "good" },
  { code: "CAD", label: "Canadian Dollar", proxy: "FXC", dataset: "tff", quality: "good" },
  { code: "WTI", label: "Crude Oil WTI", proxy: "USO", dataset: "disaggregated", quality: "degraded" },
  { code: "NATGAS", label: "Natural Gas", proxy: "UNG", dataset: "disaggregated", quality: "degraded" },
  { code: "UST30Y", label: "30-Year T-Bond", proxy: "TLT", dataset: "tff", quality: "good" },
  { code: "UST10Y", label: "10-Year T-Note", proxy: "IEF", dataset: "tff", quality: "good" },
  { code: "UST5Y", label: "5-Year T-Note", proxy: "IEI", dataset: "tff", quality: "good" },
];

export const MARKET_CODES = MARKETS.map((m) => m.code);

export interface RuleSpec {
  market: string | null;
  ticker?: string | null;
  rules: { when: unknown; weight: number }[];
  hold_between: boolean;
  execution?: {
    signal_lag?: number;
    commission_bps?: number;
    slippage_bps?: number;
    target_vol?: number | null;
    max_leverage?: number;
    stop_pct?: number | null;
    stop_atr_mult?: number | null;
    trailing_stop?: boolean;
  };
  start?: string | null;
  end?: string | null;
  explanation: string;
  /** Set when the request cannot be expressed; `rules` is then empty. */
  unsupported?: string | null;
}

// ── Wire form ─────────────────────────────────────────────────────────────────
// Structured outputs supports neither recursive schemas nor objects without
// `additionalProperties: false`, so the nested expression tree cannot be the
// wire shape. The model emits a FLAT condition list instead, which compiles to
// the tree in conditionsToExpr(). Python's evaluator still understands the full
// nested grammar — hand-written specs and future clients keep that power; only
// the composer is constrained to depth 2 (one all/any over simple comparisons),
// which covers essentially every positioning strategy anyone types.

export interface WireCondition {
  left: string;
  op: string;
  right: number | string;
  negate: boolean;
}

export interface WireWhen {
  combinator: "all" | "any";
  conditions: WireCondition[];
}

/** Compile the flat wire form into the nested expression tree the engine runs. */
export function conditionsToExpr(when: WireWhen): unknown {
  const parts = when.conditions.map((c) => {
    const node = { [c.op]: [c.left, c.right] };
    return c.negate ? { not: node } : node;
  });
  if (parts.length === 0) {
    throw new SpecValidationError("a rule needs at least one condition");
  }
  if (parts.length === 1) return parts[0];
  return { [when.combinator === "any" ? "or" : "and"]: parts };
}

const CONDITION_SCHEMA = {
  type: "object",
  properties: {
    left: {
      type: "string",
      enum: FEATURES,
      description: "The feature being tested",
    },
    op: {
      type: "string",
      enum: [...COMPARISON_OPS, ...CROSSING_OPS],
    },
    right: {
      anyOf: [
        { type: "number" },
        { type: "string", enum: FEATURES },
      ],
      description: "A threshold number, or another feature to compare against",
    },
    negate: { type: "boolean", description: "Invert this condition. Usually false." },
  },
  required: ["left", "op", "right", "negate"],
  additionalProperties: false,
} as const;

const WHEN_SCHEMA = {
  type: "object",
  properties: {
    combinator: {
      type: "string",
      enum: ["all", "any"],
      description: "all = every condition must hold; any = at least one",
    },
    conditions: { type: "array", items: CONDITION_SCHEMA },
  },
  required: ["combinator", "conditions"],
  additionalProperties: false,
} as const;

export const RULE_SPEC_SCHEMA = {
  type: "object",
  properties: {
    // anyOf rather than `type: ["string","null"] + enum` — structured outputs
    // rejects an enum whose values don't match a union-typed declaration.
    market: {
      anyOf: [{ type: "string", enum: MARKET_CODES }, { type: "null" }],
      description: "COT market code to trade, or null if unsupported",
    },
    rules: {
      type: "array",
      description:
        "Evaluated in order; the FIRST rule whose `when` is true sets that bar's weight.",
      items: {
        type: "object",
        properties: {
          when: WHEN_SCHEMA,
          weight: {
            type: "number",
            description: "Target position in [-1, 1]. 1 = fully long, -1 = fully short.",
          },
        },
        required: ["when", "weight"],
        additionalProperties: false,
      },
    },
    hold_between: {
      type: "boolean",
      description:
        "When no rule matches: true holds the previous position (usual for " +
        "positioning signals), false goes flat.",
    },
    execution: {
      type: "object",
      properties: {
        signal_lag: { type: "integer" },
        target_vol: { anyOf: [{ type: "number" }, { type: "null" }] },
        stop_pct: { anyOf: [{ type: "number" }, { type: "null" }] },
        stop_atr_mult: { anyOf: [{ type: "number" }, { type: "null" }] },
        trailing_stop: { type: "boolean" },
        commission_bps: { type: "number" },
        slippage_bps: { type: "number" },
        max_leverage: { type: "number" },
      },
      // Structured outputs requires every property to be listed in `required`.
      required: [
        "signal_lag",
        "target_vol",
        "stop_pct",
        "stop_atr_mult",
        "trailing_stop",
        "commission_bps",
        "slippage_bps",
        "max_leverage",
      ],
      additionalProperties: false,
    },
    start: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "ISO date or null",
    },
    end: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "ISO date or null",
    },
    explanation: {
      type: "string",
      description: "One or two plain-English sentences restating the strategy.",
    },
    unsupported: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "If the request cannot be expressed with the available features, explain " +
        "why here and leave `rules` empty. Never approximate.",
    },
  },
  required: [
    "market",
    "rules",
    "hold_between",
    "execution",
    "start",
    "end",
    "explanation",
    "unsupported",
  ],
  additionalProperties: false,
} as const;

/**
 * Rewrite a model-emitted spec (flat `when` conditions) into the engine's
 * nested-expression form. Idempotent: a spec already in tree form passes through.
 */
export function normalizeSpec(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const s = { ...(raw as Record<string, unknown>) };
  const rules = s.rules;
  if (!Array.isArray(rules)) return s;

  s.rules = rules.map((rule) => {
    if (typeof rule !== "object" || rule === null) return rule;
    const r = { ...(rule as Record<string, unknown>) };
    const when = r.when as Partial<WireWhen> | undefined;
    if (when && Array.isArray(when.conditions)) {
      r.when = conditionsToExpr({
        combinator: when.combinator === "any" ? "any" : "all",
        conditions: when.conditions as WireCondition[],
      });
    }
    return r;
  });
  return s;
}

// ── Validation ────────────────────────────────────────────────────────────────

export class SpecValidationError extends Error {}

const MAX_DEPTH = 12;

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateExpr(expr: unknown, path: string, depth = 0): void {
  if (depth > MAX_DEPTH) {
    throw new SpecValidationError(`${path}: nested deeper than ${MAX_DEPTH} levels`);
  }
  if (typeof expr !== "object" || expr === null || Array.isArray(expr)) {
    throw new SpecValidationError(`${path}: expected an expression object`);
  }

  const keys = Object.keys(expr as Record<string, unknown>);
  if (keys.length !== 1) {
    throw new SpecValidationError(
      `${path}: expression must have exactly one operator, got [${keys.join(", ")}]`
    );
  }

  const op = keys[0];
  const args = (expr as Record<string, unknown>)[op];

  if (!ALL_OPS.includes(op)) {
    throw new SpecValidationError(
      `${path}: unknown operator "${op}". Supported: ${ALL_OPS.join(", ")}`
    );
  }

  if (op === "not") {
    validateExpr(args, `${path}.not`, depth + 1);
    return;
  }

  if (op === "and" || op === "or") {
    if (!Array.isArray(args) || args.length < 2) {
      throw new SpecValidationError(
        `${path}: "${op}" takes a list of at least two expressions`
      );
    }
    args.forEach((a, i) => validateExpr(a, `${path}.${op}[${i}]`, depth + 1));
    return;
  }

  // Comparison or crossing: exactly two operands, each a feature or a number.
  if (!Array.isArray(args) || args.length !== 2) {
    throw new SpecValidationError(`${path}: "${op}" takes exactly two operands`);
  }
  for (const operand of args) {
    if (isNumber(operand)) continue;
    if (typeof operand === "string") {
      if (!FEATURES.includes(operand)) {
        throw new SpecValidationError(
          `${path}: unknown feature "${operand}". Available: ${FEATURES.join(", ")}`
        );
      }
      continue;
    }
    throw new SpecValidationError(
      `${path}: invalid operand ${JSON.stringify(operand)} — expected a feature name or a number`
    );
  }
}

/** Throws SpecValidationError naming the offending field. */
export function validateSpec(spec: unknown): asserts spec is RuleSpec {
  if (typeof spec !== "object" || spec === null) {
    throw new SpecValidationError("spec must be an object");
  }
  const s = spec as Record<string, unknown>;

  const unsupported = s.unsupported;
  if (unsupported != null && typeof unsupported !== "string") {
    throw new SpecValidationError("`unsupported` must be a string or null");
  }

  const rules = s.rules;
  if (!Array.isArray(rules)) {
    throw new SpecValidationError("`rules` must be an array");
  }

  // A spec that declares itself inexpressible legitimately carries no rules.
  if (rules.length === 0 && !unsupported) {
    throw new SpecValidationError("spec has no `rules` and no `unsupported` explanation");
  }

  if (!unsupported) {
    const market = s.market;
    if (typeof market !== "string" || !MARKET_CODES.includes(market)) {
      throw new SpecValidationError(
        `unknown market ${JSON.stringify(market)}. Known: ${MARKET_CODES.join(", ")}`
      );
    }
  }

  rules.forEach((rule, i) => {
    if (typeof rule !== "object" || rule === null) {
      throw new SpecValidationError(`rules[${i}] must be an object`);
    }
    const r = rule as Record<string, unknown>;
    if (!("when" in r)) {
      throw new SpecValidationError(`rules[${i}] is missing \`when\``);
    }
    if (!isNumber(r.weight)) {
      throw new SpecValidationError(
        `rules[${i}].weight must be a number, got ${JSON.stringify(r.weight)}`
      );
    }
    if (r.weight < -1 || r.weight > 1) {
      throw new SpecValidationError(
        `rules[${i}].weight must be within [-1, 1], got ${r.weight}`
      );
    }
    validateExpr(r.when, `rules[${i}].when`);
  });
}

/** True when the spec describes something the DSL can actually run. */
export function isRunnable(spec: RuleSpec): boolean {
  return !spec.unsupported && spec.rules.length > 0;
}
