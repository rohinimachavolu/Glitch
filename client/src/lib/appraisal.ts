/**
 * Glitch — Appraisal-based coaching engine
 *
 * Grounded in cognitive appraisal theory (Lazarus & Folkman, 1984): how someone *interprets* a
 * moment — challenge, threat or loss, and how much control they feel — shapes the emotion and the
 * behaviour that follows (e.g. stress eating). Strategies come from Gross's process model of emotion
 * regulation (situation selection/modification, attentional deployment, cognitive reappraisal,
 * response modulation) plus self-compassion for post-eating guilt.
 *
 * The novel part is combining the *subjective* appraisal with *objective* physiology from WHOOP:
 * when they disagree (mind stressed but body recovered, or the reverse) that gap is itself coachable.
 *
 * Strategy selection is deterministic and explainable; an LLM may only re-word the chosen strategy.
 * Wellness support, not therapy or medical advice.
 */
import type { CyclePhase } from "@/contexts/AppContext";

export type Appraisal = "challenge" | "threat" | "loss" | "neutral";
export type CravingType = "none" | "sweet" | "salty" | "carbs" | "fast_food" | "alcohol";
export type Trigger = "tired" | "stressed" | "bored" | "lonely" | "hungry" | "celebrating" | "conflict" | "pms";
export type AteFeeling = "fine" | "guilty" | "ashamed";

export interface CheckInInput {
  mood: number;             // 1–5 (valence)
  energy: number;           // 1–5 (felt arousal)
  craving: CravingType;
  cravingIntensity: number; // 0–5
  appraisal: Appraisal;
  control: number;          // 1–5 coping potential
  triggers: Trigger[];
  ateFeeling?: AteFeeling | null;
  note?: string;
}

export interface BodyContext {
  physioStress?: { score: number; level: "low" | "moderate" | "high" } | null;
  physioEnergy?: number | null;     // 0–100
  recovery?: number | null;         // 0–100
  sleepPerformance?: number | null; // 0–100
  phase?: CyclePhase | null;
  cycleDay?: number | null;
  cycleLength?: number | null;
  hoursSinceMeal?: number | null;
  hour: number;                     // 0–23 local
}

export type StrategyId =
  | "physiological_sigh" | "reframe_challenge" | "biology_not_willpower" | "planned_portion"
  | "urge_surf" | "eat_real_meal" | "fresh_start" | "reduce_decisions" | "connect"
  | "move_reset" | "harness_momentum" | "rest_permission";

export type Family = "reappraisal" | "situation" | "attention" | "response" | "self_compassion" | "action";

export interface Strategy {
  id: StrategyId;
  family: Family;
  title: string;
  minutes: number;
  steps: string[];
  why: string;
}

export type Mismatch = "mind_stressed_body_ok" | "mind_ok_body_stressed" | null;

export interface CoachingResult {
  stateLabel: string;
  insight: string;
  mismatch: Mismatch;
  primary: Strategy;
  alternative: Strategy;
  safety: { show: boolean; message: string } | null;
}

export interface StrategyStats { shown: number; helped: number }

