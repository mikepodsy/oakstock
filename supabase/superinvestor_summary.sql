-- Superinvestors Market Summary: caches the top-10 rows of five Dataroma
-- grand-portfolio tables (most owned / buys 1Q,2Q / sells 1Q,2Q).
-- Populated by POST /api/superinvestors/summary/refresh, read by
-- GET /api/superinvestors/summary. Applied to the `oakstock` Supabase project.

CREATE TABLE IF NOT EXISTS public.superinvestor_summary (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key   text NOT NULL,           -- most_owned | buys_1q | buys_2q | sells_1q | sells_2q
  rank         int  NOT NULL,           -- 1..10
  ticker       text NOT NULL,
  company_name text NOT NULL,
  metric       int  NOT NULL,           -- count of superinvestors (owning / buying / selling)
  quarter      text,                    -- label e.g. "Q1 2026", nullable
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Upsert conflict target: exactly 10 rows per widget, replaced in place.
CREATE UNIQUE INDEX IF NOT EXISTS superinvestor_summary_widget_rank_key
  ON public.superinvestor_summary (widget_key, rank);

-- Public data, server-only access via service-role key (bypasses RLS).
ALTER TABLE public.superinvestor_summary ENABLE ROW LEVEL SECURITY;
