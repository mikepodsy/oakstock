-- Precomputed daily momentum (50d/200d MA) for the ETF universe shown on the
-- /alerts page right panel ("ETF MA crossings"). One row per ticker, refreshed
-- in bulk by GET /api/alerts/etf-refresh (Yahoo daily candles -> evaluateMomentum)
-- and read back, sorted by market_cap (AUM), by GET /api/alerts/etf. Mirrors
-- momentum_status; the ETF universe is the RADAR categories minus
-- leveraged/inverse (see ETF_UNIVERSE in src/utils/constants.ts). Applied to the
-- `oakstock` Supabase project.

CREATE TABLE IF NOT EXISTS public.etf_momentum_status (
  ticker          text PRIMARY KEY,
  name            text,
  market_cap      numeric,           -- ETF AUM (Yahoo totalAssets) when available
  close           numeric,
  sma50           numeric,
  sma200          numeric,
  distance50_pct  numeric,
  distance200_pct numeric,
  price_vs50      jsonb NOT NULL,   -- CrossState { relation, crossedThisBar, direction, sessionsSinceCross }
  price_vs200     jsonb NOT NULL,
  cross50v200     jsonb NOT NULL,   -- 50d-vs-200d golden/death
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS etf_momentum_status_market_cap_idx
  ON public.etf_momentum_status (market_cap DESC NULLS LAST);
