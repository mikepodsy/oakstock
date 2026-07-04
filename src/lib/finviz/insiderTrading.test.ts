import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  classifyTransaction,
  parseInsiderFeed,
  parseInsiderTrades,
} from "./insiderTrading";

// Real markup captured from Finviz quote pages (GF: Buy/Sale, SYRE:
// Proposed Sale/Option Exercise), trimmed to one row per transaction type.
const FIXTURE = readFileSync(
  new URL("./insiderTrading.fixture.html", import.meta.url),
  "utf8",
);

// Real markup from the global buys feed (insidertrading.ashx?tc=1): three buy
// rows (GF/SNES/BOLD) plus one injected ad/banner row that must be skipped.
const FEED_FIXTURE = readFileSync(
  new URL("./insiderFeed.fixture.html", import.meta.url),
  "utf8",
);

describe("classifyTransaction", () => {
  it("maps Buy → buy", () => {
    expect(classifyTransaction("Buy")).toBe("buy");
  });

  it("maps Sale → sale", () => {
    expect(classifyTransaction("Sale")).toBe("sale");
  });

  it("maps Proposed Sale → proposed_sale", () => {
    expect(classifyTransaction("Proposed Sale")).toBe("proposed_sale");
  });

  it("maps Option Exercise → other", () => {
    expect(classifyTransaction("Option Exercise")).toBe("other");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(classifyTransaction("  buy  ")).toBe("buy");
  });
});

describe("parseInsiderTrades", () => {
  const trades = parseInsiderTrades(FIXTURE);

  it("extracts every insider row", () => {
    expect(trades).toHaveLength(4);
  });

  it("parses a Buy row's fields", () => {
    const buy = trades.find((t) => t.transaction === "Buy");
    expect(buy).toMatchObject({
      owner: "Saba Capital Management, L.P.",
      relationship: "10% Owner",
      date: "Jun 30 '26",
      transaction: "Buy",
      action: "buy",
      cost: 11.37,
      shares: 100,
      value: 1137,
      sharesTotal: 3602815,
    });
    expect(buy?.secFormUrl).toBe(
      "http://www.sec.gov/Archives/edgar/data/858706/000151028126000229/xslF345X06/primary_doc.xml",
    );
  });

  it("classifies each transaction type", () => {
    const byTx = Object.fromEntries(trades.map((t) => [t.transaction, t.action]));
    expect(byTx).toEqual({
      Buy: "buy",
      Sale: "sale",
      "Proposed Sale": "proposed_sale",
      "Option Exercise": "other",
    });
  });

  it("treats a blank #Shares Total cell as 0 (Proposed Sale)", () => {
    const proposed = trades.find((t) => t.transaction === "Proposed Sale");
    expect(proposed?.sharesTotal).toBe(0);
    expect(proposed?.value).toBe(3995100);
  });

  it("returns an empty array when there is no insider table", () => {
    expect(parseInsiderTrades("<html><body>no table here</body></html>")).toEqual(
      [],
    );
  });
});

describe("parseInsiderFeed", () => {
  const trades = parseInsiderFeed(FEED_FIXTURE);

  it("skips ad/banner rows and parses only real trades", () => {
    expect(trades).toHaveLength(3);
  });

  it("extracts ticker and company from the first row", () => {
    expect(trades[0]).toMatchObject({
      ticker: "GF",
      company: "New Germany Fund Inc",
      owner: "Saba Capital Management, L.P.",
      relationship: "10% Owner",
      transaction: "Buy",
      action: "buy",
      value: 1137,
    });
    expect(trades[0].secFormUrl).toMatch(/sec\.gov/);
    expect(trades[0].filingTime).toBe("Jul 02 09:13 PM");
  });

  it("classifies every parsed row as a buy", () => {
    expect(trades.every((t) => t.action === "buy")).toBe(true);
  });

  it("returns an empty array when there are no feed rows", () => {
    expect(parseInsiderFeed("<html><body>nothing</body></html>")).toEqual([]);
  });
});
