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

describe("Groq rate-limit handling", () => {
  it("retries after a short 429 wait, then falls back to the second model", async () => {
    const { coachCompletion } = await import("./aiService");
    const models: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const model = JSON.parse(init.body).model as string;
      models.push(model);
      if (models.length <= 2) return new Response('{"error":{"message":"Rate limit. Please try again in 0.01s"}}', { status: 429 });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"hi","actions":[]}' } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = await coachCompletion([{ role: "user", content: "hello" }]);
    expect(out).toContain('"reply":"hi"');
    expect(models[0]).toBe(models[1]);                 // retried the same model once
    expect(models[2]).not.toBe(models[0]);             // then the fallback model
    expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body).reasoning_effort).toBe("low");
  });
});

describe("JSON-mode recovery", () => {
  it("uses Groq's failed_generation text when the model answered in plain text", async () => {
    const { coachCompletion } = await import("./aiService");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "json_validate_failed", failed_generation: "What kind of pasta was it?" } }), { status: 400 })));
    expect(await coachCompletion([{ role: "user", content: "had pasta" }])).toBe("What kind of pasta was it?");
  });
});
