import { describe, expect, it } from "vitest";
import { parseCoachResponse, buildSystemPrompt } from "./coachAgent";

describe("parseCoachResponse", () => {
  it("parses reply, mood read and a valid meal action", () => {
    const r = parseCoachResponse(JSON.stringify({
      reply: "Logged! Eggs on toast, about 390 kcal.",
      mood_read: { valence: 0.4, arousal: 0.5 },
      actions: [{ type: "log_meal", meal: { name: "Eggs on toast", type: "Breakfast", calories: 390, protein: 20, carbs: 30, fats: 18, fiber: 3 } }],
    }));
    expect(r.reply).toMatch(/Logged/);
    expect(r.moodRead).toEqual({ valence: 0.4, arousal: 0.5 });
    expect(r.actions).toHaveLength(1);
  });

  it("drops invalid actions but keeps valid ones", () => {
    const r = parseCoachResponse(JSON.stringify({
      reply: "ok",
      actions: [
        { type: "log_meal", meal: { name: "Pizza", type: "Dinner", calories: 99999, protein: 10, carbs: 10, fats: 10 } },
        { type: "delete_everything" },
        { type: "remove_meal", name: "Latte" },
      ],
    }));
    expect(r.actions).toEqual([{ type: "remove_meal", name: "Latte" }]);
  });

  it("strips <think> blocks and tolerates surrounding text", () => {
    const r = parseCoachResponse('<think>hmm {not json}</think>Sure! {"reply":"Hi there","actions":[]}');
    expect(r.reply).toBe("Hi there");
  });

  it("falls back to the raw text when there is no JSON", () => {
    expect(parseCoachResponse("Just plain text").reply).toBe("Just plain text");
  });

  it("clamps out-of-range mood reads", () => {
    expect(parseCoachResponse('{"reply":"x","mood_read":{"valence":-3,"arousal":2}}').moodRead).toEqual({ valence: -1, arousal: 1 });
  });
});

describe("buildSystemPrompt", () => {
  it("adapts tone to the fused mood and includes today's meals", () => {
    const p = buildSystemPrompt({
      firstName: "Maya", goal: "manage blood sugar", localTime: "8:10 PM",
      todayMeals: [{ name: "Oatmeal", type: "Breakfast", calories: 300, protein: 10 }],
      mood: { valence: -0.5, arousal: 0.7, label: "tense", sources: ["face", "voice"] },
    });
    expect(p).toMatch(/seem tense/);
    expect(p).toMatch(/Breakfast: Oatmeal \(300 kcal\)/);
    expect(p).toMatch(/988/);
  });
});
