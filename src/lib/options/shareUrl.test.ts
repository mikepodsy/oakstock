import { describe, it, expect } from "vitest";
import { encodeLegs, decodeLegs } from "./shareUrl";
import type { OptionLeg } from "@/types/options";

function mkLeg(p: Partial<OptionLeg>): OptionLeg {
  return {
    id: "x",
    action: "buy",
    type: "call",
    qty: 1,
    expiry: "2026-07-17",
    strike: 100,
    mid: 3.2,
    iv: 0.4,
    ivOverride: null,
    greeks: null,
    ...p,
  };
}

describe("share URL round-trip", () => {
  it("encodes and decodes a multi-leg position", () => {
    const legs = [
      mkLeg({ action: "buy", type: "call", strike: 100, qty: 1 }),
      mkLeg({ action: "sell", type: "call", strike: 105, qty: 2 }),
    ];
    const params = encodeLegs(legs);
    const decoded = decodeLegs(new URLSearchParams(params));
    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toMatchObject({ action: "buy", type: "call", strike: 100, qty: 1, expiry: "2026-07-17" });
    expect(decoded[1]).toMatchObject({ action: "sell", type: "call", strike: 105, qty: 2 });
  });

  it("returns an empty array when there are no leg params", () => {
    expect(decodeLegs(new URLSearchParams("ticker=AAPL"))).toEqual([]);
  });

  it("ignores malformed legs", () => {
    const decoded = decodeLegs(new URLSearchParams("leg=buy.call.notanumber.1.2026-07-17"));
    expect(decoded).toEqual([]);
  });
});
