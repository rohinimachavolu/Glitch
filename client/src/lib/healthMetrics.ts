/**
 * Glitch — Health Metrics Engine
 * Derives stress, energy, VO2max, ovulation and cycle-adjusted recovery from daily WHOOP physiology.
 * WHOOP's API does not expose stress or VO2max directly; these are transparent estimates and are
 * labelled as such in the UI. Nothing here is a diagnosis.
 */
import type { DailyPhysiology, WhoopWorkout } from "./whoop/types";
import type { CyclePhase } from "@/contexts/AppContext";
import tunedParams from "./models/ovulationParams.json";

const DAY = 86_400_000;

// ── small stats helpers ──────────────────────────────────────
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
function sd(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null && !Number.isNaN(x));
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const parseDay = (s: string) => new Date(`${s}T00:00:00Z`).getTime();

function z(value: number, baseline: number[]): number {
  const m = mean(baseline), s = sd(baseline);
  if (!Number.isFinite(s) || s === 0) return 0;
  return (value - m) / s;
}

// ── Menstrual cycle segmentation + ovulation detection ───────
export interface CycleWindow {
  start: string;          // period start (cycle day 1)
  end: string;            // day before next period start (or today for the current cycle)
  complete: boolean;
}

/**
 * Period start dates, newest last. Uses logged starts where we have them and fills
 * earlier cycles by stepping back `cycleLength` days from the oldest known start.
 */
export function cycleWindows(periodStarts: string[], cycleLength: number, today: string, lookbackDays = 120): CycleWindow[] {
  const starts = Array.from(new Set(periodStarts)).sort();
  if (!starts.length) return [];
  const earliestWanted = parseDay(today) - lookbackDays * DAY;
  let t = parseDay(starts[0]) - cycleLength * DAY;
  while (t >= earliestWanted) { starts.unshift(isoDay(new Date(t))); t -= cycleLength * DAY; }

  return starts.map((s, i) => {
    const next = starts[i + 1];
    return next
      ? { start: s, end: isoDay(new Date(parseDay(next) - DAY)), complete: true }
      : { start: s, end: today, complete: false };
  });
}

export type OvulationStatus = "confirmed" | "not_detected" | "pending" | "insufficient_data";

export interface OvulationResult {
  cycleStart: string;
  status: OvulationStatus;
  /** Estimated ovulation date (day before the sustained temperature rise) */
  ovulationDate?: string;
  /** Cycle day of ovulation (1-based) */
  ovulationCycleDay?: number;
  tempShift?: number;     // °C, luteal mean − follicular mean
  rhrShift?: number;      // bpm
  confidence?: "high" | "medium";
}

/**
 * Biphasic temperature detection, adapted from the fertility-awareness "3 over 6" rule:
 * ovulation is confirmed when 3 consecutive days sit above the previous 6-day mean, with the
 * 3-day mean at least 0.2 °C higher, and the rise is sustained. A matching resting-HR rise
 * (progesterone raises both) upgrades confidence.
 */
export interface OvulationParams {
  /** Each of the 3 post-shift days must exceed the 6-day baseline by this much (°C) */
  eachAbove: number;
  /** The 3-day mean must exceed the baseline by this much (°C) */
  meanRise: number;
  /** The following 6 days must stay this far above baseline on average (°C) */
  sustainRise: number;
}

/**
 * Defaults follow the fertility-awareness "3 over 6" rule. They can be re-tuned against hormone-confirmed
 * ovulation with scripts/validate_ovulation_mcphases.ts (mcPHASES, PhysioNet), which writes
 * models/ovulationParams.json — only aggregate thresholds, never participant data.
 */
export const DEFAULT_OVULATION_PARAMS: OvulationParams = { eachAbove: 0.1, meanRise: 0.2, sustainRise: 0.15, ...tunedParams.params };

