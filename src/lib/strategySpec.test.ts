import { describe, expect, it } from "vitest";
import {
  FEATURES,
  MARKET_CODES,
  RULE_SPEC_SCHEMA,
  SpecValidationError,
  isRunnable,
  validateSpec,
} from "./strategySpec";

const valid = () => ({
  market: "GOLD",
  rules: [
    { when: { lt: ["cot_index_m_money", 15] }, weight: 1 },
    { when: { gt: ["cot_index_m_money", 85] }, weight: -1 },
  ],
  hold_between: true,
  explanation: "Fade crowded managed-money positioning in gold.",
  unsupported: null,
});

describe("validateSpec", () => {
  it("accepts a well-formed spec", () => {
    expect(() => validateSpec(valid())).not.toThrow();
  });

  it("accepts nested and/or/not expressions", () => {
    const spec = {
      ...valid(),
      rules: [
        {
          when: {
            and: [
              { lt: ["cot_index_m_money", 20] },
              { not: { gt: ["cot_z_m_money", 2] } },
            ],
          },
          weight: 1,
        },
      ],
    };
    expect(() => validateSpec(spec)).not.toThrow();
  });

  it("accepts crossover expressions", () => {
    const spec = {
      ...valid(),
      rules: [{ when: { crosses_above: ["cot_index_m_money", 50] }, weight: 1 }],
    };
    expect(() => validateSpec(spec)).not.toThrow();
  });

  it("accepts comparing two features", () => {
    const spec = {
      ...valid(),
      rules: [{ when: { gt: ["cot_index_m_money", "cot_oi_index"] }, weight: 1 }],
    };
    expect(() => validateSpec(spec)).not.toThrow();
  });

  it("rejects an unknown feature and names it", () => {
    const spec = { ...valid(), rules: [{ when: { lt: ["rsi_14", 30] }, weight: 1 }] };
    expect(() => validateSpec(spec)).toThrow(/rsi_14/);
  });

  it("rejects an unknown market and names it", () => {
    expect(() => validateSpec({ ...valid(), market: "ATLANTIS" })).toThrow(/ATLANTIS/);
  });

  it("rejects an unknown operator", () => {
    const spec = {
      ...valid(),
      rules: [{ when: { __proto__: ["x", 1] }, weight: 1 }],
    };
    expect(() => validateSpec(spec)).toThrow(SpecValidationError);
  });

  it("rejects an expression with more than one operator", () => {
    const spec = {
      ...valid(),
      rules: [
        { when: { lt: ["cot_index_m_money", 1], gt: ["cot_index_m_money", 9] }, weight: 1 },
      ],
    };
    expect(() => validateSpec(spec)).toThrow(/exactly one operator/);
  });

  it("rejects a non-numeric weight", () => {
    const spec = { ...valid(), rules: [{ when: { lt: ["cot_index_m_money", 15] }, weight: "big" }] };
    expect(() => validateSpec(spec)).toThrow(/weight/);
  });

  it("rejects a weight outside [-1, 1]", () => {
    const spec = { ...valid(), rules: [{ when: { lt: ["cot_index_m_money", 15] }, weight: 5 }] };
    expect(() => validateSpec(spec)).toThrow(/\[-1, 1\]/);
  });

  it("rejects a comparison with the wrong operand count", () => {
    const spec = { ...valid(), rules: [{ when: { lt: ["cot_index_m_money"] }, weight: 1 }] };
    expect(() => validateSpec(spec)).toThrow(/two operands/);
  });

  it("rejects a non-feature, non-number operand", () => {
    const spec = {
      ...valid(),
      rules: [{ when: { lt: [{ nested: true }, 5] }, weight: 1 }],
    };
    expect(() => validateSpec(spec)).toThrow(/operand/);
  });

  it("rejects an empty rule list with no explanation", () => {
    expect(() => validateSpec({ ...valid(), rules: [] })).toThrow(/unsupported/);
  });

  it("accepts an unsupported spec with no rules and no market", () => {
    const spec = {
      market: null,
      rules: [],
      hold_between: true,
      explanation: "",
      unsupported: "Needs RSI, which no feature provider produces.",
    };
    expect(() => validateSpec(spec)).not.toThrow();
  });

  it("names the offending rule index", () => {
    const spec = {
      ...valid(),
      rules: [
        { when: { lt: ["cot_index_m_money", 15] }, weight: 1 },
        { when: { lt: ["nope_feature", 15] }, weight: -1 },
      ],
    };
    expect(() => validateSpec(spec)).toThrow(/rules\[1\]/);
  });
});

describe("isRunnable", () => {
  it("is true for a spec with rules and no refusal", () => {
    const spec = valid();
    validateSpec(spec);
    expect(isRunnable(spec)).toBe(true);
  });

  it("is false when the model declined to express it", () => {
    const spec = {
      market: null,
      rules: [],
      hold_between: true,
      explanation: "",
      unsupported: "Needs earnings data.",
    };
    validateSpec(spec);
    expect(isRunnable(spec)).toBe(false);
  });
});

describe("catalogs", () => {
  it("exposes the COT features the Python registry produces", () => {
    // Mirrors test_features.py::test_feature_registry_matches_the_typescript_catalog
    expect(FEATURES).toContain("cot_index_lev_money");
    expect(FEATURES).toContain("cot_z_m_money");
    expect(FEATURES).toContain("cot_oi_index");
    expect(FEATURES).toHaveLength(17);
  });

  it("exposes all 16 markets", () => {
    expect(MARKET_CODES).toHaveLength(16);
    expect(MARKET_CODES).toContain("SP500");
    expect(MARKET_CODES).toContain("NATGAS");
  });

  it("constrains market to the known codes in the schema", () => {
    const marketEnum = RULE_SPEC_SCHEMA.properties.market.anyOf[0].enum as readonly unknown[];
    expect(marketEnum).toContain("GOLD");
    expect(RULE_SPEC_SCHEMA.properties.market.anyOf[1].type).toBe("null");
  });

  it("requires unsupported in the schema so refusal is always considered", () => {
    expect(RULE_SPEC_SCHEMA.required).toContain("unsupported");
  });
});
