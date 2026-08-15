-- Run this in your Supabase SQL editor to add uninvested cash to portfolios.
-- Cash counts toward total value and the allocation donut, but never toward
-- gain/loss — a dollar has no cost basis to gain against.

alter table portfolios
  add column if not exists cash_balance numeric not null default 0,
  add column if not exists cash_currency text not null default 'USD';

alter table portfolios
  drop constraint if exists portfolios_cash_currency_check;

alter table portfolios
  add constraint portfolios_cash_currency_check
  check (cash_currency in ('USD', 'CAD'));
