# NutriSense AI → Menstruation-First Wellness App — Final Build Plan

Hackachusetts 2026 · Healthcare & Biotech · Challenge **H1 — Turning wearable data into better healthcare**
("Continuous monitoring is not yet better care.")

> One-line pitch: **"WHOOP shows you your data. We turn it into cycle-aware support you can act on, and a summary your clinician can use."**

---

## 0. Guiding decisions (locked)

| Topic | Decision |
|---|---|
| **Focus** | Menstruation is the center of gravity. Cycle is the hub, everything else orbits it. |
| **Database** | **Dexie / IndexedDB** — persists everything across reloads, stores uploads, no backend needed. (Swap to hosted DB later if accounts/sync are wanted.) |
| **No hardcoded values** | All factual numbers live in a single **sourced constants file** with citations, or come from the DB / live APIs / LLM. No magic literals in components. |
| **Data sources** | Reference stats from AWHS/Harvard/NIH; county context from CDC PLACES live API; seed data from public cycle CSV (mcPHASES if PhysioNet access); user's own logged + uploaded + WHOOP data is always primary. |
| **WHOOP** | Real OAuth v2 flow + server token handler (secret stays off client) + **sample-data fallback** so the demo always works. |
| **LLM** | Groq (already wired). Used for personalized, pattern-based insights from the user's real history — never hardcoded rules. |
| **Safety** | Every insight is "a pattern to discuss with a clinician," never a diagnosis. No PCOS/menopause/diabetes diagnosis. County data is never shown as an individual score. |
| **Men** | Fitness-only mode. No cycle, no menopause, no period questions anywhere. |

---

## 1. User modes (onboarding branches)

1. **Regular cycle** → full cycle hub.
2. **Irregular cycle** → cycle hub + PCOS pattern module emphasis, predictions as wide ranges.
3. **PCOS (self-reported)** → cycle hub + PCOS signals surfaced (never diagnosis).
4. **Menopause / perimenopause** → menopause module replaces cycle tracking (hot-flash tracker, HRV/sleep trends).
5. **Pregnancy** → logging + support only; all plans say "check with clinician first."
6. **Male / prefer-not-to-say** → fitness + nutrition only, no reproductive-health UI.

---

## 2. Evidence base (what the logic is grounded in — all cited in constants file)

- **Cycle norms:** avg ~28d; 87% of cycles 23–38d; >50% of people vary 5+ days month-to-month; ovulation not fixed at day 14. → predictions shown as **range + confidence**. (AWHS/Harvard, Human Reproduction big-data study, NICHD.)
- **Cycle + fitness:** Evidence is **mixed** — some studies show follicular strength peak, a strong umbrella review says it's premature to prescribe by phase. → App reflects the **user's own** logged performance vs cycle day, never a universal "lift now / rest now" rule. (Frontiers reviews, McMaster umbrella review.)
- **PCOS signals a wearable can reflect:** irregular/long cycles (logged), elevated resting HR + lower HRV, sleep disruption, flatter cyclical skin-temp shift. → "worth discussing with a clinician." (AWHS PCOS paper, glucose-metabolism wearable study.)
- **Menopause:** estrogen rises/falls erratically; hot flashes affect 50–80%, avg 7–9 yrs; night-time HRV drops ~11ms in perimenopause; sleep fragmentation + elevated resting HR. → hot-flash tracker (temp spikes + self-log), HRV/sleep trends, cooling/breathing/strength suggestions. (Mayo, Yale, NIH thermoregulation review, Terra, smart-clothing sensor study.)

---

## 3. Data sources & integration points

### WHOOP Developer API v2 (verified)
- OAuth 2.0 auth-code flow. Auth `https://api.prod.whoop.com/oauth/oauth2/auth`, token `.../oauth2/token`. `state` ≥8 chars, request `offline` for refresh token.
- Scopes (only what screens need): `read:cycles`, `read:recovery`, `read:sleep`, `read:workout`, `read:profile`.
- Endpoints: `getRecoveryCollection` (recovery score, **resting_heart_rate**, **hrv_rmssd_milli**, spo2, **skin_temp_celsius**), `getCycleCollection` (strain, avg HR, step_count), `getSleepCollection` (performance %, stages, respiratory rate), `getWorkoutCollection`. Paginated ≤25, cursor `next_token`.
- Token exchange needs client secret → handled in `server/` (not browser). Sample fallback for demo.

