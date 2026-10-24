/**
 * Luna — Repositories
 * Typed CRUD + history/aggregation queries. UI and engines call these,
 * never Dexie directly.
 */
import { db } from "./database";
import type {
  UserProfile, PeriodEntry, CycleCheckin, BiometricEntry, HotFlashEvent,
  Meal, WorkoutLog, Supplement, HealthRecord,
} from "./types";

const todayISO = () => new Date().toISOString().split("T")[0];

// ── Profile (single row id=1) ────────────────────────────────
export const profileRepo = {
  async get(): Promise<UserProfile | undefined> {
    return db.profile.get(1);
  },
  async save(p: Omit<UserProfile, "id">): Promise<UserProfile> {
    const row: UserProfile = { ...p, id: 1 };
    await db.profile.put(row);
    return row;
  },
  async update(patch: Partial<UserProfile>): Promise<void> {
    await db.profile.update(1, patch);
  },
};

// ── Periods ──────────────────────────────────────────────────
export const periodsRepo = {
  all: () => db.periods.orderBy("startDate").toArray(),
  add: (e: Omit<PeriodEntry, "id">) => db.periods.add(e as PeriodEntry),
  remove: (id: number) => db.periods.delete(id),
  async latest(): Promise<PeriodEntry | undefined> {
    const all = await db.periods.orderBy("startDate").toArray();
    return all[all.length - 1];
  },
};

// ── Daily cycle check-ins ────────────────────────────────────
export const checkinsRepo = {
  all: () => db.checkins.orderBy("date").toArray(),
  byDate: (date: string) => db.checkins.where("date").equals(date).first(),
  today: () => db.checkins.where("date").equals(todayISO()).first(),
  async upsert(e: Omit<CycleCheckin, "id">): Promise<void> {
    const existing = await db.checkins.where("date").equals(e.date).first();
    if (existing?.id) await db.checkins.update(existing.id, e);
    else await db.checkins.add(e as CycleCheckin);
  },
  recent: (n = 14) =>
    db.checkins.orderBy("date").reverse().limit(n).toArray().then((r) => r.reverse()),
};

// ── Biometrics (the hero signals) ────────────────────────────
export const biometricsRepo = {
  all: () => db.biometrics.orderBy("date").toArray(),
  byDate: (date: string) => db.biometrics.where("date").equals(date).first(),
  async upsert(e: Omit<BiometricEntry, "id">): Promise<void> {
    const existing = await db.biometrics.where("date").equals(e.date).first();
    if (existing?.id) await db.biometrics.update(existing.id, { ...existing, ...e });
    else await db.biometrics.add(e as BiometricEntry);
  },
  async bulkUpsert(entries: Omit<BiometricEntry, "id">[]): Promise<void> {
    for (const e of entries) await this.upsert(e);
  },
  recent: (n = 30) =>
    db.biometrics.orderBy("date").reverse().limit(n).toArray().then((r) => r.reverse()),
  clearSample: async () => {
    const samples = await db.biometrics.where("source").equals("sample").toArray();
    await db.biometrics.bulkDelete(samples.map((s) => s.id!).filter(Boolean));
  },
};

// ── Hot flashes ──────────────────────────────────────────────
export const hotFlashesRepo = {
  all: () => db.hotFlashes.orderBy("timestamp").toArray(),
  add: (e: Omit<HotFlashEvent, "id">) => db.hotFlashes.add(e as HotFlashEvent),
  recent: (n = 50) =>
    db.hotFlashes.orderBy("timestamp").reverse().limit(n).toArray(),
  countSince: async (sinceISO: string) =>
    (await db.hotFlashes.where("timestamp").above(sinceISO).count()),
};

// ── Meals ────────────────────────────────────────────────────
export const mealsRepo = {
  byDate: (date = todayISO()) => db.meals.where("date").equals(date).toArray(),
  add: (m: Omit<Meal, "id">) => db.meals.add(m as Meal),
  remove: (id: number) => db.meals.delete(id),
  all: () => db.meals.orderBy("date").toArray(),
};

// ── Workouts ─────────────────────────────────────────────────
export const workoutsRepo = {
  all: () => db.workouts.orderBy("date").toArray(),
  add: (w: Omit<WorkoutLog, "id">) => db.workouts.add(w as WorkoutLog),
  update: (id: number, patch: Partial<WorkoutLog>) => db.workouts.update(id, patch),
  remove: (id: number) => db.workouts.delete(id),
  byDate: (date: string) => db.workouts.where("date").equals(date).toArray(),
};

// ── Supplements ──────────────────────────────────────────────
export const supplementsRepo = {
  all: () => db.supplements.toArray(),
  add: (s: Omit<Supplement, "id">) => db.supplements.add(s as Supplement),
  remove: (id: number) => db.supplements.delete(id),
};

// ── Health records (uploads + typed values) ──────────────────
export const recordsRepo = {
  all: () => db.records.orderBy("date").reverse().toArray(),
  add: (r: Omit<HealthRecord, "id">) => db.records.add(r as HealthRecord),
  remove: (id: number) => db.records.delete(id),
};

// ── History / aggregation ────────────────────────────────────
export interface CycleWindow {
  index: number;            // 0 = most recent
  startDate: string;
  lengthDays: number | null;
}

/** Build cycle windows from logged period start dates. */
export async function getCycleWindows(): Promise<CycleWindow[]> {
  const periods = await periodsRepo.all();
  const windows: CycleWindow[] = [];
  for (let i = 0; i < periods.length; i++) {
    const start = periods[i].startDate;
    const next = periods[i + 1]?.startDate;
    const lengthDays = next
      ? Math.round((new Date(next).getTime() - new Date(start).getTime()) / 86400000)
      : null;
    windows.push({ index: periods.length - 1 - i, startDate: start, lengthDays });
  }
  return windows.reverse(); // most recent first
}

/** Cycle-length stats for prediction + PCOS signals. */
export async function getCycleStats(): Promise<{
  count: number; mean: number | null; sd: number | null; lengths: number[];
}> {
  const windows = await getCycleWindows();
  const lengths = windows.map((w) => w.lengthDays).filter((n): n is number => n != null);
  if (lengths.length === 0) return { count: 0, mean: null, sd: null, lengths: [] };
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  return { count: lengths.length, mean, sd: Math.sqrt(variance), lengths };
}
