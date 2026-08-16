-- Natural-language strategy composer: keep the request alongside the result.
--
-- `prompt` is what the user typed; `spec` is the typed rule tree it compiled to.
-- Same instinct as code_version — a chart on /backtesting should always be
-- traceable to the exact thing that produced it, and storing the spec makes
-- every composed run re-runnable and diffable.

alter table backtest_runs add column if not exists prompt text;
alter table backtest_runs add column if not exists spec   jsonb;
