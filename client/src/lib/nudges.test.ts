import { describe, expect, it } from "vitest";
import { computeNudges, estimateSugar } from "./nudges";

const base = { calorieTarget: 2000, proteinTarget: 100, sugarLimit: 25, supplements: [], taken: [], allowDeficitTalk: true };

describe("nudges", () => {
  it("flags a sugary day with an appraisal-framed, non-shaming message", () => {
    const n = computeNudges({ ...base, now: new Date("2026-10-24T15:00:00"), meals: [
      { name: "Blueberry muffin", calories: 420, protein: 6, carbs: 60 },
      { name: "Iced caramel frappuccino", calories: 380, protein: 5, carbs: 60 },
    ] });
    const s = n.find((x) => x.kind === "sugar")!;
    expect(s.body).toMatch(/that's okay/);
    expect(s.body).not.toMatch(/bad|fail/i);
  });

  it("nudges protein in the afternoon when under half", () => {
    const n = computeNudges({ ...base, now: new Date("2026-10-24T16:00:00"), meals: [{ name: "Toast", calories: 300, protein: 10, carbs: 50 }] });
    expect(n.find((x) => x.kind === "protein")?.title).toBe("10 of 100 g protein");
  });

  it("flags calories nearly used before evening, but never when deficit talk is off", () => {
    const meals = [{ name: "Big lunch", calories: 1800, protein: 60, carbs: 200 }];
    expect(computeNudges({ ...base, now: new Date("2026-10-24T14:00:00"), meals }).some((x) => x.kind === "calories")).toBe(true);
    expect(computeNudges({ ...base, allowDeficitTalk: false, now: new Date("2026-10-24T14:00:00"), meals }).some((x) => x.kind === "calories")).toBe(false);
  });

  it("reminds about overdue supplements with food guidance and flags clashes", () => {
    const n = computeNudges({ ...base, now: new Date("2026-10-24T18:00:00"), meals: [], supplements: [
      { id: "1", name: "Vitamin D3", time: "Morning" }, { id: "2", name: "Iron", time: "Morning" }, { id: "3", name: "Calcium", time: "Morning" },
    ] });
    expect(n.find((x) => x.id === "sup-1")?.body).toMatch(/fat/);
    expect(n.some((x) => x.kind === "supplement_timing")).toBe(true);
  });

  it("uses logged sugar when available", () => {
    expect(estimateSugar([{ name: "Smoothie", calories: 300, protein: 5, carbs: 50, sugar: 38 }]).grams).toBe(38);
  });
});
