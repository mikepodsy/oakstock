// VIXEQ − VIX dispersion bands.
//
// The spread is a *level*, not a delta: ^VIXEQ (equal-weight S&P vol) sits well
// above ^VIX structurally, so the series never goes near zero. Over the two
// years Yahoo serves hourly ^VIXEQ bars for (2024-11-21 → 2026-11-13, n=496
// daily closes) it ran 12.86 → 34.19 with a 19.91 median.
//
// The bands are anchored on that distribution: the top quartile (p75 ≈ 23.22)
// is worth watching, the top decile (p90 ≈ 26.11) is the alarming state.
export const WATCH_THRESHOLD = 23;
export const ELEVATED_THRESHOLD = 26;

export type DispersionBand = {
  label: "Calm" | "Watch" | "Elevated";
  /** Tailwind class for the status dot. */
  dot: string;
  /** Tailwind class for the headline number. */
  value: string;
  /** Tailwind classes for the card's border + tint. */
  ring: string;
};

/** Higher spread = more single-stock dispersion, the alarming state → red. */
export function classifyDispersion(spread: number): DispersionBand {
  if (spread >= ELEVATED_THRESHOLD) {
    return {
      label: "Elevated",
      dot: "bg-red-primary",
      value: "text-red-primary",
      ring: "border-red-primary/30 bg-red-primary/10",
    };
  }
  if (spread >= WATCH_THRESHOLD) {
    return {
      label: "Watch",
      dot: "bg-yellow-500",
      value: "text-yellow-500",
      ring: "border-yellow-500/30 bg-yellow-500/10",
    };
  }
  return {
    label: "Calm",
    dot: "bg-green-primary",
    value: "text-green-primary",
    ring: "border-green-primary/30 bg-green-primary/10",
  };
}
