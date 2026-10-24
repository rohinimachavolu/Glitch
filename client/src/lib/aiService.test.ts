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

describe("AI proxy", () => {
  it("sends chat requests to the server proxy, never to Groq with a key", async () => {
    const { coachCompletion } = await import("./aiService");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: '{"reply":"hi","actions":[]}' }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await coachCompletion([{ role: "user", content: "hello" }])).toContain('"reply":"hi"');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("/api/llm/chat");
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body).patient).toBe(true);
  });

  it("falls back to an offline coach reply that still logs a hot flash and BP", async () => {
    const { coachCompletion } = await import("./aiService");
    const { parseCoachResponse } = await import("./coachAgent");
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":"rate_limited"}}', { status: 503 })));
    const res = parseCoachResponse(await coachCompletion([{ role: "user", content: "Severe hot flash, and my blood pressure is 132 over 84" }]));
    expect(res.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "log_hot_flash", intensity: 3 }),
      expect.objectContaining({ type: "log_bp", systolic: 132, diastolic: 84 }),
    ]));
    expect(res.reply.length).toBeGreaterThan(0);
  });
});

describe("JSON-mode recovery", () => {
  it("uses Groq's failed_generation text when the model answered in plain text", async () => {
    const { coachCompletion } = await import("./aiService");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "json_validate_failed", failed_generation: "What kind of pasta was it?" } }), { status: 400 })));
    expect(await coachCompletion([{ role: "user", content: "had pasta" }])).toBe("What kind of pasta was it?");
  });
});
