/**
 * Luna — App Context (Dexie-backed, persistent)
 * Loads everything from IndexedDB on mount; all mutations write through.
 */
import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from "react";
import { db } from "@/db/database";
import {
  profileRepo, periodsRepo, checkinsRepo, biometricsRepo, hotFlashesRepo,
  mealsRepo, workoutsRepo, supplementsRepo, recordsRepo,
  getCycleWindows, getCycleStats, CycleWindow,
} from "@/db/repositories";
import type {
  UserProfile, PeriodEntry, CycleCheckin, BiometricEntry, HotFlashEvent,
  Meal, WorkoutLog, Supplement, HealthRecord, HealthMode,
} from "@/db/types";
import { seedSampleData, syncWhoopData, isWhoopConnected } from "@/lib/whoop";
import { getCycleDay, getCyclePhase, predictNextPeriod } from "@/lib/cycleEngine";
import { CYCLE } from "@/data/references";
import type { CyclePhase, PeriodPrediction } from "@/db/types";

interface AppState {
  ready: boolean;
  profile: UserProfile | null;
  periods: PeriodEntry[];
  checkins: CycleCheckin[];
  biometrics: BiometricEntry[];
  hotFlashes: HotFlashEvent[];
  meals: Meal[];
  workouts: WorkoutLog[];
  supplements: Supplement[];
  records: HealthRecord[];
  cycleWindows: CycleWindow[];
  cycleStats: { count: number; mean: number | null; sd: number | null; lengths: number[] };
  whoopConnected: boolean;
  usingSample: boolean;
}

interface AppContextType extends AppState {
  // derived
  cycleDay: number | null;
  cyclePhase: CyclePhase | null;
  cycleLength: number;
  prediction: PeriodPrediction | null;
  todayMood: number | undefined;
  // actions
  completeOnboarding: (p: Omit<UserProfile, "id" | "createdAt">) => Promise<void>;
  reload: () => Promise<void>;
  addPeriod: (e: Omit<PeriodEntry, "id">) => Promise<void>;
  removePeriod: (id: number) => Promise<void>;
  saveCheckin: (e: Omit<CycleCheckin, "id">) => Promise<void>;
  logHotFlash: (e: Omit<HotFlashEvent, "id">) => Promise<void>;
  addMeal: (m: Omit<Meal, "id">) => Promise<void>;
  addWorkout: (w: Omit<WorkoutLog, "id">) => Promise<void>;
  toggleWorkout: (id: number, completed: boolean) => Promise<void>;
  addSupplement: (s: Omit<Supplement, "id">) => Promise<void>;
  removeSupplement: (id: number) => Promise<void>;
  addRecord: (r: Omit<HealthRecord, "id">) => Promise<void>;
  removeRecord: (id: number) => Promise<void>;
  connectWhoop: () => Promise<void>;
  resyncWhoop: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);
