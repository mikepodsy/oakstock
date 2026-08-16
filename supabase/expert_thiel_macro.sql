-- Add Peter Thiel / Thiel Macro LLC to the superinvestor roster.
-- Dataroma doesn't track Thiel Macro, so holdings come from SEC EDGAR instead
-- (dataroma_code stays null): python tools/fetch_13f.py --manager thiel
-- CIK 0001562087 — https://www.sec.gov/cgi-bin/browse-edgar?CIK=0001562087&type=13F

INSERT INTO public.expert_managers
  (id, name, fund, cik, description, aum_note, strategy, dataroma_code, logo_domain, public_ticker)
VALUES (
  'thiel',
  'Peter Thiel',
  'Thiel Macro',
  '0001562087',
  'PayPal co-founder and Palantir chairman. His macro vehicle runs a tiny, highly concentrated book — a handful of positions expressing long-horizon bets on technology and monetary debasement.',
  NULL,
  'Macro / Concentrated',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  fund        = EXCLUDED.fund,
  cik         = EXCLUDED.cik,
  description = EXCLUDED.description,
  strategy    = EXCLUDED.strategy;
