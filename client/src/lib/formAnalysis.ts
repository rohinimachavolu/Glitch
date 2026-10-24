/**
 * NutriSense AI — Real-time Form Analysis
 * Turns MediaPipe pose landmarks into joint angles, rep counts and form faults.
 * Every analyzer is a small state machine: "up" → "down" → "up" = 1 rep.
 * A rep is "clean" if no fault was raised while it was performed.
 */
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// BlazePose landmark indices
export const LM = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lElbow: 13,    rElbow: 14,
  lWrist: 15,    rWrist: 16,
  lHip: 23,      rHip: 24,
  lKnee: 25,     rKnee: 26,
  lAnkle: 27,    rAnkle: 28,
  lFoot: 31,     rFoot: 32,
} as const;

export type FormExerciseId = "squat" | "pushup" | "lunge" | "plank" | "bridge";

export interface FormFrame {
  inFrame: boolean;
  /** Main joint angle shown on screen (knee for squat, elbow for push-up…) */
  angle: number | null;
  angleLabel: string;
  stage: "up" | "down" | "hold";
  faults: string[];
  /** Landmark indices to highlight red on the skeleton */
  faultJoints: number[];
  repCompleted: boolean;
  repClean: boolean;
  /** Plank only: seconds held in good position */
  holdSeconds?: number;
  cue: string;
}

export interface FormExerciseDef {
  id: FormExerciseId;
  name: string;
  emoji: string;
  setup: string;
  cues: string[];
}

export const FORM_EXERCISES: FormExerciseDef[] = [
  { id: "squat",  name: "Squat",        emoji: "🏋️", setup: "Stand side-on to the camera, full body in view.", cues: ["Hips below knees (thigh parallel)", "Chest up, torso under 45°", "Knees stay behind toes", "Drive up through heels"] },
  { id: "pushup", name: "Push-Up",      emoji: "💪", setup: "Place the phone on the floor, side-on, about 2 m away.", cues: ["Elbows bend to 90°", "Straight line head to heels", "Don't let hips sag or pike", "Lock out at the top"] },
  { id: "lunge",  name: "Lunge",        emoji: "🦵", setup: "Stand side-on to the camera, full body in view.", cues: ["Front knee bends to 90°", "Torso stays upright", "Front knee behind toes", "Push back through front heel"] },
  { id: "plank",  name: "Plank",        emoji: "🧘", setup: "Phone on the floor, side-on, full body in view.", cues: ["Straight line shoulders → ankles", "Elbows under shoulders", "Squeeze glutes, brace core", "Breathe steadily"] },
  { id: "bridge", name: "Glute Bridge", emoji: "🍑", setup: "Lie side-on to the camera, knees bent.", cues: ["Drive hips up to full extension", "Straight line shoulders → knees", "Squeeze glutes at the top", "Lower with control"] },
];

type Pt = { x: number; y: number };

/** Angle ABC in degrees, in pixel space so non-square video doesn't skew it. */
function angle(a: Pt, b: Pt, c: Pt): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

/** Angle of segment a→b from vertical, 0° = upright. */
function leanFromVertical(top: Pt, bottom: Pt): number {
  return (Math.atan2(Math.abs(top.x - bottom.x), Math.abs(bottom.y - top.y)) * 180) / Math.PI;
}

/** Signed distance of p from the line a→c (positive = below the line on screen). */
function offsetFromLine(a: Pt, c: Pt, p: Pt): number {
  const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
  const cross = (c.x - a.x) * (p.y - a.y) - (c.y - a.y) * (p.x - a.x);
  // Normalise sign so "below" is positive regardless of facing direction
  return (cross / len) * (c.x >= a.x ? 1 : -1);
}

interface Side {
  shoulder: number; elbow: number; wrist: number;
  hip: number; knee: number; ankle: number; foot: number;
}
const LEFT: Side  = { shoulder: LM.lShoulder, elbow: LM.lElbow, wrist: LM.lWrist, hip: LM.lHip, knee: LM.lKnee, ankle: LM.lAnkle, foot: LM.lFoot };
const RIGHT: Side = { shoulder: LM.rShoulder, elbow: LM.rElbow, wrist: LM.rWrist, hip: LM.rHip, knee: LM.rKnee, ankle: LM.rAnkle, foot: LM.rFoot };

