/**
 * Glitch — proactive, appraisal-framed nudges ("Glitchy noticed…").
 * Deterministic checks on today's log (sugar, calories, protein, supplements). Every message is framed
 * as a *challenge you can handle* rather than a threat or failure (cognitive appraisal theory), offers
 * one concrete next step, and never shames.
 */
import { kindOf, FOOD_RULES, overdue, scheduleIssues, type SupplementLike, type TakenEvent } from "./supplementRules";

export interface NudgeMeal { name: string; calories: number; protein: number; carbs: number; sugar?: number; loggedAt?: string }

export interface NudgeInput {
  now: Date;
  meals: NudgeMeal[];
  calorieTarget?: number;
  proteinTarget?: number;
  /** AHA added-sugar guidance: ~25 g/day women, ~36 g/day men */
  sugarLimit: number;
  supplements: SupplementLike[];
  taken: TakenEvent[];
  allowDeficitTalk: boolean;   // false in pregnancy / for minors etc.
}

export interface Nudge {
  id: string;
  kind: "sugar" | "calories" | "protein" | "supplement" | "supplement_timing";
  emoji: string;
  title: string;
  body: string;
  /** Prompt to send to Glitchy if the user taps "Help me with this" */
  ask: string;
  priority: number;
}

const SWEET = /cake|cookie|brownie|donut|doughnut|candy|chocolate|ice cream|soda|cola|juice|muffin|pastry|croissant|dessert|sweet|syrup|frappuccino|milkshake|boba|bubble tea|pie|cupcake|gummy|jam|honey|sugar/i;

/** Sugar from logged values; otherwise a rough keyword estimate (~20 g per sweet item). */
export function estimateSugar(meals: NudgeMeal[]): { grams: number; sweetItems: number; estimated: boolean } {
  let grams = 0, sweet = 0, estimated = false;
  for (const m of meals) {
    if (m.sugar != null) grams += m.sugar;
    else if (SWEET.test(m.name)) { grams += 20; estimated = true; }
    if (SWEET.test(m.name) || (m.sugar ?? 0) >= 15) sweet++;
  }
  return { grams: Math.round(grams), sweetItems: sweet, estimated };
}

export function computeNudges(i: NudgeInput): Nudge[] {
  const out: Nudge[] = [];
  const h = i.now.getHours();
  const cal = i.meals.reduce((a, m) => a + m.calories, 0);
  const protein = i.meals.reduce((a, m) => a + m.protein, 0);

  // Sugar
  const sugar = estimateSugar(i.meals);
  if (sugar.grams >= i.sugarLimit || sugar.sweetItems >= 3) {
    out.push({
      id: "sugar", kind: "sugar", emoji: "🍬", priority: 3,
      title: `${sugar.estimated ? "About " : ""}${sugar.grams} g sugar today`,
      body: `That's past the ~${i.sugarLimit} g guideline, and that's okay, it's one day. Your next win: pair any carbs with protein and take a 10-minute walk after your next meal to smooth the blood-sugar curve.`,
      ask: "I've had a lot of sugar today. What should my next meal look like to balance it out?",
    });
  }

  // Calories
  if (i.calorieTarget) {
    const pct = cal / i.calorieTarget;
    if (i.allowDeficitTalk && (pct >= 1 || (pct >= 0.85 && h < 18))) {
      out.push({
        id: "calories", kind: "calories", emoji: "⚖️", priority: 2,
        title: pct >= 1 ? `At ${Math.round(pct * 100)}% of today's energy` : `${Math.round(pct * 100)}% of today's energy used by ${i.now.toLocaleTimeString("en-US", { hour: "numeric" })}`,
        body: pct >= 1
          ? "Going over once doesn't undo your progress. No need to skip anything. If you're hungry later, go for high-volume foods: veggies, soup, berries, lean protein."
          : "You've got room for a satisfying dinner if you lean on volume: a big plate of veg with lean protein fills you up for fewer calories.",
        ask: "I'm almost at my calories for today. What's a filling dinner that fits?",
      });
    }
  }

  // Protein
  if (i.proteinTarget) {
    const pct = protein / i.proteinTarget;
    if ((h >= 15 && pct < 0.5) || (h >= 19 && pct < 0.8)) {
      const gap = Math.round(i.proteinTarget - protein);
      out.push({
        id: "protein", kind: "protein", emoji: "🥚", priority: 2,
        title: `${Math.round(protein)} of ${Math.round(i.proteinTarget)} g protein`,
        body: `You're ${gap} g short, very doable. Easy adds: Greek yogurt (~17 g), 2 eggs (~12 g), a tin of tuna (~25 g), tofu (~20 g per cup), or a protein shake (~25 g).`,
        ask: `I'm ${gap} g short on protein today. Give me a quick, tasty way to close the gap.`,
      });
    }
  }

  // Supplements: overdue + food rules
  for (const s of i.supplements) {
    if (!overdue(s, i.taken, i.now)) continue;
    const rule = FOOD_RULES[kindOf(s.name)];
    out.push({
      id: `sup-${s.id}`, kind: "supplement", emoji: "💊", priority: 1,
      title: `${s.name} not taken yet`,
      body: rule ? `${rule.tip}${rule.needsFood && h >= 17 ? " Dinner is a great time." : ""}` : "Still time today. Want a reminder with your next meal?",
      ask: `When's the best time for me to take my ${s.name} today?`,
    });
  }

  // Supplement schedule conflicts
  for (const issue of scheduleIssues(i.supplements)) {
    out.push({
      id: `conf-${issue.ids.join("-")}`, kind: "supplement_timing", emoji: "⏱️", priority: 2,
      title: "Supplement timing clash",
      body: `${issue.message} ${issue.fix}`,
      ask: "Can you build me a daily supplement schedule that avoids absorption clashes?",
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
