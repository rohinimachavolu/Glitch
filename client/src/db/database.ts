/**
 * Luna — IndexedDB database (Dexie)
 * Persists everything locally. Nothing leaves the device unless the user
 * explicitly connects WHOOP (read-only) or exports a summary.
 */
import Dexie, { Table } from "dexie";
import type {
  UserProfile, PeriodEntry, CycleCheckin, BiometricEntry, HotFlashEvent,
  Meal, WorkoutLog, Supplement, HealthRecord, WhoopTokens,
} from "./types";

export class LunaDatabase extends Dexie {
  profile!: Table<UserProfile, number>;
  periods!: Table<PeriodEntry, number>;
  checkins!: Table<CycleCheckin, number>;
  biometrics!: Table<BiometricEntry, number>;
  hotFlashes!: Table<HotFlashEvent, number>;
  meals!: Table<Meal, number>;
  workouts!: Table<WorkoutLog, number>;
  supplements!: Table<Supplement, number>;
  records!: Table<HealthRecord, number>;
  whoopTokens!: Table<WhoopTokens, number>;

  constructor() {
    super("luna_health_db");
    this.version(1).stores({
      profile: "++id",
      periods: "++id, startDate",
      checkins: "++id, &date, cycleDay",
      biometrics: "++id, &date, source",
      hotFlashes: "++id, timestamp, source",
      meals: "++id, date, type",
      workouts: "++id, date, cycleDay",
      supplements: "++id, name",
      records: "++id, date, kind",
      whoopTokens: "++id",
    });
  }
}

export const db = new LunaDatabase();

/** Wipe everything (used by "reset" in settings / re-onboarding). */
export async function resetDatabase(): Promise<void> {
  await Promise.all([
    db.profile.clear(), db.periods.clear(), db.checkins.clear(),
    db.biometrics.clear(), db.hotFlashes.clear(), db.meals.clear(),
    db.workouts.clear(), db.supplements.clear(), db.records.clear(),
    db.whoopTokens.clear(),
  ]);
}
