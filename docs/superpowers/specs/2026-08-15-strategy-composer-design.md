# Natural-Language Strategy Composer — Design Spec

**Date:** 2026-08-15
**Status:** Approved
**Extends:** `docs/superpowers/specs/2026-08-15-backtesting-design.md`

---

## Overview

Type a strategy in English on `/backtesting`; it compiles to a typed rule spec,
runs on the existing engine, and the saved run opens with the parsed rule shown
beside the results.

Two things v1 deliberately lacked: a way to express a strategy without writing
Python, and any path for the browser to run anything. This adds both, without
adding code execution.

---

## Architecture

```
"go long gold when managed money is washed out below 15, 8% stop"
        │
        ▼  POST /api/backtest/compose
   Anthropic claude-opus-5, output_config.format json_schema
        │       (same pattern as src/lib/brief.ts)
        ▼
   RuleSpec  { market, rules[{when, weight}], hold_between, execution, explanation }
        │
        ▼  POST /api/backtest/run   → spawn `python -m oakbt.cli run-spec` (spec on STDIN)
   RuleStrategy.generate_signals()  → existing risk → executor → metrics → persist
        │
        ▼
   run_id → page opens that run, rendering `spec` + `prompt` alongside the charts
```

The engine, risk model, executor, and metrics are **untouched**. A rule spec
becomes an ordinary `Strategy`, so it inherits signal lag, vol targeting, stops,
costs, the point-in-time guarantee, and every existing test.

---

## The DSL

### Grammar

An expression evaluates to a boolean `pd.Series` over the daily frame.

| Form | Shape | Meaning |
|---|---|---|
| Comparison | `{"lt": [operand, operand]}` (also `gt`, `lte`, `gte`, `eq`) | Elementwise compare |
| Logical | `{"and": [expr, ...]}`, `{"or": [expr, ...]}`, `{"not": expr}` | Boolean combination |
| Crossover | `{"crosses_above": [operand, operand]}`, `crosses_below` | True on the bar the first crosses the second |

An **operand** is either a registered feature name (string) or a number. Nothing
else parses — no arithmetic, no function calls, no attribute access. A string
that is not in the feature registry raises `UnknownFeatureError` by name.

### Spec shape

```json
{
  "market": "GOLD",
  "ticker": null,
  "rules": [
    { "when": {"lt": ["cot_index_m_money", 15]}, "weight":  1.0 },
    { "when": {"gt": ["cot_index_m_money", 85]}, "weight": -1.0 }
  ],
  "hold_between": true,
  "execution": { "stop_pct": 0.08, "target_vol": 0.15, "signal_lag": 1 },
  "start": null,
  "end": null,
  "explanation": "Long gold when managed-money positioning sits in the bottom 15% of its 3-year range; short above 85; hold in between; 8% stop.",
  "unsupported": null
}
```

### Semantics

- **First matching rule wins** per bar. Rules are evaluated in order; the first
  whose `when` is true sets that bar's weight.
- **`hold_between`** — when no rule matches, `true` forward-fills the previous
  weight (positioning-signal semantics, matching `threshold_signal`), `false`
  goes flat. Default `true`.
- **Weights are clipped to [-1, 1]**; the risk model scales from there.
- **Bars before any rule has matched are 0.0**, never forward-filled from nothing.
- `required_features` is every feature name appearing anywhere in the tree, so
  the runner's existing resolution raises before simulating.

### Refusal is a first-class outcome

`unsupported` is a string explaining why the request cannot be expressed, with
`rules` empty. The composer sets it rather than approximating — a backtest of a
strategy the user did not describe is worse than no backtest. It fires when the
request needs a feature no provider produces (RSI, earnings, fundamentals),
needs multi-asset logic, or is too vague to pin to a threshold.

---

## Execution Bridge

`POST /api/backtest/run` spawns `python -m oakbt.cli run-spec` with the spec on
**stdin**. Nothing from the text box ever reaches a shell — no argv, no
interpolation, no `shell: true`.

**Gating.** The route returns 503 unless `BACKTEST_LOCAL_RUNNER=1`.
`GET /api/backtest/capabilities` reports `{ composer: boolean }`, and the page
renders the composer only when true. On the deployed site the flag is unset, the
box is absent, and `/backtesting` stays the read-only viewer it is today.

**Server-side validation before spawning:** the spec is re-validated against the
same schema in the route (the model is not trusted to have obeyed its own
schema), `market`/`ticker` are checked against the universe, and every feature
name is checked against a registry list. A spec that fails returns 400 without
launching a process.

**Timeout:** 180s, then the child is killed and the route returns 504. Concurrency
is capped at one in-flight run per process; a second request returns 429.

---

## Auto-backfill

If the target market has no stored history, `run-spec` backfills it before
simulating (the loaders are already idempotent upserts). Detection reuses
`store.latest_price_date()` / `latest_cot_report_date()`. Adds ~10–20s to a
first-time market; subsequent runs skip it. The `--no-backfill` flag opts out.

---

## Data Schema

Two columns on `backtest_runs`, in `supabase/backtesting_composer.sql`:

