import { describe, it, expect } from "vitest";
import { lastExpectedRefresh, isSnapshotStale } from "./refreshSchedule";

// The daily cron runs `0 22 * * 1-5` (weekdays 22:00 UTC). These helpers let the
// client self-heal when the snapshot predates the most recent expected run.
describe("lastExpectedRefresh", () => {
  it("returns today 22:00 UTC once that time has passed on a weekday", () => {
    // Wed 2026-07-01 23:30 UTC → most recent run is Wed 22:00 UTC.
    const now = new Date("2026-07-01T23:30:00Z");
    expect(lastExpectedRefresh(now).toISOString()).toBe("2026-07-01T22:00:00.000Z");
  });

  it("steps back to the prior weekday before 22:00 UTC", () => {
    // Wed 2026-07-01 09:00 UTC → today's run hasn't happened → Tue 22:00 UTC.
    const now = new Date("2026-07-01T09:00:00Z");
    expect(lastExpectedRefresh(now).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("skips the weekend: Monday morning falls back to Friday", () => {
    // Mon 2026-07-06 08:00 UTC → back over Sun/Sat to Fri 2026-07-03 22:00 UTC.
    const now = new Date("2026-07-06T08:00:00Z");
    expect(lastExpectedRefresh(now).toISOString()).toBe("2026-07-03T22:00:00.000Z");
  });

  it("skips the weekend: Sunday evening falls back to Friday", () => {
    const now = new Date("2026-07-05T23:00:00Z");
    expect(lastExpectedRefresh(now).toISOString()).toBe("2026-07-03T22:00:00.000Z");
  });
});

describe("isSnapshotStale", () => {
  it("treats a missing timestamp as stale", () => {
    expect(isSnapshotStale(null, new Date("2026-07-01T23:30:00Z"))).toBe(true);
  });

  it("treats an unparseable timestamp as stale", () => {
    expect(isSnapshotStale("not-a-date", new Date("2026-07-01T23:30:00Z"))).toBe(true);
  });

  it("is stale when the snapshot predates the last expected run", () => {
    // Snapshot from Sun Jun 28; now Wed Jul 1 23:30 UTC (last run Wed 22:00).
    expect(
      isSnapshotStale("2026-06-28T21:20:50Z", new Date("2026-07-01T23:30:00Z"))
    ).toBe(true);
  });

  it("is fresh when the snapshot is newer than the last expected run", () => {
    // Ran at Wed 22:00:30, now Wed 23:30 → fresh.
    expect(
      isSnapshotStale("2026-07-01T22:00:30Z", new Date("2026-07-01T23:30:00Z"))
    ).toBe(false);
  });

  it("stays fresh through the weekend after Friday's run", () => {
    // Friday's run at 22:00, checked Saturday afternoon → still fresh.
    expect(
      isSnapshotStale("2026-07-03T22:00:30Z", new Date("2026-07-04T15:00:00Z"))
    ).toBe(false);
  });
});
