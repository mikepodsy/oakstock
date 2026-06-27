-- Company financials: persisted SEC EDGAR (and Yahoo-fallback) statement data
-- powering the financial charts on /stock/[ticker]. Populated lazily by
-- GET /api/fundamentals on first view (and refreshed when stale), read back on
-- subsequent views. One wide row per (ticker, period_type, period_end) mapping
-- 1:1 to the FinancialStatement type. Raw values in USD. Applied to the
-- `oakstock` Supabase project.

CREATE TABLE IF NOT EXISTS public.company_financials (
  ticker               text        NOT NULL,
  cik                  text,                       -- 10-digit SEC CIK, null for Yahoo-sourced rows
  period_type          text        NOT NULL,       -- 'annual' | 'quarterly'
  period_end           date        NOT NULL,       -- statement period end date
  source               text        NOT NULL,       -- 'edgar' | 'yahoo'

  revenue              numeric,
  ebitda               numeric,
  free_cash_flow       numeric,
  operating_cash_flow  numeric,
  capex                numeric,
  net_income           numeric,
  gross_profit         numeric,
  operating_income     numeric,
  cost_of_revenue      numeric,
  eps                  numeric,                    -- diluted
  eps_basic            numeric,
  buybacks             numeric,
  dividends_paid       numeric,
  total_debt           numeric,
  stockholders_equity  numeric,

  updated_at           timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (ticker, period_type, period_end)
);

CREATE INDEX IF NOT EXISTS company_financials_ticker_idx
  ON public.company_financials (ticker);

-- Per-ticker fetch log so we know freshness and don't re-hit EDGAR on every
-- page load — including tickers EDGAR has no data for (source recorded, rows 0).
CREATE TABLE IF NOT EXISTS public.company_financials_sync (
  ticker       text        PRIMARY KEY,
  cik          text,
  source       text,                               -- 'edgar' | 'yahoo' | 'none'
  fetched_at   timestamptz NOT NULL DEFAULT now()
);

-- Public market data, server-only access via service-role key (bypasses RLS).
ALTER TABLE public.company_financials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_financials_sync ENABLE ROW LEVEL SECURITY;
