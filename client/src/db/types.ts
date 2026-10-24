/**
 * Luna — Shared domain types
 * Single source of truth for data shapes used across DB, engines, and UI.
 */

// ── User profile & modes ─────────────────────────────────────
export type BiologicalSex = "female" | "male" | "prefer_not_to_say";

/**
 * The reproductive-health MODE drives which features show.
 * - cycling:    regular menstrual cycles
 * - irregular:  irregular cycles (PCOS emphasis)
 * - pcos:       self-reported PCOS
 * - menopause:  peri/menopause module replaces cycle tracking
 * - pregnancy:  logging + support only
 * - none:       fitness/nutrition only (male or opted out) — NO reproductive UI
 */
export type HealthMode =
  | "cycling"
  | "irregular"
  | "pcos"
  | "menopause"
  | "pregnancy"
  | "none";

export type FitnessGoal =
  | "lose_weight"
  | "maintain"
  | "build_muscle"
  | "manage_diabetes"
  | "bone_strength";

export type Equipment =
  | "none" | "dumbbells" | "resistance_bands" | "full_gym" | "kettlebells" | "pull_up_bar";

export type WorkoutStyle =
  | "calisthenics" | "weight_training" | "yoga" | "running" | "hiit" | "pilates" | "walking";

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export type PmsSymptom =
  | "mood_swings" | "bloating" | "cravings" | "fatigue" | "headaches"
  | "anxiety" | "acne" | "breast_tenderness" | "sleep_disturbances";

export type MenopauseSymptom =
  | "hot_flashes" | "night_sweats" | "sleep_issues" | "mood_changes"
  | "joint_pain" | "brain_fog" | "low_energy" | "anxiety" | "palpitations";

export type HealthCondition =
  | "pcos" | "endometriosis" | "heavy_periods" | "irregular_cycles"
  | "thyroid" | "diabetes" | "hypertension" | "none";

export type RaceEthnicity =
  | "asian" | "black" | "hispanic" | "white" | "middle_eastern"
  | "native" | "pacific_islander" | "multiracial" | "other" | "prefer_not_to_say";

export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export interface UserProfile {
  id?: number;              // single row, id=1
  name: string;
  age: number;
  weight: number;           // kg
  height: number;           // cm
  biologicalSex: BiologicalSex;
  raceEthnicity?: RaceEthnicity;
  fitnessLevel?: FitnessLevel;
  healthMode: HealthMode;
  goal: FitnessGoal;
  equipment: Equipment[];
  workoutStyles: WorkoutStyle[];
  // cycle-related (present for cycling/irregular/pcos)
  cycleLength?: number;
  commonSymptoms?: PmsSymptom[];
  // menopause-related
  menopauseSymptoms?: MenopauseSymptom[];
  healthConditions?: HealthCondition[];
  consentWhoop?: boolean;
  consentRecords?: boolean;
  createdAt: string;
}

// ── Periods & cycle logging ──────────────────────────────────
export type FlowLevel = "spotting" | "light" | "medium" | "heavy";

export interface PeriodEntry {
  id?: number;
  startDate: string;        // ISO date (yyyy-mm-dd)
  endDate?: string;
  flow?: FlowLevel;
  notes?: string;
}

export interface CycleCheckin {
  id?: number;
  date: string;             // ISO date — one per day
  cycleDay?: number;
  mood: number;             // 1–5
  energy: number;           // 1–5
  stress: number;           // 1–5
  bloating: number;         // 1–5
  cramps: number;           // 1–5
  cravings: number;         // 1–5
  sleepQuality: number;     // 1–5
  symptoms: (PmsSymptom | MenopauseSymptom)[];
  notes?: string;
}

// ── Biometrics (WHOOP or sample) — the hero signals ──────────
export type BiometricSource = "whoop" | "sample" | "manual";

