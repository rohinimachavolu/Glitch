/**
 * Luna — Massachusetts public data (CDC PLACES)
 * Live, auth-free county-level context for the H1 "context a wearable skips" angle.
 * Source: CDC PLACES, U.S. government public data. County context, never an
 * individual score.
 */

const PLACES_SHORT_SLEEP =
  "https://data.cdc.gov/resource/swc5-untb.json?$select=year,locationname,data_value,low_confidence_limit,high_confidence_limit,totalpopulation&stateabbr=MA&measure=Short%20sleep%20duration%20among%20adults&data_value_type=Crude%20prevalence&$limit=50";

export interface CountySleep {
  county: string;
  pct: number;
  low: number;
  high: number;
  year: string;
  population: number;
}

interface PlacesRow {
  year: string;
  locationname: string;
  data_value: string;
  low_confidence_limit: string;
  high_confidence_limit: string;
  totalpopulation: string;
}

const CACHE_KEY = "luna_places_short_sleep_v1";

async function fetchAll(): Promise<CountySleep[]> {
  // Try cache first (survives offline/demo without network).
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached) as CountySleep[]; } catch { /* refetch */ }
  }
  const res = await fetch(PLACES_SHORT_SLEEP);
  if (!res.ok) throw new Error(`CDC PLACES ${res.status}`);
  const rows = (await res.json()) as PlacesRow[];
  const data: CountySleep[] = rows.map((r) => ({
    county: r.locationname,
    pct: Number(r.data_value),
    low: Number(r.low_confidence_limit),
    high: Number(r.high_confidence_limit),
    year: r.year,
    population: Number(r.totalpopulation),
  }));
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return data;
}

export async function getAllCountySleep(): Promise<CountySleep[]> {
  try { return await fetchAll(); } catch { return []; }
}

export async function getCountyShortSleep(county: string): Promise<CountySleep | null> {
  const all = await getAllCountySleep();
  if (!all.length) return null;
  const norm = county.trim().toLowerCase();
  return all.find((c) => c.county.toLowerCase() === norm) ?? null;
}

/** State average across counties (for the "vs. your area" comparison). */
export async function getStateAverageSleep(): Promise<number | null> {
  const all = await getAllCountySleep();
  if (!all.length) return null;
  return all.reduce((s, c) => s + c.pct, 0) / all.length;
}

export const MA_COUNTIES = [
  "Barnstable", "Berkshire", "Bristol", "Dukes", "Essex", "Franklin",
  "Hampden", "Hampshire", "Middlesex", "Nantucket", "Norfolk",
  "Plymouth", "Suffolk", "Worcester",
];
