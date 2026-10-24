/**
 * Luna — Sample data generator
 * Produces realistic, WHOOP-SHAPED biometric series + period history that embed
 * the real physiology from data/references.ts, so the demo always has a
 * compelling story. Everything is clearly LABELED "sample" in the UI.
 *
 * This is NOT invented clinical data presented as a user's own — it is seed data
 * for demonstration, tagged source:"sample" and badged on every screen.
 */
import { CYCLE, CYCLE_BIOMETRIC_PATTERN, MENOPAUSE } from "@/data/references";
import type { BiometricEntry, PeriodEntry, HealthMode } from "@/db/types";
import { getCyclePhase } from "./cycleEngine";

const DAY_MS = 86400000;
const iso = (d: Date) => d.toISOString().split("T")[0];

// Deterministic pseudo-random so the demo is stable run to run.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

interface SampleBundle {
  periods: Omit<PeriodEntry, "id">[];
  biometrics: Omit<BiometricEntry, "id">[];
}

/**
 * Cycling / irregular / PCOS sample: N days of biometrics with the luteal
 * temp rise, luteal RHR up / HRV down, resp-rate up — plus period starts.
 */
export function generateCyclingSample(opts: {
  days?: number;
  cycleLength?: number;
  irregular?: boolean;   // widen cycle variance (PCOS/irregular)
  flatTemp?: boolean;    // suppress the ovulatory temp rise (PCOS anovulation)
} = {}): SampleBundle {
  const days = opts.days ?? 84; // ~3 cycles
  const baseCycle = opts.cycleLength ?? CYCLE.DEFAULT_LENGTH;
  const rand = seeded(42);

  const today = new Date();
  const periods: Omit<PeriodEntry, "id">[] = [];
  const biometrics: Omit<BiometricEntry, "id">[] = [];

  // Build period start dates working backwards, with per-cycle length jitter.
  const starts: Date[] = [];
  let cursor = new Date(today.getTime() - days * DAY_MS);
  while (cursor < today) {
    starts.push(new Date(cursor));
    const jitter = opts.irregular ? Math.round((rand() - 0.5) * 16) : Math.round((rand() - 0.5) * 4);
    cursor = new Date(cursor.getTime() + (baseCycle + jitter) * DAY_MS);
  }
  starts.forEach((d, i) => {
    periods.push({
      startDate: iso(d),
      endDate: iso(new Date(d.getTime() + CYCLE.TYPICAL_PERIOD_DAYS * DAY_MS)),
      flow: i % 3 === 0 ? "heavy" : "medium",
    });
  });

  // Baselines
  const baseTemp = 33.6, baseRhr = 60, baseHrv = 62, baseResp = 15.2;

  for (let i = 0; i < days; i++) {
    const date = new Date(today.getTime() - (days - 1 - i) * DAY_MS);
    // Find current cycle day relative to most recent prior period start.
    const prior = starts.filter((s) => s <= date).pop() ?? starts[0];
    const cycleDay = Math.floor((date.getTime() - prior.getTime()) / DAY_MS) + 1;
    const phase = getCyclePhase(cycleDay, baseCycle);

    // Luteal shifts (muted if flatTemp = PCOS anovulation sample)
    const isLuteal = phase === "luteal";
    const tempRise = opts.flatTemp
      ? CYCLE_BIOMETRIC_PATTERN.LUTEAL_SKIN_TEMP_RISE_C * 0.1
      : CYCLE_BIOMETRIC_PATTERN.LUTEAL_SKIN_TEMP_RISE_C;

    const noise = (amp: number) => (rand() - 0.5) * amp;

    biometrics.push({
      date: iso(date),
      source: "sample",
      skinTempC: Number((baseTemp + (isLuteal ? tempRise : 0) + noise(0.15)).toFixed(2)),
      restingHr: Math.round(baseRhr + (isLuteal ? 4 : 0) + noise(3)),
      avgHr: Math.round(baseRhr + 12 + noise(6)),
      hrvMs: Math.round(baseHrv - (isLuteal ? 8 : 0) + noise(6)),
      respRate: Number((baseResp + (isLuteal ? 0.6 : 0) + noise(0.4)).toFixed(1)),
      spo2: Number((96 + noise(1.2)).toFixed(1)),
      recoveryScore: Math.max(20, Math.min(99, Math.round((isLuteal ? 58 : 72) + noise(18)))),
      strain: Number((8 + noise(6)).toFixed(1)),
      sleepPerformance: Math.round(80 + noise(16)),
      steps: Math.round(7000 + noise(5000)),
    });
  }

  return { periods, biometrics };
}

/**
 * Menopause sample: no periods, flatter cyclical pattern, declining HRV,
 * elevated resting HR, and a handful of hot-flash temp spikes.
 */
export function generateMenopauseSample(opts: { days?: number } = {}): SampleBundle {
  const days = opts.days ?? 60;
  const rand = seeded(77);
  const today = new Date();
  const biometrics: Omit<BiometricEntry, "id">[] = [];

  const baseTemp = 33.7, baseRhr = 66, baseHrv = 48, baseResp = 15.6;

  // Pick a few hot-flash days.
  const flashDays = new Set<number>();
  while (flashDays.size < 6) flashDays.add(Math.floor(rand() * days));

  for (let i = 0; i < days; i++) {
    const date = new Date(today.getTime() - (days - 1 - i) * DAY_MS);
    const noise = (amp: number) => (rand() - 0.5) * amp;
    const isFlash = flashDays.has(i);
    // Gentle downward HRV drift over time to mimic perimenopause.
    const drift = (i / days) * MENOPAUSE.PERIMENOPAUSE_HRV_DROP_MS;

    const sweatNight = isFlash || rand() < 0.15;
    biometrics.push({
      date: iso(date),
      source: "sample",
      skinTempC: Number((baseTemp + (isFlash ? MENOPAUSE.HOT_FLASH_TEMP_SPIKE_C + 0.2 : 0) + noise(0.15)).toFixed(2)),
      nightTempC: Number((baseTemp + (sweatNight ? MENOPAUSE.NIGHT_SWEAT_TEMP_C + 0.15 : 0) + noise(0.12)).toFixed(2)),
      restingHr: Math.round(baseRhr + (isFlash ? MENOPAUSE.HOT_FLASH_HR_JUMP_BPM + 2 : 0) + noise(3)),
      avgHr: Math.round(baseRhr + 14 + noise(6)),
      hrvMs: Math.round(baseHrv - drift + noise(5)),
      respRate: Number((baseResp + noise(0.4)).toFixed(1)),
      spo2: Number((96 + noise(1.2)).toFixed(1)),
      recoveryScore: Math.max(20, Math.min(99, Math.round(55 + noise(20)))),
      strain: Number((7 + noise(5)).toFixed(1)),
      sleepPerformance: Math.round(72 + noise(18)),
      sleepEfficiency: Math.round(84 + noise(14)),
      sleepDisturbances: Math.max(0, Math.round(14 + (sweatNight ? 6 : 0) + noise(8))),
      steps: Math.round(6500 + noise(4500)),
    });
  }

  return { periods: [], biometrics };
}

export function generateSampleForMode(mode: HealthMode): SampleBundle {
  switch (mode) {
    case "menopause": return generateMenopauseSample();
    case "pcos":
    case "irregular": return generateCyclingSample({ irregular: true, flatTemp: true });
    case "cycling":   return generateCyclingSample();
    default:          return generateCyclingSample({ days: 42 }); // fitness-only still gets WHOOP-shaped signals
  }
}
