import { describe, it, expect } from "vitest";
import { matchesQuery, searchTerms, type SearchableManager } from "./expertSearch";

const ROSTER: SearchableManager[] = [
  { name: "Bill Ackman", fund: "Pershing Square", strategy: "Activist / Concentrated" },
  { name: "Warren Buffett", fund: "Berkshire Hathaway", strategy: "Value / Long-term" },
  { name: "Peter Thiel", fund: "Thiel Macro", strategy: "Macro / Concentrated" },
  { name: "Michael Burry", fund: "Scion Asset Management", strategy: "Deep Value / Contrarian" },
  { name: "Stanley Druckenmiller", fund: "Duquesne Family Office", strategy: "Macro / Opportunistic" },
  { name: "Li Lu", fund: "Himalaya Capital", strategy: "Concentrated / Value" },
];

function search(query: string): string[] {
  const terms = searchTerms(query);
  return ROSTER.filter((m) => matchesQuery(m, terms)).map((m) => m.name);
}

describe("expert search", () => {
  it("matches on the investor's name", () => {
    expect(search("bill ackman")).toEqual(["Bill Ackman"]);
  });

  it("matches on the fund name", () => {
    expect(search("pershing square")).toEqual(["Bill Ackman"]);
    expect(search("berkshire")).toEqual(["Warren Buffett"]);
    expect(search("thiel macro")).toEqual(["Peter Thiel"]);
  });

  it("tolerates a typo in a fund or name", () => {
    expect(search("perishing square")).toEqual(["Bill Ackman"]);
    expect(search("bufett")).toEqual(["Warren Buffett"]);
    expect(search("drukenmiler")).toEqual(["Stanley Druckenmiller"]);
  });

  it("matches on strategy", () => {
    expect(search("macro")).toEqual(["Peter Thiel", "Stanley Druckenmiller"]);
  });

  it("requires every term to match, so extra words narrow the results", () => {
    expect(search("macro thiel")).toEqual(["Peter Thiel"]);
    expect(search("pershing berkshire")).toEqual([]);
  });

  it("matches short terms literally rather than fuzzily", () => {
    // "Lu" must not drag in every 2-3 letter near-miss on the roster.
    expect(search("li lu")).toEqual(["Li Lu"]);
  });

  it("returns nothing for an unrelated query", () => {
    expect(search("nonexistent fund")).toEqual([]);
  });
});
