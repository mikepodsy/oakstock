// Compact stat card for the volatility dashboard.
export function VolStatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg" | "warn";
}) {
  const color =
    tone === "pos"
      ? "text-green-primary"
      : tone === "neg"
        ? "text-red-primary"
        : tone === "warn"
          ? "text-oak-300"
          : "text-text-primary";
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className={`text-2xl font-financial ${color}`}>{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-1">{sub}</p>}
    </div>
  );
}

export const pct = (v: number | null, digits = 0): string =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

// IV rank/percentile are already 0..1 fractions of the range, not vols.
export const pctRank = (v: number | null): string =>
  v == null ? "—" : `${Math.round(v * 100)}%`;
