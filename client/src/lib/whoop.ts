/**
 * Luna — WHOOP Developer API v2 integration
 * ─────────────────────────────────────────────────────────────
 * Real OAuth 2.0 authorization-code flow. The token exchange needs the client
 * secret and WHOOP does not allow CORS browser calls to the token endpoint, so
 * that step is proxied by server/index.ts (/api/whoop/token, /api/whoop/refresh).
 *
 * If WHOOP credentials are not configured, the app runs entirely on labeled
 * SAMPLE data — the demo is never blocked.
 *
 * Endpoints (verified against https://developer.whoop.com/api/):
 *   getRecoveryCollection → skin_temp_celsius, resting_heart_rate, hrv_rmssd_milli, spo2
 *   getCycleCollection    → strain, average_heart_rate, step_count
 *   getSleepCollection    → sleep_performance_percentage, respiratory_rate
 *   getWorkoutCollection  → strain, average_heart_rate, sport_name
 */
import { db } from "@/db/database";
import { biometricsRepo } from "@/db/repositories";
import type { BiometricEntry, HealthMode } from "@/db/types";
import { generateSampleForMode } from "./sampleData";

const WHOOP_AUTH = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_API = "https://api.prod.whoop.com/developer/v2";
const SCOPES = ["read:recovery", "read:cycles", "read:sleep", "read:workout", "read:profile", "offline"];

const CLIENT_ID = import.meta.env.VITE_WHOOP_CLIENT_ID as string | undefined;
const REDIRECT_URI = import.meta.env.VITE_WHOOP_REDIRECT_URI as string | undefined
  ?? (typeof window !== "undefined" ? `${window.location.origin}/whoop/callback` : "");

export function isWhoopConfigured(): boolean {
  return !!CLIENT_ID;
}

export async function isWhoopConnected(): Promise<boolean> {
  const t = await db.whoopTokens.get(1);
  return !!t?.accessToken;
}

function randomState(len = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}

/** Build the WHOOP authorization URL and stash the state for CSRF validation. */
export function getWhoopAuthUrl(): string {
  if (!CLIENT_ID) throw new Error("WHOOP client id not configured");
  const state = randomState();
  sessionStorage.setItem("whoop_oauth_state", state);
  const url = new URL(WHOOP_AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchange the auth code for tokens via our server proxy, then persist them. */
export async function handleWhoopCallback(code: string, state: string): Promise<boolean> {
  const expected = sessionStorage.getItem("whoop_oauth_state");
  if (!expected || expected !== state) throw new Error("WHOOP OAuth state mismatch");
  const res = await fetch("/api/whoop/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  await db.whoopTokens.put({
    id: 1,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? SCOPES.join(" "),
  });
  return true;
}

async function validAccessToken(): Promise<string | null> {
  const t = await db.whoopTokens.get(1);
  if (!t) return null;
  if (Date.now() < t.expiresAt - 60_000) return t.accessToken;
  // Refresh via server proxy.
  if (!t.refreshToken) return null;
  const res = await fetch("/api/whoop/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: t.refreshToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  await db.whoopTokens.put({
    id: 1,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? t.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? t.scope,
  });
  return data.access_token;
}

async function whoopGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${WHOOP_API}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`WHOOP ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface WhoopRecord { start?: string; score?: Record<string, number>; }
interface WhoopPage<T> { records: T[]; next_token?: string; }

const dayOf = (iso?: string) => (iso ? iso.split("T")[0] : "");

/**
 * Pull the last ~30 days of recovery/cycle/sleep and normalize into one
 * BiometricEntry per day. Writes to the DB. Returns the number of days synced.
 */
export async function syncWhoopData(): Promise<{ synced: number; source: "whoop" }> {
  const token = await validAccessToken();
  if (!token) throw new Error("No valid WHOOP token");

  const start = new Date(Date.now() - 30 * 86400000).toISOString();
  const byDate = new Map<string, Partial<BiometricEntry>>();
  const put = (d: string, patch: Partial<BiometricEntry>) =>
    byDate.set(d, { ...(byDate.get(d) ?? {}), ...patch });

  const recovery = await whoopGet<WhoopPage<WhoopRecord & { score?: any }>>(
    "/recovery", token, { limit: "25", start });
  for (const r of recovery.records) {
    const d = dayOf(r.start ?? (r as any).created_at);
    if (!d || !r.score) continue;
    put(d, {
      skinTempC: r.score.skin_temp_celsius,
      restingHr: r.score.resting_heart_rate,
      hrvMs: r.score.hrv_rmssd_milli,
      spo2: r.score.spo2_percentage,
      recoveryScore: r.score.recovery_score,
    });
  }

  const cycles = await whoopGet<WhoopPage<any>>("/cycle", token, { limit: "25", start });
  for (const c of cycles.records) {
    const d = dayOf(c.start);
    if (!d) continue;
    put(d, { avgHr: c.score?.average_heart_rate, strain: c.score?.strain, steps: c.score?.step_count });
  }

  const sleeps = await whoopGet<WhoopPage<any>>("/activity/sleep", token, { limit: "25", start });
  for (const s of sleeps.records) {
    const d = dayOf(s.start);
    if (!d) continue;
    put(d, { respRate: s.score?.respiratory_rate, sleepPerformance: s.score?.sleep_performance_percentage });
  }

  const entries: Omit<BiometricEntry, "id">[] = Array.from(byDate.entries()).map(([date, v]) => ({
    date, source: "whoop", ...v,
  }));
  await biometricsRepo.clearSample();
  await biometricsRepo.bulkUpsert(entries);
  return { synced: entries.length, source: "whoop" };
}

/** Seed the DB with labeled sample biometrics + periods for the given mode. */
export async function seedSampleData(mode: HealthMode): Promise<{ synced: number; source: "sample" }> {
  const { biometrics, periods } = generateSampleForMode(mode);
  await biometricsRepo.bulkUpsert(biometrics);
  // Only seed periods if the user has none and the mode is cycle-based.
  if (periods.length) {
    const existing = await db.periods.count();
    if (existing === 0) await db.periods.bulkAdd(periods as any);
  }
  return { synced: biometrics.length, source: "sample" };
}

export async function disconnectWhoop(): Promise<void> {
  await db.whoopTokens.clear();
}
