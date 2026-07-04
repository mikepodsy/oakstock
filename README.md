# Oakstock

A personal investing dashboard built with Next.js. Tracks portfolios and watchlists, analyzes options strategies and volatility, follows superinvestor 13F filings, and surfaces market data, momentum alerts, economic indicators, and an AI-generated daily news brief.

## Features

- **Dashboard** — portfolio summary, market overview, daily brief
- **Portfolio** — multiple portfolios with lot-level holdings, performance vs benchmark, allocation/sector breakdowns
- **Watchlists** — multiple lists with quotes and pre/post-market moves
- **Stock pages** — candlestick charts (indicators + drawing tools), fundamentals from SEC EDGAR + Yahoo, sentiment
- **Options** — multi-leg strategy builder with payoff diagrams and time decay; IV/HV history, term structure, skew, and VRP analytics
- **Experts** — superinvestor portfolios from Dataroma and SEC EDGAR 13F filings, per-manager detail and per-ticker activity
- **Radar** — gainers/losers/trending scanner with sector filters
- **Alerts** — moving-average crossing alerts for Mag 7, S&P 400, and ETFs
- **Economic** — inflation, unemployment, rates, treasury yield curve, commodities, VIX
- **Calendar** — earnings, dividends, economic events, IPOs
- **COT** — CFTC Commitment of Traders visualization
- **News** — macro + holdings-specific feed with a Claude-generated daily brief
- **DCF** — multi-stage DCF calculator with sensitivity table

## Stack

Next.js (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Zustand · Recharts + lightweight-charts · Supabase (Postgres) · Clerk (auth) · Vitest

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm run lint       # ESLint
npx tsc --noEmit   # typecheck
npm test           # Vitest (npm run test:watch for watch mode)
npm run build      # production build
```

## Environment variables

Create `.env.local` (never commit env files):

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase (experts/superinvestors ingest, Questrade token storage) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Clerk auth |
| `QUESTRADE_REFRESH_TOKEN` | Bootstrap only — the live single-use rotating token is persisted in the Supabase `questrade_auth` table |
| `ANTHROPIC_API_KEY` | Claude daily brief generation |
| `FRED_API_KEY` | Economic indicators |
| `FMP_API_KEY` | Financial Modeling Prep data |
| `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` | Alpaca market data |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | logo.dev company logos |

## Data sources

| Source | Purpose |
|---|---|
| Yahoo Finance (`yahoo-finance2`, server-side) | Quotes, history, financials, screening, news RSS |
| SEC EDGAR | Fundamentals (10-K/10-Q), 13F filings |
| Questrade API | Option chains with Greeks, candles. OAuth refresh token is single-use and rotates; persisted in Supabase |
| DoltHub (public options DB) | Historical IV/HV backfill |
| Dataroma (scraped) | Superinvestor grand portfolio |
| CFTC | Commitment of Traders reports |
| Anthropic Claude | Daily news brief |

External responses are cached in-memory per data type (`src/lib/cache.ts`) with `Cache-Control: s-maxage` headers on API routes.

## Repo layout

```
src/app/            pages + ~48 API routes (server-side proxies to data sources)
src/components/     UI components by feature
src/hooks/          data-fetching hooks
src/lib/            integrations (questrade, dolthub, edgar/, dataroma/, options math, brief)
src/services/       feature-level data services
src/stores/         Zustand stores (portfolio/watchlist currently persist to localStorage)
src/utils/          pure helpers (calculations, dcf, formatters)
scripts/            seed-volatility-history.mjs — backfills IV/HV history into Supabase
tools/              fetch_13f.py (SEC 13F ingest), generate_ticker_domains.mjs
supabase/           SQL migrations
```

## Testing & CI

Unit tests live next to their modules (`*.test.ts`) and run with Vitest. CI (GitHub Actions) runs lint, typecheck, tests, and build on pushes and PRs. A local pre-commit hook running lint + typecheck can be installed with:

```bash
ln -s ../../scripts/pre-commit .git/hooks/pre-commit
```