export function detectOvulation(days: DailyPhysiology[], win: CycleWindow, params: OvulationParams = DEFAULT_OVULATION_PARAMS): OvulationResult {
  const inCycle = days.filter((d) => d.date >= win.start && d.date <= win.end);
  const temps = inCycle.map((d) => d.skinTemp);
  if (nums(temps).length < 12) return { cycleStart: win.start, status: "insufficient_data" };

  for (let i = 6; i + 2 < inCycle.length; i++) {
    const before = nums(temps.slice(i - 6, i));
    const after = temps.slice(i, i + 3);
    if (before.length < 4 || after.some((t) => t == null)) continue;
    const base = mean(before);
    const a = after as number[];
    if (!a.every((t) => t > base + params.eachAbove) || mean(a) < base + params.meanRise) continue;
    // Sustained: the rest of the cycle (up to 6 more days) stays elevated
    const sustain = nums(temps.slice(i, i + 6));
    if (mean(sustain) < base + params.sustainRise) continue;

    const follicular = inCycle.slice(Math.max(0, i - 6), i);
    const luteal = inCycle.slice(i, i + 6);
    const rhrShift = mean(nums(luteal.map((d) => d.restingHr))) - mean(nums(follicular.map((d) => d.restingHr)));
    const ovDay = inCycle[i - 1];
    return {
      cycleStart: win.start,
      status: "confirmed",
      ovulationDate: ovDay.date,
      ovulationCycleDay: Math.round((parseDay(ovDay.date) - parseDay(win.start)) / DAY) + 1,
      tempShift: +(mean(sustain) - base).toFixed(2),
      rhrShift: Number.isFinite(rhrShift) ? +rhrShift.toFixed(1) : undefined,
      confidence: rhrShift >= 1.5 ? "high" : "medium",
    };
  }
  // No shift: for a finished cycle that's a possible anovulatory cycle; for the current one, keep waiting
  return { cycleStart: win.start, status: win.complete ? "not_detected" : "pending" };
}

export function detectOvulationHistory(days: DailyPhysiology[], windows: CycleWindow[]): OvulationResult[] {
  return windows.map((w) => detectOvulation(days, w));
}

export interface OvulationConfidenceSummary {
  /** False unless the cycle's ovulation is confirmed. */
  show: boolean;
  /** "High confidence" | "Medium confidence" | "" */
  label: string;
  tone: "high" | "medium" | null;
  /** Physiology behind the call, e.g. "+0.31 °C skin temp · +1.8 bpm resting HR". */
  detail: string;
}

/**
 * Turn a confirmed OvulationResult into trust-building display copy. Progesterone raises
 * both skin temperature and resting heart rate after ovulation, so a matching RHR rise
 * corroborates the temperature shift. Pure — the UI only renders what this returns.
 */
export function ovulationConfidenceSummary(ov: OvulationResult): OvulationConfidenceSummary {
  if (ov.status !== "confirmed") return { show: false, label: "", tone: null, detail: "" };

  const tone = ov.confidence ?? "medium";
  const label = tone === "high" ? "High confidence" : "Medium confidence";

  const parts: string[] = [];
  if (ov.tempShift != null && Number.isFinite(ov.tempShift)) {
    parts.push(`${signed(ov.tempShift)} °C skin temp`);
  }
  if (ov.rhrShift != null && Number.isFinite(ov.rhrShift)) {
    parts.push(`${signed(ov.rhrShift, 1)} bpm resting HR`);
  }
  return { show: true, label, tone, detail: parts.join(" · ") };
}

/** Format a number with a sign prefix for non-negative values, fixed to `digits` decimals. */
function signed(n: number, digits = 2): string {
  const v = n.toFixed(digits);
  return n >= 0 ? `+${v}` : v;
}

/** Phase for a given day, using a detected ovulation date when we have one. */
export function phaseForDay(date: string, win: CycleWindow, ov: OvulationResult | undefined, cycleLength: number): CyclePhase {
  const cycleDay = Math.round((parseDay(date) - parseDay(win.start)) / DAY) + 1;
  if (cycleDay <= 5) return "menstrual";
  if (ov?.status === "confirmed" && ov.ovulationCycleDay) {
    if (cycleDay < ov.ovulationCycleDay - 1) return "follicular";
    if (cycleDay <= ov.ovulationCycleDay + 1) return "ovulation";
    return "luteal";
  }
  // Calendar fallback: ovulation ≈ 14 days before the next period
  const ovGuess = cycleLength - 14;
  if (cycleDay < ovGuess - 1) return "follicular";
  if (cycleDay <= ovGuess + 1) return "ovulation";
  return "luteal";
}

/** Map every day to its phase (null if it falls outside the known cycle windows). */
export function phaseMap(days: DailyPhysiology[], windows: CycleWindow[], ovs: OvulationResult[], cycleLength: number): Map<string, CyclePhase> {
  const m = new Map<string, CyclePhase>();
  windows.forEach((w, i) => {
    for (const d of days) {
      if (d.date >= w.start && d.date <= w.end) m.set(d.date, phaseForDay(d.date, w, ovs[i], cycleLength));
    }
  });
  return m;
}