export interface BiometricEntry {
  id?: number;
  date: string;             // ISO date — one per day
  source: BiometricSource;
  skinTempC?: number;       // recovery.score.skin_temp_celsius
  restingHr?: number;       // recovery.score.resting_heart_rate
  avgHr?: number;           // cycle.score.average_heart_rate
  hrvMs?: number;           // recovery.score.hrv_rmssd_milli
  respRate?: number;        // sleep.score.respiratory_rate
  spo2?: number;
  recoveryScore?: number;   // 0–100
  strain?: number;          // 0–21
  sleepPerformance?: number;// %
  sleepDisturbances?: number; // count (fragmentation)
  sleepEfficiency?: number;   // %
  nightTempC?: number;        // mean skin temp during sleep window (night sweats)
  steps?: number;
}

export interface HotFlashEvent {
  id?: number;
  timestamp: string;        // ISO datetime
  source: "manual" | "detected";
  intensity?: number;       // 1–5 (manual)
  tempSpikeC?: number;      // detected
  hrJumpBpm?: number;       // detected
  note?: string;
}

// ── Nutrition / fitness ──────────────────────────────────────
export interface Meal {
  id?: number;
  date: string;
  type: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  omega3: number;
  iron?: number;
  calcium?: number;
  mood?: string;            // emotional-eating context: stressed/sad/bored/happy...
  time: string;
}

export interface WorkoutLog {
  id?: number;
  date: string;
  name: string;
  type: WorkoutStyle | "other";
  durationMin?: number;
  sets?: number;
  reps?: number;
  weightKg?: number;
  perceivedEffort?: number; // 1–10 RPE — key for the "felt harder" cycle correlation
  cycleDay?: number;
  completed: boolean;
  notes?: string;
}

export interface Supplement {
  id?: number;
  name: string;
  dose: string;
  time: string;
  emoji: string;
}

// ── Uploaded health records ──────────────────────────────────
export type RecordKind = "file" | "value";

export interface HealthRecord {
  id?: number;
  kind: RecordKind;
  label: string;            // e.g. "Blood pressure", "Thyroid panel"
  // for kind=value:
  value?: string;
  unit?: string;
  // for kind=file:
  fileName?: string;
  mimeType?: string;
  blob?: Blob;              // stored locally in IndexedDB, never uploaded anywhere
  date: string;
  notes?: string;
}

// ── WHOOP auth ───────────────────────────────────────────────
export interface WhoopTokens {
  id?: number;              // single row, id=1
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;        // epoch ms
  scope: string;
}

// ── Engine outputs ───────────────────────────────────────────
export type Confidence = "low" | "moderate" | "high";

export interface PeriodPrediction {
  rangeStart: Date;
  rangeEnd: Date;
  mostLikely: Date;
  confidence: Confidence;
  basis: string;            // plain-language explanation
}

export interface SignalTrendPoint {
  date: string;
  value: number;
  baseline: number;
  phase?: CyclePhase;
}

export interface SignalTrend {
  signal: "skinTempC" | "restingHr" | "hrvMs" | "respRate" | "avgHr";
  label: string;
  unit: string;
  points: SignalTrendPoint[];
  direction: "up" | "down" | "stable";
  deltaFromBaseline: number;
}

export interface PatternFlag {
  flag: string;             // short title
  detail: string;           // plain-language, "discuss with a clinician"
  confidence: Confidence;
  severity: "info" | "watch";
}

export interface CorrelationInsight {
  title: string;            // "Your energy tracked your HRV drop"
  detail: string;
  signalA: string;
  signalB: string;
  strength: number;         // 0–1
}

// ── Menopause module outputs ─────────────────────────────────
export type PerimenopauseStage = "unlikely" | "possible_early" | "likely_peri" | "established";

export interface PerimenopauseAssessment {
  stage: PerimenopauseStage;
  ageBasedLikelihood: Confidence;  // from age alone
  score: number;                   // 0–100 composite (not diagnostic)
  contributors: string[];          // plain-language factors
  headline: string;                // e.g. "You may be entering perimenopause"
  alert: boolean;                  // triggers a notification
}

export interface MentalHealthCheck {
  hrvTrend: "up" | "down" | "stable";
  bp?: { systolic: number; diastolic: number; flag: "normal" | "elevated" | "high" };
  prompt: string;                  // when-to-seek-help / supportive prompt
  needsAttention: boolean;
}
