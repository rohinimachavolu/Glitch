import { describe, expect, it } from "vitest";
import { coach, detectMismatch, learnedWeight, safetyCheck, type CheckInInput, type BodyContext } from "./appraisal";

const base: CheckInInput = {
  mood: 3, energy: 3, craving: "none", cravingIntensity: 0, appraisal: "neutral", control: 3, triggers: [],
};
const body: BodyContext = { hour: 15 };

describe("appraisal coaching", () => {
  it("answers post-eating guilt with self-compassion, not restriction", () => {
    const r = coach({ ...base, appraisal: "loss", ateFeeling: "guilty", mood: 2 }, body);
    expect(r.primary.id).toBe("fresh_start");
    expect(r.stateLabel).toMatch(/slipped/);
  });

  it("explains a late-luteal craving after poor sleep as biology", () => {
    const r = coach(
      { ...base, craving: "sweet", cravingIntensity: 4, triggers: ["tired"] },
      { ...body, phase: "luteal", cycleDay: 25, cycleLength: 29, sleepPerformance: 62 },
    );
    expect(r.primary.id).toBe("biology_not_willpower");
    expect(r.insight).toMatch(/before your period/);
  });

  it("sends real hunger to a real meal", () => {
    const r = coach({ ...base, craving: "carbs", cravingIntensity: 4 }, { ...body, hoursSinceMeal: 6 });
    expect(r.primary.id).toBe("eat_real_meal");
  });

  it("suggests urge surfing for a boredom craving when not hungry", () => {
    const r = coach({ ...base, craving: "salty", cravingIntensity: 3, triggers: ["bored"] }, { ...body, hoursSinceMeal: 1.5 });
    expect(r.primary.id).toBe("urge_surf");
  });

  it("detects mind-stressed / body-recovered and coaches reappraisal", () => {
    const input: CheckInInput = { ...base, appraisal: "threat", control: 3, triggers: ["stressed"], mood: 2, energy: 4 };
    const b: BodyContext = { ...body, physioStress: { score: 30, level: "low" }, recovery: 78 };
    expect(detectMismatch(input, b)).toBe("mind_stressed_body_ok");
    const r = coach(input, b);
    expect(r.primary.id).toBe("reframe_challenge");
    expect(r.insight).toMatch(/calm and recovered/);
  });

  it("detects mind-ok / body-stressed and protects recovery", () => {
    const input: CheckInInput = { ...base, appraisal: "challenge", mood: 5, energy: 4 };
    const b: BodyContext = { ...body, physioStress: { score: 75, level: "high" }, physioEnergy: 28, recovery: 30 };
    expect(detectMismatch(input, b)).toBe("mind_ok_body_stressed");
    expect(coach(input, b).primary.id).toBe("rest_permission");
  });

  it("harnesses a challenge appraisal on a well-recovered day", () => {
    const r = coach({ ...base, appraisal: "challenge", mood: 5, energy: 4 }, { ...body, recovery: 80, physioEnergy: 75 });
    expect(r.primary.id).toBe("harness_momentum");
  });

  it("always offers an alternative from a different regulation family", () => {
    const r = coach({ ...base, appraisal: "threat", control: 1, triggers: ["stressed"] }, { ...body, physioStress: { score: 80, level: "high" } });
    expect(r.alternative.family).not.toBe(r.primary.family);
  });

  it("learns from feedback: strategies that didn't help get down-weighted", () => {
    expect(learnedWeight({ shown: 6, helped: 0 })).toBeLessThan(0.5);
    expect(learnedWeight({ shown: 6, helped: 6 })).toBeGreaterThan(1.5);
    const input: CheckInInput = { ...base, appraisal: "threat", control: 3, triggers: ["stressed"] };
    const b: BodyContext = { ...body, physioStress: { score: 80, level: "high" } };
    const first = coach(input, b).primary.id;
    const after = coach(input, b, { [first]: { shown: 8, helped: 0 } }).primary.id;
    expect(after).not.toBe(first);
  });
});

describe("safety", () => {
  it("surfaces crisis resources for crisis language", () => {
    expect(safetyCheck({ ...base, note: "I want to die" }, [])?.message).toMatch(/988/);
  });
  it("surfaces support after a streak of very low mood", () => {
    expect(safetyCheck({ ...base, mood: 1 }, [1, 1])?.show).toBe(true);
    expect(safetyCheck({ ...base, mood: 1 }, [3, 1])).toBeNull();
  });
});
