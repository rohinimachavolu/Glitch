/**
 * WHOOP Developer API v2 response shapes (only the fields Glitch uses).
 * Docs: https://developer.whoop.com/api/
 * Note: a WHOOP "cycle" is a physiological day (wake → wake), not a menstrual cycle.
 */

export type ScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE";

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: string;
  created_at: string;
  score_state: ScoreState;
  score?: {
    user_calibrating: boolean;
    recovery_score: number;       // 0–100
    resting_heart_rate: number;   // bpm
    hrv_rmssd_milli: number;      // ms
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface WhoopSleep {
  id: string;
  cycle_id: number;
  start: string;
  end: string;
  nap: boolean;
  score_state: ScoreState;
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      disturbance_count: number;
    };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  };
}

export interface WhoopCycle {
  id: number;
  start: string;
  end?: string;
  score_state: ScoreState;
  score?: {
    strain: number;               // 0–21
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

export interface WhoopWorkout {
  id: string;
  start: string;
  end: string;
  sport_name: string;
  score_state: ScoreState;
  score?: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    zone_durations: {
      zone_zero_milli: number;
      zone_one_milli: number;
      zone_two_milli: number;
      zone_three_milli: number;
      zone_four_milli: number;
      zone_five_milli: number;
    };
  };
}

export interface WhoopBody {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

export interface WhoopData {
  source: "demo" | "live";
  syncedAt: string;
  recoveries: WhoopRecovery[];
  sleeps: WhoopSleep[];
  cycles: WhoopCycle[];
  workouts: WhoopWorkout[];
  body: WhoopBody | null;
}

/** One row per calendar day — the shape every metric in healthMetrics.ts works on. */
export interface DailyPhysiology {
  date: string;              // YYYY-MM-DD (local wake-up day)
  recovery: number | null;
  restingHr: number | null;
  hrv: number | null;
  skinTemp: number | null;
  spo2: number | null;
  respRate: number | null;
  sleepPerformance: number | null;
  sleepHours: number | null;
  strain: number | null;
  kilojoule: number | null;
  /** Sleep disturbances (wake events) — useful for spotting night sweats */
  disturbances?: number | null;
  sleepEfficiency?: number | null;
}

const dayOf = (iso: string) => iso.slice(0, 10);

/** Join WHOOP's separate collections into one row per day. */
export function toDaily(data: WhoopData): DailyPhysiology[] {
  const byDay = new Map<string, DailyPhysiology>();
  const row = (date: string) => {
    let r = byDay.get(date);
    if (!r) {
      r = { date, recovery: null, restingHr: null, hrv: null, skinTemp: null, spo2: null, respRate: null, sleepPerformance: null, sleepHours: null, strain: null, kilojoule: null };
      byDay.set(date, r);
    }
    return r;
  };

  const sleepById = new Map(data.sleeps.map((s) => [s.id, s]));
  for (const rec of data.recoveries) {
    if (rec.score_state !== "SCORED" || !rec.score) continue;
    const sleep = sleepById.get(rec.sleep_id);
    const r = row(dayOf(sleep?.end ?? rec.created_at));
    r.recovery = rec.score.recovery_score;
    r.restingHr = rec.score.resting_heart_rate;
    r.hrv = rec.score.hrv_rmssd_milli;
    r.skinTemp = rec.score.skin_temp_celsius ?? null;
    r.spo2 = rec.score.spo2_percentage ?? null;
  }
  for (const s of data.sleeps) {
    if (s.nap || s.score_state !== "SCORED" || !s.score) continue;
    const r = row(dayOf(s.end));
    const st = s.score.stage_summary;
    r.respRate = s.score.respiratory_rate;
    r.sleepPerformance = s.score.sleep_performance_percentage;
    r.sleepHours = (st.total_in_bed_time_milli - st.total_awake_time_milli) / 3_600_000;
    r.disturbances = st.disturbance_count;
    r.sleepEfficiency = s.score.sleep_efficiency_percentage;
  }
  for (const c of data.cycles) {
    if (c.score_state !== "SCORED" || !c.score) continue;
    const r = row(dayOf(c.start));
    r.strain = c.score.strain;
    r.kilojoule = c.score.kilojoule;
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
