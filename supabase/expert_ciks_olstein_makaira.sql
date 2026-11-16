-- Backfill CIKs for two managers Dataroma stopped publishing.
--
-- Dataroma's holdings pages for OFALX (Olstein) and MP (Makaira / Tom Bancroft)
-- now return a stub with no table, so /api/experts/refresh can only report
-- "Failed to parse holdings table" and the roster froze — Olstein at Q1 2026,
-- Bancroft with no holdings at all. Both still file 13F-HR with the SEC, so
-- point them at EDGAR instead:
--
--   python tools/fetch_13f.py --manager robert-olstein
--   python tools/fetch_13f.py --manager tom-bancroft
--
-- dataroma_code is deliberately left in place: if Dataroma restores the pages
-- the existing refresh picks them up again, and fetch_13f.py is keyed on cik.
--
-- Olstein Capital Management, L.P. — CIK 0000947996
-- Makaira Partners LLC           — CIK 0001540866

UPDATE public.expert_managers SET cik = '0000947996' WHERE id = 'robert-olstein';
UPDATE public.expert_managers SET cik = '0001540866' WHERE id = 'tom-bancroft';
