/**
 * Demo WHOOP data for judges and users without a band.
 * Produces 90 days of v2-shaped records that tell the Glitch story:
 *   • resting HR drifts down and HRV up over 90 days (habits working)
 *   • for menstruating users: progesterone raises skin temp / RHR and lowers HRV after ovulation,
 *     and the OLDEST cycle has no temperature shift — an anovulatory cycle, as often seen in PCOS —
 *     while later cycles ovulate again.
 *   • zone-2 cardio minutes climb week over week.
 * Seeded, so the demo looks the same every time.
 */
import type { WhoopData, WhoopRecovery, WhoopSleep, WhoopCycle, WhoopWorkout, DailyPhysiology } from "./types";

const DAY = 86_400_000;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export interface DemoOptions {
  days?: number;
  menstruating: boolean;
  /** Most recent period start, YYYY-MM-DD. Cycles are laid out backwards from here. */
  lastPeriodDate?: string;
  cycleLength?: number;
  age: number;
  today?: Date;
  /** Peri/post-menopause: adds warm, disrupted nights (night sweats) that ease as habits improve */
  menopausal?: boolean;
  /** Personalises the dataset so two different people don't get identical numbers (deterministic). */
  seed?: number;
  /** Body metrics so the demo reflects this user (defaults to typical values). */
  heightMeter?: number;
  weightKg?: number;
}