### Massachusetts public data (no auth — verified live)
- **CDC PLACES short sleep (H1)** — adults sleeping <7h by MA county, 2022. Live JSON confirmed working:
  `https://data.cdc.gov/resource/swc5-untb.json?...measure=Short sleep duration among adults...` → county-context card ("your sleep vs where you live"). **County context, never an individual score.**
- **CDC PLACES 5 measures** (obesity, diabetes, checkups, mental distress, smoking) — equity/public-health angle.
- **CMS Care Update Template** — field shape for the **clinician handoff summary** (don't invent a private shape).
- **HL7 FHIR** — reference shape when the handoff/chart summary is involved.
- **Synthea column guide** — if we need synthetic rows, generate + label "synthetic."
- **PhysioNet wearable dataset** — real signal series fallback when no live device consent (check license).

### Reproductive-health datasets (from earlier research)
- **mcPHASES (PhysioNet)** — restricted, rich multimodal (physiology + hormones + symptoms). Seed if access obtained.
- **Public cycle CSV** (Kaggle/GitHub) — open, quick seed, labeled "sample."

---

## 4. Architecture / file map

```
client/src/
  db/
    database.ts            ← Dexie schema (NEW) — all tables + versioning
    repositories.ts        ← typed CRUD helpers (NEW)
  data/
    references.ts          ← SOURCED constants (NEW) — cycle norms, phase physiology,
                             nutrition refs, menopause facts — each w/ citation comment
    sampleData.ts          ← labeled sample cycle/WHOOP seed (NEW)
  lib/
    whoop.ts               ← WHOOP OAuth + fetch + normalize (NEW)
    massPublicData.ts      ← CDC PLACES county fetch + cache (NEW)
    cycleEngine.ts         ← phase math, range+confidence prediction (NEW, sourced)
    pcosSignals.ts         ← pattern flags from logged + WHOOP data (NEW)
    menopauseEngine.ts     ← hot-flash detection, HRV/sleep trend (NEW)
    aiService.ts           ← EXTEND: personalized cycle-fitness + coach prompts
    theme.ts               ← mood + time + phase → palette (NEW)
  contexts/
    AppContext.tsx         ← REWIRE to Dexie (async, persistent)
    ThemeContext.tsx       ← EXTEND for adaptive theming
  pages/
    Onboarding.tsx         ← branches (regular/irregular/pcos/menopause/male)
    CycleHub.tsx           ← NEW main hub (was WomensHealth) — richer, multi-cycle
    Menopause.tsx          ← NEW menopause module
    Records.tsx            ← NEW upload + consent + typed values
    ClinicianSummary.tsx   ← NEW weekly handoff (CMS template fields)
    Dashboard/Fitness/LogFood/Progress/FormCoach  ← keep, wire to DB + WHOOP
  components/
    WhoopConnect.tsx, HotFlashTracker.tsx, CountyContextCard.tsx,
    CyclePhaseRing.tsx, ConfidenceRange.tsx, UploadDropzone.tsx  ← NEW
server/
  index.ts                 ← ADD WHOOP token-exchange + refresh routes
```

---

## 5. Two-person detailed plan

### 5.0 Roles
- **Person A — "Data, Wearable & Clinical Engine"** (backend/logic-leaning). Owns the WHOOP integration, the biometric + cycle/PCOS/menopause engines, public-data fetching, the clinician handoff, and all DB query/aggregation helpers.
- **Person B — "Experience, UI & Intelligence"** (frontend/design-leaning). Owns onboarding, every screen, the adaptive theming, the upload flow, and the LLM coach prompts/wiring.

**Rule of thumb:** A produces functions that return typed data; B consumes them and renders. They meet at the interfaces defined in §5.2.

---

### 5.1 Phase 0 — Shared foundation (DO THIS FIRST, TOGETHER)

Neither person starts their stream until F0 is merged to `main`, because every file imports from it. One person drives, the other reviews, then both branch off.

| ID | Task | Files | Done when |
|---|---|---|---|
| **F0.1** | Install deps | `package.json` | `pnpm add dexie` (framer-motion already present). `pnpm install` clean. |
| **F0.2** | Dexie schema — all tables + versioning | `client/src/db/database.ts` | Tables: `profile`, `periods`, `cycleCheckins`, `biometricLog`, `meals`, `workouts`, `supplements`, `records`, `whoopTokens`, `whoopRaw`, `hotFlashes`. Opens without error. |
| **F0.3** | Typed domain models | `client/src/db/types.ts` | All interfaces (see §5.2) exported, shared by A and B. |
| **F0.4** | Sourced reference constants | `client/src/data/references.ts` | Every cycle/nutrition/menopause number from §2, each with a `// source:` citation comment. No literals elsewhere. |
| **F0.5** | Rewire AppContext to Dexie (async, persistent) | `client/src/contexts/AppContext.tsx` | Profile + logs persist across reload. Loading state handled. Build passes (`pnpm check`). |

**Gate:** `pnpm check` + app loads + a logged period survives a refresh → merge F0 → split.

---

### 5.2 Interface contract (the seam between A and B — agree before coding)

These type signatures are the handshake. A implements, B imports. Put them in `db/types.ts` / each lib's exports.

```ts
// cycleEngine.ts  (A implements)
getCyclePhase(cycleDay, cycleLength, biometrics?): CyclePhase
predictNextPeriod(periods: PeriodEntry[], biometrics?): { rangeStart: Date; rangeEnd: Date; confidence: "low"|"moderate"|"high" }
getBiometricTrend(log: BiometricEntry[], signal): { points: {date,value,baseline,phase}[]; direction }

// pcosSignals.ts  (A implements)
getPcosSignals(periods, biometrics): { flag: string; detail: string; confidence }[]   // never a diagnosis

// menopauseEngine.ts  (A implements)
detectHotFlashes(biometrics): HotFlashEvent[]
getMenopauseTrends(biometrics): { hrv, restingHr, respRate, sleep }  // each a trend vs baseline

// whoop.ts  (A implements)
getWhoopAuthUrl(): string
syncWhoopData(): Promise<{ recoveries; cycles; sleeps; workouts }>   // normalized → biometricLog
isWhoopConnected(): boolean   // false → B shows sample-data badge

// massPublicData.ts  (A implements)
getCountyShortSleep(county: string): Promise<{ pct; low; high; year } | null>

// repositories.ts  (A implements)  — B calls these, not Dexie directly
periodsRepo, checkinsRepo, biometricsRepo, mealsRepo, recordsRepo ...  (CRUD + history queries)
```

B codes against these signatures with stubs if A isn't done yet (A ships a stub returning sample data first — see A1/A3).

---

### 5.3 Person A — task breakdown

| ID | Task | Files (A owns) | Depends on | Acceptance |
|---|---|---|---|---|
| **A1** | WHOOP OAuth + sync + **sample fallback FIRST** | `lib/whoop.ts`, `server/index.ts` (token routes) | F0 | `syncWhoopData()` returns normalized sample data immediately (no creds); real OAuth path works when creds present; tokens persisted in `whoopTokens`. Exposes `isWhoopConnected()`. |
| **A2** | Normalize WHOOP → `biometricLog` (skin temp, resting/avg HR, resp rate, HRV) | `lib/whoop.ts`, `db/repositories.ts` | A1, F0.2 | Each day writes one `biometricLog` row with the 4 signals + source=`whoop`\|`sample`. |
| **A3** | Cycle engine — phase math + **range+confidence** prediction, biometric corroboration | `lib/cycleEngine.ts` | F0.4 | Uses `references.ts` norms (no literals). Prediction returns a date range + confidence; skin-temp rise / HR / resp-rate shift nudge confidence. Unit-sanity tested. |
| **A4** | PCOS signals (pattern flags, never diagnosis) | `lib/pcosSignals.ts` | A2, A3 | Flags flat temp curve + elevated resting HR + irregular cycles → "discuss with clinician" strings + confidence. |
| **A5** | Menopause engine + hot-flash detection | `lib/menopauseEngine.ts` | A2 | `detectHotFlashes` = skin-temp spike + HR jump → `hotFlashes` rows; trends for HRV/resting HR/resp rate/sleep. |
| **A6** | CDC PLACES county data fetch + cache | `lib/massPublicData.ts` | F0 | Live fetch of short-sleep by county (verified URL), cached in Dexie, graceful offline fallback. |
| **A7** | Clinician handoff summary (CMS template fields) | `pages/ClinicianSummary.tsx`, `lib/handoff.ts` | A2–A5 | Plain-language weekly summary: cycle/phase trends, biometric trends, symptom/craving/stress patterns. Exportable (copy/print). "Explains an insight; a professional decides." |
| **A8** | History/aggregation queries (multi-cycle overlay data) | `db/repositories.ts` | F0.2 | Returns per-cycle series B can chart (days 1–28 overlaid across cycles). |

**A's definition of done:** every function typed per §5.2, returns real-or-sample data, `pnpm check` clean, no hardcoded clinical numbers (all via `references.ts`).

---

### 5.4 Person B — task breakdown

| ID | Task | Files (B owns) | Depends on | Acceptance |
|---|---|---|---|---|
| **B1** | Onboarding branches | `pages/Onboarding.tsx` | F0.3 | Paths: regular / irregular / PCOS / menopause / pregnancy / male. **Men & prefer-not-to-say see zero reproductive-health questions.** Writes profile to Dexie. |
| **B2** | Cycle Hub (main surface) | `pages/CycleHub.tsx`, `components/CyclePhaseRing.tsx`, `ConfidenceRange.tsx` | A3, A8 (stubs ok) | Multi-cycle calendar + phase ring + daily logging + **prediction shown as range + confidence**. Consumes `cycleEngine` + `repositories`. |
| **B3** | "Your Signals" biometric trends card | `components/BiometricTrends.tsx` | A2 | Skin temp / heart rate / respiratory rate sparklines vs baseline, color-coded by phase. On Cycle Hub + Menopause. "Pattern, not diagnosis" label. |
| **B4** | Menopause module UI + hot-flash tracker | `pages/Menopause.tsx`, `components/HotFlashTracker.tsx` | A5 | Tap-to-log hot flash + auto-flagged temp spikes; cooling/breathing/strength suggestions; HRV/sleep trends. |
| **B5** | Records: upload + consent + typed values | `pages/Records.tsx`, `components/UploadDropzone.tsx` | F0.2 | Explicit consent screen before upload; files/images + typed values (BP, diagnoses) stored in `records` table; nothing leaves device. |
| **B6** | County context card | `components/CountyContextCard.tsx` | A6 | Shows user's sleep vs their MA county (CDC PLACES). **Labeled context, never an individual score.** |
| **B7** | Adaptive theming: mood + time + phase | `lib/theme.ts`, `contexts/ThemeContext.tsx` | F0 | Palette shifts by time-of-day, cycle phase, and logged mood; framer-motion transitions; respects `prefers-reduced-motion`. |
| **B8** | LLM coach + personalized cycle-fitness insights | `lib/aiService.ts` (extend), `pages/Dashboard.tsx`, `pages/Fitness.tsx` | A2, A8 | LLM prompt fed real logged history + WHOOP signals + cycle day → personalized observations ("your heavy sessions felt harder around days 24–28"), never a universal rule. |
| **B9** | Nav + mode routing | `App.tsx`, `components/BottomNav.tsx` | B1 | Tabs adapt to mode (cycle hub for menstruating, menopause module for menopause, fitness-only for men). |

**B's definition of done:** screens consume A's typed functions (or stubs), safety labels present, animations smooth, `pnpm check` clean.

---

### 5.5 Integration checkpoints (merge order matters)

1. **CP0 — Foundation:** F0 merged. Both branch from it.
2. **CP1 — Data flows:** A1+A2 (WHOOP sample sync) + B2+B3 → biometrics appear in the hub. Verify a sample day renders.
3. **CP2 — Intelligence:** A3+A4 + B2 → predictions show as range+confidence; PCOS flags render. A5 + B4 → menopause path works end-to-end.
4. **CP3 — Context & clinical:** A6+B6 (county card) + A7 (clinician summary) + B5 (records/upload).
5. **CP4 — Polish together:** B7 theming across all screens, B8 LLM coach, safety-checklist sweep (§6), build + demo run.

---

### 5.6 Git workflow (for pushing after Kiro finishes)

- Branch per stream: `feat/foundation` → merge first; then `feat/person-a-*` and `feat/person-b-*` off updated `main`.
- **File ownership above is the collision-avoidance contract** — A and B rarely touch the same file. The few shared files (`App.tsx`, `BottomNav.tsx`, `AppContext.tsx`) are B-owned after F0; A requests changes via the interface, not by editing them.
- Commit per task ID (e.g. `A3: cycle engine with range+confidence prediction`), small and reviewable.
- PR into `main` at each checkpoint; the other person reviews against the §5.2 interface + §6 safety checklist.
- Keep `.env` out of git (`VITE_GROQ_API_KEY`, WHOOP creds). `.env.example` documents the keys.

**Note on this Kiro session:** I'm a single agent, so I'll build the tasks sequentially (F0 → A-stream → B-stream, respecting the checkpoint order), but the ownership/branch structure above is how your two teammates divide and commit the result afterward.

---

## 6. Safety checklist (must hold in every screen)
- [ ] Insights say "pattern / discuss with clinician," never diagnose.
- [ ] Predictions are ranges with confidence, never a single guaranteed date.
- [ ] County/public data labeled as context, never an individual score.
- [ ] Sample/synthetic data clearly labeled on-screen.
- [ ] WHOOP only after explicit consent; minimal scopes.
- [ ] No clinical promises re PCOS, diabetes, menopause, pregnancy.
- [ ] Every reference number carries a source citation in `references.ts`.

---

## 7. Open item
- **WHOOP dev credentials** (Client ID/Secret + redirect URL): if available → real OAuth; if not → sample fallback default (build is identical, creds drop in later).


---

## 8. App is now "GLITCH" — Menopause-priority spec (from team)

Rebrand Luna → **Glitch**. Menopause is the PRIORITY module. UI must be bigger / richer with **Perlin-noise** generative backgrounds. Use **real app data**, not just sample. LLM provider = **Subconscious** (OpenAI-compatible, key in `.env`, rotate the leaked one).

### Menopause section — 7 required features
1. **Race & ethnicity** — optional onboarding field; context only (SWAN shows timing/burden varies), never a standalone risk score.
2. **Age** — drives perimenopause staging + "you may be entering perimenopause" flag.
3. **Hot flashes (count)** — logged + auto-detected (skin-temp spike + HR jump), charted over time.
4. **Night sweats detection** — nighttime temp spikes during the sleep window (distinct from daytime flashes), from WHOOP sleep + temp.
5. **Sleep fragmentation** — disturbance count, efficiency/performance, awake time; trend vs baseline.
6. **Perimenopause staging risk flags + alerts** — age + cycle irregularity + HRV decline + flash/sweat frequency + sleep fragmentation → staging indicator + in-app notifications. PATTERN/FLAG, never a diagnosis.
7. **Mental-health check (BP, HRV)** — HRV trend + typed BP (from Records) + short mood/stress report → when-to-seek-help prompt. Context, not clinical assessment.

### Other requested changes (this batch)
- **Rename** everything Luna → Glitch.
- **Perlin-noise** animated background component (bigger, more alive UI; screen currently looks empty).
- **Fix food macro bug** — no API key → zero macros. Added local nutrition DB (`data/nutritionDb.ts`) as the floor; LLM refines when available. Macros must update on log.
- **Vision** food identification from photo (via Subconscious vision model; graceful fallback).
- **Fitness**: suggest exercises FIRST by phase; ask level (beginner/intermediate/advanced); ask for input; show correct form/posture figure.
- **Voice assistant** — talk to it, it takes notes → saves to DB (Web Speech API).
- **Motivational messages.**
- **Spotify connect** option.
- **Datasets** (credentialed, can't bulk-commit) — ground the model on their documented structure, add a loader if CSVs are dropped in:
  - mcPHASES (PhysioNet): Fitbit HRV/skin-temp/sleep + urinary hormones (estrogen/LH/progesterone) + CGM.
  - Hot Flashes (TSHS / causeweb.org/tshs/hot-flashes): sternal skin conductance (EDA), activity, microclimate temp/humidity.
- **WHOOP**: wire the `/whoop/callback` OAuth redirect handler so live connect completes (see §3).
- **Women's psych / hormone** framing woven into coach + menopause support.
