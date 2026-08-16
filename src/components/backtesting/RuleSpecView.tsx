"use client";

import type { RuleSpec } from "@/lib/strategySpec";
import { MARKETS } from "@/lib/strategySpec";

// Renders the compiled rule tree back as English. This is the trust surface:
// if the composer misread the request, this is where you see it.

const OP_WORDS: Record<string, string> = {
  lt: "is below",
  lte: "is at or below",
  gt: "is above",
  gte: "is at or above",
  eq: "equals",
  crosses_above: "crosses above",
  crosses_below: "crosses below",
};

const FEATURE_WORDS: Record<string, string> = {
  cot_index: "positioning index",
  cot_z: "positioning z-score",
  cot_oi_index: "open-interest index",
};

const CATEGORY_WORDS: Record<string, string> = {
  lev_money: "leveraged funds",
  asset_mgr: "asset managers",
  dealer: "dealers",
  m_money: "managed money",
  swap: "swap dealers",
  prod_merc: "producers",
  commercial: "commercials",
  noncommercial: "non-commercials",
};

function describeOperand(operand: unknown): string {
  if (typeof operand === "number") return String(operand);
  if (typeof operand !== "string") return JSON.stringify(operand);

  if (operand === "cot_oi_index") return FEATURE_WORDS.cot_oi_index;

  const indexMatch = operand.match(/^cot_index_(.+)$/);
  if (indexMatch) {
    return `${CATEGORY_WORDS[indexMatch[1]] ?? indexMatch[1]} ${FEATURE_WORDS.cot_index}`;
  }
  const zMatch = operand.match(/^cot_z_(.+)$/);
  if (zMatch) {
    return `${CATEGORY_WORDS[zMatch[1]] ?? zMatch[1]} ${FEATURE_WORDS.cot_z}`;
  }
  return operand;
}

function describeExpr(expr: unknown): string {
  if (typeof expr !== "object" || expr === null) return String(expr);

  const keys = Object.keys(expr as Record<string, unknown>);
  if (keys.length !== 1) return JSON.stringify(expr);

  const op = keys[0];
  const args = (expr as Record<string, unknown>)[op];

  if (op === "not") return `not (${describeExpr(args)})`;
  if ((op === "and" || op === "or") && Array.isArray(args)) {
    return args.map(describeExpr).join(op === "and" ? " and " : " or ");
  }
  if (Array.isArray(args) && args.length === 2) {
    return `${describeOperand(args[0])} ${OP_WORDS[op] ?? op} ${describeOperand(args[1])}`;
  }
  return JSON.stringify(expr);
}

function describeWeight(weight: number): string {
  if (weight === 1) return "go fully long";
  if (weight === -1) return "go fully short";
  if (weight === 0) return "go flat";
  if (weight > 0) return `go ${Math.round(weight * 100)}% long`;
  return `go ${Math.round(Math.abs(weight) * 100)}% short`;
}

export function RuleSpecView({ spec, prompt }: { spec: RuleSpec; prompt?: string | null }) {
  const market = MARKETS.find((m) => m.code === spec.market);
  const ex = spec.execution ?? {};

  return (
    <div className="flex flex-col gap-2 text-sm">
      {prompt && (
        <p className="text-text-secondary">
          <span className="text-text-tertiary">You asked:</span>{" "}
          <span className="italic">&ldquo;{prompt}&rdquo;</span>
        </p>
      )}

      {spec.unsupported ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-amber-500">
          {spec.unsupported}
        </p>
      ) : (
        <>
          <p className="text-text-primary">
            Trading{" "}
            <span className="font-financial">{market?.proxy ?? spec.ticker}</span>
            {market && (
              <span className="text-text-tertiary"> ({market.label} positioning)</span>
            )}
          </p>

          <ol className="flex flex-col gap-1">
            {spec.rules.map((rule, i) => (
              <li className="flex gap-2 text-text-secondary" key={i}>
                <span className="text-text-tertiary">{i + 1}.</span>
                <span>
                  When {describeExpr(rule.when)} —{" "}
                  <span className="text-text-primary">
                    {describeWeight(rule.weight)}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-text-tertiary">
            {spec.hold_between
              ? "Otherwise: hold the previous position."
              : "Otherwise: flat."}
            {ex.stop_pct != null &&
              ` Stop at ${(ex.stop_pct * 100).toFixed(1)}%.`}
            {ex.target_vol != null &&
              ` Sized to ${(ex.target_vol * 100).toFixed(0)}% annualised vol.`}
            {ex.target_vol === null && " Full notional, no vol targeting."}
          </p>
        </>
      )}
    </div>
  );
}