// ── Cycle-adjusted recovery ──────────────────────────────────
export interface AdjustedRecovery {
  raw: number;
  phase: CyclePhase | null;
  phaseAverage: number | null;
  /** raw − phaseAverage */
  delta: number | null;
  /** Plain-language framing for the UI */
  message: string;
}

/**
 * WHOOP's recovery score typically dips in the luteal phase because progesterone raises RHR
 * and lowers HRV. Comparing today against the user's own average *for the same phase* stops
 * a normal hormonal dip from reading as "you're doing badly".
 */
export function cycleAdjustedRecovery(days: DailyPhysiology[], phases: Map<string, CyclePhase> | null): AdjustedRecovery | null {
  const scored = days.filter((d) => d.recovery != null);
  const today = scored[scored.length - 1];
  if (!today) return null;
  const raw = today.recovery!;
  const phase = phases?.get(today.date) ?? null;

  if (!phase) {
    const avg = mean(nums(scored.slice(-31, -1).map((d) => d.recovery)));
    const delta = Number.isFinite(avg) ? Math.round(raw - avg) : null;
    return {
      raw, phase: null, phaseAverage: Number.isFinite(avg) ? Math.round(avg) : null, delta,
      message: delta == null ? "Building your baseline…" : delta >= 0 ? `${delta} points above your 30-day average.` : `${-delta} points below your 30-day average.`,
    };
  }

  const samePhase = nums(scored.slice(0, -1).filter((d) => phases!.get(d.date) === phase).map((d) => d.recovery));
  if (samePhase.length < 4) {
    return { raw, phase, phaseAverage: null, delta: null, message: `Learning what's normal for your ${phase} phase.` };
  }
  const avg = mean(samePhase);
  const delta = Math.round(raw - avg);
  const message =
    delta >= 5 ? `Above your usual ${phase}-phase recovery (${Math.round(avg)}%). Good day to push.` :
    delta <= -10 ? `Lower than your usual ${phase}-phase recovery (${Math.round(avg)}%). Prioritise rest.` :
    `Normal for your ${phase} phase (usual ${Math.round(avg)}%). ${phase === "luteal" ? "This dip is hormonal, not a setback." : ""}`.trim();
  return { raw, phase, phaseAverage: Math.round(avg), delta, message };
}

// ── Stress ───────────────────────────────────────────────────
export interface StressScore {
  score: number;             // 0–100, higher = more physiological stress
  level: "low" | "moderate" | "high";
  drivers: string[];
}

/**
 * Physiological stress estimate: HRV below and resting HR above the user's own baseline,
 * plus poor sleep. When cycle phases are known, the baseline is phase-matched so the
 * luteal HRV dip isn't counted as stress.
 */
export function stressScore(days: DailyPhysiology[], phases: Map<string, CyclePhase> | null): StressScore | null {
  const valid = days.filter((d) => d.hrv != null && d.restingHr != null);
  const today = valid[valid.length - 1];
  if (!today || valid.length < 7) return null;
  let base = valid.slice(-31, -1);
  const phase = phases?.get(today.date);
  if (phase) {
    const matched = base.filter((d) => phases!.get(d.date) === phase);
    if (matched.length >= 5) base = matched;
  }
  const zHrv = z(today.hrv!, nums(base.map((d) => d.hrv)));
  const zRhr = z(today.restingHr!, nums(base.map((d) => d.restingHr)));
  const zSleep = today.sleepPerformance != null ? z(today.sleepPerformance, nums(base.map((d) => d.sleepPerformance))) : 0;
  const raw = -0.5 * zHrv + 0.3 * zRhr - 0.2 * zSleep;
  const score = Math.round(clamp(50 + 22 * raw));

  const drivers: string[] = [];
  if (zHrv < -0.8) drivers.push("HRV below your baseline");
  if (zRhr > 0.8) drivers.push("Resting heart rate elevated");
  if (zSleep < -0.8) drivers.push("Poorer sleep than usual");
  if (!drivers.length) drivers.push(score < 40 ? "HRV and heart rate look calm" : "Within your normal range");
  return { score, level: score < 40 ? "low" : score < 65 ? "moderate" : "high", drivers };
}

