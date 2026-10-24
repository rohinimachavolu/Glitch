/**
 * Luna — Menopause / Perimenopause engine
 * Hot-flash detection from skin-temp spikes + HR jumps, plus trend summaries.
 * All thresholds from data/references.ts. Patterns only, never diagnosis.
 */
import { MENOPAUSE } from "@/data/references";
import type { BiometricEntry, HotFlashEvent, SignalTrend } from "@/db/types";
import { getBiometricTrend } from "./cycleEngine";

/**
 * Detect probable hot-flash events: a skin-temp spike above the rolling baseline
 * paired with an elevated heart rate on the same day.
 * (Day-granularity from WHOOP daily data; a real device would do intraday.)
 */
export function detectHotFlashes(biometrics: BiometricEntry[]): HotFlashEvent[] {
  const temps = biometrics.map((b) => b.skinTempC).filter((n): n is number => typeof n === "number");
  if (temps.length < 5) return [];
  const baseTemp = temps.reduce((a, b) => a + b, 0) / temps.length;

  const rhrs = biometrics.map((b) => b.restingHr).filter((n): n is number => typeof n === "number");
  const baseHr = rhrs.length ? rhrs.reduce((a, b) => a + b, 0) / rhrs.length : 0;

  const events: HotFlashEvent[] = [];
  for (const b of biometrics) {
    if (typeof b.skinTempC !== "number") continue;
    const tempSpike = b.skinTempC - baseTemp;
    const hrJump = typeof b.restingHr === "number" ? b.restingHr - baseHr : 0;
    if (tempSpike >= MENOPAUSE.HOT_FLASH_TEMP_SPIKE_C && hrJump >= MENOPAUSE.HOT_FLASH_HR_JUMP_BPM) {
      events.push({
        timestamp: new Date(b.date).toISOString(),
        source: "detected",
        tempSpikeC: Number(tempSpike.toFixed(2)),
        hrJumpBpm: Number(hrJump.toFixed(1)),
        note: "Auto-flagged from a skin-temperature spike with raised heart rate.",
      });
    }
  }
  return events;
}

export interface MenopauseTrends {
  hrv: SignalTrend;
  restingHr: SignalTrend;
  respRate: SignalTrend;
  skinTemp: SignalTrend;
}

export function getMenopauseTrends(biometrics: BiometricEntry[]): MenopauseTrends {
  return {
    hrv: getBiometricTrend(biometrics, "hrvMs"),
    restingHr: getBiometricTrend(biometrics, "restingHr"),
    respRate: getBiometricTrend(biometrics, "respRate"),
    skinTemp: getBiometricTrend(biometrics, "skinTempC"),
  };
}

/** Non-medical, supportive suggestions. Never prescribes medication/HRT. */
export interface MenopauseSuggestion {
  icon: string;
  title: string;
  detail: string;
}

export function getMenopauseSuggestions(trends: MenopauseTrends, hotFlashCount: number): MenopauseSuggestion[] {
  const s: MenopauseSuggestion[] = [];

  if (hotFlashCount > 0) {
    s.push({
      icon: "🧊",
      title: "Cool down proactively",
      detail: "Keep a cool room at night, dress in layers, and try a few minutes of slow paced breathing when a flash starts — peripheral cooling and paced respiration can ease vasomotor symptoms.",
    });
  }

  if (trends.hrv.direction === "down") {
    s.push({
      icon: "🫁",
      title: "Your recovery signal is dipping",
      detail: `Your HRV is trending down from your baseline. Perimenopause can suppress night-time HRV (by roughly ${MENOPAUSE.PERIMENOPAUSE_HRV_DROP_MS}ms on average). Prioritize sleep and gentle stress management this week.`,
    });
  }

  if (trends.restingHr.direction === "up") {
    s.push({
      icon: "❤️",
      title: "Resting heart rate is up",
      detail: "Your resting heart rate is above your usual baseline. Hydration, cooler sleep, and lighter evenings can help. If it stays elevated, mention it to a clinician.",
    });
  }

  s.push({
    icon: "🏋️",
    title: "Protect bone & muscle",
    detail: "Strength training twice a week and adequate protein and calcium matter more after menopause for bone density and muscle — a great focus for your fitness plan.",
  });

  return s;
}

// ─────────────────────────────────────────────────────────────
// Expanded menopause module (the 7 features)
// ─────────────────────────────────────────────────────────────
import { BLOOD_PRESSURE } from "@/data/references";
import type {
  PerimenopauseAssessment, PerimenopauseStage, MentalHealthCheck, HealthRecord, Confidence,
} from "@/db/types";
import { getCycleStats } from "@/db/repositories";

/** #4 Night sweats: elevated skin temp during the sleep window vs baseline. */
export function detectNightSweats(biometrics: BiometricEntry[]): number {
  const nights = biometrics.map((b) => b.nightTempC ?? b.skinTempC).filter((n): n is number => typeof n === "number");
  if (nights.length < 5) return 0;
  const base = nights.reduce((a, b) => a + b, 0) / nights.length;
  return biometrics.filter((b) => {
    const nt = b.nightTempC ?? b.skinTempC;
    return typeof nt === "number" && nt - base >= MENOPAUSE.NIGHT_SWEAT_TEMP_C;
  }).length;
}

