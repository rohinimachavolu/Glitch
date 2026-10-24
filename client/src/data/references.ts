/**
 * Luna — Sourced Reference Constants
 * ─────────────────────────────────────────────────────────────
 * EVERY clinical / physiological number the app uses lives here, each with a
 * source citation. No magic literals in components or engines.
 *
 * SAFETY: These are population reference values for CONTEXT only. They are never
 * presented as an individual diagnosis, score, or medical advice.
 */

// ── Menstrual cycle norms ────────────────────────────────────
// source: NICHD/NIH — average cycle ~28d, adults typically 21–35d, teens 21–45d
//   https://www.nichd.nih.gov/health/topics/factsheets/menstruation
// source: Apple Women's Health Study / Harvard Chan — 87% of cycles fall 23–38d
//   https://awhs-updates.hsph.harvard.edu/cycle-length-variability/part-4/
export const CYCLE = {
  DEFAULT_LENGTH: 28,
  MIN_TYPICAL: 21,
  MAX_TYPICAL: 35,
  // Band containing ~87% of cycles (AWHS)
  POPULATION_BAND_LOW: 23,
  POPULATION_BAND_HIGH: 38,
  // Period bleed length used for calendar shading (NICHD: typically 2–7 days)
  TYPICAL_PERIOD_DAYS: 5,
} as const;

// source: Human Reproduction big-data ovulation study (Fehring/ Natural Cycles lineage)
//   https://pubmed.ncbi.nlm.nih.gov/32328534/  — >50% of people vary 5+ days
//   month-to-month; ovulation NOT fixed at day 14 (10-day spread; most common day 15)
export const CYCLE_VARIABILITY = {
  COMMON_VARIATION_DAYS: 5,       // most people vary by at least this much
  OVULATION_MOST_COMMON_DAY: 15,  // for a 28-day cycle, not a rule
  OVULATION_SPREAD_DAYS: 10,      // observed spread of ovulation day
} as const;

// Phase boundaries as FRACTIONS of the individual's cycle length, not fixed days.
// Grounded in standard reproductive physiology: menstrual (bleed) → follicular →
// ovulatory window → luteal (~14d post-ovulation).
// source: UCSF Center for Reproductive Health — cycle phases overview
//   https://crh.ucsf.edu/about-fertility/normal-menstrual-cycle
export const PHASE_FRACTIONS = {
  MENSTRUAL_END: 5 / 28,    // days 1–5 of a 28d cycle
  FOLLICULAR_END: 12 / 28,  // through ~day 12
  OVULATION_END: 16 / 28,   // fertile/ovulatory window ~day 13–16
  // remainder → luteal
} as const;

// ── Biometric shifts across the cycle (direction, used for corroboration) ──
// source: WHOOP Menstrual Cycle Insights white paper + npj Digital Medicine
//   (Nature) 45,000-cycle study — predictable RHR & HRV fluctuation across cycle
//   https://www.whoop.com/thelocker/menstrual-cycle-insights-white-paper/
// source: Wearable menses physiology study — pulse rate & wrist skin temp shift
//   https://pubmed.ncbi.nlm.nih.gov/30998226/
// source: Stanford/42k-cycle wearable map — sleep, RHR, HRV, resp rate, temp
//   https://humanperformance.stanford.edu/news/a-wearable-device-tracked-over-42000-menstrual-cycles-heres-what-researchers-found/
export const CYCLE_BIOMETRIC_PATTERN = {
  // Typical post-ovulation skin-temperature rise (luteal), in °C
  LUTEAL_SKIN_TEMP_RISE_C: 0.3,
  // Resting HR tends to rise and HRV tends to fall in the luteal phase
  LUTEAL_RHR_DIRECTION: "up" as const,
  LUTEAL_HRV_DIRECTION: "down" as const,
  // Respiratory rate tends to be slightly higher in the luteal phase
  LUTEAL_RESP_RATE_DIRECTION: "up" as const,
} as const;

// ── Fitness across the cycle — HONEST framing ────────────────
// source: McMaster umbrella review (Frontiers Sports & Active Living, 2023) —
//   premature to conclude cycle phase meaningfully changes strength/adaptation
//   https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1054542/full
// source: Frontiers narrative review 2025 — some evidence strength lowest in luteal
//   https://www.frontiersin.org/journals/endocrinology/articles/10.3389/fendo.2025.1448686/full
// => The app reflects the USER'S OWN logged performance vs cycle, never a universal rule.
export const FITNESS_EVIDENCE = {
  PHASE_RULE_IS_PRESCRIPTIVE: false, // we do NOT prescribe "train hard here / rest there"
  MIN_CYCLES_FOR_PERSONAL_PATTERN: 2, // need ≥2 logged cycles before claiming a pattern
} as const;

// ── PCOS pattern thresholds (pattern-flagging only, NEVER diagnosis) ─────────
// source: Apple Women's Health Study PCOS & variability paper
//   https://pubmed.ncbi.nlm.nih.gov/41297783/
// source: sleep-derived HR/HRV features associate with glucose metabolism status
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC12944498/
export const PCOS_PATTERN = {
  // Cycles longer than this (days) are considered "long" and worth noting
  LONG_CYCLE_DAYS: 35,
  // Standard deviation of cycle length above this = high irregularity
  HIGH_IRREGULARITY_SD_DAYS: 9,
  // A flat luteal temp curve (rise below this °C) can indicate anovulation
  FLAT_TEMP_RISE_THRESHOLD_C: 0.15,
} as const;