// ── Strategy library ─────────────────────────────────────────
export const STRATEGIES: Record<StrategyId, Strategy> = {
  physiological_sigh: {
    id: "physiological_sigh", family: "response", title: "Two-minute physiological sigh", minutes: 2,
    steps: ["Breathe in through your nose", "Take a second short sip of air on top", "Long, slow exhale through your mouth", "Repeat for 2 minutes"],
    why: "Exhale-focused breathing was the fastest way to lower arousal and improve mood in a 2023 Stanford trial (Balban et al.).",
  },
  reframe_challenge: {
    id: "reframe_challenge", family: "reappraisal", title: "Reframe the pressure", minutes: 1,
    steps: ["Notice the racing heart or tension", "Say to yourself: \"This is my body getting ready, not falling apart\"", "Pick the one next step you can control"],
    why: "Re-reading stress arousal as helpful improves performance and cardiovascular response (Jamieson et al., 2012).",
  },
  biology_not_willpower: {
    id: "biology_not_willpower", family: "reappraisal", title: "It's biology, not willpower", minutes: 1,
    steps: ["Name the cause: low sleep, hormones or a stressed nervous system", "Expect the craving to be louder today, and that's okay", "Choose a smaller, planned version instead of fighting it"],
    why: "Short sleep raises the hunger hormone ghrelin, and energy intake naturally rises in the luteal phase, so cravings are a signal, not a failure.",
  },
  planned_portion: {
    id: "planned_portion", family: "situation", title: "Have it on purpose", minutes: 10,
    steps: ["Put one portion on a plate (not the bag)", "Pair it with protein or fibre", "Sit down and eat it slowly, without screens", "Put the rest away first"],
    why: "Flexible, planned indulgence predicts better long-term control than rigid restriction, which tends to backfire.",
  },
  urge_surf: {
    id: "urge_surf", family: "attention", title: "Surf the urge for 10 minutes", minutes: 10,
    steps: ["Set a 10-minute timer", "Notice where you feel the craving in your body", "Rate it 1–10 every couple of minutes and watch it rise and fall", "Decide again when the timer ends"],
    why: "Cravings rise and fall like waves; mindfulness-based urge surfing reduces craving-driven eating.",
  },
  eat_real_meal: {
    id: "eat_real_meal", family: "action", title: "You're actually hungry, so eat a real meal", minutes: 15,
    steps: ["Protein + vegetables + a slow carb", "Drink a glass of water", "Then check if the craving is still there"],
    why: "Physical hunger after a long gap amplifies cravings for fast sugar. A balanced meal fixes the cause.",
  },
  fresh_start: {
    id: "fresh_start", family: "self_compassion", title: "One meal doesn't undo progress", minutes: 2,
    steps: ["Say: \"That happened, and I'm still on track\"", "Don't skip your next meal or do a punishment workout", "Make your next meal a normal, balanced one"],
    why: "Guilt after a slip often triggers more overeating (the abstinence-violation effect). Self-compassion breaks that cycle (Adams & Leary, 2007).",
  },
  reduce_decisions: {
    id: "reduce_decisions", family: "situation", title: "Shrink today down", minutes: 5,
    steps: ["Pick one default meal for later and stop deciding", "Swap today's workout for a 20-minute walk", "Choose one task that matters and let the rest wait"],
    why: "When you feel low control, every extra decision drains self-regulation. Fewer choices protect your goals.",
  },
  connect: {
    id: "connect", family: "situation", title: "Reach out to one person", minutes: 5,
    steps: ["Text or call someone you trust", "You don't need to explain everything; just connect", "Notice how you feel afterwards"],
    why: "Loneliness is one of the strongest emotional-eating triggers; brief social contact reduces stress reactivity.",
  },
  move_reset: {
    id: "move_reset", family: "response", title: "10-minute walk reset", minutes: 10,
    steps: ["Step outside if you can", "Walk at an easy, conversational pace", "Leave your phone in your pocket"],
    why: "A short walk lowers tension and, after a meal, blunts the blood-sugar spike.",
  },
  harness_momentum: {
    id: "harness_momentum", family: "action", title: "Use the momentum", minutes: 30,
    steps: ["Do today's planned workout, and add one extra set if it feels good", "Prep tomorrow's first meal while motivation is high", "Note what made today feel good"],
    why: "Challenge appraisals plus good recovery are the ideal window for progress. Lock it in.",
  },
  rest_permission: {
    id: "rest_permission", family: "self_compassion", title: "Rest is part of the plan", minutes: 5,
    steps: ["Swap intensity for mobility or a gentle walk", "Get to bed 30 minutes earlier tonight", "Remind yourself: recovery is where progress happens"],
    why: "Training hard on a depleted day raises injury risk and stress hormones. Backing off today protects tomorrow.",
  },
};

// ── Safety ───────────────────────────────────────────────────
const CRISIS_WORDS = ["suicide", "kill myself", "end it", "self harm", "self-harm", "hurt myself", "want to die", "no reason to live"];

export function safetyCheck(input: CheckInInput, recentMoods: number[]): CoachingResult["safety"] {
  const note = (input.note ?? "").toLowerCase();
  if (CRISIS_WORDS.some((w) => note.includes(w))) {
    return { show: true, message: "It sounds like you're going through something really hard. You don't have to handle it alone. Call or text 988 (Suicide & Crisis Lifeline, US) any time, or contact local emergency services." };
  }
  const lowStreak = [...recentMoods, input.mood].slice(-3);
  if (lowStreak.length === 3 && lowStreak.every((m) => m <= 1)) {
    return { show: true, message: "Your mood has been very low for a few check-ins. It could really help to talk to someone: a friend, a doctor, or call/text 988 in the US." };
  }
  return null;
}

