/**
 * Validate & tune Glitch's ovulation detection on mcPHASES (PhysioNet, restricted access).
 *
 * mcPHASES requires a PhysioNet account and signing its Data Use Agreement:
 *   https://physionet.org/content/mcphases/1.0.0/
 * Download the CSVs locally (e.g. to scripts/data/mcphases/, which is git-ignored). Never commit them.
 * This script only writes AGGREGATE thresholds + metrics to client/src/lib/models/ovulationParams.json.
 *
 * Usage:
 *   npx tsx scripts/validate_ovulation_mcphases.ts --inspect   # list files + columns
 *   npx tsx scripts/validate_ovulation_mcphases.ts             # evaluate + grid-search + write params
 *   MCPHASES_DIR=/path/to/csvs npx tsx scripts/validate_ovulation_mcphases.ts
 *
 * Column names are auto-detected from common candidates; override with scripts/mcphases.columns.json:
 *   { "temperature": { "file": "...csv", "value": "nightly_temperature" }, "hormones": { ... }, ... }
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv, pickColumn, gridSearch, evaluate, type ParticipantDay } from "../client/src/lib/ovulationValidation";
import { DEFAULT_OVULATION_PARAMS } from "../client/src/lib/healthMetrics";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIR = process.env.MCPHASES_DIR ?? path.join(ROOT, "scripts", "data", "mcphases");
const OUT = path.join(ROOT, "client", "src", "lib", "models", "ovulationParams.json");
const OVERRIDES = path.join(ROOT, "scripts", "mcphases.columns.json");

const ID = ["id", "participant_id", "subject_id"];
const DAY = ["day_in_study", "study_day", "day"];

if (!fs.existsSync(DIR)) {
  console.error(`No mcPHASES folder at ${DIR}.\nRequest access at https://physionet.org/content/mcphases/1.0.0/, download the CSVs there (or set MCPHASES_DIR).`);
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
const tables = new Map<string, Record<string, string>[]>();
for (const f of files) tables.set(f, parseCsv(fs.readFileSync(path.join(DIR, f), "utf8")));

if (process.argv.includes("--inspect")) {
  for (const [f, rows] of tables) console.log(`${f} (${rows.length} rows): ${Object.keys(rows[0] ?? {}).join(", ")}`);
  process.exit(0);
}

const overrides: Record<string, { file: string; value: string }> = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, "utf8")) : {};

/** Find the table+column for a signal, by override or by searching every table's headers. */
function locate(key: string, fileHints: string[], valueCandidates: string[]) {
  const o = overrides[key];
  if (o && tables.has(o.file)) return { file: o.file, value: o.value };
  const ordered = [...tables.keys()].sort((a, b) => Number(fileHints.some((h) => b.toLowerCase().includes(h))) - Number(fileHints.some((h) => a.toLowerCase().includes(h))));
  for (const f of ordered) {
    const headers = Object.keys(tables.get(f)![0] ?? {});
    const v = pickColumn(headers, valueCandidates);
    if (v && pickColumn(headers, ID) && pickColumn(headers, DAY)) return { file: f, value: v };
  }
  return null;
}

const temp = locate("temperature", ["temp"], ["nightly_temperature", "temperature_diff", "nightly_relative_temperature", "skin_temperature", "temperature"]);
const rhr = locate("resting_heart_rate", ["resting", "heart"], ["resting_heart_rate", "restingheartrate", "rhr"]);
const lh = locate("lh", ["hormone", "selfreport", "mira"], ["lh"]);
const phase = locate("phase", ["hormone", "selfreport", "mira", "phase"], ["phase", "cycle_phase"]);
const flow = locate("flow", ["selfreport", "hormone"], ["flow_volume", "flow", "menstrual_flow"]);
console.log("Using:", { temp, rhr, lh, phase, flow });
if (!temp || !lh || (!phase && !flow)) {
  console.error("Could not find temperature, LH and phase/flow columns. Run with --inspect and add scripts/mcphases.columns.json.");
  process.exit(1);
}

const byPid = new Map<string, Map<number, ParticipantDay>>();
function put(loc: { file: string; value: string } | null, apply: (d: ParticipantDay, raw: string) => void) {
  if (!loc) return;
  const rows = tables.get(loc.file)!;
  const headers = Object.keys(rows[0] ?? {});
  const idCol = pickColumn(headers, ID)!, dayCol = pickColumn(headers, DAY)!;
  for (const r of rows) {
    const pid = r[idCol], day = Number(r[dayCol]);
    if (!pid || !Number.isFinite(day)) continue;
    const m = byPid.get(pid) ?? new Map<number, ParticipantDay>();
    byPid.set(pid, m);
    const d = m.get(day) ?? { day };
    m.set(day, d);
    if (r[loc.value] !== "") apply(d, r[loc.value]);
  }
}
// Several temperature samples per night are averaged
const tempAcc = new WeakMap<ParticipantDay, { s: number; n: number }>();
put(temp, (d, raw) => {
  const v = Number(raw);
  if (!Number.isFinite(v)) return;
  const acc = tempAcc.get(d) ?? { s: 0, n: 0 };
  acc.s += v; acc.n += 1;
  tempAcc.set(d, acc);
  d.temp = acc.s / acc.n;
});
put(rhr, (d, raw) => { const v = Number(raw); if (Number.isFinite(v)) d.rhr = v; });
put(lh, (d, raw) => { const v = Number(raw); if (Number.isFinite(v)) d.lh = v; });
put(phase, (d, raw) => { if (/menstrua/i.test(raw)) d.menstruating = true; });
put(flow, (d, raw) => { const v = Number(raw); if ((Number.isFinite(v) && v > 0) || /light|medium|heavy|spotting/i.test(raw)) d.menstruating = true; });

const participants = [...byPid.values()].map((m) => [...m.values()]);
const baseline = evaluate(participants, DEFAULT_OVULATION_PARAMS);
const ranked = gridSearch(participants);
const best = ranked[0];

console.log(`\nParticipants: ${participants.length}. Cycles with LH surge: ${baseline.cyclesWithSurge}, without: ${baseline.cyclesWithoutSurge}`);
console.log("Current params:", baseline);
console.log("Top 5 settings:");
for (const r of ranked.slice(0, 5)) console.log(" ", JSON.stringify(r.params), `±2d ${r.within2Days}  sens ${r.sensitivity}  MAE ${r.meanAbsErrorDays}  FPR ${r.falsePositiveRate}`);

if (process.argv.includes("--dry-run")) { console.log("\n--dry-run: not writing params"); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify({
  source: `Tuned on mcPHASES (PhysioNet) — ${participants.length} participants, ${best.cyclesWithSurge} LH-confirmed cycles. Aggregate thresholds only.`,
  tunedAt: new Date().toISOString().slice(0, 10),
  params: best.params,
  metrics: { within2Days: best.within2Days, sensitivity: best.sensitivity, meanAbsErrorDays: best.meanAbsErrorDays, falsePositiveRate: best.falsePositiveRate },
  baselineMetrics: { within2Days: baseline.within2Days, sensitivity: baseline.sensitivity, meanAbsErrorDays: baseline.meanAbsErrorDays, falsePositiveRate: baseline.falsePositiveRate },
}, null, 2) + "\n");
console.log(`\nWrote ${path.relative(ROOT, OUT)}`);
