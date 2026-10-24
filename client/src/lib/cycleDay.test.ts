import { describe, expect, it } from "vitest";
import { getCycleDay } from "@/contexts/AppContext";

const TODAY = new Date(2026, 9, 24); // 24 Oct 2026

describe("getCycleDay", () => {
  it("returns the correct 1-based day within a cycle", () => {
    // 12 Oct → 24 Oct is 12 days later, so cycle day 13
    expect(getCycleDay("2026-10-12", 28, TODAY)).toBe(13);
  });

  it("wraps across cycle boundaries without going to 0 or negative", () => {
    // 60 days before today, 28-day cycle → still a valid day in [1, 28]
    const d = getCycleDay("2026-08-25", 28, TODAY);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(28);
  });

  it("never returns NaN for a blank date (C1 regression)", () => {
    const d = getCycleDay("", 28, TODAY);
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBe(1);
  });

  it("never returns NaN for an invalid date string", () => {
    const d = getCycleDay("not-a-date", 28, TODAY);
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBe(1);
  });

  it("tolerates a zero/negative cycle length by falling back to 28", () => {
    const d = getCycleDay("2026-10-12", 0, TODAY);
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBeGreaterThanOrEqual(1);
  });
});