/** Deterministic seed from a profile's stable fields, so each person gets consistent-but-distinct data. */
export function demoSeedFrom(parts: { name?: string; age?: number; heightCm?: number; weightKg?: number }): number {
  const key = `${parts.name ?? ""}|${parts.age ?? 0}|${parts.heightCm ?? 0}|${parts.weightKg ?? 0}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100000 || 42;
}

export function generateDemoWhoop(opts: DemoOptions): WhoopData {
  const days = opts.days ?? 90;
  const cycleLength = opts.cycleLength ?? 29;
  const rand = rng(opts.seed ?? 42);
  const noise = (amp: number) => (rand() - 0.5) * 2 * amp;
  const today = opts.today ?? new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const lastPeriod = opts.lastPeriodDate ? Date.parse(`${opts.lastPeriodDate}T00:00:00Z`) : todayUtc - 10 * DAY;
  const firstDay = todayUtc - (days - 1) * DAY;

  // Work out which cycle (counting back from the most recent) each day belongs to
  const cycleInfo = (t: number) => {
    const k = Math.floor((t - lastPeriod) / (cycleLength * DAY)); // 0 = current, -1 = previous…
    const start = lastPeriod + k * cycleLength * DAY;
    return { k, cycleDay: Math.round((t - start) / DAY) + 1 };
  };
  const oldestK = cycleInfo(firstDay).k;
  // The oldest *complete* cycle in the window is the anovulatory one
  const anovulatoryK = cycleInfo(firstDay).cycleDay === 1 ? oldestK : oldestK + 1;
  const ovulationDay = cycleLength - 14;

  const recoveries: WhoopRecovery[] = [];
  const sleeps: WhoopSleep[] = [];
  const cycles: WhoopCycle[] = [];
  const workouts: WhoopWorkout[] = [];

  let sleepDebt = 0;
  for (let i = 0; i < days; i++) {
    const t = firstDay + i * DAY;
    const progress = i / (days - 1); // 0 → 1 over the window

    // Baseline improvement from habit change, nudged by age (older → a bit higher RHR, lower HRV)
    const ageAdj = (opts.age - 35) * 0.12;
    let rhr = 72 - 8 * progress + ageAdj + noise(1.6);
    let hrv = 36 + 16 * progress - (opts.age - 35) * 0.25 + noise(5);
    let temp = 33.6 + noise(0.08);
    let resp = 15.2 + noise(0.3);

    if (opts.menstruating) {
      const { k, cycleDay } = cycleInfo(t);
      const ovulates = k !== anovulatoryK;
      if (ovulates && cycleDay > ovulationDay) {
        // Luteal phase: progesterone effect, ramping in over ~2 days
        const ramp = Math.min(1, (cycleDay - ovulationDay) / 2);
        temp += 0.38 * ramp;
        rhr += 2.8 * ramp;
        hrv -= 7 * ramp;
        resp += 0.4 * ramp;
      }
      if (cycleDay <= 2) hrv -= 3; // period start
    }

    // A rough week ~8 weeks ago (deadline stress) for the stress chart to pick up
    if (i >= days - 58 && i < days - 53) { hrv -= 9; rhr += 3; sleepDebt += 1.5; }
    // Occasional bad nights (late screens, stress, a sick kid…), more common before habits improved
    const badNight = rand() < 0.16 - 0.06 * progress;
    if (badNight) { hrv -= 5; rhr += 1.5; }
    // Night sweats: warm skin + wake-ups, more frequent early on (before trigger changes kicked in)
    const sweatNight = !!opts.menopausal && rand() < 0.42 - 0.14 * progress;
    if (sweatNight) { temp += 0.5 + rand() * 0.25; hrv -= 4; rhr += 1.5; }

    const sleepPerf = Math.round(Math.max(48, Math.min(98, 82 - sleepDebt * 8 + 8 * progress + noise(8) - (badNight ? 20 : 0) - (sweatNight ? 18 : 0))));
    sleepDebt = Math.max(0, sleepDebt * 0.6);
    const hrvMs = Math.max(15, hrv);
    const recovery = Math.round(Math.max(8, Math.min(99, 47 + (hrvMs - 30) * 1.0 - (rhr - 58) * 1.2 + (sleepPerf - 75) * 0.5 + noise(6))));

    const wake = t + 6.75 * 3_600_000 + noise(0.4) * 3_600_000;
    const sleepHours = 6.4 + 1.2 * (sleepPerf / 100) + noise(0.3);
    const sleepStart = wake - sleepHours * 3_600_000 - 25 * 60_000;
    const cycleId = 1_000_000 + i;
    const sleepId = `demo-sleep-${i}`;
    const inBed = wake - sleepStart;
    const awake = 25 * 60_000 + noise(8) * 60_000;
    const asleep = inBed - awake;

    sleeps.push({
      id: sleepId, cycle_id: cycleId, start: new Date(sleepStart).toISOString(), end: new Date(wake).toISOString(),
      nap: false, score_state: "SCORED",
      score: {
        stage_summary: {
          total_in_bed_time_milli: Math.round(inBed),
          total_awake_time_milli: Math.round(awake),
          total_light_sleep_time_milli: Math.round(asleep * 0.52),
          total_slow_wave_sleep_time_milli: Math.round(asleep * 0.22),
          total_rem_sleep_time_milli: Math.round(asleep * 0.26),
          disturbance_count: Math.round(8 + noise(4) + (sweatNight ? 10 : 0)),
        },
        respiratory_rate: +resp.toFixed(1),
        sleep_performance_percentage: sleepPerf,
        sleep_consistency_percentage: Math.round(70 + 15 * progress + noise(6)),
        sleep_efficiency_percentage: Math.round((sweatNight ? 77 : 88) + noise(4)),
      },
    });

    recoveries.push({
      cycle_id: cycleId, sleep_id: sleepId, created_at: new Date(wake + 5 * 60_000).toISOString(), score_state: "SCORED",
      score: {
        user_calibrating: i < 4,
        recovery_score: recovery,
        resting_heart_rate: Math.round(rhr),
        hrv_rmssd_milli: +hrvMs.toFixed(1),
        spo2_percentage: +(96.5 + noise(1)).toFixed(1),
        skin_temp_celsius: +temp.toFixed(2),
      },
    });

    // Workouts: frequency and zone-2 time rise with progress
    const dow = new Date(t).getUTCDay();
    const trainingDay = dow === 1 || dow === 3 || dow === 6 || (progress > 0.4 && dow === 5);
    let strain = 6 + noise(2);
    if (trainingDay && i < days - 1) {
      const minutes = 25 + 25 * progress + noise(6);
      const z2 = minutes * (0.35 + 0.25 * progress);
      const start = wake + 10 * 3_600_000;
      const wStrain = 8 + 5 * progress + noise(1.5);
      strain = Math.min(21, strain + wStrain * 0.8);
      const m = (x: number) => Math.round(Math.max(0, x) * 60_000);
      workouts.push({
        id: `demo-workout-${i}`, start: new Date(start).toISOString(), end: new Date(start + minutes * 60_000).toISOString(),
        sport_name: dow === 6 ? "running" : progress > 0.5 && dow === 3 ? "functional-fitness" : "walking",
        score_state: "SCORED",
        score: {
          strain: +wStrain.toFixed(1), average_heart_rate: Math.round(120 + 15 * progress), max_heart_rate: Math.round(155 + 10 * progress),
          kilojoule: Math.round(minutes * 32),
          zone_durations: {
            zone_zero_milli: m(minutes * 0.05), zone_one_milli: m(minutes * 0.3 - z2 * 0.2),
            zone_two_milli: m(z2), zone_three_milli: m(minutes * 0.15),
            zone_four_milli: m(minutes * 0.05), zone_five_milli: m(minutes * 0.01),
          },
        },
      });
    }
    const isToday = i === days - 1;
    cycles.push({
      id: cycleId, start: new Date(wake).toISOString(), end: isToday ? undefined : new Date(wake + DAY).toISOString(),
      score_state: "SCORED",
      score: {
        strain: +(isToday ? Math.min(strain, 5.5) : strain).toFixed(1),
        kilojoule: Math.round(7600 + strain * 220 + noise(400)),
        average_heart_rate: Math.round(rhr + 14),
        max_heart_rate: Math.round(140 + strain * 2),
      },
    });
  }

  return {
    source: "demo",
    syncedAt: new Date().toISOString(),
    recoveries: recoveries.reverse(), // WHOOP returns newest first
    sleeps: sleeps.reverse(),
    cycles: cycles.reverse(),
    workouts: workouts.reverse(),
    body: { height_meter: opts.heightMeter ?? 1.65, weight_kilogram: opts.weightKg ?? 72, max_heart_rate: Math.round(208 - 0.7 * opts.age) },
  };
}

/**
 * Demo mood check-ins (1–5) that follow the same story as the demo physiology: mood dips after
 * poor sleep and on low-HRV days, and — for menstruating users — in the week before a period.
 * Shown only in demo mode; never written into the user's own log.
 */
export function generateDemoMoods(days: DailyPhysiology[], periodStarts: string[]): { date: string; mood: number }[] {
  const rand = rng(7);
  const hrvs = days.map((d) => d.hrv ?? 0);
  const out: { date: string; mood: number }[] = [];
  const starts = periodStarts.map((s) => Date.parse(`${s}T00:00:00Z`)).sort((a, b) => a - b);
  days.forEach((d, i) => {
    if (rand() < 0.2) return; // people don't check in every day
    const t = Date.parse(`${d.date}T00:00:00Z`);
    let mood = 3.1 + (i / days.length) * 0.7;
    if (d.sleepPerformance != null && d.sleepPerformance < 70) mood -= 1.1;
    const recent = hrvs.slice(Math.max(0, i - 14), i);
    const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : hrvs[i];
    if (d.hrv != null && d.hrv < avg * 0.82) mood -= 0.8;
    const nextStart = starts.find((s) => s > t);
    if (nextStart != null && (nextStart - t) / DAY <= 7) mood -= 1.6;
    mood += (rand() - 0.5) * 0.8;
    out.push({ date: d.date, mood: Math.max(1, Math.min(5, Math.round(mood))) });
  });
  return out;
}

/**
 * Demo hot-flash log for menopause mode: a few daytime flashes most days, more after night-sweat
 * nights and on high-stress days. Shown only in demo mode.
 */
export function generateDemoHotFlashes(days: DailyPhysiology[], warmDates: Set<string>, stressDates: Set<string>, wineDates: Set<string> = new Set()): { id: string; at: string; intensity: 1 | 2 | 3; night?: boolean }[] {
  const rand = rng(99);
  const out: { id: string; at: string; intensity: 1 | 2 | 3; night?: boolean }[] = [];
  days.slice(-30).forEach((d, i) => {
    let n = Math.floor(rand() * 2.2);
    if (warmDates.has(d.date)) n += 2;
    if (stressDates.has(d.date)) n += 1;
    if (wineDates.has(d.date)) n += 3;
    for (let k = 0; k < n; k++) {
      const hour = 9 + Math.floor(rand() * 12);
      out.push({ id: `demo-flash-${i}-${k}`, at: `${d.date}T${String(hour).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00`, intensity: (1 + Math.floor(rand() * 3)) as 1 | 2 | 3 });
    }
    if (warmDates.has(d.date)) out.push({ id: `demo-flash-${i}-n`, at: `${d.date}T03:10:00`, intensity: 3, night: true });
  });
  return out;
}

/** Demo-only evening drinks on a handful of recent days, so trigger detection has something to find. */
export function generateDemoTriggerMeals(days: DailyPhysiology[]): { name: string; loggedAt: string }[] {
  const rand = rng(2024);
  return days.slice(-30).filter(() => rand() < 0.22).map((d) => ({ name: "Glass of red wine", loggedAt: `${d.date}T19:45:00` }));
}

/** Demo home BP readings every ~2–3 days: drifting from normal into stage-1 range (heart risk after menopause). */
export function generateDemoBp(today = new Date()): { at: string; systolic: number; diastolic: number }[] {
  const rand = rng(31);
  const out: { at: string; systolic: number; diastolic: number }[] = [];
  for (let d = 29; d >= 0; d -= 2 + Math.floor(rand() * 2)) {
    const drift = (29 - d) / 29;
    const t = new Date(today.getTime() - d * DAY);
    t.setHours(8, 10, 0, 0);
    out.push({ at: t.toISOString(), systolic: Math.round(122 + 12 * drift + (rand() - 0.5) * 8), diastolic: Math.round(78 + 7 * drift + (rand() - 0.5) * 6) });
  }
  return out;
}