/** #5 Sleep fragmentation: disturbances up or efficiency down vs baseline. */
export function getSleepFragmentation(biometrics: BiometricEntry[]): {
  level: "ok" | "watch" | "high"; avgDisturbances: number; avgEfficiency: number | null; detail: string;
} {
  const dist = biometrics.map((b) => b.sleepDisturbances).filter((n): n is number => typeof n === "number");
  const eff = biometrics.map((b) => b.sleepEfficiency ?? b.sleepPerformance).filter((n): n is number => typeof n === "number");
  const avgDist = dist.length ? dist.reduce((a, b) => a + b, 0) / dist.length : 0;
  const avgEff = eff.length ? eff.reduce((a, b) => a + b, 0) / eff.length : null;
  let level: "ok" | "watch" | "high" = "ok";
  if (avgDist >= MENOPAUSE.SLEEP_FRAGMENTATION_DISTURBANCES || (avgEff != null && avgEff < MENOPAUSE.SLEEP_EFFICIENCY_LOW_PCT - 8)) level = "high";
  else if (avgDist >= MENOPAUSE.SLEEP_FRAGMENTATION_DISTURBANCES * 0.7 || (avgEff != null && avgEff < MENOPAUSE.SLEEP_EFFICIENCY_LOW_PCT)) level = "watch";
  const detail = level === "high"
    ? "Your sleep has been notably fragmented lately — common in the menopause transition."
    : level === "watch" ? "Your sleep shows some fragmentation. Worth watching." : "Your sleep looks relatively settled.";
  return { level, avgDisturbances: Math.round(avgDist), avgEfficiency: avgEff != null ? Math.round(avgEff) : null, detail };
}

/** #2/#6 Perimenopause staging from age + irregularity + HRV + flashes + sleep. */
export async function assessPerimenopause(input: {
  age: number;
  biometrics: BiometricEntry[];
  hotFlashCount: number;
  nightSweatCount: number;
}): Promise<PerimenopauseAssessment> {
  const { age, biometrics, hotFlashCount, nightSweatCount } = input;
  const contributors: string[] = [];
  let score = 0;

  // Age-based likelihood
  let ageBased: Confidence = "low";
  if (age >= MENOPAUSE.MENO_AGE_TYPICAL) { ageBased = "high"; score += 35; contributors.push(`Age ${age} is around the typical menopause age (${MENOPAUSE.MENO_AGE_TYPICAL}).`); }
  else if (age >= MENOPAUSE.PERI_AGE_LIKELY) { ageBased = "high"; score += 28; contributors.push(`Age ${age} is in the range where perimenopause commonly begins.`); }
  else if (age >= MENOPAUSE.PERI_AGE_EARLY) { ageBased = "moderate"; score += 18; contributors.push(`Age ${age} — perimenopause can start in the early 40s.`); }

  // Cycle irregularity
  const stats = await getCycleStats();
  if (stats.sd != null && stats.sd >= 9) { score += 18; contributors.push(`Your cycles have become quite irregular (±${Math.round(stats.sd)} days).`); }
  else if (stats.mean != null && stats.mean > 35) { score += 10; contributors.push("Your cycles have been running long."); }

  // HRV decline
  const hrvTrend = getBiometricTrend(biometrics, "hrvMs");
  if (hrvTrend.direction === "down") { score += 12; contributors.push("Your HRV is trending down from baseline (seen in the transition)."); }

  // Vasomotor symptoms
  if (hotFlashCount > 0) { score += Math.min(20, hotFlashCount * 3); contributors.push(`${hotFlashCount} hot flash${hotFlashCount > 1 ? "es" : ""} recorded.`); }
  if (nightSweatCount > 0) { score += Math.min(12, nightSweatCount * 3); contributors.push(`${nightSweatCount} night-sweat night${nightSweatCount > 1 ? "s" : ""} detected.`); }

  // Sleep fragmentation
  const frag = getSleepFragmentation(biometrics);
  if (frag.level === "high") { score += 10; contributors.push("Fragmented sleep."); }
  else if (frag.level === "watch") { score += 5; }

  score = Math.min(100, score);
  let stage: PerimenopauseStage = "unlikely";
  if (score >= 65) stage = "established";
  else if (score >= 45) stage = "likely_peri";
  else if (score >= 25) stage = "possible_early";

  const headline =
    stage === "established" ? "Your signals are consistent with the menopause transition"
    : stage === "likely_peri" ? "You may be in perimenopause"
    : stage === "possible_early" ? "You may be entering perimenopause"
    : "Few menopause-transition signals right now";

  return {
    stage, ageBasedLikelihood: ageBased, score, contributors,
    headline,
    alert: stage === "likely_peri" || stage === "established",
  };
}

/** #7 Mental-health check from HRV trend + typed BP record. Context, not clinical. */
export function getMentalHealthCheck(biometrics: BiometricEntry[], records: HealthRecord[]): MentalHealthCheck {
  const hrvTrend = getBiometricTrend(biometrics, "hrvMs").direction;

  // Find most recent BP record like "120/80".
  let bp: MentalHealthCheck["bp"];
  const bpRec = records.filter((r) => /blood pressure|bp\b/i.test(r.label) && r.value).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (bpRec?.value) {
    const m = bpRec.value.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (m) {
      const systolic = Number(m[1]), diastolic = Number(m[2]);
      const flag = systolic >= BLOOD_PRESSURE.HIGH_SYSTOLIC || diastolic >= BLOOD_PRESSURE.HIGH_DIASTOLIC ? "high"
        : systolic >= BLOOD_PRESSURE.ELEVATED_SYSTOLIC ? "elevated" : "normal";
      bp = { systolic, diastolic, flag };
    }
  }

  const needsAttention = hrvTrend === "down" || bp?.flag === "high";
  const prompt = bp?.flag === "high"
    ? "Your recorded blood pressure is in a high range and your recovery signal is low. This is worth raising with a clinician."
    : hrvTrend === "down"
      ? "Your HRV has been low lately, which can track with stress. Be gentle with yourself — rest, breathe, and reach out if you're struggling."
      : "Your stress-recovery signals look steady. Keep checking in with how you feel.";

  return { hrvTrend, bp, prompt, needsAttention };
}
