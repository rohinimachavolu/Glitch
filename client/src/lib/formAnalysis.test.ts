import { describe, expect, it } from "vitest";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { LM, createAnalyzer, matchFormExercise } from "./formAnalysis";

type P = [number, number];

/** Build a 33-point pose with the given left-side joints fully visible, everything else hidden. */
function pose(joints: Partial<Record<keyof typeof LM, P>>): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  for (const [name, [x, y]] of Object.entries(joints)) {
    lm[LM[name as keyof typeof LM]] = { x, y, z: 0, visibility: 0.99 };
  }
  return lm;
}

/** Side-view squat: knee fixed, hip swings back/down as knee angle closes. */
function squatPose(kneeDeg: number, leanForward = false): NormalizedLandmark[] {
  const knee: P = [0.5, 0.7];
  const ankle: P = [0.5, 0.9];
  const t = ((180 - kneeDeg) * Math.PI) / 180;
  const hip: P = [knee[0] - 0.2 * Math.sin(t), knee[1] - 0.2 * Math.cos(t)];
  const shoulder: P = leanForward ? [hip[0] + 0.25, hip[1] - 0.08] : [hip[0] + 0.05, hip[1] - 0.25];
  return pose({ lShoulder: shoulder, lHip: hip, lKnee: knee, lAnkle: ankle, lFoot: [0.56, 0.9] });
}

function run(id: Parameters<typeof createAnalyzer>[0], frames: NormalizedLandmark[][]) {
  const a = createAnalyzer(id);
  return frames.map((f, i) => a.update(f, 1, 1, i * 33));
}

describe("squat analyzer", () => {
  it("counts a full-depth rep as clean", () => {
    const angles = [175, 150, 120, 95, 85, 95, 130, 165, 175];
    const out = run("squat", angles.map((a) => squatPose(a)));
    expect(out.filter((f) => f.repCompleted)).toHaveLength(1);
    expect(out.find((f) => f.repCompleted)!.repClean).toBe(true);
  });

  it("does not count a shallow rep", () => {
    const angles = [175, 150, 125, 115, 130, 165, 175];
    const out = run("squat", angles.map((a) => squatPose(a)));
    expect(out.some((f) => f.repCompleted)).toBe(false);
    expect(out.some((f) => f.cue.includes("deeper"))).toBe(true);
  });

  it("flags excessive forward lean and marks the rep as not clean", () => {
    const angles = [175, 140, 110, 90, 110, 165];
    const out = run("squat", angles.map((a) => squatPose(a, true)));
    expect(out.some((f) => f.faults.includes("Keep your chest up"))).toBe(true);
    expect(out.find((f) => f.repCompleted)!.repClean).toBe(false);
  });

  it("asks the user to step back when joints are not visible", () => {
    const [f] = run("squat", [pose({ lShoulder: [0.5, 0.2] })]);
    expect(f.inFrame).toBe(false);
  });
});

describe("push-up analyzer", () => {
  function pushupPose(elbowDeg: number, hipDrop = 0): NormalizedLandmark[] {
    const shoulderY = 0.5 + 0.12 * (1 - Math.min(1, (elbowDeg - 70) / 110));
    const wrist: P = [0.3, 0.75];
    const elbow: P = [0.3, (shoulderY + 0.75) / 2];
    return pose({ lShoulder: [0.3, shoulderY], lElbow: [elbow[0] + 0.05 * (1 - elbowDeg / 180) * 4, elbow[1]], lWrist: wrist, lHip: [0.55, shoulderY + 0.1 + hipDrop], lAnkle: [0.85, 0.72] });
  }

  it("flags sagging hips", () => {
    const out = run("pushup", [pushupPose(170, 0.15)]);
    expect(out[0].faults[0]).toMatch(/sagging/);
  });
});

describe("matchFormExercise", () => {
  it("maps AI plan names to analyzers", () => {
    expect(matchFormExercise("Goblet Squat")).toBe("squat");
    expect(matchFormExercise("Incline Push-Ups")).toBe("pushup");
    expect(matchFormExercise("Bulgarian Split Squat")).toBe("lunge");
    expect(matchFormExercise("Single-leg Glute Bridge")).toBe("bridge");
    expect(matchFormExercise("Bicep Curl")).toBeNull();
  });
});
