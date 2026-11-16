import { describe, it, expect } from "vitest";
import {
  classifyDispersion,
  WATCH_THRESHOLD,
  ELEVATED_THRESHOLD,
} from "./dispersion";

// Observed daily closes of ^VIXEQ − ^VIX over the two years Yahoo serves
// (2024-11-21 → 2026-11-13, n=496): min 12.86, p25 17.89, p50 19.91,
// p75 23.22, p90 26.11, max 34.19. The bands have to sit inside that range —
// the original 1.0 / 3.0 pair put every single observation in the top band.
describe("classifyDispersion", () => {
  it("reads a two-year low as calm", () => {
    expect(classifyDispersion(12.86).label).toBe("Calm");
  });

  it("reads the median as calm", () => {
    expect(classifyDispersion(19.91).label).toBe("Calm");
  });

  it("reads the top quartile as watch", () => {
    expect(classifyDispersion(23.47).label).toBe("Watch");
  });

  it("reads a two-year high as elevated", () => {
    expect(classifyDispersion(34.19).label).toBe("Elevated");
  });

  it("puts both thresholds inside the observed range", () => {
    for (const t of [WATCH_THRESHOLD, ELEVATED_THRESHOLD]) {
      expect(t).toBeGreaterThan(12.86);
      expect(t).toBeLessThan(34.19);
    }
    expect(WATCH_THRESHOLD).toBeLessThan(ELEVATED_THRESHOLD);
  });

  it("is inclusive at each boundary", () => {
    expect(classifyDispersion(WATCH_THRESHOLD).label).toBe("Watch");
    expect(classifyDispersion(ELEVATED_THRESHOLD).label).toBe("Elevated");
  });
});
