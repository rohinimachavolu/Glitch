/**
 * Glitch — conversational coach ("Glitchy")
 * The model replies like a person AND returns structured actions (log/remove meals) plus its own
 * read of the user's mood from their words. Actions are validated with zod before they touch state,
 * so a malformed or hallucinated response can't corrupt the user's log.
 */
import { z } from "zod";
import { TONE_GUIDE, type FusedMood } from "./emotion";

export const MealActionSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
  calories: z.number().min(0).max(4000),
  protein: z.number().min(0).max(300),
  carbs: z.number().min(0).max(500),
  fats: z.number().min(0).max(300),
  fiber: z.number().min(0).max(100).default(0),
  sugar: z.number().min(0).max(300).optional(),
});
export type MealAction = z.infer<typeof MealActionSchema>;

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("log_meal"), meal: MealActionSchema }),
  z.object({ type: z.literal("remove_meal"), name: z.string().min(1) }),
  z.object({ type: z.literal("log_hot_flash"), intensity: z.number().int().min(1).max(3).default(2), night: z.boolean().default(false), count: z.number().int().min(1).max(10).default(1) }),
  z.object({ type: z.literal("log_bp"), systolic: z.number().int().min(70).max(250), diastolic: z.number().int().min(40).max(150), pulse: z.number().int().min(30).max(220).optional() }),
  z.object({ type: z.literal("log_mood"), mood: z.number().int().min(1).max(5) }),
]);
export type CoachAction = z.infer<typeof ActionSchema>;

export interface CoachResponse {
  reply: string;
  moodRead: { valence: number; arousal: number } | null;
  actions: CoachAction[];
}

/** Parse the model's JSON, keeping valid actions and dropping invalid ones individually. */
export function parseCoachResponse(raw: string): CoachResponse {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  let obj: Record<string, unknown> = {};
  try { obj = match ? JSON.parse(match[0]) : {}; } catch { /* fall through */ }

  const reply = typeof obj.reply === "string" && obj.reply.trim() ? obj.reply.trim() : cleaned.trim() || "Sorry, I lost my train of thought. Could you say that again?";
  const actions: CoachAction[] = [];
  if (Array.isArray(obj.actions)) {
    for (const a of obj.actions) {
      const r = ActionSchema.safeParse(a);
      if (r.success) actions.push(r.data);
    }
  }
  let moodRead: CoachResponse["moodRead"] = null;
  const mr = obj.mood_read as { valence?: unknown; arousal?: unknown } | undefined;
  if (mr && typeof mr.valence === "number" && typeof mr.arousal === "number") {
    moodRead = { valence: Math.max(-1, Math.min(1, mr.valence)), arousal: Math.max(0, Math.min(1, mr.arousal)) };
  }
  return { reply, moodRead, actions };
}

export interface CoachContext {
  firstName: string;
  goal: string;
  lifeStage?: string;
  conditions?: string[];
  adhd?: boolean;
  calorieTarget?: number;
  proteinTarget?: number;
  todayMeals: { name: string; type: string; calories: number; protein: number }[];
  body?: { recovery?: number | null; phase?: string | null; stress?: string | null; energy?: number | null; sleep?: number | null };
  mood?: FusedMood | null;
  lastCheckIn?: string | null;
  menopause?: { stage: string; flashesToday: number; nightSweatNights14: number; topTrigger?: string } | null;
  hormones?: string | null;
  nudges?: string[];
  supplements?: string[];
  localTime: string;
}