```sql
alter table backtest_runs add column if not exists prompt text;
alter table backtest_runs add column if not exists spec   jsonb;
```

`prompt` is what the user typed; `spec` is what it compiled to. Same instinct as
`code_version` — a chart on that page should always be traceable to the exact
thing that produced it, and it makes every run re-runnable.

---

## Model Call

Follows `src/lib/brief.ts`:

```ts
const client = new Anthropic();
const res = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 16000,
  output_config: {
    effort: "medium",
    format: { type: "json_schema", schema: RULE_SPEC_SCHEMA },
  },
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: prompt }],
});
```

`max_tokens` is generous because thinking is on by default on `claude-opus-5`
and shares that budget with the response. The system prompt carries the full
grammar, the live feature list (generated from the registry, not hardcoded), the
market table, and an explicit instruction to set `unsupported` rather than
approximate.

Handle `stop_reason: "refusal"` before reading content — Opus 5 runs safety
classifiers, and a refusal returns HTTP 200 with empty content.

---

## File Structure

### New — Python

| Path | Purpose |
|---|---|
| `tools/backtest/oakbt/engine/rules.py` | Expression evaluator + spec validation |
| `tools/backtest/oakbt/strategies/rule_strategy.py` | `RuleStrategy(Strategy)` |
| `tools/backtest/tests/test_rules.py` | Evaluator semantics |
| `tools/backtest/tests/test_rule_strategy.py` | Signal generation, hold/flat, clipping |

### New — TypeScript

| Path | Purpose |
|---|---|
| `src/lib/strategySpec.ts` | Schema, validation, feature/market catalogs |
| `src/lib/strategySpec.test.ts` | Validation tests |
| `src/app/api/backtest/compose/route.ts` | NL → spec |
| `src/app/api/backtest/run/route.ts` | Spec → subprocess → run_id |
| `src/app/api/backtest/capabilities/route.ts` | `{ composer }` |
| `src/components/backtesting/StrategyComposer.tsx` | Input + parsed-rule readback |
| `src/components/backtesting/RuleSpecView.tsx` | Renders a spec as readable English |

### Modified

| File | Change |
|---|---|
| `tools/backtest/oakbt/cli.py` | `run-spec` subcommand; auto-backfill helper |
| `tools/backtest/oakbt/strategies/__init__.py` | Register `rule` strategy |
| `src/app/backtesting/page.tsx` | Mount composer; show spec on the open run |
| `src/types/backtest.ts` | `prompt`, `spec` on `BacktestRun` |

---

## Error Handling

| Failure | Behavior |
|---|---|
| Request can't be expressed in the DSL | `unsupported` set; UI shows the explanation and does not run |
| Model returns a malformed spec | Route re-validates and returns 400 naming the bad field |
| Hallucinated feature name | Rejected at validation; if it slips through, `UnknownFeatureError` before simulating |
| Anthropic refusal (`stop_reason: "refusal"`) | 502 with a plain message; content is empty and must not be indexed |
| `ANTHROPIC_API_KEY` unset | 503 naming the variable |
| Runner disabled in production | 503; composer not rendered at all |
| Market has no data | Auto-backfill, then run |
| Backfill or run exceeds 180s | Child killed, 504 |
| Concurrent run in flight | 429 |
| Python exits non-zero | 500 carrying the last lines of stderr |

---

## Testing

**Python (pytest)**
- `test_rules.py` — each comparison and logical form; `crosses_above` fires only
  on the crossing bar, not while merely above; unknown feature raises by name;
  malformed nodes raise; deeply nested trees evaluate correctly; a number-vs-number
  comparison is constant.
- `test_rule_strategy.py` — first-match-wins ordering; `hold_between` true
  forward-fills and false goes flat; pre-first-match bars are 0; weights clip to
  [-1, 1]; `required_features` collects every referenced name including nested;
  output is NaN-free and index-aligned.

**TypeScript (vitest)** — `strategySpec.test.ts`: valid specs pass; unknown
feature, unknown market, bad operator, non-numeric weight, and empty rules each
fail with a field-naming message; `unsupported` specs are accepted as valid but
flagged non-runnable.

The composer's model call is not unit-tested (it's a network call to a
non-deterministic service); it's verified end-to-end against the real API.

---

## Out of Scope

- Editing a parsed rule in the UI (edit the text and re-run).
- Deploying the runner — still local-only.
- Features no provider produces (RSI, fundamentals) — these need a provider first,
  which the DSL is deliberately designed to make additive.
- Multi-asset strategies; a run remains one strategy on one instrument.
- Streaming the compose response.

---

## Verification

1. `cd tools/backtest && pytest` — full suite green.
2. Apply `supabase/backtesting_composer.sql`; confirm both columns exist.
3. `echo '<spec>' | python -m oakbt.cli run-spec` — a run row appears.
4. `BACKTEST_LOCAL_RUNNER=1 npm run dev` → `/backtesting`, type a strategy, Run;
   confirm the rule readback matches the request and the run opens.
5. Type something inexpressible ("buy when RSI < 30") — confirm it explains
   rather than approximating.
6. Unset the flag; confirm the composer disappears and the page still works.
7. `npm test && npm run lint && npm run build`.
