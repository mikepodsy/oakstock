"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { RuleSpecView } from "@/components/backtesting/RuleSpecView";
import type { RuleSpec } from "@/lib/strategySpec";

const EXAMPLES = [
  "Long gold when managed money is washed out below 15, short above 85, 8% stop",
  "Fade leveraged funds in the S&P when their positioning index goes above 90",
  "Short natural gas when managed money positioning crosses above 80",
];

type Phase = "idle" | "composing" | "running";

interface StrategyComposerProps {
  onRunComplete: (runId: string) => void;
}

export function StrategyComposer({ onRunComplete }: StrategyComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [spec, setSpec] = useState<RuleSpec | null>(null);
  const [askedPrompt, setAskedPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";

  const submit = useCallback(async () => {
    const text = prompt.trim();
    if (!text || busy) return;

    setError(null);
    setSpec(null);
    setPhase("composing");

    try {
      const composeRes = await fetch("/api/backtest/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const composed = await composeRes.json();
      if (!composeRes.ok) {
        throw new Error(composed.detail || composed.error || "Could not read that strategy");
      }

      const parsed = composed.spec as RuleSpec;
      setSpec(parsed);
      setAskedPrompt(text);

      // The model declined to express it — show why rather than approximating.
      if (parsed.unsupported) {
        setPhase("idle");
        return;
      }

      setPhase("running");
      const runRes = await fetch("/api/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: parsed, prompt: text }),
      });
      const ran = await runRes.json();
      if (!runRes.ok) {
        throw new Error(ran.detail || ran.error || "The backtest failed");
      }

      onRunComplete(ran.run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPhase((p) => (p === "running" ? "idle" : p === "composing" ? "idle" : p));
    }
  }, [prompt, busy, onRunComplete]);

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-center gap-1.5">
        <Sparkles className="text-oak-300" size={14} />
        <h2 className="text-sm text-text-primary">Describe a strategy</h2>
      </div>

      <textarea
        className="mt-3 w-full resize-y rounded-lg border border-border-primary bg-bg-primary p-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-oak-300 focus:outline-none"
        disabled={busy}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder="e.g. go long gold when managed money is washed out below 15, short above 85, with an 8% stop"
        rows={3}
        value={prompt}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          className="flex items-center gap-1.5 rounded-lg bg-oak-300 px-3 py-1.5 text-sm text-bg-primary disabled:opacity-50"
          disabled={busy || !prompt.trim()}
          onClick={submit}
          type="button"
        >
          {busy && <Loader2 className="animate-spin" size={13} />}
          {phase === "composing"
            ? "Reading…"
            : phase === "running"
              ? "Backtesting…"
              : "Run backtest"}
        </button>
        <span className="text-xs text-text-tertiary">⌘↵</span>
        {phase === "running" && (
          <span className="text-xs text-text-tertiary">
            First run on a new market also fetches its history — give it a moment.
          </span>
        )}
      </div>

      {!spec && !error && (
        <div className="mt-3 flex flex-col gap-1">
          {EXAMPLES.map((ex) => (
            <button
              className="text-left text-xs text-text-tertiary hover:text-text-secondary disabled:opacity-50"
              disabled={busy}
              key={ex}
              onClick={() => setPrompt(ex)}
              type="button"
            >
              &ldquo;{ex}&rdquo;
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-primary/30 bg-red-primary/5 p-2.5 text-xs text-red-primary">
          {error}
        </p>
      )}

      {/* Always visible once composed, so a misreading is never hidden. */}
      {spec && (
        <div className="mt-3 border-t border-border-secondary pt-3">
          <p className="mb-2 text-xs text-text-tertiary">What I understood:</p>
          <RuleSpecView prompt={askedPrompt} spec={spec} />
        </div>
      )}
    </div>
  );
}