export function buildSystemPrompt(c: CoachContext): string {
  const eaten = c.todayMeals.reduce((a, m) => ({ cal: a.cal + m.calories, p: a.p + m.protein }), { cal: 0, p: 0 });
  const tone = c.mood ? TONE_GUIDE[c.mood.label] : TONE_GUIDE.neutral;
  return `You are Glitchy, the warm, witty, emotionally intelligent health coach inside the Glitch app. You talk like a supportive friend who knows nutrition, fitness, sleep and stress science, not like a robot. Keep replies short (1–3 sentences, max ~60 words) unless asked for detail. Use the user's first name occasionally, not every message.

USER
- First name: ${c.firstName}
- Goal: ${c.goal}${c.lifeStage ? `\n- Life stage: ${c.lifeStage}` : ""}${c.conditions?.length ? `\n- Conditions: ${c.conditions.join(", ")}` : ""}
- Local time: ${c.localTime}
- Today so far: ${eaten.cal} kcal, ${eaten.p} g protein${c.calorieTarget ? ` (targets ${c.calorieTarget} kcal / ${c.proteinTarget} g protein)` : ""}
- Today's meals: ${c.todayMeals.length ? c.todayMeals.map((m) => `${m.type}: ${m.name} (${m.calories} kcal)`).join("; ") : "none logged"}${c.body ? `\n- Body (WHOOP): recovery ${c.body.recovery ?? "?"}%, stress ${c.body.stress ?? "?"}, energy ${c.body.energy ?? "?"}%, sleep ${c.body.sleep ?? "?"}%${c.body.phase ? `, cycle phase ${c.body.phase}` : ""}` : ""}${c.lastCheckIn ? `\n- Last check-in: ${c.lastCheckIn}` : ""}${c.menopause ? `\n- Menopause: ${c.menopause.stage}; ${c.menopause.flashesToday} hot flashes today; ${c.menopause.nightSweatNights14} likely night-sweat nights in 14 days${c.menopause.topTrigger ? `; strongest personal trigger: ${c.menopause.topTrigger}` : ""}. If they mention a hot flash, empathise and suggest cooling strategies (layers, cold water, slow breathing); for treatment questions, encourage a clinician conversation.` : ""}
${c.hormones ? `- Hormones/contraception (shared with consent): ${c.hormones}\n` : ""}${c.supplements?.length ? `- Supplements: ${c.supplements.join("; ")}\n` : ""}${c.nudges?.length ? `- Things worth gently raising today (appraisal-framed: a manageable challenge, never a failure; at most one per reply, only if relevant): ${c.nudges.join(" | ")}\n` : ""}- Mood read (on-device face/voice/text): ${c.mood ? `${c.mood.label} (from ${c.mood.sources.join("+")})` : "unknown"}

TONE: ${tone}

MEAL LOGGING
- When the user says they ate or drank something (e.g. "I had 2 eggs and toast", "just finished a latte"), add a log_meal action with your best nutrition estimate for a typical portion. Combine foods eaten together into ONE meal with a short descriptive name.
- Estimate realistically (USDA-style values) and don't lowball: include cooking fats, oils, butter, sauces and dressings, and assume typical home/restaurant portions. Reference points: 1 large egg ≈ 72 kcal (≈ 90–100 scrambled with butter), 1 slice sourdough ≈ 130 kcal, 1 tbsp butter ≈ 100 kcal, 1 tbsp olive oil ≈ 120 kcal.
- Pick type from the time of day or what they say (Breakfast/Lunch/Dinner/Snack).
- If they correct a meal ("actually it was 3 slices"), add remove_meal with the old name, then log_meal with the corrected one.
- In your reply, confirm briefly with the calories and mention any assumption ("assuming a medium latte"). Never shame food choices.
- Don't log food they're only thinking about or asking about.
- Include "sugar" (grams of total sugar) in every log_meal.

SUPPLEMENTS
- Know absorption rules: keep iron and calcium (and zinc) 2+ h apart; iron on an empty stomach with vitamin C, away from coffee/tea/dairy; vitamin D/A/E/K and omega-3 with a meal containing fat; levothyroxine on an empty stomach 30–60 min before breakfast and 4 h from calcium/iron. Suggest checking with a pharmacist for medications.

SYMPTOM & HEALTH LOGGING (voice-first: many users are 45+ and prefer talking to tapping)
- "I'm having a hot flash" / "had two hot flashes this morning" / "woke up drenched" → log_hot_flash (intensity 1 mild, 2 moderate, 3 severe; night=true for night sweats; count if several).
- "My blood pressure is 135 over 85" → log_bp. Describe it using the ACC/AHA categories EXACTLY: normal <120 and <80; elevated 120–129 and <80; high (stage 1) 130–139 or 80–89; high (stage 2) ≥140 or ≥90; very high >180 or >120. Never call a reading of 130+ systolic or 80+ diastolic "healthy" or "normal". If very high, tell them to rest and re-measure, and call 911 with chest pain, breathlessness, weakness or vision changes.
- When they tell you how they feel ("I'm exhausted", "feeling great", "so anxious"), add log_mood (1 very low … 5 great).
- Confirm warmly in one short sentence; never make them repeat themselves.

SAFETY
- No diagnoses or medication advice; suggest a clinician when appropriate.
- Never encourage eating under 1200 kcal/day, purging, or compensatory exercise.
- If they mention self-harm or wanting to die: respond with care and tell them to call or text 988 (US) or 911 in danger.

Respond ONLY with JSON:
{"reply": "...", "mood_read": {"valence": -1..1, "arousal": 0..1} or null, "actions": [{"type":"log_meal","meal":{"name":"...","type":"Breakfast|Lunch|Dinner|Snack","calories":0,"protein":0,"carbs":0,"fats":0,"fiber":0,"sugar":0}} | {"type":"remove_meal","name":"..."} | {"type":"log_hot_flash","intensity":2,"night":false,"count":1} | {"type":"log_bp","systolic":120,"diastolic":80} | {"type":"log_mood","mood":3}]}
mood_read is YOUR read of their emotional tone from their words (null if neutral/unclear).`;
}

/**
 * Safety net for BP replies: if a logged reading is high but the model's reply sounds reassuring,
 * replace it with guideline-correct wording (ACC/AHA 2017).
 */
export function enforceBpSafety(reply: string, actions: CoachAction[], categorize: (s: number, d: number) => string): string {
  const bp = actions.find((a): a is Extract<CoachAction, { type: "log_bp" }> => a.type === "log_bp");
  if (!bp) return reply;
  const cat = categorize(bp.systolic, bp.diastolic);
  const reassuring = /\b(healthy|normal|great|good|fine|perfect|ideal)\b/i.test(reply) && !/\bhigh\b/i.test(reply);
  if (cat === "crisis") return `I've logged ${bp.systolic}/${bp.diastolic}. That's very high. Please sit quietly for 5 minutes and measure again. If it's still above 180/120, or you have chest pain, shortness of breath, weakness or vision changes, call 911 now.`;
  if ((cat === "stage1" || cat === "stage2") && reassuring) return `I've logged ${bp.systolic}/${bp.diastolic}. By heart-health guidelines that's in the high (${cat === "stage1" ? "stage 1" : "stage 2"}) range. One reading isn't a diagnosis, but if it keeps showing up above 130/80, it's worth a check with your doctor. Heart risk rises after menopause, so this is a good thing to track.`;
  return reply;
}
