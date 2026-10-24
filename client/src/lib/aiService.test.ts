import { afterEach, describe, expect, it, vi } from "vitest";
import { generateExercisePlan, generateNutritionGoals, getMotivationalMessage } from "./aiService";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AI service fallbacks", () => {
  it("returns usable nutrition and exercise data when the external API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const goals = await generateNutritionGoals({
      name: "Ava",
      age: 29,
      weight: 62,
      height: 168,
      goal: "lose_weight",
    });

    expect(goals.calorieTarget).toBeGreaterThan(0);
    expect(goals.proteinTarget).toBeGreaterThan(0);
    expect(goals.rationale.length).toBeGreaterThan(0);

    const plan = await generateExercisePlan({
      age: 29,
      weight: 62,
      height: 168,
      goal: "lose_weight",
      equipment: ["dumbbells"],
      workoutStyles: ["weight_training", "running"],
    });

    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0]?.name.length).toBeGreaterThan(0);

    const message = await getMotivationalMessage({
      name: "Ava",
      goal: "lose_weight",
      caloriesPct: 0.7,
      proteinPct: 0.8,
      streakDays: 5,
    });

    expect(message.length).toBeGreaterThan(0);
  });
});