function vis(lm: NormalizedLandmark[], i: number) {
  return lm[i]?.visibility ?? 0;
}

/** Pick the side facing the camera (higher landmark confidence). */
function pickSide(lm: NormalizedLandmark[], joints: (keyof Side)[]): Side {
  const score = (s: Side) => joints.reduce((sum, j) => sum + vis(lm, s[j]), 0);
  return score(LEFT) >= score(RIGHT) ? LEFT : RIGHT;
}

function visible(lm: NormalizedLandmark[], side: Side, joints: (keyof Side)[], min = 0.5) {
  return joints.every((j) => vis(lm, side[j]) >= min);
}

export interface FormAnalyzer {
  update(lm: NormalizedLandmark[], width: number, height: number, now: number): FormFrame;
}

const OUT_OF_FRAME: Omit<FormFrame, "angleLabel"> = {
  inFrame: false, angle: null, stage: "up", faults: [], faultJoints: [],
  repCompleted: false, repClean: false, cue: "Step back so your full body is visible",
};

/**
 * Shared rep state machine. `downAt` / `upAt` are thresholds on the main angle
 * (with a gap between them so jitter can't double-count).
 */
function makeRepCounter(downAt: number, upAt: number) {
  let stage: "up" | "down" = "up";
  let minAngle = 180;
  let faultSeen = false;
  return {
    step(a: number, hasFault: boolean) {
      let repCompleted = false, repClean = false, shallow = false;
      if (a < upAt) {
        minAngle = Math.min(minAngle, a);
        if (hasFault) faultSeen = true;
      }
      if (stage === "up" && a <= downAt) {
        stage = "down";
      } else if (a >= upAt) {
        if (stage === "down") {
          repCompleted = true;
          repClean = !faultSeen;
        } else if (minAngle < upAt - 25) {
          // Started the movement but came back up before reaching depth
          shallow = true;
        }
        stage = "up";
        minAngle = 180;
        faultSeen = false;
      }
      return { stage, repCompleted, repClean, shallow };
    },
  };
}

function px(lm: NormalizedLandmark[], i: number, w: number, h: number): Pt {
  return { x: lm[i].x * w, y: lm[i].y * h };
}

// ── Squat ─────────────────────────────────────────────────────
function squat(): FormAnalyzer {
  const reps = makeRepCounter(100, 160);
  let shallowUntil = 0;
  return {
    update(lm, w, h, now) {
      const s = pickSide(lm, ["hip", "knee", "ankle"]);
      if (!visible(lm, s, ["shoulder", "hip", "knee", "ankle"])) return { ...OUT_OF_FRAME, angleLabel: "Knee" };
      const P = (i: number) => px(lm, i, w, h);
      const knee = angle(P(s.hip), P(s.knee), P(s.ankle));
      const lean = leanFromVertical(P(s.shoulder), P(s.hip));
      const shin = Math.hypot(P(s.knee).x - P(s.ankle).x, P(s.knee).y - P(s.ankle).y);
      const footDir = Math.sign(P(s.foot).x - P(s.ankle).x) || 1;
      const kneePastToe = vis(lm, s.foot) > 0.5 && (P(s.knee).x - P(s.foot).x) * footDir > shin * 0.25;

      const faults: string[] = [];
      const faultJoints: number[] = [];
      const moving = knee < 150;
      if (moving && lean > 50) { faults.push("Keep your chest up"); faultJoints.push(s.shoulder, s.hip); }
      if (moving && kneePastToe) { faults.push("Sit your hips back — knees past toes"); faultJoints.push(s.knee); }

      const r = reps.step(knee, faults.length > 0);
      if (r.shallow) shallowUntil = now + 1500;

      let cue = "Stand tall, then sit back and down";
      if (faults.length) cue = faults[0];
      else if (now < shallowUntil) cue = "Go deeper — aim for thighs parallel";
      else if (r.stage === "down") cue = "Good depth! Drive up through your heels";
      else if (moving) cue = knee > 115 ? "Lower… keep going" : "Almost there";

      return { inFrame: true, angle: knee, angleLabel: "Knee", stage: r.stage, faults, faultJoints, repCompleted: r.repCompleted, repClean: r.repClean, cue };
    },
  };
}

