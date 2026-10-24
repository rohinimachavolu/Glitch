/**
 * Glitch — Life-stage guidance for users who aren't currently having menstrual cycles.
 * Each stage changes what the app is allowed to recommend (e.g. no calorie deficit in pregnancy,
 * no ovulation detection on hormonal contraception). General wellness guidance only.
 */

export type NoCycleReason =
  | "pregnant"
  | "postpartum"
  | "perimenopause"
  | "menopause"
  | "not_started"
  | "hormonal_contraception"
  | "other";

export interface LifeStageInfo {
  id: NoCycleReason;
  label: string;
  emoji: string;
  question?: string;
  summary: string;
  fitness: string[];
  nutrition: string[];
  watch: string[];
  /** Whether temperature-based ovulation detection makes sense */
  ovulationTracking: boolean;
  /** Whether the nutrition plan may include a calorie deficit */
  allowCalorieDeficit: boolean;
}

export const LIFE_STAGES: Record<NoCycleReason, LifeStageInfo> = {
  pregnant: {
    id: "pregnant", label: "Pregnant", emoji: "🤰",
    summary: "Your plan focuses on steady energy, safe movement and blood-sugar stability — not weight loss.",
    fitness: ["Moderate activity most days (brisk walks, swimming, prenatal yoga)", "Avoid lying flat on your back after the first trimester", "Skip contact sports and anything with a fall risk", "Use the talk test — you should be able to hold a conversation"],
    nutrition: ["No calorie deficit — needs rise in the 2nd and 3rd trimester", "Pair carbs with protein and fibre to keep blood sugar steady", "Folate, iron, iodine and choline are priorities", "Walk 10 minutes after meals to blunt glucose spikes"],
    watch: ["Ask your clinician about gestational-diabetes screening (usually 24–28 weeks)", "Sudden swelling, headaches or vision changes need prompt medical attention"],
    ovulationTracking: false, allowCalorieDeficit: false,
  },
  postpartum: {
    id: "postpartum", label: "Postpartum / breastfeeding", emoji: "👶",
    summary: "Recovery first. Sleep is fragmented, so we read your recovery score generously and build back slowly.",
    fitness: ["Start with walking and pelvic-floor work once cleared by your clinician", "Rebuild core strength before high-impact exercise", "Let recovery — not the calendar — set your intensity"],
    nutrition: ["Breastfeeding adds roughly 400–500 kcal/day — avoid aggressive deficits", "Prioritise protein, hydration and iron", "Small frequent meals help on low-sleep days"],
    watch: ["Periods may stay absent while breastfeeding — that's common", "Low mood lasting more than two weeks is worth raising with a clinician"],
    ovulationTracking: false, allowCalorieDeficit: false,
  },
  perimenopause: {
    id: "perimenopause", label: "Perimenopause", emoji: "🌗",
    summary: "Cycles may be irregular. We track hot flushes and sleep through skin temperature, and focus on muscle, bone and heart health.",
    fitness: ["Strength training 2–3×/week to protect muscle and bone", "Zone-2 cardio for heart health", "Add balance and mobility work"],
    nutrition: ["Higher protein (about 1.2 g/kg) to preserve muscle", "Calcium and vitamin D for bone health", "Limit alcohol and late caffeine — both worsen night sweats and sleep"],
    watch: ["Heart-disease risk starts rising — keep an eye on blood pressure and lipids", "Very heavy or prolonged bleeding should be checked by a clinician"],
    ovulationTracking: true, allowCalorieDeficit: true,
  },
  menopause: {
    id: "menopause", label: "Menopause / post-menopause", emoji: "🌕",
    summary: "No cycle tracking — instead we focus on bone density, heart health, sleep and metabolic health.",
    fitness: ["Progressive strength training is the single best thing for bone and muscle", "150+ minutes/week of moderate cardio for heart health", "Impact and balance work help prevent falls"],
    nutrition: ["Protein at every meal", "Calcium, vitamin D and fibre", "Watch for rising fasting glucose and LDL — metabolism shifts after menopause"],
    watch: ["Any bleeding after menopause should be checked by a clinician", "Discuss bone-density screening with your clinician"],
    ovulationTracking: false, allowCalorieDeficit: true,
  },
  not_started: {
    id: "not_started", label: "Haven't had my first period yet", emoji: "🌱",
    summary: "Your plan is about energy, strength and healthy habits — never weight loss or restriction.",
    fitness: ["Play, sport and fun movement for about an hour a day", "Bodyweight strength is great — no heavy maxing out", "Rest days matter for growing bodies"],
    nutrition: ["Regular meals and snacks — no calorie counting or deficits", "Iron and calcium-rich foods support growth", "Plenty of water, especially with sport"],
    watch: ["If you're 15 or older and haven't had a period, it's worth talking to a doctor"],
    ovulationTracking: false, allowCalorieDeficit: false,
  },
  hormonal_contraception: {
    id: "hormonal_contraception", label: "Hormonal birth control", emoji: "💊",
    summary: "Most hormonal methods pause ovulation, so we turn off ovulation detection and track how you feel instead.",
    fitness: ["Train by recovery score and how you feel — no phase-based periodisation needed", "Strength and cardio as normal"],
    nutrition: ["Some pills can lower B6, B12, folate and magnesium — include leafy greens, legumes and whole grains"],
    watch: ["Migraines with aura, chest pain or leg swelling on combined pills need prompt medical attention"],
    ovulationTracking: false, allowCalorieDeficit: true,
  },
  other: {
    id: "other", label: "Other / prefer not to say", emoji: "🤍",
    summary: "We'll skip cycle tracking and personalise from your recovery, sleep and goals.",
    fitness: ["Train by your WHOOP recovery and strain targets"],
    nutrition: ["Balanced meals built around protein, fibre and whole foods"],
    watch: ["Periods missing for 3+ months without a known reason are worth discussing with a clinician"],
    ovulationTracking: false, allowCalorieDeficit: true,
  },
};

export const NO_CYCLE_OPTIONS: NoCycleReason[] = ["pregnant", "postpartum", "perimenopause", "menopause", "not_started", "hormonal_contraception", "other"];
