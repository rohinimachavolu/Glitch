/**
 * Validate & tune Glitch's temperature-based ovulation detection against hormone ground truth
 * (mcPHASES: Fitbit nightly temperature + resting HR, urinary LH/E3G/PdG and Mira phase labels).
 *
 * Ground truth per cycle: the LH surge (peak LH ≥ 2× the cycle's median LH, away from the cycle edges);
 * ovulation is taken as the day after the LH peak. Cycles without a surge count as likely anovulatory,
 * where a "confirmed" detection is a false positive.
 *
 * Pure functions only — the CLI in scripts/validate_ovulation_mcphases.ts does the file I/O.
 */
import type { DailyPhysiology } from "./whoop/types";
import { detectOvulation, type CycleWindow, type OvulationParams } from "./healthMetrics";

export interface ParticipantDay {
  day: number;                // day_in_study
  temp?: number | null;       // nightly (relative) skin temperature
  rhr?: number | null;
  lh?: number | null;
  menstruating?: boolean;     // phase label or flow
}

const BASE = Date.UTC(2000, 0, 1);
export const dayToIso = (day: number) => new Date(BASE + day * 86_400_000).toISOString().slice(0, 10);

export function toPhysiology(rows: ParticipantDay[]): DailyPhysiology[] {
  return rows.map((r) => ({
    date: dayToIso(r.day), recovery: null, restingHr: r.rhr ?? null, hrv: null, skinTemp: r.temp ?? null, spo2: null,
    respRate: null, sleepPerformance: null, sleepHours: null, strain: null, kilojoule: null,
  }));
}

/** Period starts = first day of each menstruation run (needs ≥ 10 non-bleeding days between runs). */
export function cycleWindowsFromBleeding(rows: ParticipantDay[]): CycleWindow[] {
  const sorted = [...rows].sort((a, b) => a.day - b.day);
  const starts: number[] = [];
  let lastBleed = -999;
  for (const r of sorted) {
    if (!r.menstruating) continue;
    if (r.day - lastBleed >= 10) starts.push(r.day);
    lastBleed = r.day;
  }
  const out: CycleWindow[] = [];
  for (let i = 0; i + 1 < starts.length; i++) {
    const len = starts[i + 1] - starts[i];
    if (len < 18 || len > 50) continue; // skip gaps in data / implausible cycles
    out.push({ start: dayToIso(starts[i]), end: dayToIso(starts[i + 1] - 1), complete: true });
  }
  return out;
}

export interface Reference { ovulationIso: string | null }

export function referenceOvulation(rows: ParticipantDay[], win: CycleWindow): Reference {
  const s = Date.parse(`${win.start}T00:00:00Z`), e = Date.parse(`${win.end}T00:00:00Z`);
  const inCycle = rows.filter((r) => {
    const t = BASE + r.day * 86_400_000;
    return t >= s && t <= e && r.lh != null;
  }).sort((a, b) => a.day - b.day);
  if (inCycle.length < 8) return { ovulationIso: null };
  const lhs = inCycle.map((r) => r.lh!).sort((a, b) => a - b);
  const median = lhs[Math.floor(lhs.length / 2)];
  const startDay = inCycle[0].day, endDay = inCycle[inCycle.length - 1].day;
  const core = inCycle.filter((r) => r.day - startDay >= 5 && endDay - r.day >= 5);
  if (!core.length) return { ovulationIso: null };
  const peak = core.reduce((a, b) => (b.lh! > a.lh! ? b : a));
  if (peak.lh! < 2 * median) return { ovulationIso: null };
  return { ovulationIso: dayToIso(peak.day + 1) };
}

export interface EvalResult {
  params: OvulationParams;
  cyclesWithSurge: number;
  cyclesWithoutSurge: number;
  sensitivity: number;      // surge cycles where we confirmed ovulation
  within2Days: number;      // of surge cycles, share confirmed within ±2 days of reference
  meanAbsErrorDays: number | null;
  falsePositiveRate: number | null; // no-surge cycles we called ovulatory
  score: number;
}

export function evaluate(participants: ParticipantDay[][], params: OvulationParams): EvalResult {
  let surge = 0, noSurge = 0, hits = 0, within2 = 0, fp = 0;
  const errs: number[] = [];
  for (const rows of participants) {
    const days = toPhysiology([...rows].sort((a, b) => a.day - b.day));
    for (const w of cycleWindowsFromBleeding(rows)) {
      const ref = referenceOvulation(rows, w);
      const det = detectOvulation(days, w, params);
      if (det.status === "insufficient_data") continue;
      if (ref.ovulationIso) {
        surge++;
        if (det.status === "confirmed" && det.ovulationDate) {
          hits++;
          const err = Math.round((Date.parse(det.ovulationDate) - Date.parse(ref.ovulationIso)) / 86_400_000);
          errs.push(Math.abs(err));
          if (Math.abs(err) <= 2) within2++;
        }
      } else {
        noSurge++;
        if (det.status === "confirmed") fp++;
      }
    }
  }
  const sensitivity = surge ? hits / surge : 0;
  const w2 = surge ? within2 / surge : 0;
  const fpr = noSurge ? fp / noSurge : null;
  return {
    params, cyclesWithSurge: surge, cyclesWithoutSurge: noSurge,
    sensitivity: +sensitivity.toFixed(3), within2Days: +w2.toFixed(3),
    meanAbsErrorDays: errs.length ? +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(2) : null,
    falsePositiveRate: fpr == null ? null : +fpr.toFixed(3),
    // Reward accurate timing, penalise calling anovulatory cycles ovulatory
    score: +(w2 + 0.3 * sensitivity - 0.5 * (fpr ?? 0)).toFixed(4),
  };
}

export function gridSearch(participants: ParticipantDay[][]): EvalResult[] {
  const results: EvalResult[] = [];
  for (const eachAbove of [0.05, 0.1, 0.15])
    for (const meanRise of [0.1, 0.15, 0.2, 0.25, 0.3])
      for (const sustainRise of [0.1, 0.15, 0.2])
        if (meanRise >= eachAbove) results.push(evaluate(participants, { eachAbove, meanRise, sustainRise }));
  return results.sort((a, b) => b.score - a.score);
}

// ── CSV helpers (used by the CLI and tests) ──────────────────
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

/** First header matching any candidate (case-insensitive, exact then substring). */
export function pickColumn(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) { const i = lower.indexOf(c.toLowerCase()); if (i >= 0) return headers[i]; }
  for (const c of candidates) { const i = lower.findIndex((h) => h.includes(c.toLowerCase())); if (i >= 0) return headers[i]; }
  return null;
}
