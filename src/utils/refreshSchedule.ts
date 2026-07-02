// Scheduling helpers for the precomputed large-cap momentum snapshot. The daily
// Vercel cron refreshes it on the `0 22 * * 1-5` schedule (weekdays 22:00 UTC,
// comfortably after the 16:00 ET close). These pure functions let the client
// detect a stale snapshot and self-heal — covering dev/preview (where the cron
// never runs) and any missed/failed production run.

/** UTC hour the daily refresh is scheduled for; mirrors vercel.json's cron. */
const REFRESH_HOUR_UTC = 22;

/**
 * The most recent instant the daily refresh was expected to have run: the latest
 * weekday (Mon–Fri) at 22:00 UTC that is at or before `now`. Holidays are not
 * modeled — at worst that means one harmless extra recompute on a closed day.
 */
export function lastExpectedRefresh(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(REFRESH_HOUR_UTC, 0, 0, 0);
  // If today's run time hasn't arrived yet, look to a previous day.
  if (d.getTime() > now.getTime()) d.setUTCDate(d.getUTCDate() - 1);
  // Walk back over Saturday (6) and Sunday (0) to the prior weekday.
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

/**
 * True when the snapshot's `updated_at` predates the last expected refresh (or is
 * missing/unparseable), meaning the client should trigger a recompute.
 */
export function isSnapshotStale(lastUpdated: string | null, now: Date = new Date()): boolean {
  if (!lastUpdated) return true;
  const updated = new Date(lastUpdated).getTime();
  if (Number.isNaN(updated)) return true;
  return updated < lastExpectedRefresh(now).getTime();
}
