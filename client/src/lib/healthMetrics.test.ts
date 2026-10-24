import { describe, expect, it } from "vitest";
import { generateDemoWhoop } from "./whoop/demoData";
import { toDaily, type DailyPhysiology } from "./whoop/types";
import {
  cycleWindows, detectOvulation, detectOvulationHistory, phaseMap, cycleAdjustedRecovery,
  stressScore, energyScore, estimateVo2max, trend, zone2MinutesByWeek,
} from "./healthMetrics";

const TODAY = new Date(2026, 9, 24);
const LAST_PERIOD = "2026-10-12";

function demo(menstruating = true) {
  const data = generateDemoWhoop({ menstruating, lastPeriodDate: LAST_PERIOD, cycleLength: 29, age: 30, today: TODAY });
  return { data, days: toDaily(data) };
}

describe("toDaily", () => {
  it("joins WHOOP collections into one row per day", () => {
    const { days } = demo();
    expect(days).toHaveLength(90);
    expect(days[89].date).toBe("2026-10-24");
    const d = days[50];
    expect(d.recovery).not.toBeNull();
    expect(d.skinTemp).not.toBeNull();
    expect(d.sleepPerformance).not.toBeNull();
    expect(d.strain).not.toBeNull();
  });
});

describe("ovulation detection", () => {
  it("finds the anovulatory cycle and confirms ovulation in later cycles", () => {
    const { days } = demo();
    const windows = cycleWindows([LAST_PERIOD], 29, "2026-10-24", 90);
    const results = detectOvulationHistory(days, windows);
    const complete = results.filter((_, i) => windows[i].complete);
    const statuses = complete.map((r) => r.status);
    expect(statuses).toContain("not_detected");
    expect(statuses).toContain("confirmed");
    // The anovulatory cycle comes before the ovulatory ones (the reversal story)
    expect(statuses.indexOf("not_detected")).toBeLessThan(statuses.lastIndexOf("confirmed"));

    const confirmed = complete.find((r) => r.status === "confirmed")!;
    expect(confirmed.ovulationCycleDay).toBeGreaterThanOrEqual(13);
    expect(confirmed.ovulationCycleDay).toBeLessThanOrEqual(17);
    expect(confirmed.tempShift!).toBeGreaterThan(0.2);
  });

  it("reports pending for the in-progress cycle before the shift", () => {
    const { days } = demo();
    const r = detectOvulation(days, { start: LAST_PERIOD, end: "2026-10-24", complete: false });
    // Cycle day 13 — too early for a luteal shift
    expect(r.status === "pending" || r.status === "insufficient_data").toBe(true);
  });

  it("finds no ovulation for a non-menstruating profile", () => {
    const { days } = demo(false);
    const windows = cycleWindows([LAST_PERIOD], 29, "2026-10-24", 90).filter((w) => w.complete);
    expect(detectOvulationHistory(days, windows).every((r) => r.status !== "confirmed")).toBe(true);
  });
});

describe("cycle-adjusted recovery", () => {
  it("compares today against the same phase", () => {
    const { days } = demo();
    const windows = cycleWindows([LAST_PERIOD], 29, "2026-10-24", 90);
    const phases = phaseMap(days, windows, detectOvulationHistory(days, windows), 29);
    const r = cycleAdjustedRecovery(days, phases)!;
    expect(r.phase).toBe("follicular");
    expect(r.phaseAverage).not.toBeNull();
    expect(typeof r.message).toBe("string");
  });

  it("falls back to a 30-day baseline without cycle data", () => {
    const { days } = demo(false);
    const r = cycleAdjustedRecovery(days, null)!;
    expect(r.phase).toBeNull();
    expect(r.message).toMatch(/30-day average|baseline/);
  });
});

describe("stress, energy, VO2max", () => {
  it("flags high stress when HRV drops and RHR rises", () => {
    const base: DailyPhysiology[] = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`, recovery: 60, restingHr: 60 + (i % 3) - 1, hrv: 50 + (i % 5) - 2,
      skinTemp: null, spo2: null, respRate: null, sleepPerformance: 80 + (i % 4) - 2, sleepHours: 7.5, strain: 8, kilojoule: null,
    }));
    const stressed = [...base, { ...base[0], date: "2026-10-01", hrv: 35, restingHr: 67, sleepPerformance: 62 }];
    const calm = [...base, { ...base[0], date: "2026-10-01", hrv: 56, restingHr: 58, sleepPerformance: 85 }];
    expect(stressScore(stressed, null)!.level).toBe("high");
    expect(stressScore(stressed, null)!.drivers).toContain("HRV below your baseline");
    expect(stressScore(calm, null)!.level).toBe("low");
  });

  it("drains energy with strain", () => {
    const d: DailyPhysiology = { date: "2026-10-01", recovery: 80, restingHr: 58, hrv: 55, skinTemp: null, spo2: null, respRate: null, sleepPerformance: 85, sleepHours: 8, strain: 0, kilojoule: null };
    expect(energyScore(d)!.score).toBeGreaterThan(energyScore({ ...d, strain: 15 })!.score);
  });

  it("estimates VO2max with the Uth formula", () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}`, restingHr: 60 } as DailyPhysiology));
    const v = estimateVo2max(days, 30, "female", 187)!;
    expect(v.value).toBeCloseTo(15.3 * 187 / 60, 1);
    expect(v.category).toBe("Superior");
  });
});

describe("reversal trends", () => {
  it("shows resting HR down, HRV up and zone-2 minutes rising in the demo", () => {
    const { data, days } = demo();
    expect(trend(days, "restingHr")!.change).toBeLessThan(-3);
    expect(trend(days, "hrv")!.change).toBeGreaterThan(5);
    const z2 = zone2MinutesByWeek(data.workouts, 12, TODAY);
    expect(z2).toHaveLength(12);
    expect(z2[z2.length - 2].minutes).toBeGreaterThan(z2[1].minutes);
  });
});
