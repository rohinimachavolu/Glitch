/**
 * Glitch — Voice service
 * Web Speech API wrappers for speech-to-text and text-to-speech, plus an
 * LLM-backed intent parser that turns what you SAY into structured actions
 * (log food, log symptom, log hot flash, add note) saved to the DB.
 */
import { chatRaw } from "./aiService";

// ── Speech synthesis (Glitch speaks) ─────────────────────────
export function speak(text: string, enabled = true): void {
  if (!enabled || typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02; u.pitch = 1.05;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((v) => /female|samantha|google us english|zira/i.test(v.name));
  if (preferred) u.voice = preferred;
  speechSynthesis.speak(u);
}

// ── Speech recognition (you speak) ───────────────────────────
type SR = any;
export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);
}

export function createRecognizer(onResult: (text: string, isFinal: boolean) => void, onEnd: () => void): SR | null {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e: any) => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const tr = e.results[i];
      if (tr.isFinal) final += tr[0].transcript; else interim += tr[0].transcript;
    }
    if (final) onResult(final, true);
    else if (interim) onResult(interim, false);
  };
  rec.onend = onEnd;
  rec.onerror = onEnd;
  return rec;
}

// ── Intent parsing ───────────────────────────────────────────
export type VoiceIntent =
  | { action: "log_food"; text: string }
  | { action: "log_symptom"; fields: Record<string, number>; note?: string }
  | { action: "log_hot_flash"; intensity?: number }
  | { action: "log_period" }
  | { action: "note"; text: string }
  | { action: "chat"; text: string };

export async function parseVoiceIntent(transcript: string): Promise<VoiceIntent> {
  // Cheap local heuristics first (works with no LLM).
  const t = transcript.toLowerCase();
  if (/hot flash|flush|flashing/.test(t)) {
    const m = t.match(/(\d)\s*(?:out of|\/)\s*5/);
    return { action: "log_hot_flash", intensity: m ? Number(m[1]) : undefined };
  }
  if (/\b(ate|eat|had|drank|breakfast|lunch|dinner|snack)\b/.test(t)) {
    return { action: "log_food", text: transcript };
  }
  if (/period (started|began|today)|got my period/.test(t)) return { action: "log_period" };

  // LLM intent classification for richer cases (symptoms, notes).
  try {
    const raw = await chatRaw([{
      role: "user",
      content: `Classify this spoken health note into JSON. Allowed actions: log_food, log_symptom, log_hot_flash, log_period, note.
For log_symptom, extract any of mood/energy/stress/cramps/bloating/cravings/sleepQuality as 1-5 integers you can infer.
Input: "${transcript}"
Return ONLY JSON like {"action":"log_symptom","fields":{"stress":4,"energy":2},"note":"felt drained"} or {"action":"note","text":"..."}.`,
    }]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.action) return parsed as VoiceIntent;
    }
  } catch { /* fall through */ }

  return { action: "note", text: transcript };
}
