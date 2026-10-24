/**
 * NutriSense AI — App Context (AI-powered + Women's Health)
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  generateNutritionGoals,
  generateExercisePlan,
  NutritionGoals,
  Exercise,
} from "@/lib/aiService";

export type FitnessGoal =
  | "lose_weight"
  | "maintain"
  | "build_muscle"
  | "manage_diabetes";

export type Equipment = "none" | "dumbbells" | "resistance_bands" | "full_gym" | "kettlebells" | "pull_up_bar";
export type WorkoutStyle = "calisthenics" | "weight_training" | "yoga" | "running" | "hiit" | "pilates";
export type BiologicalSex = "female" | "male" | "prefer_not_to_say";
export type CycleStatus = "yes" | "no" | "irregular";
export type PmsSymptom = "mood_swings" | "bloating" | "cravings" | "fatigue" | "headaches" | "anxiety" | "acne" | "breast_tenderness" | "sleep_disturbances";
export type HealthCondition = "pcos" | "endometriosis" | "heavy_periods" | "irregular_cycles" | "none";
export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface WomensHealthProfile {
  cycleStatus: CycleStatus;
  lastPeriodDate: string;       // ISO date string
  cycleLength: number;          // days, default 28
  commonSymptoms: PmsSymptom[];
  healthConditions: HealthCondition[];
}

export interface UserProfile {
  name: string;
  age: number;
  weight: number;
  height: number;
  goal: FitnessGoal;
  equipment: Equipment[];
  workoutStyles: WorkoutStyle[];
  biologicalSex: BiologicalSex;
  womensHealth?: WomensHealthProfile;
}

export interface Meal {
  id: string;
  type: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  name: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  omega3: number;
  time: string;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface WellnessEntry {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  sleepHours: number;
  cravings: string[];
  notes: string;
}

export interface CycleSymptomEntry {
  date: string;
  cycleDay: number;
  mood: number;       // 1-5
  energy: number;     // 1-5
  stress: number;     // 1-5
  bloating: number;   // 1-5
  cramps: number;     // 1-5
  cravings: number;   // 1-5
  sleepQuality: number; // 1-5
  notes: string;
}

export interface PeriodEntry {
  startDate: string;
  endDate?: string;
}

export interface Supplement {
  id: string;
  name: string;
  dose: string;
  time: string;
  emoji: string;
}

export type { Exercise };

// ── Weekly Workout Plan ──────────────────────────────────────
export interface WorkoutExercise extends Exercise {
  id: string;           // Unique ID for this exercise in the plan
  dayOfWeek: number;    // 0=Monday, 6=Sunday
  completed: boolean;   // Exercise-level completion
  customNotes?: string; // User can add personal notes
}

export interface WeeklyWorkoutPlan {
  id: string;
  daysPerWeek: number;  // 1-7
  exercises: WorkoutExercise[];
  createdAt: string;
  lastUpdated: string;
  cyclePhaseAtCreation?: CyclePhase; // For female users
}

// ── Cycle utility functions ──────────────────────────────────
export function getCycleDay(lastPeriodDate: string, today = new Date()): number {
  const start = new Date(lastPeriodDate);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, (diff % 28) + 1);
}

export function getCyclePhase(cycleDay: number, cycleLength = 28): CyclePhase {
  const menstrualEnd = 5;
  const follicularEnd = Math.round(cycleLength * 0.43);
  const ovulationEnd = Math.round(cycleLength * 0.57);
  if (cycleDay <= menstrualEnd) return "menstrual";
  if (cycleDay <= follicularEnd) return "follicular";
  if (cycleDay <= ovulationEnd) return "ovulation";
  return "luteal";
}

export function getNextPeriodDate(lastPeriodDate: string, cycleLength = 28): Date {
  const start = new Date(lastPeriodDate);
  return new Date(start.getTime() + cycleLength * 24 * 60 * 60 * 1000);
}

export function getOvulationDate(lastPeriodDate: string, cycleLength = 28): Date {
  const start = new Date(lastPeriodDate);
  return new Date(start.getTime() + Math.round(cycleLength * 0.5) * 24 * 60 * 60 * 1000);
}

// ── App State ────────────────────────────────────────────────
export interface AppState {
  profile: UserProfile | null;
  nutritionGoals: NutritionGoals | null;
  nutritionLoading: boolean;
  exercisePlan: Exercise[];
  exerciseLoading: boolean;
  weeklyWorkoutPlan: WeeklyWorkoutPlan | null;
  weeklyPlanLoading: boolean;
  meals: Meal[];
  steps: number;
  streak: number;
  weightLog: WeightEntry[];
  wellnessLog: WellnessEntry[];
  cycleSymptomLog: CycleSymptomEntry[];
  periodLog: PeriodEntry[];
  supplements: Supplement[];
  completedExercises: string[];
}

interface AppContextType extends AppState {
  setProfile: (p: UserProfile) => void;
  addMeal: (m: Meal) => void;
  setSteps: (s: number) => void;
  toggleExercise: (id: string) => void;
  addWeightEntry: (e: WeightEntry) => void;
  addWellnessEntry: (e: WellnessEntry) => void;
  addCycleSymptomEntry: (e: CycleSymptomEntry) => void;
  logPeriodStart: (date: string) => void;
  addSupplement: (s: Supplement) => void;
  removeSupplement: (id: string) => void;
  refreshExercisePlan: () => void;
  generateWeeklyPlan: (daysPerWeek: number) => Promise<void>;
  updateWeeklyPlan: (plan: WeeklyWorkoutPlan) => void;
  toggleExerciseCompletion: (exerciseId: string) => void;
  addCustomExerciseToDay: (dayOfWeek: number, exercise: WorkoutExercise) => void;
  removeExerciseFromDay: (exerciseId: string) => void;
  editExerciseInPlan: (exerciseId: string, updates: Partial<WorkoutExercise>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [exercisePlan, setExercisePlan] = useState<Exercise[]>([]);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [weeklyWorkoutPlan, setWeeklyWorkoutPlanState] = useState<WeeklyWorkoutPlan | null>(null);
  const [weeklyPlanLoading, setWeeklyPlanLoading] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [steps, setStepsState] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [wellnessLog, setWellnessLog] = useState<WellnessEntry[]>([]);
  const [cycleSymptomLog, setCycleSymptomLog] = useState<CycleSymptomEntry[]>([]);
  const [periodLog, setPeriodLog] = useState<PeriodEntry[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [completedExercises, setCompleted] = useState<string[]>([]);

  const fetchExercisePlan = useCallback(async (p: UserProfile) => {
    setExerciseLoading(true);
    try {
      const phase = p.womensHealth?.lastPeriodDate
        ? getCyclePhase(getCycleDay(p.womensHealth.lastPeriodDate), p.womensHealth.cycleLength)
        : undefined;
      const plan = await generateExercisePlan({
        age: p.age, weight: p.weight, height: p.height, goal: p.goal,
        equipment: p.equipment, workoutStyles: p.workoutStyles,
        cyclePhase: phase,
      });
      setExercisePlan(plan);
    } catch (err) {
      console.error("Exercise plan generation failed:", err);
    } finally {
      setExerciseLoading(false);
    }
  }, []);

  const setProfile = useCallback(async (p: UserProfile) => {
    setProfileState(p);
    setMeals([]); setCompleted([]); setStreak(0); setStepsState(0);
    setNutritionLoading(true); setExerciseLoading(true);
    try {
      const phase = p.womensHealth?.lastPeriodDate
        ? getCyclePhase(getCycleDay(p.womensHealth.lastPeriodDate), p.womensHealth.cycleLength)
        : undefined;
      const [goals, plan] = await Promise.all([
        generateNutritionGoals(p),
        generateExercisePlan({ age: p.age, weight: p.weight, height: p.height, goal: p.goal, equipment: p.equipment, workoutStyles: p.workoutStyles, cyclePhase: phase }),
      ]);
      setNutritionGoals(goals);
      setExercisePlan(plan);
    } catch (err) {
      console.error("AI personalization failed:", err);
    } finally {
      setNutritionLoading(false); setExerciseLoading(false);
    }
  }, []);

  const addMeal = useCallback((m: Meal) => {
    setMeals((prev) => [...prev, m]);
    setStreak((s) => s + (meals.length === 0 ? 1 : 0));
  }, [meals.length]);

  const setSteps = useCallback((s: number) => setStepsState(s), []);

  const toggleExercise = useCallback((id: string) => {
    setCompleted((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const addWeightEntry = useCallback((e: WeightEntry) => {
    setWeightLog((prev) => [...prev, e]);
  }, []);

  const addWellnessEntry = useCallback((e: WellnessEntry) => {
    setWellnessLog((prev) => [...prev, e]);
  }, []);

  const addCycleSymptomEntry = useCallback((e: CycleSymptomEntry) => {
    setCycleSymptomLog((prev) => [...prev.filter((x) => x.date !== e.date), e]);
  }, []);

  const logPeriodStart = useCallback((date: string) => {
    setPeriodLog((prev) => [...prev, { startDate: date }]);
  }, []);

  const addSupplement = useCallback((s: Supplement) => {
    setSupplements((prev) => [...prev, s]);
  }, []);

  const removeSupplement = useCallback((id: string) => {
    setSupplements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const refreshExercisePlan = useCallback(() => {
    if (profile) fetchExercisePlan(profile);
  }, [profile, fetchExercisePlan]);

  const generateWeeklyPlan = useCallback(async (daysPerWeek: number) => {
    if (!profile || exercisePlan.length === 0) return;
    setWeeklyPlanLoading(true);
    try {
      const exercises: WorkoutExercise[] = [];
      const workDays = new Set<number>();
      const daysToAssign = Math.min(daysPerWeek, 7);
      const dayGap = Math.max(1, Math.floor(7 / daysToAssign));
      for (let i = 0; i < daysToAssign; i++) {
        workDays.add((i * dayGap) % 7);
      }
      let exIdx = 0;
      workDays.forEach((dayOfWeek) => {
        for (let i = 0; i < 2 && exIdx < exercisePlan.length; i++, exIdx++) {
          const ex = exercisePlan[exIdx];
          exercises.push({
            ...ex,
            id: `${dayOfWeek}-${i}-${Date.now()}`,
            dayOfWeek,
            completed: false,
          });
        }
      });
      const phase = profile.womensHealth?.lastPeriodDate
        ? getCyclePhase(getCycleDay(profile.womensHealth.lastPeriodDate), profile.womensHealth.cycleLength)
        : undefined;
      const plan: WeeklyWorkoutPlan = {
        id: `plan-${Date.now()}`,
        daysPerWeek,
        exercises,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        cyclePhaseAtCreation: phase,
      };
      setWeeklyWorkoutPlanState(plan);
    } catch (err) {
      console.error("Weekly plan generation failed:", err);
    } finally {
      setWeeklyPlanLoading(false);
    }
  }, [profile, exercisePlan]);

  const updateWeeklyPlan = useCallback((plan: WeeklyWorkoutPlan) => {
    setWeeklyWorkoutPlanState(plan);
  }, []);

  const toggleExerciseCompletion = useCallback((exerciseId: string) => {
    setWeeklyWorkoutPlanState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex
        ),
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const addCustomExerciseToDay = useCallback((dayOfWeek: number, exercise: WorkoutExercise) => {
    setWeeklyWorkoutPlanState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: [...prev.exercises, { ...exercise, dayOfWeek, id: `${dayOfWeek}-custom-${Date.now()}` }],
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const removeExerciseFromDay = useCallback((exerciseId: string) => {
    setWeeklyWorkoutPlanState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.filter((ex) => ex.id !== exerciseId),
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const editExerciseInPlan = useCallback((exerciseId: string, updates: Partial<WorkoutExercise>) => {
    setWeeklyWorkoutPlanState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId ? { ...ex, ...updates } : ex
        ),
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  return (
    <AppContext.Provider value={{
      profile, nutritionGoals, nutritionLoading, exercisePlan, exerciseLoading,
      weeklyWorkoutPlan, weeklyPlanLoading,
      meals, steps, streak, weightLog, wellnessLog, cycleSymptomLog, periodLog,
      supplements, completedExercises,
      setProfile, addMeal, setSteps, toggleExercise, addWeightEntry,
      addWellnessEntry, addCycleSymptomEntry, logPeriodStart,
      addSupplement, removeSupplement, refreshExercisePlan,
      generateWeeklyPlan, updateWeeklyPlan, toggleExerciseCompletion,
      addCustomExerciseToDay, removeExerciseFromDay, editExerciseInPlan,
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
