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

  const start = useCallback(async () => {
    const rec = getRecognizer();
    if (!rec) return;
    finalText.current = "";
    windowRef.current = { pitches: [], levels: [] };
    setInterim("");

    // Tone analysis runs in parallel with recognition
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
        setLevel(Math.min(1, rms * 8));
        const p = detectPitch(buf, ctx.sampleRate);
        if (p) { windowRef.current.pitches.push(p); windowRef.current.levels.push(rms); }
        audio.current!.raf = requestAnimationFrame(loop);
      };
      audio.current = { ctx, stream, raf: requestAnimationFrame(loop) };
    } catch {
      /* mic analysis unavailable — transcription can still work */
    }

    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText.current += r[0].transcript;
        else text += r[0].transcript;
      }
      setInterim(finalText.current + text);
    };
    rec.onerror = () => {};
    rec.onend = () => {
      setListening(false);
      const arousal = voiceToArousal(windowRef.current);
      setLastArousal(arousal);
      stopAudio();
      const text = finalText.current.trim();
      setInterim("");
      if (text) onFinalRef.current(text, arousal);
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [stopAudio]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  useEffect(() => () => { recRef.current?.stop(); stopAudio(); }, [stopAudio]);

  return { supported, listening, level, interim, lastArousal, start, stop };
}
