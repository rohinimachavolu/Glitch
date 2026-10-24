/**
 * Glitch — Exercise library + phase-aware suggestions
 * Suggests exercises FIRST (by phase + level), with form cues and a posture
 * figure. Honest framing: suggestions adapt to how you feel, not a hard rule.
 */
import type { CyclePhase, FitnessLevel } from "@/db/types";

export interface Exercise {
  id: string;
  name: string;
  emoji: string;
  level: FitnessLevel;
  focus: "strength" | "cardio" | "mobility" | "recovery";
  sets: string;             // "3 × 12" or "20 min"
  cues: string[];           // form cues
  // Normalized 2D stick-figure keypoints (0..1) for the posture figure.
  posture: { points: Record<string, [number, number]>; label: string };
}

// Simple reusable postures (x,y normalized; y down).
const SQUAT = {
  label: "Squat — hips back, chest up, knees over toes",
  points: {
    head: [0.5, 0.12], neck: [0.5, 0.22], hip: [0.5, 0.52],
    kneeL: [0.4, 0.68], kneeR: [0.6, 0.68], ankleL: [0.42, 0.9], ankleR: [0.58, 0.9],
    shoulderL: [0.42, 0.26], shoulderR: [0.58, 0.26], handL: [0.4, 0.42], handR: [0.6, 0.42],
  } as Record<string, [number, number]>,
};
const PLANK = {
  label: "Plank — straight line from head to heels, hips level",
  points: {
    head: [0.15, 0.4], neck: [0.22, 0.42], hip: [0.6, 0.5], ankleL: [0.9, 0.58], ankleR: [0.9, 0.58],
    shoulderL: [0.25, 0.43], shoulderR: [0.25, 0.43], handL: [0.22, 0.62], handR: [0.22, 0.62],
    kneeL: [0.75, 0.54], kneeR: [0.75, 0.54],
  } as Record<string, [number, number]>,
};
const HINGE = {
  label: "Hinge — flat back, hips push back, soft knees",
  points: {
    head: [0.3, 0.2], neck: [0.34, 0.26], hip: [0.62, 0.42],
    kneeL: [0.6, 0.66], kneeR: [0.66, 0.66], ankleL: [0.6, 0.9], ankleR: [0.66, 0.9],
    shoulderL: [0.34, 0.28], shoulderR: [0.34, 0.28], handL: [0.36, 0.5], handR: [0.36, 0.5],
  } as Record<string, [number, number]>,
};
const STRETCH = {
  label: "Gentle stretch — breathe, no bouncing",
  points: {
    head: [0.5, 0.14], neck: [0.5, 0.24], hip: [0.5, 0.54], kneeL: [0.4, 0.72], kneeR: [0.6, 0.72],
    ankleL: [0.4, 0.92], ankleR: [0.6, 0.92], shoulderL: [0.4, 0.28], shoulderR: [0.6, 0.28],
    handL: [0.32, 0.16], handR: [0.68, 0.16],
  } as Record<string, [number, number]>,
};

export const EXERCISES: Exercise[] = [
  { id: "bw_squat", name: "Bodyweight Squat", emoji: "🏋️", level: "beginner", focus: "strength", sets: "3 × 12", cues: ["Chest up, core braced", "Knees track over toes", "Sit hips back and down", "Drive through heels"], posture: SQUAT },
  { id: "goblet_squat", name: "Goblet Squat", emoji: "🏋️", level: "intermediate", focus: "strength", sets: "4 × 10", cues: ["Hold weight at chest", "Elbows inside knees at bottom", "Keep heels down"], posture: SQUAT },
  { id: "plank", name: "Plank Hold", emoji: "🧘", level: "beginner", focus: "strength", sets: "3 × 30s", cues: ["Straight line head to heels", "Squeeze glutes", "Don't let hips sag"], posture: PLANK },
  { id: "hinge", name: "Hip Hinge / RDL", emoji: "🏋️", level: "intermediate", focus: "strength", sets: "4 × 8", cues: ["Flat back throughout", "Push hips back", "Soft knees, bar close"], posture: HINGE },
  { id: "walk", name: "Brisk Walk", emoji: "🚶", level: "beginner", focus: "cardio", sets: "20–30 min", cues: ["Relaxed shoulders", "Steady breathing", "Easy conversational pace"], posture: STRETCH },
  { id: "yoga_flow", name: "Gentle Yoga Flow", emoji: "🧘", level: "beginner", focus: "mobility", sets: "15 min", cues: ["Move with your breath", "No forcing a stretch", "Rest in child's pose as needed"], posture: STRETCH },
  { id: "hiit", name: "Short HIIT Intervals", emoji: "⚡", level: "advanced", focus: "cardio", sets: "6 × 40s", cues: ["Full effort in work bursts", "Full rest between", "Stop if form breaks"], posture: SQUAT },
  { id: "mobility", name: "Mobility & Stretch", emoji: "🌀", level: "beginner", focus: "recovery", sets: "10 min", cues: ["Slow and controlled", "Breathe into tight areas", "Never bounce"], posture: STRETCH },
];

export interface PhaseSuggestion {
  intro: string;         // phase-aware intro (honest, soft)
  askLevel: boolean;
  recommended: Exercise[];
}

/**
 * Suggest exercises FIRST, by phase + level. The intro reflects typical energy
 * but invites the user to adjust — never prescriptive.
 */
export function suggestExercises(phase: CyclePhase | null, level: FitnessLevel, mode: string): PhaseSuggestion {
  const pool = EXERCISES.filter((e) => {
    if (level === "beginner") return e.level === "beginner";
    if (level === "intermediate") return e.level !== "advanced";
    return true;
  });

  let intro = "Here's a starting point for today. You know your body — scale up or down to how you actually feel.";
  let focus: Exercise["focus"][] = ["strength", "cardio", "mobility"];

  if (mode === "menopause") {
    intro = "Strength and gentle cardio protect bone and muscle through the transition. Here's a supportive set — adjust to your energy.";
    focus = ["strength", "mobility", "cardio"];
  } else if (phase === "menstrual") {
    intro = "You might have less energy right now — that's okay. Gentle movement counts. Push harder only if you feel up to it.";
    focus = ["mobility", "recovery", "cardio"];
  } else if (phase === "follicular") {
    intro = "Energy often rises in the follicular phase — a nice window to build if you're feeling it. Still, listen to your body.";
    focus = ["strength", "cardio"];
  } else if (phase === "ovulation") {
    intro = "Many feel strongest around ovulation. If you're up for a challenge, today could be a good day — no pressure though.";
    focus = ["strength", "cardio"];
  } else if (phase === "luteal") {
    intro = "Energy can dip in the luteal phase for some. Moderate, steady sessions tend to feel good — but go by how you actually feel today.";
    focus = ["strength", "mobility", "recovery"];
  }

  const recommended = focus.flatMap((f) => pool.filter((e) => e.focus === f)).slice(0, 4);
  return { intro, askLevel: true, recommended: recommended.length ? recommended : pool.slice(0, 4) };
}
