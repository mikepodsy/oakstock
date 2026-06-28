import Anthropic from "@anthropic-ai/sdk";
import type {
  BriefArticle,
  DailyBrief,
  MacroNewsItem,
  StockNewsItem,
} from "@/types/news";

// Cap how many candidate articles we hand to the model, to bound token cost.
const MAX_MACRO = 30;
const MAX_STOCK = 15;

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    outlook: { type: "string" },
    highImpact: { anyOf: [{ type: "string" }, { type: "null" }] },
    articles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          source: { type: "string" },
          url: { type: "string" },
          why: { type: "string" },
          tickers: { type: "array", items: { type: "string" } },
        },
        required: ["title", "source", "url", "why", "tickers"],
      },
    },
  },
  required: ["outlook", "highImpact", "articles"],
} as const;

const SYSTEM_PROMPT = `You are a markets editor writing a concise pre-market daily brief for an individual investor's portfolio dashboard.

You are given a list of candidate news articles (macro/market-wide and portfolio-specific). Your job:
1. Filter out noise — ignore clickbait, duplicates, horoscope/lifestyle filler, and low-signal items.
2. Select EXACTLY 5 of the most decision-relevant articles that set the reader up for the trading day. Prefer market-moving, high-signal items and reputable sources. Favor a mix of macro context and items relevant to the reader's holdings when both are strong.
3. For each selected article, write a "why" of at most one sentence explaining why it matters today.
4. Write an "outlook": 2-4 sentences on what to expect in markets today, grounded only in the provided articles.
5. Set "highImpact" to a one-sentence note ONLY if there is a genuinely market-moving / high-impact event today (e.g. a major central-bank decision, key economic data release, major earnings, or a significant geopolitical development). If nothing rises to that bar, set it to null.

Rules:
- Copy each article's "url", "title", and "source" VERBATIM from the provided candidates — never invent or alter a URL.
- "tickers" should list any relevant tickers for that article (use the ones provided; empty array if none).
- Be specific and neutral. No hype, no emoji, no investment advice or recommendations to buy/sell.`;

function articleLine(
  index: number,
  item: MacroNewsItem | StockNewsItem
): string {
  const tickers =
    item.type === "stock" && item.symbols.length > 0
      ? ` | tickers: ${item.symbols.join(", ")}`
      : "";
  const summary = item.summary ? ` | summary: ${item.summary.slice(0, 280)}` : "";
  return `[${index}] (${item.source}) ${item.title}${tickers}\n    url: ${item.url}\n    published: ${item.publishedAt}${summary}`;
}

function buildNewsBlob(macro: MacroNewsItem[], stocks: StockNewsItem[]): string {
  const lines: string[] = [];
  let i = 1;

  lines.push("## Macro / market news");
  for (const item of macro.slice(0, MAX_MACRO)) {
    lines.push(articleLine(i++, item));
  }

  if (stocks.length > 0) {
    lines.push("\n## Portfolio / watchlist news");
    for (const item of stocks.slice(0, MAX_STOCK)) {
      lines.push(articleLine(i++, item));
    }
  }

  return lines.join("\n");
}

interface RawBrief {
  outlook: string;
  highImpact: string | null;
  articles: BriefArticle[];
}

/**
 * Generate a curated daily brief from the supplied news using Claude.
 * Returns everything except `date` (the route stamps that). Throws if the
 * API key is missing or the model response can't be parsed — callers handle
 * the failure and surface a fallback to the user.
 */
export async function generateDailyBrief(
  macro: MacroNewsItem[],
  stocks: StockNewsItem[]
): Promise<Omit<DailyBrief, "date">> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic();
  const newsBlob = buildNewsBlob(macro, stocks);

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: BRIEF_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today's candidate articles:\n\n${newsBlob}\n\nProduce the daily brief.`,
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text block in brief response");
  }

  const parsed = JSON.parse(textBlock.text) as RawBrief;

  return {
    outlook: parsed.outlook,
    highImpact: parsed.highImpact || null,
    articles: parsed.articles.slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
}