// ── Push-up ───────────────────────────────────────────────────
function pushup(): FormAnalyzer {
  const reps = makeRepCounter(95, 155);
  let shallowUntil = 0;
  return {
    update(lm, w, h, now) {
      const s = pickSide(lm, ["shoulder", "elbow", "wrist", "hip", "ankle"]);
      if (!visible(lm, s, ["shoulder", "elbow", "wrist", "hip", "ankle"])) return { ...OUT_OF_FRAME, angleLabel: "Elbow" };
      const P = (i: number) => px(lm, i, w, h);
      const elbow = angle(P(s.shoulder), P(s.elbow), P(s.wrist));
      const body = angle(P(s.shoulder), P(s.hip), P(s.ankle));
      const sag = offsetFromLine(P(s.shoulder), P(s.ankle), P(s.hip));

      const faults: string[] = [];
      const faultJoints: number[] = [];
      if (body < 160) {
        faults.push(sag > 0 ? "Hips sagging — brace your core" : "Hips too high — lower them in line");
        faultJoints.push(s.hip);
      }

      const r = reps.step(elbow, faults.length > 0);
      if (r.shallow) shallowUntil = now + 1500;

      let cue = "Lower your chest toward the floor";
      if (faults.length) cue = faults[0];
      else if (now < shallowUntil) cue = "Go lower — elbows to 90°";
      else if (r.stage === "down") cue = "Great depth! Push up";
      else if (elbow > 155) cue = "Strong lockout — body in a straight line";

      return { inFrame: true, angle: elbow, angleLabel: "Elbow", stage: r.stage, faults, faultJoints, repCompleted: r.repCompleted, repClean: r.repClean, cue };
    },
  };
}

// ── Lunge ─────────────────────────────────────────────────────
function lunge(): FormAnalyzer {
  const reps = makeRepCounter(105, 160);
  let shallowUntil = 0;
  return {
    update(lm, w, h, now) {
      const need: (keyof Side)[] = ["hip", "knee", "ankle"];
      if (!visible(lm, LEFT, need, 0.4) || !visible(lm, RIGHT, need, 0.4) || vis(lm, LM.lShoulder) + vis(lm, LM.rShoulder) < 0.8) {
        return { ...OUT_OF_FRAME, angleLabel: "Front knee" };
      }
      const P = (i: number) => px(lm, i, w, h);
      const kL = angle(P(LM.lHip), P(LM.lKnee), P(LM.lAnkle));
      const kR = angle(P(LM.rHip), P(LM.rKnee), P(LM.rAnkle));
      // Front leg = the one whose ankle is further forward / knee more bent
      const front = kL <= kR ? LEFT : RIGHT;
      const knee = Math.min(kL, kR);
      const shoulder = vis(lm, LM.lShoulder) >= vis(lm, LM.rShoulder) ? LM.lShoulder : LM.rShoulder;
      const hip = shoulder === LM.lShoulder ? LM.lHip : LM.rHip;
      const lean = leanFromVertical(P(shoulder), P(hip));
      const shin = Math.hypot(P(front.knee).x - P(front.ankle).x, P(front.knee).y - P(front.ankle).y);
      const footDir = Math.sign(P(front.foot).x - P(front.ankle).x) || 1;
      const kneePastToe = vis(lm, front.foot) > 0.5 && (P(front.knee).x - P(front.foot).x) * footDir > shin * 0.2;

      const faults: string[] = [];
      const faultJoints: number[] = [];
      const moving = knee < 150;
      if (moving && lean > 25) { faults.push("Keep your torso upright"); faultJoints.push(shoulder, hip); }
      if (moving && kneePastToe) { faults.push("Front knee past toes — take a longer step"); faultJoints.push(front.knee); }

      const r = reps.step(knee, faults.length > 0);
      if (r.shallow) shallowUntil = now + 1500;

      let cue = "Step forward and lower your back knee";
      if (faults.length) cue = faults[0];
      else if (now < shallowUntil) cue = "Lower — front knee to 90°";
      else if (r.stage === "down") cue = "Nice! Push back through your front heel";

      return { inFrame: true, angle: knee, angleLabel: "Front knee", stage: r.stage, faults, faultJoints, repCompleted: r.repCompleted, repClean: r.repClean, cue };
    },
  };
}