// ── Engine ───────────────────────────────────────────────────
export function detectMismatch(input: CheckInInput, body: BodyContext): Mismatch {
  const mindStressed = input.appraisal === "threat" || input.triggers.includes("stressed") || input.control <= 2;
  const mindOk = (input.appraisal === "challenge" || input.appraisal === "neutral") && input.mood >= 4;
  const bodyOk = body.physioStress?.level === "low" && (body.recovery ?? 0) >= 60;
  const bodyStressed = body.physioStress?.level === "high" || (body.physioEnergy != null && body.physioEnergy < 35);
  if (mindStressed && bodyOk) return "mind_stressed_body_ok";
  if (mindOk && bodyStressed) return "mind_ok_body_stressed";
  return null;
}

function isLateLuteal(body: BodyContext) {
  if (body.phase !== "luteal") return false;
  if (body.cycleDay == null || body.cycleLength == null) return true;
  return body.cycleLength - body.cycleDay <= 7;
}

/** Score every strategy for this moment. Higher = better fit. */
export function scoreStrategies(input: CheckInInput, body: BodyContext): Record<StrategyId, number> {
  const t = (x: Trigger) => input.triggers.includes(x);
  const craving = input.craving !== "none" ? input.cravingIntensity : 0;
  const physioHigh = body.physioStress?.level === "high";
  const poorSleep = (body.sleepPerformance ?? 100) < 70 || t("tired");
  const luteal = isLateLuteal(body) || t("pms");
  const hungry = t("hungry") || (body.hoursSinceMeal ?? 0) >= 4.5;
  const emotionalTrigger = t("bored") || t("lonely") || t("stressed") || t("conflict");
  const guilt = input.ateFeeling === "guilty" || input.ateFeeling === "ashamed" || input.appraisal === "loss";
  const depleted = (body.physioEnergy != null && body.physioEnergy < 35) || (body.recovery != null && body.recovery < 34);
  const mismatch = detectMismatch(input, body);

  return {
    physiological_sigh: (input.appraisal === "threat" ? 2 : 0) + (physioHigh ? 2 : 0) + (t("stressed") || t("conflict") ? 1.5 : 0) + (input.energy >= 4 && input.mood <= 2 ? 1 : 0),
    reframe_challenge: (input.appraisal === "threat" ? 2 : 0) + (input.control >= 3 ? 1 : -1) + (mismatch === "mind_stressed_body_ok" ? 3 : 0),
    biology_not_willpower: craving >= 3 ? 1.5 + (poorSleep ? 1.5 : 0) + (luteal ? 2 : 0) + (physioHigh ? 1 : 0) : 0,
    planned_portion: craving >= 3 && input.appraisal !== "loss" ? 1.5 + (input.control >= 3 ? 1 : 0) + (t("celebrating") ? 1.5 : 0) + (luteal ? 0.5 : 0) : 0,
    urge_surf: craving >= 2 && emotionalTrigger && !hungry ? 1.5 + (input.control >= 2 ? 1 : 0) + (t("bored") ? 1 : 0) : 0,
    eat_real_meal: hungry ? 3 + (craving >= 3 ? 1 : 0) : 0,
    fresh_start: guilt ? 4 + (input.ateFeeling === "ashamed" ? 1 : 0) : 0,
    reduce_decisions: (input.control <= 2 ? 2.5 : 0) + (input.appraisal === "threat" ? 1 : 0) + (input.energy <= 2 ? 0.5 : 0),
    connect: (t("lonely") ? 3 : 0) + (t("conflict") ? 1 : 0) + (input.mood <= 2 ? 0.5 : 0),
    move_reset: (t("stressed") || t("bored") ? 1 : 0) + (input.energy <= 3 && !depleted ? 1 : 0) + ((body.hoursSinceMeal ?? 9) < 1 ? 1.5 : 0) + (mismatch === "mind_stressed_body_ok" ? 1 : 0),
    harness_momentum: input.appraisal === "challenge" && input.mood >= 4 && !depleted ? 3 + ((body.recovery ?? 0) >= 67 ? 1.5 : 0) : 0,
    rest_permission: (depleted ? 2.5 : 0) + (mismatch === "mind_ok_body_stressed" ? 2.5 : 0) + (poorSleep && input.energy <= 2 ? 1 : 0),
  };
}