// ── Menopause / perimenopause facts ──────────────────────────
// source: Yale Medicine — avg menopause age ~51; hot flashes often start in
//   perimenopause, average duration 7–9 years
//   https://www.yalemedicine.org/news/hot-flashes
// source: NIH thermoregulation review — hot flashes affect 50–80%, hallmark symptom
//   https://pubmed.ncbi.nlm.nih.gov/40330614/
// source: Terra — night-time HRV drops ~11ms in perimenopause
//   https://tryterra.co/research/can-wearables-detect-menopause
// source: smart-clothing sensor study — skin temp + humidity capture hot-flash
//   frequency/duration/intensity  https://mdpi.com/1424-8220/20/4/1093
export const MENOPAUSE = {
  AVG_MENOPAUSE_AGE: 51,
  HOT_FLASH_PREVALENCE_LOW: 50,   // %
  HOT_FLASH_PREVALENCE_HIGH: 80,  // %
  HOT_FLASH_AVG_DURATION_YEARS_LOW: 7,
  HOT_FLASH_AVG_DURATION_YEARS_HIGH: 9,
  PERIMENOPAUSE_HRV_DROP_MS: 11,
  // Hot-flash auto-detection: skin-temp spike above rolling baseline (°C)
  HOT_FLASH_TEMP_SPIKE_C: 0.5,
  // paired with a resting/instant HR jump above baseline (bpm)
  HOT_FLASH_HR_JUMP_BPM: 8,
  // Perimenopause typically begins mid-40s (can be earlier). Age bands for
  // age-based likelihood of being in the transition.
  // source: Mayo Clinic / Yale — perimenopause commonly starts 40s, avg menopause 51
  PERI_AGE_EARLY: 40,     // possible from here
  PERI_AGE_LIKELY: 45,    // commonly in transition
  MENO_AGE_TYPICAL: 51,   // average menopause
  // Night sweat = elevated night (sleep-window) skin temp above baseline (°C)
  NIGHT_SWEAT_TEMP_C: 0.4,
  // Sleep fragmentation flag: disturbances above baseline, or efficiency below %
  SLEEP_FRAGMENTATION_DISTURBANCES: 15,
  SLEEP_EFFICIENCY_LOW_PCT: 85,
} as const;

// ── Blood pressure categories (for the mental-health/BP check) ──
// source: ACC/AHA 2017 blood pressure categories
//   https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings
export const BLOOD_PRESSURE = {
  ELEVATED_SYSTOLIC: 120,
  HIGH_SYSTOLIC: 130,
  HIGH_DIASTOLIC: 80,
} as const;

// ── Nutrition reference anchors (adult general guidance) ──────
// source: NIH Office of Dietary Supplements fact sheets (iron, calcium, vit D, B12, omega-3)
//   https://ods.od.nih.gov/factsheets/  (per-nutrient pages)
// source: Dietary Guidelines for Americans — fiber, general macros
//   https://www.dietaryguidelines.gov/
// Used as ANCHORS the AI personalizes from; never a prescription.
export const NUTRITION_ANCHORS = {
  IRON_MG_MENSTRUATING: 18,   // higher need for menstruating adults (NIH ODS)
  IRON_MG_POSTMENOPAUSE: 8,   // lower after menopause (NIH ODS)
  CALCIUM_MG: 1000,
  CALCIUM_MG_POSTMENOPAUSE: 1200, // bone health emphasis post-menopause
  VIT_D_IU: 600,
  VIT_B12_MCG: 2.4,
  OMEGA3_G: 1.6,
  FIBER_G: 28,
  PROTEIN_G_PER_KG: 1.6,
} as const;

// ── Phase-specific nutrition emphasis (context, from the above anchors) ──────
export const PHASE_NUTRITION = {
  menstrual:  { priority: ["Iron", "Protein", "Hydration"],                  note: "Iron-rich foods (lentils, beans, tofu, leafy greens) help replace losses during bleeding." },
  follicular: { priority: ["Complex carbs", "B vitamins", "Energy"],         note: "Rising energy — whole grains, eggs and greens fuel the follicular lift." },
  ovulation:  { priority: ["Protein", "Antioxidants", "Recovery"],           note: "Lean protein and colorful vegetables support this higher-energy window." },
  luteal:     { priority: ["Magnesium", "Fiber", "Blood-sugar stability"],   note: "Magnesium (dark chocolate, pumpkin seeds, avocado) and fiber can ease luteal symptoms." },
} as const;

// ── Data-source attributions surfaced in the UI ──────────────
export const DATA_SOURCES = {
  cdcPlaces: {
    label: "CDC PLACES (2022/2023)",
    note: "U.S. government public data. County-level context, not an individual score.",
    url: "https://data.cdc.gov/",
  },
  awhs: {
    label: "Apple Women's Health Study / Harvard Chan",
    note: "Population reference statistics, not individual medical advice.",
    url: "https://hsph.harvard.edu/research/apple-womens-health-study/",
  },
  whoop: {
    label: "WHOOP Developer API v2",
    note: "Your own device data, read only with your consent.",
    url: "https://developer.whoop.com/",
  },
  physionet: {
    label: "PhysioNet wearable datasets",
    note: "Public research data used for sample/seed series only.",
    url: "https://physionet.org/",
  },
} as const;
