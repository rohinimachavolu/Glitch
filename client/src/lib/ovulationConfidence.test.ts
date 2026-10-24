import { describe, expect, it } from "vitest";
import { ovulationConfidenceSummary, type OvulationResult } from "./healthMetrics";

const base: OvulationResult = { cycleStart: "2000-01-01", status: "confirmed" };

describe("ovulationConfidenceSummary", () => {
  it("high confidence with a resting-HR rise shows both signals", () => {
    const s = ovulationConfidenceSummary({ ...base, confidence: "high", tempShift: 0.31, rhrShift: 1.8 });
    expect(s.show).toBe(true);
    expect(s.label).toBe("High confidence");
    expect(s.tone).toBe("high");
    expect(s.detail).toContain("°C");
    expect(s.detail).toContain("+1.8 bpm resting HR");
  });

  it("medium confidence without rhr shows temp only, no bpm", () => {
    const s = ovulationConfidenceSummary({ ...base, confidence: "medium", tempShift: 0.22 });
    expect(s.show).toBe(true);
    expect(s.label).toBe("Medium confidence");
    expect(s.tone).toBe("medium");
    expect(s.detail).toContain("+0.22 °C skin temp");
    expect(s.detail).not.toContain("bpm");
  });

  it("hides the indicator for non-confirmed statuses", () => {
    for (const status of ["pending", "not_detected", "insufficient_data"] as const) {
      const s = ovulationConfidenceSummary({ ...base, status });
      expect(s.show).toBe(false);
      expect(s.label).toBe("");
      expect(s.tone).toBeNull();
    }
  });
});
