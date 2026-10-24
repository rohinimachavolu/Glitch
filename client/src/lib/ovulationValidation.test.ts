import { describe, expect, it } from "vitest";
import { evaluate, gridSearch, parseCsv, pickColumn, referenceOvulation, cycleWindowsFromBleeding, type ParticipantDay } from "./ovulationValidation";
import { DEFAULT_OVULATION_PARAMS } from "./healthMetrics";

/** Synthetic mcPHASES-like participant: 28-day cycles, LH surge on day 14, temp rises after ovulation. */
function participant(cycles: number, anovulatoryCycle = -1, seed = 1): ParticipantDay[] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
  const rows: ParticipantDay[] = [];
  for (let c = 0; c < cycles; c++) {
    for (let d = 1; d <= 28; d++) {
      const day = c * 28 + d;
      const ovulates = c !== anovulatoryCycle;
      const luteal = ovulates && d > 15;
      rows.push({
        day,
        temp: (luteal ? 0.35 : 0) + rnd() * 0.12,
        rhr: 60 + (luteal ? 2.5 : 0) + rnd(),
        lh: ovulates && d === 14 ? 40 : ovulates && d === 13 ? 15 : 5 + rnd() * 2,
        menstruating: d <= 5,
      });
    }
  }
  return rows;
}

describe("mcPHASES validation harness", () => {
  it("finds LH-surge reference ovulation the day after the peak", () => {
    const p = participant(3);
    const w = cycleWindowsFromBleeding(p);
    expect(w).toHaveLength(2);
    expect(referenceOvulation(p, w[0]).ovulationIso).toBe("2000-01-16");
  });

  it("scores the detector: high ±2-day accuracy and catches the anovulatory cycle", () => {
    const people = [participant(5, 2, 3), participant(5, -1, 7), participant(5, 1, 11)];
    const r = evaluate(people, DEFAULT_OVULATION_PARAMS);
    expect(r.cyclesWithSurge).toBeGreaterThanOrEqual(8);
    expect(r.cyclesWithoutSurge).toBeGreaterThanOrEqual(2);
    expect(r.within2Days).toBeGreaterThan(0.8);
    expect(r.falsePositiveRate).toBe(0);
  });

  it("grid search returns ranked settings", () => {
    const g = gridSearch([participant(4, 1, 5)]);
    expect(g.length).toBeGreaterThan(10);
    expect(g[0].score).toBeGreaterThanOrEqual(g[g.length - 1].score);
  });

  it("parses CSV and auto-detects columns", () => {
    const rows = parseCsv('id,day_in_study,"nightly_temperature"\n1,3,0.21\n');
    expect(rows[0]).toEqual({ id: "1", day_in_study: "3", nightly_temperature: "0.21" });
    expect(pickColumn(["ID", "Day_In_Study", "LH_value"], ["lh"])).toBe("LH_value");
  });
});
