import { describe, expect, it } from "vitest";
import { generateDemoWhoop, generateDemoMoods } from "./whoop/demoData";
import { toDaily } from "./whoop/types";
import { cycleWindows } from "./healthMetrics";
import {
  scoreScreener, interpretScreener, moodByDay, moodBodyLinks, premenstrualMoodPattern, burnoutRisk,
} from "./mentalHealth";

describe("PHQ-2 / GAD-2 screener", () => {
  it("scores each scale and flags ≥3 as a positive screen", () => {
    const r = scoreScreener({ phq1: 2, phq2: 1, gad1: 0, gad2: 1 }, "2026-10-24");
    expect(r).toEqual({ date: "2026-10-24", phq2: 3, gad2: 1 });
    const i = interpretScreener(r);
    expect(i.positive).toBe(true);
    expect(i.message).toMatch(/PHQ-9/);
  });
  it("is negative below threshold", () => {
    expect(interpretScreener(scoreScreener({ phq1: 1, phq2: 1, gad1: 1, gad2: 1 }, "x")).positive).toBe(false);
  });
});

describe("mood analytics on demo data", () => {
  const data = generateDemoWhoop({ menstruating: true, lastPeriodDate: "2026-10-12", cycleLength: 29, age: 30, today: new Date(2026, 9, 24) });
  const days = toDaily(data);
  const windows = cycleWindows(["2026-10-12"], 29, "2026-10-24", 90);
  const moods = moodByDay(generateDemoMoods(days, windows.map((w) => w.start)));

  it("finds the sleep → mood link", () => {
    const links = moodBodyLinks(days, moods);
    expect(links.find((l) => l.id === "sleep")?.diff).toBeGreaterThan(0.4);
  });

  it("detects a recurring premenstrual mood dip", () => {
    const p = premenstrualMoodPattern(windows, moods)!;
    expect(p.cyclesAnalysed).toBeGreaterThanOrEqual(2);
    expect(p.recurring).toBe(true);
    expect(p.avgDip).toBeGreaterThanOrEqual(1);
  });

  it("doesn't flag burnout on an improving trend", () => {
    expect(burnoutRisk(days, moods).flagged).toBe(false);
  });
});

describe("guards against false patterns", () => {
  it("needs enough days before claiming a link", () => {
    const days = [{ date: "2026-10-01", sleepPerformance: 50 }, { date: "2026-10-02", sleepPerformance: 90 }] as never;
    expect(moodBodyLinks(days, new Map([["2026-10-01", 1], ["2026-10-02", 5]]))).toEqual([]);
  });
});
