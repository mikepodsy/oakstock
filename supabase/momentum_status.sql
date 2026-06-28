-- Precomputed daily momentum (50d/200d MA) for the large-cap universe shown on
-- the /alerts page right panel. One row per ticker, refreshed in bulk by
-- GET /api/alerts/refresh (Yahoo daily candles -> evaluateMomentum) and read
-- back, sorted by market_cap, by GET /api/alerts/sp400. The Mag 7 left panel is
-- computed live (Questrade) and is NOT stored here. Applied to the `oakstock`
-- Supabase project.

CREATE TABLE IF NOT EXISTS public.momentum_status (
  ticker          text PRIMARY KEY,
  name            text,
  market_cap      numeric,
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

CREATE INDEX IF NOT EXISTS momentum_status_market_cap_idx
  ON public.momentum_status (market_cap DESC NULLS LAST);
