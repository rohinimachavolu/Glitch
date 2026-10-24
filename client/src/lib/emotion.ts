/**
 * Glitch — multimodal mood estimation (all on-device)
 * - Face: MediaPipe face blendshapes (smile, frown, brow, eye-wide…) → valence/arousal
 *   on Russell's circumplex model of affect.
 * - Voice: pitch (autocorrelation), pitch variability and loudness → arousal ("tune").
 * - Text: the coach model returns its own valence/arousal read of what the user wrote.
 * Facial expressions are not the same as feelings, so the UI always calls this a "read" and the
 * user can correct it. Only the derived label/numbers ever leave the device — never images or audio.
 */

export interface MoodRead {
  valence: number;   // -1 (negative) … 1 (positive)
  arousal: number;   // 0 (calm/tired) … 1 (activated)
}

export interface FusedMood extends MoodRead {
  label: MoodLabel;
  sources: ("face" | "voice" | "text" | "self")[];
}

export type MoodLabel = "upbeat" | "content" | "calm" | "neutral" | "tired" | "low" | "tense";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ── Face ─────────────────────────────────────────────────────
export type Blendshapes = Record<string, number>;

const avg = (b: Blendshapes, ...keys: string[]) => keys.reduce((s, k) => s + (b[k] ?? 0), 0) / keys.length;

/** Map ARKit-style blendshape scores (0–1) to valence/arousal. Heuristic weights, tuned by hand. */
export function faceToMood(b: Blendshapes): MoodRead {
  const smile = avg(b, "mouthSmileLeft", "mouthSmileRight");
  const cheek = avg(b, "cheekSquintLeft", "cheekSquintRight");
  const frown = avg(b, "mouthFrownLeft", "mouthFrownRight");
  const browDown = avg(b, "browDownLeft", "browDownRight");
  const sneer = avg(b, "noseSneerLeft", "noseSneerRight");
  const press = avg(b, "mouthPressLeft", "mouthPressRight");
  const browInnerUp = b.browInnerUp ?? 0;
  const eyeWide = avg(b, "eyeWideLeft", "eyeWideRight");
  const jawOpen = b.jawOpen ?? 0;
  const blink = avg(b, "eyeBlinkLeft", "eyeBlinkRight");

  const dimple = avg(b, "mouthDimpleLeft", "mouthDimpleRight");
  const lowerDown = avg(b, "mouthLowerDownLeft", "mouthLowerDownRight");
  const eyeSquint = avg(b, "eyeSquintLeft", "eyeSquintRight");
  // A "Duchenne" (genuine) smile engages the eyes/cheeks as well as the mouth
  const genuine = smile * (0.6 + 0.4 * Math.min(1, cheek + eyeSquint));
  const valence = 1.5 * genuine + 0.3 * dimple + 0.2 * cheek - 1.2 * frown - 0.9 * browDown - 0.6 * sneer - 0.4 * press - 0.3 * lowerDown * (1 - smile) - 0.4 * browInnerUp * (1 - smile);
  // Droopy, half-closed eyes read as low arousal
  const arousal = 0.25 + 0.9 * eyeWide + 0.5 * browInnerUp + 0.35 * jawOpen + 0.5 * browDown + 0.2 * press + 0.3 * smile - 0.35 * Math.max(0, blink - 0.35);
  return { valence: clamp(valence, -1, 1), arousal: clamp(arousal, 0, 1) };
}

/**
 * Personal calibration: everyone's resting face differs (a naturally downturned mouth isn't sadness).
 * Subtract the user's neutral baseline, captured over the first ~1.5 s, and amplify the change.
 */
export function averageBlendshapes(frames: Blendshapes[]): Blendshapes {
  const out: Blendshapes = {};
  for (const f of frames) for (const k in f) out[k] = (out[k] ?? 0) + f[k] / frames.length;
  return out;
}

export function calibrate(b: Blendshapes, neutral: Blendshapes, gain = 1.4): Blendshapes {
  const out: Blendshapes = {};
  for (const k in b) out[k] = Math.max(0, Math.min(1, (b[k] - (neutral[k] ?? 0)) * gain));
  return out;
}

/** Centre point of each label on the circumplex, used when the user corrects the read. */
export const LABEL_CENTROID: Record<MoodLabel, MoodRead> = {
  upbeat: { valence: 0.6, arousal: 0.75 }, content: { valence: 0.45, arousal: 0.45 }, calm: { valence: 0.2, arousal: 0.25 },
  neutral: { valence: 0, arousal: 0.45 }, tired: { valence: -0.1, arousal: 0.1 }, low: { valence: -0.55, arousal: 0.3 },
  tense: { valence: -0.5, arousal: 0.75 },
};

