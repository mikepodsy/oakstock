import { describe, expect, it } from "vitest";
import { keepListed, MAX_PEERS, normalizeTicker, sanitizePeers } from "./peers";

describe("normalizeTicker", () => {
  it("upper-cases and turns class-share dots into dashes", () => {
    expect(normalizeTicker(" brk.b ")).toBe("BRK-B");
    expect(normalizeTicker("amd")).toBe("AMD");
  });
  it("keeps exchange suffixes", () => {
    expect(normalizeTicker("asml.as")).toBe("ASML.AS");
    expect(normalizeTicker("7203.T")).toBe("7203.T");
  });
});

describe("sanitizePeers", () => {
  it("drops the target, duplicates and junk", () => {
    const out = sanitizePeers(
      [
        { ticker: "NVDA", name: "self", reason: "" },
        { ticker: "amd", name: "AMD", reason: "GPU rival" },
        { ticker: "AMD", name: "dupe", reason: "" },
        { ticker: "not a ticker!", name: "x", reason: "" },
        { ticker: "", name: "", reason: "" },
        { ticker: "INTC", name: "", reason: " CPUs " },
      ],
      "nvda"
    );
    expect(out).toEqual([
      { ticker: "AMD", name: "AMD", reason: "GPU rival" },
      { ticker: "INTC", name: "INTC", reason: "CPUs" },
    ]);
  });
  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ticker: `T${i}`, name: "", reason: "" }));
    expect(sanitizePeers(many, "X")).toHaveLength(MAX_PEERS);
  });
});

describe("keepListed", () => {
  it("keeps only priced equities Yahoo returned, using Yahoo's name", () => {
    const out = keepListed(
      [
        { ticker: "AMD", name: "amd", reason: "r" },
        { ticker: "FAKE", name: "fake", reason: "r" },
        { ticker: "SPY", name: "spy", reason: "r" },
      ],
      [
        { symbol: "AMD", quoteType: "EQUITY", regularMarketPrice: 150, longName: "Advanced Micro Devices, Inc." },
        { symbol: "SPY", quoteType: "ETF", regularMarketPrice: 600 },
      ]
    );
    expect(out).toEqual([{ ticker: "AMD", name: "Advanced Micro Devices, Inc.", reason: "r" }]);
  });
});
