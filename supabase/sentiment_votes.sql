-- Run this in your Supabase SQL editor to create the sentiment_votes table

create table if not exists sentiment_votes (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  vote text not null check (vote in ('bearish', 'neutral', 'bullish')),
  voter_id text not null,
  created_at timestamptz default now(),
  unique(ticker, voter_id)
);

-- Index for fast lookups by ticker
create index if not exists idx_sentiment_votes_ticker on sentiment_votes (ticker);