// ── Energy ───────────────────────────────────────────────────
export interface EnergyScore {
  score: number;           // 0–100
  label: string;
}

/** Battery-style energy: recharged by recovery + sleep, drained by today's strain. */
export function energyScore(today: DailyPhysiology | undefined): EnergyScore | null {
  if (!today || today.recovery == null) return null;
  const charge = 0.6 * today.recovery + 0.4 * (today.sleepPerformance ?? today.recovery);
  const score = Math.round(clamp(charge - (today.strain ?? 0) * 1.8));
  return { score, label: score >= 70 ? "Charged" : score >= 45 ? "Steady" : score >= 25 ? "Running low" : "Depleted" };
}

// ── VO2max ───────────────────────────────────────────────────
export interface Vo2Estimate {
  value: number;            // ml/kg/min
  category: "Poor" | "Fair" | "Good" | "Excellent" | "Superior";
  hrMax: number;
  hrRest: number;
}

// Approximate cut-offs (Poor < a, Fair < b, Good < c, Excellent < d, else Superior), ml/kg/min
const VO2_TABLE: Record<"female" | "male", [number, number[]][]> = {
  female: [[30, [31, 35, 39, 44]], [40, [29, 33, 37, 41]], [50, [27, 31, 35, 39]], [60, [25, 28, 31, 35]], [200, [22, 25, 28, 32]]],
  male:   [[30, [38, 42, 46, 51]], [40, [36, 40, 44, 48]], [50, [34, 38, 42, 46]], [60, [31, 35, 39, 43]], [200, [28, 32, 36, 40]]],
};

/**
 * Uth–Sørensen–Overgaard–Pedersen (2004): VO2max ≈ 15.3 × HRmax / HRrest.
 * HRmax comes from WHOOP's body measurement when present, else Tanaka (208 − 0.7 × age).
 * Resting HR is the median of the last 7 days to smooth out one-off nights.
 */
export function estimateVo2max(days: DailyPhysiology[], age: number, sex: "female" | "male" | "prefer_not_to_say", whoopMaxHr?: number | null): Vo2Estimate | null {
  const rhrs = nums(days.slice(-7).map((d) => d.restingHr)).sort((a, b) => a - b);
  if (rhrs.length < 3) return null;
  const hrRest = rhrs[Math.floor(rhrs.length / 2)];
  const hrMax = whoopMaxHr || Math.round(208 - 0.7 * age);
  const value = +(15.3 * (hrMax / hrRest)).toFixed(1);
  const table = VO2_TABLE[sex === "male" ? "male" : "female"];
  const cuts = table.find(([maxAge]) => age < maxAge)![1];
  const labels: Vo2Estimate["category"][] = ["Poor", "Fair", "Good", "Excellent"];
  const idx = cuts.findIndex((c) => value < c);
  return { value, category: idx === -1 ? "Superior" : labels[idx], hrMax, hrRest };
}

// ── Trends for the reversal dashboard ────────────────────────
export interface Trend {
  start: number;
  end: number;
  change: number;
}

/** Compare the first and last 14 days of a series. */
export function trend(days: DailyPhysiology[], key: keyof Omit<DailyPhysiology, "date">): Trend | null {
  const series = nums(days.map((d) => d[key] as number | null));
  if (series.length < 28) return null;
  const start = mean(series.slice(0, 14)), end = mean(series.slice(-14));
  return { start: +start.toFixed(1), end: +end.toFixed(1), change: +(end - start).toFixed(1) };
}

/** Minutes in heart-rate zone 2 (WHOOP zone_two) per ISO week, oldest first. */
export function zone2MinutesByWeek(workouts: WhoopWorkout[], weeks = 12, today = new Date()): { weekStart: string; minutes: number }[] {
  const out: { weekStart: string; minutes: number }[] = [];
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  for (let w = weeks - 1; w >= 0; w--) {
    const start = monday.getTime() - w * 7 * DAY;
    const end = start + 7 * DAY;
    const ms = workouts
      .filter((wk) => wk.score && Date.parse(wk.start) >= start && Date.parse(wk.start) < end)
      .reduce((a, wk) => a + wk.score!.zone_durations.zone_two_milli, 0);
    out.push({ weekStart: isoDay(new Date(start)), minutes: Math.round(ms / 60_000) });
  }
  return out;
}