// ── Plank (timed hold) ────────────────────────────────────────
function plank(): FormAnalyzer {
  let held = 0;
  let last = 0;
  return {
    update(lm, w, h, now) {
      const s = pickSide(lm, ["shoulder", "hip", "ankle"]);
      if (!visible(lm, s, ["shoulder", "hip", "ankle"])) { last = 0; return { ...OUT_OF_FRAME, angleLabel: "Body line", holdSeconds: held }; }
      const P = (i: number) => px(lm, i, w, h);
      const body = angle(P(s.shoulder), P(s.hip), P(s.ankle));
      const sag = offsetFromLine(P(s.shoulder), P(s.ankle), P(s.hip));
      // Must actually be horizontal, not standing
      const horizontal = leanFromVertical(P(s.shoulder), P(s.ankle)) > 55;

      const faults: string[] = [];
      const faultJoints: number[] = [];
      if (!horizontal) faults.push("Get into plank position");
      else if (body < 165) { faults.push(sag > 0 ? "Hips sagging — squeeze glutes" : "Hips too high — flatten out"); faultJoints.push(s.hip); }

      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (!faults.length) held += Math.min(dt, 0.25);

      return {
        inFrame: true, angle: body, angleLabel: "Body line", stage: "hold", faults, faultJoints,
        repCompleted: false, repClean: false, holdSeconds: held,
        cue: faults[0] ?? "Perfect line — keep breathing",
      };
    },
  };
}

// ── Glute bridge ──────────────────────────────────────────────
// The bridge counts reps at the *top*, which is the opposite of the other lifts,
// so it gets its own tiny state machine instead of the shared one above.
function gluteBridge(): FormAnalyzer {
  let stage: "up" | "down" = "down";
  let maxHip = 0;
  let partialUntil = 0;
  return {
    update(lm, w, h, now) {
      const s = pickSide(lm, ["shoulder", "hip", "knee"]);
      if (!visible(lm, s, ["shoulder", "hip", "knee"])) return { ...OUT_OF_FRAME, angleLabel: "Hip" };
      const P = (i: number) => px(lm, i, w, h);
      const hip = angle(P(s.shoulder), P(s.hip), P(s.knee));
      let repCompleted = false;
      if (stage === "down") {
        maxHip = Math.max(maxHip, hip);
        if (hip >= 165) { stage = "up"; repCompleted = true; }
        else if (hip <= 135 && maxHip > 150 && maxHip < 165) { partialUntil = now + 1500; maxHip = 0; }
      } else if (hip <= 135) {
        stage = "down";
        maxHip = 0;
      }
      const faults: string[] = [];
      const faultJoints: number[] = [];
      if (now < partialUntil) { faults.push("Drive hips higher — full extension"); faultJoints.push(s.hip); }
      const cue = faults[0] ?? (stage === "up" ? "Squeeze at the top, then lower slowly" : "Drive through heels, lift hips");
      return { inFrame: true, angle: hip, angleLabel: "Hip", stage, faults, faultJoints, repCompleted, repClean: repCompleted, cue };
    },
  };
}
export function createAnalyzer(id: FormExerciseId): FormAnalyzer {
  switch (id) {
    case "squat":  return squat();
    case "pushup": return pushup();
    case "lunge":  return lunge();
    case "plank":  return plank();
    case "bridge": return gluteBridge();
  }
}

/** Map a free-text exercise name (e.g. from the AI plan) to an analyzer, if one fits. */
export function matchFormExercise(name: string): FormExerciseId | null {
  const n = name.toLowerCase();
  if (n.includes("push")) return "pushup";
  if (n.includes("plank")) return "plank";
  if (n.includes("lunge") || n.includes("split squat")) return "lunge";
  if (n.includes("bridge") || n.includes("hip thrust")) return "bridge";
  if (n.includes("squat")) return "squat";
  return null;
}
