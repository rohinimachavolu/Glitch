/**
 * Property-based tests (fast-check).
 *
 * Example-based tests check specific inputs; these check INVARIANTS that must hold for *all*
 * inputs in a range. fast-check generates hundreds of random cases and shrinks any failure to
 * a minimal reproducer. Run against the original getCycleDay, the first property fails with the
 * shrunk counterexample ["", 0] (blank date, zero cycle length → NaN), the C1 bug. It now guards
 * that fix against regressions.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { getCycleDay } from "@/contexts/AppContext";
import { demoSeedFrom } from "@/lib/whoop/demoData";
import { ovulationConfidenceSummary, type OvulationResult, type OvulationStatus } from "@/lib/healthMetrics";

describe("getCycleDay — properties", () => {
  it("is always a finite integer in [1, cycleLength] for any date string and length", () => {
    fc.assert(
      fc.property(
        // arbitrary (often invalid) date strings, including "" and junk
        fc.oneof(
          fc.string(),                                   // junk / empty / invalid
          fc.constant(""),
          fc.constant("not-a-date"),
          // valid YYYY-MM-DD strings built from integers (never throws)
          fc.record({ y: fc.integer({ min: 1990, max: 2035 }), m: fc.integer({ min: 1, max: 12 }), d: fc.integer({ min: 1, max: 28 }) })
            .map(({ y, m, d }) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`),
        ),
        fc.integer({ min: -10, max: 400 }),  // includes zero/negative lengths
        fc.integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2035, 0, 1) }).map((t) => new Date(t)),
        (dateStr, len, today) => {
          const d = getCycleDay(dateStr, len, today);
          expect(Number.isNaN(d)).toBe(false);
          expect(Number.isInteger(d)).toBe(true);
          const effectiveLen = len > 0 ? len : 28;
          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(effectiveLen);
        }
      ),
      { numRuns: 500 }
    );
  });
});

describe("demoSeedFrom — properties", () => {
  it("is deterministic: same profile → same seed", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 12, max: 90 }), fc.integer({ min: 120, max: 210 }), fc.integer({ min: 40, max: 160 }),
        (name, age, heightCm, weightKg) => {
          const a = demoSeedFrom({ name, age, heightCm, weightKg });
          const b = demoSeedFrom({ name, age, heightCm, weightKg });
          expect(a).toBe(b);
          expect(a).toBeGreaterThan(0);
          expect(Number.isInteger(a)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("distinguishes profiles that differ by age (very low collision rate)", () => {
    // Over many pairs differing only in age, seeds should almost always differ.
    let collisions = 0, total = 0;
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 20, max: 60 }), (name, age) => {
        total++;
        if (demoSeedFrom({ name, age }) === demoSeedFrom({ name, age: age + 1 })) collisions++;
      }),
      { numRuns: 400 }
    );
    expect(collisions / total).toBeLessThan(0.02);
  });
});

describe("ovulationConfidenceSummary — properties", () => {
  const statuses: OvulationStatus[] = ["confirmed", "not_detected", "pending", "insufficient_data"];
  it("only shows for confirmed status, and detail never contains NaN/undefined", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...statuses),
        fc.option(fc.double({ min: -1, max: 2, noNaN: true }), { nil: undefined }),
        fc.option(fc.double({ min: -5, max: 10, noNaN: true }), { nil: undefined }),
        fc.constantFrom<"high" | "medium" | undefined>("high", "medium", undefined),
        (status, tempShift, rhrShift, confidence) => {
          const ov: OvulationResult = { cycleStart: "2000-01-01", status, tempShift, rhrShift, confidence };
          const s = ovulationConfidenceSummary(ov);
          expect(s.show).toBe(status === "confirmed");
          if (!s.show) expect(s.label).toBe("");
          expect(s.detail).not.toContain("NaN");
          expect(s.detail).not.toContain("undefined");
        }
      ),
      { numRuns: 500 }
    );
  });
});