/** Learned weight from "did this help?" feedback (Laplace-smoothed, centred on 1). */
export function learnedWeight(s: StrategyStats | undefined): number {
  if (!s) return 1;
  return 2 * ((s.helped + 1) / (s.shown + 2));
}

function stateLabel(i: CheckInInput): string {
  if (i.appraisal === "loss" || i.ateFeeling === "guilty" || i.ateFeeling === "ashamed") return "Feeling like you slipped";
  if (i.appraisal === "challenge" && i.mood >= 4) return "Motivated and ready";
  const valence = i.mood >= 4 ? "good" : i.mood <= 2 ? "low" : "okay";
  const arousal = i.energy >= 4 ? "wired" : i.energy <= 2 ? "drained" : "steady";
  if (i.appraisal === "threat" && i.energy >= 3) return "Stressed and on edge";
  if (valence === "low" && arousal === "drained") return "Low and drained";
  if (valence === "low" && arousal === "wired") return "Tense and frustrated";
  if (i.craving !== "none" && i.cravingIntensity >= 3) return `Strong ${i.craving.replace("_", " ")} craving`;
  return `Feeling ${valence}, ${arousal}`;
}

function buildInsight(i: CheckInInput, b: BodyContext, mismatch: Mismatch): string {
  const parts: string[] = [];
  if (mismatch === "mind_stressed_body_ok") {
    parts.push(`Your body is actually calm and recovered${b.recovery != null ? ` (${b.recovery}% recovery)` : ""}. The pressure is coming from the situation, not from depletion, so you have the physical resources to handle it.`);
  } else if (mismatch === "mind_ok_body_stressed") {
    parts.push("You feel good, but your body is carrying load right now (low HRV or energy). Enjoy the mood, just keep intensity moderate today.");
  } else if (b.physioStress?.level === "high") {
    parts.push("Your body is showing stress too (HRV below your baseline), so this isn't just in your head.");
  }
  const craving = i.craving !== "none" && i.cravingIntensity >= 3;
  if (craving && isLateLuteal(b)) parts.push("You're in the days before your period, when cravings are biologically stronger.");
  else if (craving && (b.sleepPerformance ?? 100) < 70) parts.push(`Last night's sleep (${b.sleepPerformance}%) makes cravings louder; that's hormones, not weakness.`);
  if ((b.hoursSinceMeal ?? 0) >= 4.5) parts.push(`It's been about ${Math.round(b.hoursSinceMeal!)} hours since you last ate.`);
  if (!parts.length) parts.push(i.mood >= 4 ? "Your check-in and body signals look balanced." : "Thanks for checking in. Naming how you feel is already a regulation step.");
  return parts.join(" ");
}

export function coach(input: CheckInInput, body: BodyContext, stats: Partial<Record<StrategyId, StrategyStats>> = {}, recentMoods: number[] = []): CoachingResult {
  const scores = scoreStrategies(input, body);
  const ranked = (Object.keys(scores) as StrategyId[])
    .map((id) => ({ id, score: scores[id] * learnedWeight(stats[id]) }))
    .sort((a, b) => b.score - a.score);

  // Fallback when nothing fits strongly: a calm default
  const primaryId = ranked[0].score > 0 ? ranked[0].id : "move_reset";
  const primary = STRATEGIES[primaryId];
  // Alternative from a different regulation family so the user gets a real choice
  const altId = ranked.find((r) => r.id !== primaryId && STRATEGIES[r.id].family !== primary.family && r.score > 0)?.id
    ?? (primary.family === "response" ? "reframe_challenge" : "physiological_sigh");

  const mismatch = detectMismatch(input, body);
  return {
    stateLabel: stateLabel(input),
    insight: buildInsight(input, body, mismatch),
    mismatch,
    primary,
    alternative: STRATEGIES[altId],
    safety: safetyCheck(input, recentMoods),
  };
}
