/**
 * Glitch — supplement timing & interaction rules (well-established absorption guidance).
 * - Iron: best on an empty stomach with vitamin C; keep ≥2 h from calcium, zinc, dairy, coffee/tea.
 * - Calcium: with food; ≥2 h from iron and zinc; ≥4 h from levothyroxine.
 * - Fat-soluble vitamins (A, D, E, K) and omega-3: with a meal containing fat (better absorption,
 *   fewer fishy burps/reflux for omega-3).
 * - Zinc: with food to avoid nausea; ≥2 h from iron and calcium.
 * - Levothyroxine: empty stomach, 30–60 min before breakfast, ≥4 h from calcium/iron.
 * - Magnesium: evening is fine; may upset an empty stomach. Probiotics: with or just before a meal.
 * General guidance — a pharmacist or doctor should check medication interactions.
 */

export type SupplementKind =
  | "iron" | "calcium" | "vitamin_d" | "fat_soluble" | "omega3" | "zinc" | "magnesium" | "b12"
  | "probiotic" | "levothyroxine" | "creatine" | "protein" | "ashwagandha" | "multivitamin" | "other";

const ALIASES: [SupplementKind, RegExp][] = [
  ["levothyroxine", /levothyrox|synthroid|thyroxine|thyroid/i],
  ["iron", /\biron\b|ferrous|ferritin|bisglycinate iron/i],
  ["calcium", /calcium/i],
  ["vitamin_d", /vitamin\s*d|\bd3\b|cholecalciferol/i],
  ["fat_soluble", /vitamin\s*(a|e|k)\b|\bk2\b/i],
  ["omega3", /omega|fish oil|krill|\bdha\b|\bepa\b/i],
  ["zinc", /zinc/i],
  ["magnesium", /magnesium/i],
  ["b12", /b12|cobalamin/i],
  ["probiotic", /probiotic/i],
  ["creatine", /creatine/i],
  ["protein", /protein|whey/i],
  ["ashwagandha", /ashwagandha/i],
  ["multivitamin", /multi\s*-?vitamin|prenatal/i],
];

export function kindOf(name: string): SupplementKind {
  return ALIASES.find(([, re]) => re.test(name))?.[0] ?? "other";
}

export interface FoodRule {
  needsFood: boolean;
  needsFat?: boolean;
  emptyStomach?: boolean;
  tip: string;
}

export const FOOD_RULES: Partial<Record<SupplementKind, FoodRule>> = {
  iron: { needsFood: false, emptyStomach: true, tip: "Best on an empty stomach with vitamin C (e.g. orange juice). Avoid coffee, tea and dairy for 1–2 h." },
  calcium: { needsFood: true, tip: "Take with food, max ~500 mg at once. Keep 2 h away from iron and zinc." },
  vitamin_d: { needsFood: true, needsFat: true, tip: "Fat-soluble: take with a meal that has some fat (eggs, avocado, nuts, olive oil)." },
  fat_soluble: { needsFood: true, needsFat: true, tip: "Fat-soluble: take with a meal that contains fat." },
  omega3: { needsFood: true, needsFat: true, tip: "Take with a meal. On an empty stomach it's absorbed less and causes fishy burps or reflux." },
  zinc: { needsFood: true, tip: "Take with food to avoid nausea, 2 h away from iron and calcium." },
  magnesium: { needsFood: false, tip: "Evening works well (may help sleep). Take with food if it upsets your stomach." },
  probiotic: { needsFood: true, tip: "Take with or just before a meal." },
  levothyroxine: { needsFood: false, emptyStomach: true, tip: "Empty stomach, 30–60 min before breakfast, and 4 h away from calcium or iron." },
  multivitamin: { needsFood: true, needsFat: true, tip: "Take with a meal. If it contains iron, keep it away from calcium." },
};

/** Pairs that compete for absorption: [a, b, hours apart] */
const CONFLICTS: [SupplementKind, SupplementKind, number][] = [
  ["iron", "calcium", 2], ["iron", "zinc", 2], ["calcium", "zinc", 2],
  ["levothyroxine", "calcium", 4], ["levothyroxine", "iron", 4], ["iron", "multivitamin", 2],
];

export interface SupplementLike { id: string; name: string; time: string }

export interface ScheduleIssue {
  ids: [string, string];
  message: string;
  fix: string;
}

const SLOT_GROUP: Record<string, string> = { Morning: "am", "Before Workout": "am", Afternoon: "pm", "After Workout": "pm", "With Meal": "meal", Evening: "eve" };

