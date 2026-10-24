import { describe, expect, it } from "vitest";
import { faceToMood, detectPitch, voiceToArousal, fuseMood, labelFor, calibrate, averageBlendshapes, LABEL_CENTROID } from "./emotion";

describe("face → mood", () => {
  it("reads a smile as positive", () => {
    const m = faceToMood({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8, cheekSquintLeft: 0.4, cheekSquintRight: 0.4 });
    expect(m.valence).toBeGreaterThan(0.5);
  });
  it("reads frown + lowered brows as negative and activated", () => {
    const m = faceToMood({ mouthFrownLeft: 0.6, mouthFrownRight: 0.6, browDownLeft: 0.7, browDownRight: 0.7 });
    expect(m.valence).toBeLessThan(-0.5);
    expect(labelFor(m)).toBe("tense");
  });
  it("reads a relaxed face as neutral-ish", () => {
    expect(labelFor(faceToMood({}))).not.toBe("tense");
  });
});

describe("voice tone", () => {
  it("detects the pitch of a sine wave", () => {
    const sr = 16000, f = 220;
    const buf = new Float32Array(2048).map((_, i) => 0.3 * Math.sin((2 * Math.PI * f * i) / sr));
    expect(detectPitch(buf, sr)).toBeCloseTo(f, -1);
  });
  it("ignores silence", () => {
    expect(detectPitch(new Float32Array(2048), 16000)).toBeNull();
  });
  it("animated, loud speech reads as higher arousal than flat, quiet speech", () => {
    const animated = voiceToArousal({ pitches: [180, 260, 200, 300, 170, 280, 220, 310, 190, 270], levels: Array(10).fill(0.12) })!;
    const flat = voiceToArousal({ pitches: Array(10).fill(150).map((p, i) => p + (i % 2)), levels: Array(10).fill(0.02) })!;
    expect(animated).toBeGreaterThan(flat + 0.3);
  });
});

describe("fusion", () => {
  it("combines face valence with voice arousal", () => {
    const m = fuseMood({ valence: -0.5, arousal: 0.4 }, 0.9, null)!;
    expect(m.sources).toEqual(["face", "voice"]);
    expect(m.label).toBe("tense");
  });
  it("returns null with no signals", () => {
    expect(fuseMood(null, null, null)).toBeNull();
  });
});

describe("calibration & correction", () => {
  it("doesn't read a naturally downturned resting mouth as sad once calibrated", () => {
    const resting = { mouthFrownLeft: 0.35, mouthFrownRight: 0.35, browDownLeft: 0.2, browDownRight: 0.2 };
    expect(labelFor(faceToMood(resting))).toMatch(/low|tense/);
    const neutral = averageBlendshapes([resting, resting, resting]);
    expect(labelFor(faceToMood(calibrate(resting, neutral)))).not.toMatch(/low|tense/);
  });
  it("still detects a real smile relative to the baseline", () => {
    const neutral = { mouthFrownLeft: 0.3, mouthFrownRight: 0.3 };
    const smiling = { mouthFrownLeft: 0.3, mouthFrownRight: 0.3, mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.5, cheekSquintRight: 0.5 };
    expect(faceToMood(calibrate(smiling, neutral)).valence).toBeGreaterThan(0.5);
  });
  it("lets the user's own correction override sensors", () => {
    const m = fuseMood({ valence: 0.8, arousal: 0.8 }, 0.9, null, LABEL_CENTROID.tired)!;
    expect(m.label).toBe("tired");
    expect(m.sources).toEqual(["self"]);
  });
});
