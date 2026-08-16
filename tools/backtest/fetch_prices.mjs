// Price fetcher for the Python backtester.
//
// Yahoo's public chart endpoint now rejects plain HTTP clients with 429 — it
// wants the cookie/crumb handshake. Rather than reimplement that in Python, we
// reuse yahoo-finance2, which the app already depends on and which keeps the
// handshake working. oakbt/data/prices.py shells out to this.
//
// Usage: node fetch_prices.mjs TICKER START_ISO [END_ISO]
// Prints a JSON array of {date, open, high, low, close, adjclose, volume}.

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const [ticker, start, end] = process.argv.slice(2);

if (!ticker || !start) {
  console.error("usage: node fetch_prices.mjs TICKER START_ISO [END_ISO]");
  process.exit(2);
}

try {
  const result = await yf.chart(ticker, {
    period1: start,
    period2: end || new Date().toISOString().slice(0, 10),
    interval: "1d",
  });

  const rows = (result.quotes ?? [])
    // Yahoo pads non-trading days with nulls; a NaN close would poison every
    // return derived from it, so drop those bars entirely.
    .filter((q) => q && q.close != null)
    .map((q) => ({
      date: new Date(q.date).toISOString().slice(0, 10),
      open: q.open ?? null,
      high: q.high ?? null,
      low: q.low ?? null,
      close: q.close,
      adjclose: q.adjclose ?? q.close,
      volume: q.volume ?? null,
    }));

  process.stdout.write(JSON.stringify(rows));
} catch (err) {
  console.error(String(err?.message ?? err));
  process.exit(1);
}
