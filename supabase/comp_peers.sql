-- Claude-suggested comparable companies for the Comparisons page
-- (/comparisons). One row per target ticker; `peers` is
-- [{ticker, name, reason}]. Refreshed when older than 30 days. Only
-- Claude-sourced sets are written (the Yahoo fallback is never cached).
-- Applied to the `oakstock` Supabase project.

CREATE TABLE IF NOT EXISTS public.comp_peers (
  ticker      text        PRIMARY KEY,
  peers       jsonb       NOT NULL,
  source      text        NOT NULL DEFAULT 'claude',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Server-only table (service role). Enable RLS with no policies so the anon
-- key can't read or write it.
ALTER TABLE public.comp_peers ENABLE ROW LEVEL SECURITY;
