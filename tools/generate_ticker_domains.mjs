/**
 * Generates a static ticker → domain mapping by fetching website data
 * from Yahoo Finance for all tickers in RADAR_SECTORS.
 *
 * Usage: node tools/generate_ticker_domains.mjs
 */

import YahooFinance from "yahoo-finance2";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_PATH = join(ROOT, "src", "data", "ticker-domains.json");

// Parse tickers from constants.ts (avoid needing TSX compilation)
function extractTickers() {
  const src = readFileSync(join(ROOT, "src", "utils", "constants.ts"), "utf-8");
  const tickerSet = new Set();
  const re = /"([A-Z0-9^.]+)"/g;
  // Only extract from RADAR_SECTORS section
  const sectorStart = src.indexOf("RADAR_SECTORS");
  if (sectorStart === -1) throw new Error("RADAR_SECTORS not found in constants.ts");
  const sectorBlock = src.slice(sectorStart);
  let match;
  while ((match = re.exec(sectorBlock)) !== null) {
    const t = match[1];
    // Skip labels and non-ticker strings
    if (t.length <= 6 && /^[A-Z0-9^.]+$/.test(t)) {
      tickerSet.add(t);
    }
  }
  return [...tickerSet];
}

function extractDomain(website) {
  if (!website) return null;
  return website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

async function main() {
  const tickers = extractTickers();
  console.log(`Found ${tickers.length} unique tickers`);

  // Load existing mapping to avoid re-fetching
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    console.log(`Loaded ${Object.keys(existing).length} existing mappings`);
  } catch {
    // No existing file
  }

  const yf = new YahooFinance();
  const mapping = { ...existing };
  const BATCH_SIZE = 10;
  const DELAY_MS = 500;
  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  // Filter out tickers we already have
  const toFetch = tickers.filter((t) => !mapping[t]);
  console.log(`Need to fetch ${toFetch.length} new tickers`);

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          const summary = await yf.quoteSummary(ticker, {
            modules: ["assetProfile"],
          });
          const domain = extractDomain(summary.assetProfile?.website);
          return { ticker, domain };
        } catch {
          // Try quote() as fallback - won't have website but at least we tried
          return { ticker, domain: null };
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value.domain) {
        mapping[r.value.ticker] = r.value.domain;
        fetched++;
      } else if (r.status === "fulfilled") {
        skipped++;
      } else {
        failed++;
      }
    }

    const progress = Math.min(i + BATCH_SIZE, toFetch.length);
    process.stdout.write(`\r  Progress: ${progress}/${toFetch.length} (${fetched} found, ${skipped} no website, ${failed} failed)`);

    if (i + BATCH_SIZE < toFetch.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log("\n");

  // Sort keys for deterministic output
  const sorted = {};
  for (const key of Object.keys(mapping).sort()) {
    sorted[key] = mapping[key];
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(sorted).length} mappings to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
