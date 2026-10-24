/**
 * Voice input: speech-to-text (Web Speech API) + on-device tone analysis (pitch, variability,
 * loudness via Web Audio). Audio is never recorded or uploaded; only the transcript text is used.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch, voiceToArousal } from "@/lib/emotion";

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void;
};

function getRecognizer(): SpeechRec | null {
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useVoice(onFinal: (text: string, arousal: number | null) => void) {
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [lastArousal, setLastArousal] = useState<number | null>(null);
  const supported = typeof window !== "undefined" && !!getRecognizer();

  const recRef = useRef<SpeechRec | null>(null);
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const windowRef = useRef<{ pitches: number[]; levels: number[] }>({ pitches: [], levels: [] });
  const finalText = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stopAudio = useCallback(() => {
    if (!audio.current) return;
    cancelAnimationFrame(audio.current.raf);
    audio.current.stream.getTracks().forEach((t) => t.stop());
    audio.current.ctx.close().catch(() => {});
    audio.current = null;
    setLevel(0);
  }, []);

  // End-of-speech detection: keep listening through natural pauses ("I had a wrap… um… with chicken")
  // and only finish after ~2.5 s of real silence (no new words AND a quiet mic).
  const SILENCE_MS = 2500;      // pause that means "I'm done"
  const NO_SPEECH_MS = 8000;    // give up if nothing is said at all
  const MAX_MS = 45_000;        // hard cap per turn
  const session = useRef({ stoppedByUs: false, startedAt: 0, lastActivity: 0, heard: false, committed: "", timer: 0 as unknown as ReturnType<typeof setInterval> });

  const finish = useCallback(() => {
    session.current.stoppedByUs = true;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
  }, []);

  const start = useCallback(async () => {
    const rec = getRecognizer();
    if (!rec) return;
    finalText.current = "";
    windowRef.current = { pitches: [], levels: [] };
    setInterim("");
    const now = performance.now();
    session.current = { stoppedByUs: false, startedAt: now, lastActivity: now, heard: false, committed: "", timer: session.current.timer };

    // Tone analysis runs in parallel with recognition; its level also counts as "still talking"
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const loop = () => {
        analyser.getFloatTimeDomainData(buf);
        let rms = 0;
        for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / buf.length);
        const lvl = Math.min(1, rms * 8);
        setLevel(lvl);
        if (lvl > 0.14) { session.current.lastActivity = performance.now(); session.current.heard = true; }
        const p = detectPitch(buf, ctx.sampleRate);
        if (p) { windowRef.current.pitches.push(p); windowRef.current.levels.push(rms); }
        audio.current!.raf = requestAnimationFrame(loop);
      };
      audio.current = { ctx, stream, raf: requestAnimationFrame(loop) };
    } catch {
      /* mic analysis unavailable — transcription can still work */
    }

    const finalize = () => {
      clearInterval(session.current.timer);
      setListening(false);
      const arousal = voiceToArousal(windowRef.current);
      setLastArousal(arousal);
      stopAudio();
      const text = finalText.current.trim();
      setInterim("");
      if (text) onFinalRef.current(text, arousal);
    };

    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      // Rebuild from scratch each event (results accumulate in continuous mode)
      let finals = "", partial = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += r[0].transcript; else partial += r[0].transcript;
      }
      finalText.current = `${session.current.committed} ${finals}`.trim();
      setInterim(`${finalText.current} ${partial}`.trim());
      session.current.lastActivity = performance.now();
      session.current.heard = true;
    };
    rec.onerror = () => {};
    rec.onend = () => {
      const s = session.current;
      const t = performance.now();
      // Browsers sometimes end a continuous session on their own; if the user may still be talking, resume
      if (!s.stoppedByUs && t - s.startedAt < MAX_MS && (!s.heard || t - s.lastActivity < SILENCE_MS)) {
        s.committed = finalText.current;
        try { rec.start(); return; } catch { /* fall through to finalize */ }
      }
      finalize();
    };

    clearInterval(session.current.timer);
    session.current.timer = setInterval(() => {
      const s = session.current;
      const t = performance.now();
      if ((s.heard && t - s.lastActivity >= SILENCE_MS) || (!s.heard && t - s.startedAt >= NO_SPEECH_MS) || t - s.startedAt >= MAX_MS) finish();
    }, 200);

    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
    setListening(true);
  }, [stopAudio, finish]);

  /** Tap to send now (don't wait for the silence timer). */
  const stop = finish;

  useEffect(() => () => { clearInterval(session.current.timer); session.current.stoppedByUs = true; recRef.current?.stop(); stopAudio(); }, [stopAudio]);

  return { supported, listening, level, interim, lastArousal, start, stop };
}
