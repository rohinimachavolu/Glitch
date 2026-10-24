/**
 * Luna — Cycle Engine
 * Phase math + range/confidence period prediction + biometric trends.
 * All reference numbers come from data/references.ts (no magic literals).
 */
import { CYCLE, CYCLE_VARIABILITY, PHASE_FRACTIONS } from "@/data/references";
import type {
  CyclePhase, PeriodEntry, BiometricEntry, PeriodPrediction, Confidence,
  SignalTrend, SignalTrendPoint,
} from "@/db/types";

const DAY_MS = 86400000;

const DEFAULT_CYCLE_LENGTH: number = CYCLE.DEFAULT_LENGTH;

/** Current cycle day (1-based) from the latest period start. */
export function getCycleDay(lastPeriodDate: string, cycleLength = DEFAULT_CYCLE_LENGTH, today = new Date()): number {
  const start = new Date(lastPeriodDate);
  const diff = Math.floor((today.getTime() - start.getTime()) / DAY_MS);
  if (diff < 0) return 1;
  return (diff % cycleLength) + 1;
}

/** Phase from cycle day, scaled to the individual's cycle length. */
export function getCyclePhase(cycleDay: number, cycleLength = DEFAULT_CYCLE_LENGTH): CyclePhase {
  const f = cycleDay / cycleLength;
  if (cycleDay <= Math.round(cycleLength * PHASE_FRACTIONS.MENSTRUAL_END)) return "menstrual";
  if (f <= PHASE_FRACTIONS.FOLLICULAR_END) return "follicular";
  if (f <= PHASE_FRACTIONS.OVULATION_END) return "ovulation";
  return "luteal";
}

export function getNextPeriodDate(lastPeriodDate: string, cycleLength = DEFAULT_CYCLE_LENGTH): Date {
  return new Date(new Date(lastPeriodDate).getTime() + cycleLength * DAY_MS);
}

export function getOvulationEstimate(lastPeriodDate: string, cycleLength = DEFAULT_CYCLE_LENGTH): Date {
  // Luteal phase is ~14 days; ovulation ≈ cycleLength − 14 (more robust than "day 14").
  const ovDay = Math.max(10, cycleLength - 14);
  return new Date(new Date(lastPeriodDate).getTime() + ovDay * DAY_MS);
}

/**
 * Predict the next period as a RANGE with confidence — never a single guaranteed date.
 * Grounded in the finding that most people vary 5+ days cycle-to-cycle.
 */
export function predictNextPeriod(
  periods: PeriodEntry[],
  cycleStats: { count: number; mean: number | null; sd: number | null },
  fallbackLength: number = CYCLE.DEFAULT_LENGTH,
): PeriodPrediction | null {
  if (periods.length === 0) return null;
  const last = periods[periods.length - 1].startDate;
  const meanLen = cycleStats.mean ?? fallbackLength;
  const lastStart = new Date(last);

  // Spread: use observed SD when available, else the population common-variation band.
  const spread = cycleStats.sd && cycleStats.sd > 0
    ? Math.max(cycleStats.sd, 1)
    : CYCLE_VARIABILITY.COMMON_VARIATION_DAYS;

  const mostLikely = new Date(lastStart.getTime() + meanLen * DAY_MS);
  const rangeStart = new Date(mostLikely.getTime() - spread * DAY_MS);
  const rangeEnd = new Date(mostLikely.getTime() + spread * DAY_MS);

  // Confidence from how many cycles we have and how consistent they are.
  let confidence: Confidence = "low";
  if (cycleStats.count >= 3 && (cycleStats.sd ?? 99) <= 3) confidence = "high";
  else if (cycleStats.count >= 2 && (cycleStats.sd ?? 99) <= 6) confidence = "moderate";

  const basis =
    cycleStats.count >= 2
      ? `Based on your last ${cycleStats.count + 1} logged periods (avg ${Math.round(meanLen)}-day cycle, ±${Math.round(spread)} days). Most people's cycles vary by several days, so this is a window, not a fixed date.`
      : `Estimated from 1 logged period and a typical ${Math.round(meanLen)}-day cycle. Log more periods to sharpen this. This is a window, not a fixed date.`;

  return { rangeStart, rangeEnd, mostLikely, confidence, basis };
}

// ── Biometric trends vs rolling baseline ─────────────────────
const SIGNAL_META: Record<SignalTrend["signal"], { label: string; unit: string; key: keyof BiometricEntry }> = {
  skinTempC:  { label: "Skin Temperature", unit: "°C",  key: "skinTempC" },
  restingHr:  { label: "Resting Heart Rate", unit: "bpm", key: "restingHr" },
  hrvMs:      { label: "Heart Rate Variability", unit: "ms", key: "hrvMs" },
  respRate:   { label: "Respiratory Rate", unit: "br/min", key: "respRate" },
  avgHr:      { label: "Average Heart Rate", unit: "bpm", key: "avgHr" },
};

export function getBiometricTrend(
  log: BiometricEntry[],
  signal: SignalTrend["signal"],
  phaseFor?: (date: string) => CyclePhase | undefined,
): SignalTrend {
  const meta = SIGNAL_META[signal];
  const series = log
    .map((e) => ({ date: e.date, value: e[meta.key] as number | undefined }))
    .filter((p): p is { date: string; value: number } => typeof p.value === "number");

  // Rolling baseline = mean of all available points (the user's own baseline).
  const values = series.map((p) => p.value);
  const baseline = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const points: SignalTrendPoint[] = series.map((p) => ({
    date: p.date,
    value: p.value,
    baseline,
    phase: phaseFor?.(p.date),
  }));

  const recent = values.slice(-3);
  const recentMean = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : baseline;
  const delta = recentMean - baseline;
  const threshold = baseline * 0.02; // 2% deadband
  const direction: SignalTrend["direction"] =
    delta > threshold ? "up" : delta < -threshold ? "down" : "stable";

  return {
    signal,
    label: meta.label,
    unit: meta.unit,
    points,
    direction,
    deltaFromBaseline: Number(delta.toFixed(2)),
  };
}

// ── Lightweight correlation (for the "wow" pattern reveal) ───
/** Pearson correlation of two aligned numeric series. */
export function correlate(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const xa = a.slice(-n), xb = b.slice(-n);
  const ma = xa.reduce((s, v) => s + v, 0) / n;
  const mb = xb.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) {
    const x = xa[i] - ma, y = xb[i] - mb;
    num += x * y; da += x * x; dbb += y * y;
  }
  if (da === 0 || dbb === 0) return 0;
  return num / Math.sqrt(da * dbb);
}
