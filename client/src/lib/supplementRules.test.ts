import { describe, expect, it } from "vitest";
import { kindOf, scheduleIssues, checkTaking, overdue } from "./supplementRules";

const iron = { id: "i", name: "Iron", time: "Morning" };
const calcium = { id: "c", name: "Calcium + D", time: "Morning" };
const omega = { id: "o", name: "Omega-3 fish oil", time: "Morning" };

describe("supplement rules", () => {
  it("recognises supplement names", () => {
    expect(kindOf("Ferrous sulfate 65mg")).toBe("iron");
    expect(kindOf("Vitamin D3")).toBe("vitamin_d");
    expect(kindOf("Synthroid")).toBe("levothyroxine");
    expect(kindOf("Krill oil")).toBe("omega3");
  });
  it("flags iron + calcium in the same slot", () => {
    const issues = scheduleIssues([iron, calcium, omega]);
    expect(issues).toHaveLength(1);
    expect(issues[0].fix).toMatch(/2\+ hours apart/);
  });
  it("doesn't flag iron morning + calcium evening", () => {
    expect(scheduleIssues([iron, { ...calcium, time: "Evening" }])).toEqual([]);
  });
  it("warns about omega-3 on an empty stomach", () => {
    const r = checkTaking(omega, new Date("2026-10-24T09:00:00"), [omega], [], []);
    expect(r.ok).toBe(false);
    expect(r.warnings[0]).toMatch(/with a meal/);
  });
  it("is happy with omega-3 right after a meal with fat", () => {
    expect(checkTaking(omega, new Date("2026-10-24T09:00:00"), [omega], [], [{ name: "Eggs & avocado toast", loggedAt: "2026-10-24T08:40:00", fats: 22 }]).ok).toBe(true);
  });
  it("warns about iron right after calcium and after coffee", () => {
    const now = new Date("2026-10-24T09:00:00");
    const r = checkTaking(iron, now, [iron, calcium], [{ supplementId: "c", at: "2026-10-24T08:30:00" }], [{ name: "Latte", loggedAt: "2026-10-24T08:20:00" }]);
    expect(r.warnings.some((w) => /wait 2 h/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /Coffee, tea or dairy/.test(w))).toBe(true);
  });
  it("knows when a dose is overdue", () => {
    expect(overdue(iron, [], new Date("2026-10-24T12:30:00"))).toBe(true);
    expect(overdue(iron, [{ supplementId: "i", at: new Date("2026-10-24T08:00:00").toISOString() }], new Date("2026-10-24T12:30:00"))).toBe(false);
  });
});