/** Same-slot conflicts in the saved schedule, e.g. iron and calcium both "Morning". */
export function scheduleIssues(sups: SupplementLike[]): ScheduleIssue[] {
  const out: ScheduleIssue[] = [];
  for (let i = 0; i < sups.length; i++) {
    for (let j = i + 1; j < sups.length; j++) {
      const a = sups[i], b = sups[j];
      const ka = kindOf(a.name), kb = kindOf(b.name);
      const c = CONFLICTS.find(([x, y]) => (x === ka && y === kb) || (x === kb && y === ka));
      if (!c) continue;
      const sameSlot = SLOT_GROUP[a.time] === SLOT_GROUP[b.time] || a.time === "With Meal" || b.time === "With Meal";
      if (!sameSlot) continue;
      const iron = ka === "iron" || ka === "levothyroxine" ? a : b;
      const other = iron === a ? b : a;
      out.push({
        ids: [a.id, b.id],
        message: `${a.name} and ${b.name} compete for absorption when taken together.`,
        fix: `Keep them ${c[2]}+ hours apart, e.g. ${iron.name} in the morning before breakfast and ${other.name} with dinner.`,
      });
    }
  }
  return out;
}

export interface TakenEvent { supplementId: string; at: string }
export interface MealLike { name: string; loggedAt?: string; fats?: number }

export interface TakeCheck { ok: boolean; warnings: string[] }

const COFFEE_TEA_DAIRY = /coffee|espresso|latte|cappuccino|tea\b|chai|milk|yogurt|yoghurt|cheese|dairy/i;

/**
 * Check a dose at the moment the user marks it taken: food needs, conflicting doses taken recently,
 * and (for iron) coffee/tea/dairy just before.
 */
export function checkTaking(sup: SupplementLike, now: Date, allSups: SupplementLike[], taken: TakenEvent[], meals: MealLike[]): TakeCheck {
  const kind = kindOf(sup.name);
  const rule = FOOD_RULES[kind];
  const warnings: string[] = [];
  const hoursAgo = (iso: string) => (now.getTime() - Date.parse(iso)) / 3_600_000;
  const recentMeals = meals.filter((m) => m.loggedAt && hoursAgo(m.loggedAt) >= -0.5 && hoursAgo(m.loggedAt) <= 2);

  if (rule?.needsFood && recentMeals.length === 0) {
    warnings.push(rule.needsFat ? `${sup.name} is best with a meal that has some fat. Have it with your next meal?` : `${sup.name} is better taken with food.`);
  } else if (rule?.needsFat && recentMeals.every((m) => m.fats != null && m.fats < 5)) {
    warnings.push(`${sup.name} absorbs better with some fat, so add a few nuts or a little olive oil.`);
  }
  if (rule?.emptyStomach && recentMeals.length > 0) warnings.push(`${sup.name} absorbs best on an empty stomach (1 h before or 2 h after eating).`);
  if (kind === "iron" && recentMeals.some((m) => COFFEE_TEA_DAIRY.test(m.name))) warnings.push("Coffee, tea or dairy in the last 2 h can cut iron absorption a lot. Wait a bit if you can.");

  for (const t of taken) {
    const other = allSups.find((s) => s.id === t.supplementId);
    if (!other || other.id === sup.id) continue;
    const c = CONFLICTS.find(([x, y]) => (x === kind && y === kindOf(other.name)) || (y === kind && x === kindOf(other.name)));
    if (c && hoursAgo(t.at) < c[2] && hoursAgo(t.at) >= 0) warnings.push(`You took ${other.name} ${Math.round(hoursAgo(t.at) * 60)} min ago, so wait ${c[2]} h between ${other.name} and ${sup.name}.`);
  }
  return { ok: warnings.length === 0, warnings };
}

/** When the slot has passed, is the supplement still un-taken today? */
export function overdue(sup: SupplementLike, taken: TakenEvent[], now: Date): boolean {
  // Compare local calendar days (ISO strings are UTC)
  if (taken.some((t) => t.supplementId === sup.id && new Date(t.at).toDateString() === now.toDateString())) return false;
  const h = now.getHours();
  const due: Record<string, number> = { Morning: 11, "Before Workout": 12, Afternoon: 16, "After Workout": 18, "With Meal": 20, Evening: 22 };
  return h >= (due[sup.time] ?? 20);
}
