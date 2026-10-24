import { describe, expect, it } from "vitest";
import { cycleAlerts } from "./cycleAlerts";

const now = new Date("2026-10-24T12:00:00Z");

describe("cycle alerts", () => {
  it("flags a late period with age-appropriate context", () => {
    const a = cycleAlerts({ lastPeriodDate: "2026-09-10", cycleLength: 28, periodStarts: [], age: 46, now });
    expect(a[0].title).toMatch(/days late/);
    expect(a[0].detail).toMatch(/perimenopause/);
  });
  it("flags shifting cycle lengths", () => {
    const a = cycleAlerts({ lastPeriodDate: "2026-10-15", cycleLength: 28, periodStarts: ["2026-07-01", "2026-07-27", "2026-09-05"], age: 44, now });
    expect(a.some((x) => x.title === "Cycle length is shifting")).toBe(true);
  });
  it("flags a recurring premenstrual mood dip and a cycle without ovulation", () => {
    const a = cycleAlerts({
      lastPeriodDate: "2026-10-12", cycleLength: 29, periodStarts: [], age: 30, now,
      windows: [{ start: "2026-08-15", end: "2026-09-12", complete: true }, { start: "2026-09-13", end: "2026-10-11", complete: true }, { start: "2026-10-12", end: "2026-10-24", complete: false }],
      ovulations: [{ cycleStart: "2026-08-15", status: "confirmed" }, { cycleStart: "2026-09-13", status: "not_detected" }, { cycleStart: "2026-10-12", status: "pending" }],
      premenstrualDip: { recurring: true, avgDip: 1.2 },
    });
    expect(a.map((x) => x.icon)).toEqual(expect.arrayContaining(["🥚", "🌖"]));
  });
  it("stays quiet for a regular, on-time cycle", () => {
    expect(cycleAlerts({ lastPeriodDate: "2026-10-12", cycleLength: 28, periodStarts: ["2026-08-17", "2026-09-14"], age: 30, now })).toEqual([]);
  });
});