// ── Voice ────────────────────────────────────────────────────
/** Fundamental frequency via autocorrelation; null if unvoiced/too quiet. */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return null;

  const minLag = Math.floor(sampleRate / 500); // 500 Hz max
  const maxLag = Math.floor(sampleRate / 70);  // 70 Hz min
  let best = -1, bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < buf.length - lag; i++) c += buf[i] * buf[i + lag];
    if (c > bestCorr) { bestCorr = c; best = lag; }
  }
  let energy = 0;
  for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
  if (best < 0 || bestCorr / energy < 0.3) return null;
  return sampleRate / best;
}

export interface VoiceWindow {
  pitches: number[];   // Hz, voiced frames only
  levels: number[];    // RMS per frame
}

/** Arousal from voice: louder, higher and more variable pitch = more activated. */
export function voiceToArousal(w: VoiceWindow): number | null {
  if (w.pitches.length < 8) return null;
  const mean = w.pitches.reduce((a, b) => a + b, 0) / w.pitches.length;
  const sd = Math.sqrt(w.pitches.reduce((a, b) => a + (b - mean) ** 2, 0) / w.pitches.length);
  const variability = clamp((sd / mean) / 0.25, 0, 1);       // coefficient of variation, 25% ≈ very animated
  const loud = clamp((w.levels.reduce((a, b) => a + b, 0) / w.levels.length) / 0.12, 0, 1);
  return clamp(0.15 + 0.45 * variability + 0.4 * loud, 0, 1);
}

// ── Fusion ───────────────────────────────────────────────────
export function labelFor(m: MoodRead): MoodLabel {
  if (m.valence <= -0.2 && m.arousal >= 0.55) return "tense";
  if (m.valence <= -0.2) return "low";
  if (m.arousal <= 0.2) return "tired";
  if (m.valence >= 0.3 && m.arousal >= 0.55) return "upbeat";
  if (m.valence >= 0.2) return "content";
  if (m.arousal <= 0.4 && m.valence > -0.1) return "calm";
  return "neutral";
}

/**
 * Weighted fusion. Face and text both inform valence; voice informs arousal only (prosody is a
 * weak valence signal). Missing modalities are simply skipped.
 */
export function fuseMood(face: MoodRead | null, voiceArousal: number | null, text: MoodRead | null, self?: MoodRead | null): FusedMood | null {
  // The user's own correction always wins: people know their feelings better than a camera does
  if (self) return { ...self, label: labelFor(self), sources: ["self"] };
  const sources: FusedMood["sources"] = [];
  let vSum = 0, vW = 0, aSum = 0, aW = 0;
  if (face) { sources.push("face"); vSum += face.valence * 0.5; vW += 0.5; aSum += face.arousal * 0.35; aW += 0.35; }
  if (text) { sources.push("text"); vSum += text.valence * 0.5; vW += 0.5; aSum += text.arousal * 0.25; aW += 0.25; }
  if (voiceArousal != null) { sources.push("voice"); aSum += voiceArousal * 0.4; aW += 0.4; }
  if (!sources.length) return null;
  const m = { valence: vW ? vSum / vW : 0, arousal: aW ? aSum / aW : 0.4 };
  return { ...m, label: labelFor(m), sources };
}

/** How the coach should adapt its tone to the current mood read. */
export const TONE_GUIDE: Record<MoodLabel, string> = {
  tense: "They seem tense. Be calm and grounding: validate first, short sentences, one small concrete step, no lists.",
  low: "They seem low. Be warm and gentle, acknowledge the feeling, lower the bar, celebrate tiny wins, no pressure.",
  tired: "They seem tired. Keep it brief and easy, suggest low-effort options, permission to rest.",
  upbeat: "They seem upbeat. Match their energy, be playful, and channel momentum into a goal.",
  content: "They seem content. Be friendly and encouraging, reinforce what's working.",
  calm: "They seem calm. Be clear and steady, a good moment for planning.",
  neutral: "Be friendly, clear and concise.",
};

export const LABEL_EMOJI: Record<MoodLabel, string> = {
  upbeat: "😄", content: "🙂", calm: "😌", neutral: "😐", tired: "😴", low: "😔", tense: "😣",
};
