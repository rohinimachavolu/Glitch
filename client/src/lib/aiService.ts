/**
 * NutriSense AI — Groq AI Service Layer
 * Text tasks: openai/gpt-oss-120b (JSON-capable)
 * Vision tasks: qwen/qwen3.8-27b (food photo analysis)
 * Override with VITE_GROQ_TEXT_MODEL / VITE_GROQ_VISION_MODEL when Groq retires a model.
 * Base URL: https://api.groq.com/openai/v1
 */

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_KEY  = import.meta.env.VITE_GROQ_API_KEY as string;
const TEXT_MODEL   = (import.meta.env.VITE_GROQ_TEXT_MODEL as string) || "openai/gpt-oss-120b";
const VISION_MODEL = (import.meta.env.VITE_GROQ_VISION_MODEL as string) || "qwen/qwen3.8-27b";

// ── Generic text chat (JSON output) ──────────────────────────
async function chat(
  messages: { role: string; content: string }[],
  json = true
): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages,
      temperature: 0.3,
      // Reasoning models spend part of the budget thinking before the JSON
      max_tokens: 3000,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ── Vision chat (food photo analysis) ────────────────────────
async function visionChat(
  imageBase64DataUrl: string,
  textPrompt: string
): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageBase64DataUrl } },
            { type: "text", text: textPrompt },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Vision API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}

// ── Safe JSON parse helper ────────────────────────────────────
function safeParseJSON<T>(raw: string, fallback: T): T {
  try {
    // Reasoning models may prepend <think>…</think>; drop it before looking for JSON
    raw = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
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
  /** e.g. "pregnant" — stages where a calorie deficit is unsafe set allowCalorieDeficit=false */
  lifeStage?: { label: string; allowCalorieDeficit: boolean };
}): Promise<NutritionGoals> {
  const goalLabels: Record<string, string> = {
    lose_weight:     "lose weight and reduce body fat",
    maintain:        "maintain current weight and stay healthy",
    build_muscle:    "build lean muscle mass",
    manage_diabetes: "manage Type 2 diabetes and control blood sugar",
  };
  const noDeficit = profile.lifeStage?.allowCalorieDeficit === false;
  // Weight loss is never targeted when a deficit is unsafe (pregnancy, postpartum, pre-menarche)
  const goalDesc = noDeficit && profile.goal === "lose_weight"
    ? goalLabels.maintain
    : goalLabels[profile.goal] ?? profile.goal;

  const fallback: NutritionGoals = {
    calorieTarget: profile.goal === "build_muscle" ? 2200 : profile.goal === "manage_diabetes" ? 1900 : profile.goal === "maintain" || noDeficit ? 2050 : 1750,
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
Goal: ${goalDesc}${profile.lifeStage ? `\nLife stage: ${profile.lifeStage.label}` : ""}${noDeficit ? "\nIMPORTANT: Do NOT apply any calorie deficit for this life stage. Use TDEE or higher." : ""}

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
  const fallback: IngredientNutrition = {
    found: false, name: ingredient, calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, omega3: 0,
  };

  try {
    const prompt = `You are a nutrition database. Provide nutritional content for: "${ingredient}"
Use a typical standard serving size.

Return ONLY valid JSON (no markdown):
{"found":true,"name":"1 tbsp Flax Seeds","calories":37,"protein":1.3,"carbs":2.0,"fats":3.0,"fiber":1.9,"omega3":1.60}`;

    const raw = await chat([{ role: "user", content: prompt }]);
    return safeParseJSON<IngredientNutrition>(raw, fallback);
  } catch (error) {
    console.warn("Ingredient lookup failed, using local fallback:", error);
    return fallback;
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
// Appraisal coaching — warm re-wording only
// The strategy is chosen by the deterministic engine in lib/appraisal.ts; the model may only
// phrase it. No name or identifiers are sent.
// ─────────────────────────────────────────────────────────────
export async function phraseCoaching(ctx: {
  stateLabel: string;
  insight: string;
  strategyTitle: string;
  note?: string;
}): Promise<string | null> {
  try {
    const prompt = `You are a warm, non-judgmental wellness coach. The user checked in feeling: "${ctx.stateLabel}".
Context: ${ctx.insight}
${ctx.note ? `They wrote: "${ctx.note.slice(0, 200)}"\n` : ""}The coaching strategy already chosen for them is: "${ctx.strategyTitle}".
Write ONE or TWO short sentences (max 35 words) that validate how they feel and encourage them to try that strategy.
Rules: never shame, never mention calories or weight, never give medical advice, don't suggest a different strategy.
Return ONLY the message text.`;
    const text = (await chat([{ role: "user", content: prompt }], false)).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return text || null;
  } catch (error) {
    console.warn("Coaching phrasing failed, using engine text:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Conversational coach — multi-turn, JSON (see lib/coachAgent.ts)
// ─────────────────────────────────────────────────────────────
export async function coachCompletion(messages: { role: "system" | "user" | "assistant"; content: string }[]): Promise<string> {
  return chat(messages, true);
}
