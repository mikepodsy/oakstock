-- Experts section: switch the holdings source from SEC EDGAR to Dataroma.
-- Applied to the `oakstock` Supabase project. The manager roster (82 superinvestors
-- from https://www.dataroma.com/m/home.php) is seeded separately; holdings are
-- populated by POST /api/experts/refresh, which scrapes each manager's Dataroma page.

-- 1. Schema changes ----------------------------------------------------------
-- Dataroma manager code (the ?m= URL param, e.g. 'oc' for Howard Marks / Oaktree).
ALTER TABLE public.expert_managers ADD COLUMN IF NOT EXISTS dataroma_code text;
-- cik is no longer required now that we don't use SEC EDGAR.
ALTER TABLE public.expert_managers ALTER COLUMN cik DROP NOT NULL;
-- Raw "Recent Activity" text from Dataroma, e.g. "Reduce 9.78%" / "Add 3.46%" / "Buy".
ALTER TABLE public.expert_holdings ADD COLUMN IF NOT EXISTS activity text;

-- 2. Indexes -----------------------------------------------------------------
-- Dataroma rows have null cusip/option_type, so the original
-- (manager_id, quarter, cusip, option_type) unique index can't dedupe them.
-- Use a ticker-based unique index as the upsert conflict target instead.
CREATE UNIQUE INDEX IF NOT EXISTS expert_holdings_manager_quarter_ticker_key
  ON public.expert_holdings (manager_id, quarter, ticker);

-- Unique dataroma_code so the roster seed can upsert idempotently.
CREATE UNIQUE INDEX IF NOT EXISTS expert_managers_dataroma_code_key
  ON public.expert_managers (dataroma_code) WHERE dataroma_code IS NOT NULL;

-- 3. Row Level Security ------------------------------------------------------
-- These tables hold public data but are only read/written server-side via the
-- service-role key (which bypasses RLS). Enabling RLS with no policies denies the
-- anon/authenticated keys direct access, closing the exposure while the API routes
-- keep working through the service role.
ALTER TABLE public.expert_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_votes ENABLE ROW LEVEL SECURITY;
