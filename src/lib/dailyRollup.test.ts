import { describe, it, expect } from "vitest";
import { rollupToDaily } from "./dailyRollup";

describe("rollupToDaily", () => {
  it("keeps the last bar of each day as that day's close", () => {
    const result = rollupToDaily([
      { date: "2026-08-10T13:30:00.000Z", value: 1 },
      { date: "2026-08-10T20:00:00.000Z", value: 3 },
      { date: "2026-08-11T13:30:00.000Z", value: 5 },
      { date: "2026-08-11T19:30:00.000Z", value: 4 },
    ]);

    expect(result).toEqual([
      { date: "2026-08-10", value: 3 },
      { date: "2026-08-11", value: 4 },
    ]);
  });

  it("picks the latest bar and sorts by day when input is out of order", () => {
    const result = rollupToDaily([
      { date: "2026-08-11T19:30:00.000Z", value: 4 },
      { date: "2026-08-10T20:00:00.000Z", value: 3 },
      { date: "2026-08-10T13:30:00.000Z", value: 1 },
    ]);

    expect(result).toEqual([
      { date: "2026-08-10", value: 3 },
      { date: "2026-08-11", value: 4 },
    ]);
  });

  it("passes through points that are already day-keyed", () => {
    const result = rollupToDaily([
      { date: "2026-08-10", value: 3 },
      { date: "2026-08-11", value: 4 },
    ]);

    expect(result).toEqual([
      { date: "2026-08-10", value: 3 },
      { date: "2026-08-11", value: 4 },
    ]);
  });

  it("returns an empty series unchanged", () => {
    expect(rollupToDaily([])).toEqual([]);
  });
});
