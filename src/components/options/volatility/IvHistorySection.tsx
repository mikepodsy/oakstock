"use client";

import type { VolStats } from "@/types/volatility";

const pct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const diff = (cur: number | null, avg: number | null) =>
  cur == null || avg == null ? "—" : `${cur - avg >= 0 ? "+" : ""}${((cur - avg) * 100).toFixed(1)}%`;

// Position of current IV within the 52-week range, as a 0..100% gauge.
function gaugePct(stats: VolStats): number | null {
  const { currentIv, yearLowIv, yearHighIv } = stats;
  if (currentIv == null || yearLowIv == null || yearHighIv == null || yearHighIv <= yearLowIv) {
    return null;
  }
  return Math.min(Math.max((currentIv - yearLowIv) / (yearHighIv - yearLowIv), 0), 1) * 100;
}

export function IvHistorySection({ stats }: { stats: VolStats }) {
  const g = gaugePct(stats);
  const zone =
    g == null ? "" : g < 33 ? "Cheap vol" : g < 66 ? "Average vol" : "Expensive vol";

  const rows: Array<[string, string, string, string]> = [
    ["30-day avg", pct(stats.avg30Iv), pct(stats.currentIv), diff(stats.currentIv, stats.avg30Iv)],
    ["90-day avg", pct(stats.avg90Iv), pct(stats.currentIv), diff(stats.currentIv, stats.avg90Iv)],
    ["52-week high", pct(stats.yearHighIv), "—", "—"],
    ["52-week low", pct(stats.yearLowIv), "—", "—"],
  ];

  return (
    <section className="rounded-xl border border-border-primary bg-bg-secondary p-4">
      <h3 className="font-display text-base text-text-primary mb-1">IV vs Recent History</h3>
      <p className="text-xs text-text-secondary mb-4">
        Where current ATM IV ({pct(stats.currentIv)}) sits versus its own history.
      </p>

      {/* Gauge */}
      {g != null && (
        <div className="mb-5">
          <div className="relative h-2.5 rounded-full bg-gradient-to-r from-green-primary via-oak-300 to-red-primary">
            <div
              className="absolute -top-1 h-4.5 w-1.5 rounded-full bg-text-primary border border-bg-primary"
              style={{ left: `calc(${g}% - 3px)`, height: "1.125rem" }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-text-tertiary">
            <span>Low {pct(stats.yearLowIv, 0)}</span>
            <span className="text-text-secondary">{zone}</span>
            <span>High {pct(stats.yearHighIv, 0)}</span>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-tertiary text-xs">
            <th className="text-left font-normal py-1.5">Period</th>
            <th className="text-right font-normal">Avg IV</th>
            <th className="text-right font-normal">Current</th>
            <th className="text-right font-normal">vs Avg</th>
          </tr>
        </thead>
        <tbody className="font-financial">
          {rows.map(([period, avg, cur, vs]) => (
            <tr key={period} className="border-t border-border-primary/50">
              <td className="text-left py-2 text-text-secondary font-sans">{period}</td>
              <td className="text-right text-text-primary">{avg}</td>
              <td className="text-right text-text-primary">{cur}</td>
              <td
                className="text-right"
                style={{ color: vs.startsWith("+") ? "var(--green-primary)" : vs.startsWith("-") ? "var(--red-primary)" : "var(--text-tertiary)" }}
              >
                {vs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
