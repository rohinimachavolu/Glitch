/**
/**
 * Glitch — LLM Service Layer (Subconscious, OpenAI-compatible)
 * Prefers the server proxy (/api/llm) so the key stays off the browser.
 * Falls back to a direct client call for local dev if a VITE key is present.
 */
import { lookupLocal } from "@/data/nutritionDb";
const SUB_BASE = (import.meta.env.VITE_SUBCONSCIOUS_BASE_URL as string) || "https://api.subconscious.dev/v1";
const SUB_KEY = import.meta.env.VITE_SUBCONSCIOUS_API_KEY as string | undefined;
const TEXT_MODEL = (import.meta.env.VITE_SUBCONSCIOUS_TEXT_MODEL as string) || "subconscious/deepseek-v4.1-flash-marathon";
const VISION_MODEL = (import.meta.env.VITE_SUBCONSCIOUS_VISION_MODEL as string) || "subconscious/nemotron-3.5-super-vl";

type Msg = { role: string; content: any };

/** Returns whether any LLM path is available (proxy is always attempted). */
export function isLlmConfigured(): boolean {
  return true; // server proxy may be configured even if no VITE key
}

async function callLlm(model: string, messages: Msg[], opts: { json?: boolean; maxTokens?: number } = {}): Promise<string> {
  const body = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: opts.maxTokens ?? 900,
  };

  // 1) Preferred: server proxy (keeps key server-side, avoids CORS)
  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
    }
    // if proxy not configured (501) or failed, fall through to direct
  } catch { /* fall through */ }

  // 2) Fallback: direct client call (local dev only)
  if (!SUB_KEY) throw new Error("No LLM available (no server proxy, no client key)");
  const res = await fetch(`${SUB_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUB_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Subconscious ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ── Generic text chat ────────────────────────────────────────
async function chat(messages: Msg[], _json = true): Promise<string> {
  return callLlm(TEXT_MODEL, messages, { maxTokens: 900 });
}

/** Public raw chat (used by the voice intent parser). */
export async function chatRaw(messages: Msg[]): Promise<string> {
  return callLlm(TEXT_MODEL, messages, { maxTokens: 500 });
}

// ── Vision chat (food photo analysis) ────────────────────────
async function visionChat(imageBase64DataUrl: string, textPrompt: string): Promise<string> {
  return callLlm(VISION_MODEL, [{
    role: "user",
    content: [
      { type: "image_url", image_url: { url: imageBase64DataUrl } },
      { type: "text", text: textPrompt },
    ],
  }], { maxTokens: 600 });
}

// ── Safe JSON parse helper ────────────────────────────────────
function safeParseJSON<T>(raw: string, fallback: T): T {
  try {
    // Extract JSON block if wrapped in markdown code fences
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = match ? match[1] ?? match[0] : raw;
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Personalized Nutrition Goals
// ─────────────────────────────────────────────────────────────
export interface NutritionGoals {
  calorieTarget: number;
  proteinTarget: number;   // g
  carbsTarget:   number;   // g
  fatsTarget:    number;   // g
  fiberTarget:   number;   // g
  omega3Target:  number;   // g
  vitDTarget:    number;   // IU
  vitB12Target:  number;   // mcg
  ironTarget:    number;   // mg
  stepGoal:      number;
  rationale:     string;
}

export async function generateNutritionGoals(profile: {
  name: string;
  age: number;
  weight: number;
  height: number;
  goal: string;
}): Promise<NutritionGoals> {
  const goalLabels: Record<string, string> = {
    lose_weight:     "lose weight and reduce body fat",
    maintain:        "maintain current weight and stay healthy",
    build_muscle:    "build lean muscle mass",
    manage_diabetes: "manage Type 2 diabetes and control blood sugar",
  };
  const goalDesc = goalLabels[profile.goal] ?? profile.goal;

  const fallback: NutritionGoals = {
    calorieTarget: profile.goal === "build_muscle" ? 2200 : profile.goal === "manage_diabetes" ? 1900 : profile.goal === "maintain" ? 2050 : 1750,
    proteinTarget: Math.round((profile.weight * 1.8) || 90),
    carbsTarget: profile.goal === "manage_diabetes" ? 180 : 220,
    fatsTarget: profile.goal === "build_muscle" ? 65 : 55,
    fiberTarget: profile.goal === "manage_diabetes" ? 35 : 30,
    omega3Target: 2,
    vitDTarget: 600,
    vitB12Target: 2.4,
    ironTarget: 18,
    stepGoal: 8000,
    rationale: `${profile.name}, this plan balances energy, recovery, and sustainable habits for your ${goalDesc}.`,
  };

  try {
    const prompt = `You are a certified nutritionist. Calculate precise daily nutrition targets for this user.

User: ${profile.name}, Age ${profile.age}, Weight ${profile.weight}kg, Height ${profile.height}cm
Goal: ${goalDesc}

Use Mifflin-St Jeor BMR × 1.55 activity multiplier, then adjust for goal:
- Weight loss: -500 kcal deficit
- Muscle building: +300 kcal surplus, protein 1.8-2.2g/kg
- Diabetes: reduce carbs, increase fiber, low-GI focus
- Maintain: TDEE as-is

Return ONLY valid JSON (no markdown, no explanation):
{"calorieTarget":1800,"proteinTarget":90,"carbsTarget":220,"fatsTarget":55,"fiberTarget":30,"omega3Target":2.0,"vitDTarget":600,"vitB12Target":2.4,"ironTarget":18,"stepGoal":8000,"rationale":"One friendly sentence explaining the plan"}`;

    const raw = await chat([{ role: "user", content: prompt }]);
    return safeParseJSON<NutritionGoals>(raw, fallback);
  } catch (error) {
    console.warn("Nutrition plan generation failed, using local fallback:", error);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Personalized Exercise Plan
// ─────────────────────────────────────────────────────────────
export interface Exercise {
  id: string;
  name: string;
  detail: string;
  burn: number;
  emoji: string;
  rationale: string;
  cues: string[];
  goodCue: string;
  sets?: number;
  reps?: number;
  duration?: string;
  formCues?: string[];
  caloriesBurned?: number;
  dayOfWeek?: number;
  completed?: boolean;
  description?: string;
}

export async function generateExercisePlan(profile: {
  age: number;
  weight: number;
  height: number;
  goal: string;
  equipment?: string[];
  workoutStyles?: string[];
  cyclePhase?: string;
}): Promise<Exercise[]> {
  const goalLabels: Record<string, string> = {
    lose_weight:     "lose weight and burn fat",
    maintain:        "maintain fitness and general health",
    build_muscle:    "build lean muscle mass",
    manage_diabetes: "manage Type 2 diabetes through exercise",
  };
  const goalDesc = goalLabels[profile.goal] ?? profile.goal;
  const bmi = (profile.weight / ((profile.height / 100) ** 2)).toFixed(1);

  const fallback: Exercise[] = [
    { id: "walk-cardio", name: "Brisk Walk", detail: "20 min steady pace", burn: 120, emoji: "🚶", rationale: "Simple cardio that supports fat loss and heart health with your current routine.", cues: ["Keep shoulders relaxed", "Swing arms naturally", "Maintain a steady pace"], goodCue: "Great pacing — you’re staying consistent." },
    { id: "bodyweight-squat", name: "Bodyweight Squat", detail: "3 × 12 reps", burn: 90, emoji: "🏋️", rationale: "Builds lower-body strength and supports muscle retention for your goal.", cues: ["Chest up", "Knees track over toes", "Drive through heels"], goodCue: "Nice depth — strong control throughout the rep." },
    { id: "push-up", name: "Incline Push-up", detail: "3 × 10 reps", burn: 80, emoji: "💪", rationale: "Improves upper-body strength and helps maintain lean muscle without heavy equipment.", cues: ["Body in one line", "Lower chest to bench", "Press up with control"], goodCue: "Strong form — you kept the core engaged." },
  ];

  try {
    const equipmentList = profile.equipment?.length
      ? profile.equipment.map((e) => e.replace(/_/g, " ")).join(", ")
      : "no equipment (bodyweight only)";

    const styleList = profile.workoutStyles?.length
      ? profile.workoutStyles.map((s) => s.replace(/_/g, " ")).join(", ")
      : "general fitness";

    const cycleContext = profile.cyclePhase
      ? `\nMenstrual cycle phase: ${profile.cyclePhase}. Adjust workout intensity accordingly:\n- menstrual: gentle/restorative only\n- follicular: progressive overload welcome\n- ovulation: peak performance\n- luteal: moderate, recovery-focused`
      : "";

    const prompt = `You are a certified personal trainer. Create a personalized daily workout plan.

User: Age ${profile.age}, Weight ${profile.weight}kg, Height ${profile.height}cm, BMI ${bmi}
Goal: ${goalDesc}
Available equipment: ${equipmentList}
Preferred training styles: ${styleList}${cycleContext}

Critical rules:
- ONLY use exercises that can be done with the available equipment listed above
- Honour the user's preferred training styles as much as possible
- BUT always include at least 1-2 exercises that serve their primary fitness goal even if outside their preferred style (e.g. if goal is build_muscle but they only chose yoga, add 1-2 strength exercises and explain why)
- 4-6 exercises total, appropriate for their BMI and age
- For diabetes: include low-impact cardio and resistance work
- For weight loss: include cardio + compound movements
- For muscle building: prioritize compound lifts or calisthenics progressions
- Realistic calorie burn estimates
- Specific, actionable form cues (not generic)
- In rationale, briefly explain why this exercise suits their goal/equipment/style

Return ONLY a valid JSON array (no markdown, no extra text):
[{"id":"squat","name":"Bodyweight Squat","detail":"3 × 15 reps","burn":80,"emoji":"🏋️","rationale":"Builds leg strength with no equipment needed","cues":["Keep chest up","Knees over toes","Lower hips to parallel","Drive through heels"],"goodCue":"Perfect depth! Great form"}]`;

    const raw = await chat([{ role: "user", content: prompt }]);

    // Groq with json_object mode wraps arrays — handle both cases
    let parsed: Exercise[];
    try {
      const obj = JSON.parse(raw.trim());
      if (Array.isArray(obj)) {
        parsed = obj;
      } else {
        // Try common wrapper keys
        parsed = obj.exercises ?? obj.plan ?? obj.workout ?? Object.values(obj)[0] as Exercise[];
      }
    } catch {
      parsed = safeParseJSON<Exercise[]>(raw, []);
    }

    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn("Exercise plan generation failed, using local fallback:", error);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// 3. AI Food Analysis from image (base64 data URL)
// ─────────────────────────────────────────────────────────────
export interface FoodAnalysis {
  name: string;
  calories: number;
  protein:  number;
  carbs:    number;
  fats:     number;
  fiber:    number;
  omega3:   number;
  confidence: string;
  notes: string;
}

export async function analyzeFoodImage(base64DataUrl: string): Promise<FoodAnalysis> {
  const fallback: FoodAnalysis = {
    name: "Mixed Meal", calories: 400, protein: 18, carbs: 45, fats: 14,
    fiber: 5, omega3: 0.3, confidence: "low", notes: "Could not analyze image clearly",
  };

  try {
    const prompt = `You are a nutrition expert. Analyze this food image and estimate nutritional content for a typical single serving.

Return ONLY valid JSON (no markdown, no explanation):
{"name":"Food Name","calories":400,"protein":20,"carbs":45,"fats":12,"fiber":5.0,"omega3":0.5,"confidence":"high","notes":"Brief note about the meal"}

If you cannot identify the food clearly, make your best estimate and set confidence to "low".`;

    const raw = await visionChat(base64DataUrl, prompt);
    return safeParseJSON<FoodAnalysis>(raw, fallback);
  } catch (error) {
    console.warn("Food image analysis failed, using local fallback:", error);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Ingredient nutrition lookup
// ─────────────────────────────────────────────────────────────
export interface IngredientNutrition {
  found: boolean;
  name: string;
  calories: number;
  protein:  number;
  carbs:    number;
  fats:     number;
  fiber:    number;
  omega3:   number;
}

export async function lookupIngredient(ingredient: string): Promise<IngredientNutrition> {
  // Local DB first — guarantees non-zero macros even with no LLM key.
  const local = lookupLocal(ingredient);
  const localResult: IngredientNutrition = {
    found: local.calories > 0, name: local.name, calories: local.calories,
    protein: local.protein, carbs: local.carbs, fats: local.fats, fiber: local.fiber, omega3: local.omega3,
  };

  try {
    const prompt = `You are a nutrition database. Provide nutritional content for: "${ingredient}"
Account for any quantities mentioned (e.g. "100g rice" = 100g). Sum multiple items.

Return ONLY valid JSON (no markdown):
{"found":true,"name":"100g Rice + Dal","calories":246,"protein":11.7,"carbs":48,"fats":0.7,"fiber":8.4,"omega3":0.1}`;

    const raw = await chat([{ role: "user", content: prompt }]);
    const ai = safeParseJSON<IngredientNutrition>(raw, localResult);
    // Trust AI only if it produced real numbers; else keep local.
    return ai.calories > 0 ? ai : localResult;
  } catch (error) {
    console.warn("LLM ingredient lookup unavailable, using local nutrition DB:", error);
    return localResult;
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Motivational message
// ─────────────────────────────────────────────────────────────
export async function getMotivationalMessage(profile: {
  name: string;
  goal: string;
  caloriesPct: number;
  proteinPct: number;
  streakDays: number;
}): Promise<string> {
  try {
    const prompt = `Write a short (max 12 words) warm motivational message for ${profile.name} who is ${Math.round(profile.caloriesPct * 100)}% through their calorie goal and ${Math.round(profile.proteinPct * 100)}% through their protein goal today. They have a ${profile.streakDays}-day logging streak. Goal: ${profile.goal}. Be specific and warm. Return ONLY the message text, no quotes, no JSON.`;

    return await chat([{ role: "user", content: prompt }], false);
  } catch (error) {
    console.warn("Motivational message generation failed, using local fallback:", error);
    return "Keep going — your plan is working.";
  }
}

// ─────────────────────────────────────────────────────────────
// 6. Glitch — Personalized cycle/menopause-aware coach
// ─────────────────────────────────────────────────────────────
import { FITNESS_EVIDENCE } from "@/data/references";

export interface CoachContext {
  name: string;
  healthMode: string;          // cycling | irregular | pcos | menopause | pregnancy | none
  cyclePhase?: string;
  cycleDay?: number;
  mood?: number;               // 1–5
  energy?: number;             // 1–5
  stress?: number;             // 1–5
  recentRecovery?: number;     // 0–100 (WHOOP/sample)
  loggedCycles?: number;
  question?: string;           // if user is chatting
}

/**
 * Supportive, non-judgmental coach. Reflects the user's OWN data.
 * Never diagnoses; never prescribes "train hard in phase X" as a rule.
 */
export async function getCoachResponse(ctx: CoachContext): Promise<string> {
  const fallback =
    ctx.stress && ctx.stress >= 4
      ? "You seem stretched today. Aim for stability, not perfection — hydrate, prioritize protein, and a short walk counts."
      : "You're building a healthier rhythm. One good choice at a time is exactly how this works.";

  try {
    const prescriptiveNote = FITNESS_EVIDENCE.PHASE_RULE_IS_PRESCRIPTIVE
      ? ""
      : "The evidence on cycle phase and training is mixed, so NEVER say 'you must train hard/rest in phase X'. Instead reflect the person's own logged pattern and energy.";

    const system = `You are Glitch, a warm, emotionally intelligent wellness coach for women's health (menstrual cycle, PCOS, and menopause). You are supportive and realistic, never judgmental, never shaming about food or missed days. You NEVER diagnose medical conditions and NEVER prescribe medication/HRT. You frame insights as patterns to notice or discuss with a clinician. ${prescriptiveNote} Keep replies under 60 words, specific and human.`;

    const profile = `User: ${ctx.name}. Mode: ${ctx.healthMode}.` +
      (ctx.cyclePhase ? ` Cycle phase: ${ctx.cyclePhase} (day ${ctx.cycleDay ?? "?"}).` : "") +
      (ctx.mood != null ? ` Mood ${ctx.mood}/5, energy ${ctx.energy ?? "?"}/5, stress ${ctx.stress ?? "?"}/5.` : "") +
      (ctx.recentRecovery != null ? ` Recent recovery ${ctx.recentRecovery}%.` : "") +
      (ctx.loggedCycles != null ? ` ${ctx.loggedCycles} cycles logged.` : "");

    const user = ctx.question
      ? `${profile}\n\nThey asked: "${ctx.question}"\nReply supportively and specifically.`
      : `${profile}\n\nGive one short, warm, specific suggestion for today.`;

    return await chat([{ role: "system", content: system }, { role: "user", content: user }], false);
  } catch (error) {
    console.warn("Coach response failed, using fallback:", error);
    return fallback;
  }
}

/**
 * Turn a detected correlation into a plain-language "pattern reveal" line.
 * Input is already-computed correlation facts (no raw PII to the model).
 */
export async function describePattern(input: {
  signalA: string; signalB: string; strength: number; direction: string;
  cycleContext?: string;
}): Promise<string> {
  const fallback = `Your ${input.signalA} and ${input.signalB} tended to move together${input.cycleContext ? ` ${input.cycleContext}` : ""}. This is your own pattern, not a diagnosis.`;
  try {
    const prompt = `Write ONE short, warm sentence (max 24 words) describing this personal pattern for a wellness app user. Frame it as "your own pattern," never a diagnosis.
Facts: ${input.signalA} and ${input.signalB} correlated (strength ${input.strength.toFixed(2)}, ${input.direction})${input.cycleContext ? `, ${input.cycleContext}` : ""}.
Return only the sentence.`;
    return await chat([{ role: "user", content: prompt }], false);
  } catch {
    return fallback;
  }
}
