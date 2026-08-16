-- Backtesting: point-in-time history store + saved run results.
--
-- Two concerns in one file because they share a lifecycle:
--   * cot_history / price_history — the historical data the repo previously had
--     nowhere to put (COT and prices were fetched on demand into memory caches).
--   * backtest_runs / _equity / _trades — results the /backtesting page reads.
--
-- The Python engine (tools/backtest/) is the only writer. The Next.js app is a
-- reader, via the service-role client in src/lib/supabase.ts.
--
-- RLS is ENABLED with no policies on every table. That is deliberate and differs
-- from iv_history/momentum_status: the service role bypasses RLS, so all app
-- reads keep working, while the public anon key gets no access at all.

-- ─── Historical data ──────────────────────────────────────────────────────────

create table if not exists cot_history (
  market_code   text   not null,  -- canonical code, see oakbt/data/universe.py
  dataset       text   not null,  -- 'tff' | 'disaggregated' | 'legacy'
  report_date   date   not null,  -- positions as of this Tuesday
  released_at   date   not null,  -- when CFTC actually published (see calendar.py)
  category      text   not null,  -- 'lev_money' | 'asset_mgr' | 'dealer' | ...
  longs         bigint,
  shorts        bigint,
  net           bigint,
  open_interest bigint,
  primary key (market_code, dataset, report_date, category)
);

-- Alignment queries filter on released_at, never report_date — using report_date
-- would leak three days of hindsight into every signal.
create index if not exists cot_history_release_idx
  on cot_history (market_code, released_at);

create table if not exists price_history (
  ticker    text not null,
  date      date not null,
  open      numeric,
  high      numeric,
  low       numeric,
  close     numeric,
  adj_close numeric,
  volume    bigint,
  primary key (ticker, date)
);

-- ─── Run results ──────────────────────────────────────────────────────────────

create table if not exists backtest_runs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  strategy      text not null,
  params        jsonb not null default '{}'::jsonb,
  ticker        text not null,
  market_code   text,
  proxy_quality text,
  start_date    date,
  end_date      date,
  config        jsonb not null default '{}'::jsonb,
  metrics       jsonb,
  code_version  text,   -- git SHA, so any chart traces back to the code behind it
  status        text not null default 'running',
  error         text
);

create index if not exists backtest_runs_created_idx
  on backtest_runs (created_at desc);

create table if not exists backtest_equity (
  run_id           uuid not null references backtest_runs(id) on delete cascade,
  date             date not null,
  equity           numeric not null,
  benchmark_equity numeric,
  drawdown         numeric,
  exposure         numeric,
  position         numeric,
  primary key (run_id, date)
);

create table if not exists backtest_trades (
  id          bigserial primary key,
  run_id      uuid not null references backtest_runs(id) on delete cascade,
  entry_date  date not null,
  exit_date   date,
  direction   text not null,   -- 'long' | 'short'
  entry_price numeric,
  exit_price  numeric,
  size        numeric,
  pnl         numeric,
  return_pct  numeric,
  exit_reason text,            -- 'signal' | 'stop' | 'end_of_data'
  bars_held   integer
);

create index if not exists backtest_trades_run_idx
  on backtest_trades (run_id, entry_date);

-- ─── Access control ───────────────────────────────────────────────────────────

alter table cot_history     enable row level security;
alter table price_history   enable row level security;
alter table backtest_runs   enable row level security;
alter table backtest_equity enable row level security;
alter table backtest_trades enable row level security;
