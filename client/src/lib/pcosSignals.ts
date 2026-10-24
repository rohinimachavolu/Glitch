/**
 * Luna — PCOS pattern signals
 * Surfaces PATTERNS worth discussing with a clinician. NEVER a diagnosis.
 * All thresholds come from data/references.ts.
 */
import { PCOS_PATTERN, CYCLE_BIOMETRIC_PATTERN } from "@/data/references";
import type { BiometricEntry, PatternFlag, Confidence } from "@/db/types";

export interface PcosInput {
  cycleStats: { count: number; mean: number | null; sd: number | null; lengths: number[] };
  biometrics: BiometricEntry[];
}

/** Estimate the luteal skin-temp rise: recent mean temp minus earlier mean temp. */
function lutealTempRise(biometrics: BiometricEntry[]): number | null {
  const temps = biometrics.map((b) => b.skinTempC).filter((n): n is number => typeof n === "number");
  if (temps.length < 8) return null;
  const half = Math.floor(temps.length / 2);
  const early = temps.slice(0, half);
  const late = temps.slice(half);
  const m = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return m(late) - m(early);
}

export function getPcosSignals(input: PcosInput): PatternFlag[] {
  const flags: PatternFlag[] = [];
  const { cycleStats, biometrics } = input;

  // 1. Long cycles
  if (cycleStats.mean != null && cycleStats.mean > PCOS_PATTERN.LONG_CYCLE_DAYS) {
    flags.push({
      flag: "Longer-than-typical cycles",
      detail: `Your average cycle is about ${Math.round(cycleStats.mean)} days, longer than the usual range. Long or infrequent cycles are one pattern worth discussing with a clinician.`,
      confidence: cycleStats.count >= 3 ? "moderate" : "low",
      severity: "watch",
    });
  }

  // 2. High irregularity
  if (cycleStats.sd != null && cycleStats.sd >= PCOS_PATTERN.HIGH_IRREGULARITY_SD_DAYS) {
    flags.push({
      flag: "Highly variable cycle length",
      detail: `Your cycle length varies a lot month to month (±${Math.round(cycleStats.sd)} days). Persistent irregularity is worth raising with a clinician.`,
      confidence: cycleStats.count >= 3 ? "moderate" : "low",
      severity: "watch",
    });
  }

  // 3. Flat temperature curve (possible anovulation)
  const rise = lutealTempRise(biometrics);
  if (rise != null && rise < PCOS_PATTERN.FLAT_TEMP_RISE_THRESHOLD_C) {
    flags.push({
      flag: "Little cyclical temperature shift",
      detail: `Your skin temperature stayed relatively flat across this cycle (expected rise ~${CYCLE_BIOMETRIC_PATTERN.LUTEAL_SKIN_TEMP_RISE_C}°C after ovulation). A flat pattern can accompany cycles without ovulation — a pattern to mention to a clinician.`,
      confidence: "low",
      severity: "info",
    });
  }

  // 4. Elevated resting HR relative to baseline (metabolic/autonomic load)
  const rhr = biometrics.map((b) => b.restingHr).filter((n): n is number => typeof n === "number");
  if (rhr.length >= 7) {
    const baseline = rhr.slice(0, Math.floor(rhr.length / 2));
    const recent = rhr.slice(Math.floor(rhr.length / 2));
    const base = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const rec = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (rec - base > 5) {
      flags.push({
        flag: "Resting heart rate trending up",
        detail: `Your resting heart rate has drifted up from your own baseline. Combined with irregular cycles, it's context worth sharing with a clinician.`,
        confidence: "low",
        severity: "info",
      });
    }
  }

  return flags;
}

/** Overall confidence summary for the module header. */
export function pcosSummaryConfidence(flags: PatternFlag[]): Confidence {
  if (flags.some((f) => f.confidence === "moderate")) return "moderate";
  if (flags.length > 0) return "low";
  return "low";
}
