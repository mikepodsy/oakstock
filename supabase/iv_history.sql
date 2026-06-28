-- IV/HV history powering the Volatility Dashboard (/options/[ticker]/volatility).
-- Backfilled from the public DoltHub `post-no-preference/options` dataset
-- (volatility_history) on first view and topped up incrementally; read back to
-- compute IV rank/percentile, VRP, and the IV-vs-HV chart. One row per
-- (ticker, date). Vols stored as fractions (0.28 = 28%). The latest row also
-- carries the point-in-time term-structure + skew snapshot. Applied to the
-- `oakstock` Supabase project.

CREATE TABLE IF NOT EXISTS public.iv_history (
  ticker          text  NOT NULL,
  date            date  NOT NULL,
  iv30            numeric,            -- ~30-day implied vol (DoltHub iv_current)
  hv30            numeric,            -- realized/historical vol (DoltHub hv_current)
  iv_rank         numeric,            -- snapshot only (latest row)
  iv_percentile   numeric,            -- snapshot only (latest row)
  term_structure  jsonb,             -- snapshot only: [{expiry,dte,atmIv}]
  skew            jsonb,             -- snapshot only: SkewData
  updated_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (ticker, date)
);

-- Read pattern is "all rows for a ticker, ordered by date".
CREATE INDEX IF NOT EXISTS iv_history_ticker_date_idx
  ON public.iv_history (ticker, date);