const todayISO = () => new Date().toISOString().split("T")[0];

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [periods, setPeriods] = useState<PeriodEntry[]>([]);
  const [checkins, setCheckins] = useState<CycleCheckin[]>([]);
  const [biometrics, setBiometrics] = useState<BiometricEntry[]>([]);
  const [hotFlashes, setHotFlashes] = useState<HotFlashEvent[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [cycleWindows, setCycleWindows] = useState<CycleWindow[]>([]);
  const [cycleStats, setCycleStats] = useState<AppState["cycleStats"]>({ count: 0, mean: null, sd: null, lengths: [] });
  const [whoopConnected, setWhoopConnected] = useState(false);

  const reload = useCallback(async () => {
    const [p, per, ch, bio, hf, ml, wo, sup, rec, win, stats, wc] = await Promise.all([
      profileRepo.get(), periodsRepo.all(), checkinsRepo.all(), biometricsRepo.all(),
      hotFlashesRepo.all(), mealsRepo.byDate(todayISO()), workoutsRepo.all(),
      supplementsRepo.all(), recordsRepo.all(), getCycleWindows(), getCycleStats(),
      isWhoopConnected(),
    ]);
    setProfile(p ?? null);
    setPeriods(per); setCheckins(ch); setBiometrics(bio); setHotFlashes(hf);
    setMeals(ml); setWorkouts(wo); setSupplements(sup); setRecords(rec);
    setCycleWindows(win); setCycleStats(stats); setWhoopConnected(wc);
  }, []);

  useEffect(() => {
    (async () => { await reload(); setReady(true); })();
  }, [reload]);

  const completeOnboarding = useCallback(async (p: Omit<UserProfile, "id" | "createdAt">) => {
    await profileRepo.save({ ...p, createdAt: new Date().toISOString() });
    // Seed labeled sample data so the app has an immediate story (WHOOP optional).
    await seedSampleData(p.healthMode);
    await reload();
  }, [reload]);

  const addPeriod = useCallback(async (e: Omit<PeriodEntry, "id">) => { await periodsRepo.add(e); await reload(); }, [reload]);
  const removePeriod = useCallback(async (id: number) => { await periodsRepo.remove(id); await reload(); }, [reload]);
  const saveCheckin = useCallback(async (e: Omit<CycleCheckin, "id">) => { await checkinsRepo.upsert(e); await reload(); }, [reload]);
  const logHotFlash = useCallback(async (e: Omit<HotFlashEvent, "id">) => { await hotFlashesRepo.add(e); await reload(); }, [reload]);
  const addMeal = useCallback(async (m: Omit<Meal, "id">) => { await mealsRepo.add(m); await reload(); }, [reload]);
  const addWorkout = useCallback(async (w: Omit<WorkoutLog, "id">) => { await workoutsRepo.add(w); await reload(); }, [reload]);
  const toggleWorkout = useCallback(async (id: number, completed: boolean) => { await workoutsRepo.update(id, { completed }); await reload(); }, [reload]);
  const addSupplement = useCallback(async (s: Omit<Supplement, "id">) => { await supplementsRepo.add(s); await reload(); }, [reload]);
  const removeSupplement = useCallback(async (id: number) => { await supplementsRepo.remove(id); await reload(); }, [reload]);
  const addRecord = useCallback(async (r: Omit<HealthRecord, "id">) => { await recordsRepo.add(r); await reload(); }, [reload]);
  const removeRecord = useCallback(async (id: number) => { await recordsRepo.remove(id); await reload(); }, [reload]);

  const connectWhoop = useCallback(async () => {
    const { getWhoopAuthUrl } = await import("@/lib/whoop");
    window.location.href = getWhoopAuthUrl();
  }, []);

  const resyncWhoop = useCallback(async () => {
    await syncWhoopData();
    await reload();
  }, [reload]);

  // ── Derived cycle state ────────────────────────────────────
  const cycleLength: number = profile?.cycleLength ?? CYCLE.DEFAULT_LENGTH;
  const lastPeriod = periods.length ? periods[periods.length - 1].startDate : null;
  const cycleDay = lastPeriod ? getCycleDay(lastPeriod, cycleLength) : null;
  const cyclePhase = cycleDay ? getCyclePhase(cycleDay, cycleLength) : null;
  const prediction = predictNextPeriod(periods, cycleStats, cycleLength);
  const usingSample = !whoopConnected && biometrics.some((b) => b.source === "sample");
  const todayMood = checkins.find((c) => c.date === todayISO())?.mood;

  return (
    <AppContext.Provider value={{
      ready, profile, periods, checkins, biometrics, hotFlashes, meals, workouts,
      supplements, records, cycleWindows, cycleStats, whoopConnected, usingSample,
      cycleDay, cyclePhase, cycleLength, prediction, todayMood,
      completeOnboarding, reload, addPeriod, removePeriod, saveCheckin, logHotFlash,
      addMeal, addWorkout, toggleWorkout, addSupplement, removeSupplement,
      addRecord, removeRecord, connectWhoop, resyncWhoop,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// Re-export engine helpers + types for convenience
export { getCycleDay, getCyclePhase, getNextPeriodDate, getOvulationEstimate } from "@/lib/cycleEngine";
export { db };
export type {
  UserProfile, PeriodEntry, CycleCheckin, BiometricEntry, HotFlashEvent,
  Meal, WorkoutLog, Supplement, HealthRecord, HealthMode, CyclePhase,
  FitnessGoal, Equipment, WorkoutStyle, BiologicalSex, PmsSymptom,
  MenopauseSymptom, HealthCondition, FlowLevel, PeriodPrediction,
  SignalTrend, PatternFlag, Confidence,
} from "@/db/types";
