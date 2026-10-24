/**
 * Glitch — Glitchy's face: an illustrated, animated coach who talks back.
 * - Lip-sync: mouth opening follows speech (word-boundary pulses from speechSynthesis + a natural
 *   syllable rhythm while speaking).
 * - Blinks, breathes, gently bobs while talking, nods while listening (driven by the user's mic level).
 * - Expression mirrors the user's mood read: concerned brows when they're tense/low, bright smile when upbeat.
 * Pure SVG + requestAnimationFrame — no external avatar service, nothing leaves the device.
 */
import { useEffect, useRef, useState } from "react";
import type { MoodLabel } from "@/lib/emotion";

export interface AvatarProps {
  mode: "idle" | "listening" | "thinking" | "speaking";
  /** Increments on each spoken word boundary (from SpeechSynthesisUtterance.onboundary) */
  wordTick: number;
  /** User's live mic level 0–1 while listening */
  micLevel: number;
  userMood?: MoodLabel | null;
  size?: number;
}

export default function TalkingAvatar({ mode, wordTick, micLevel, userMood, size = 170 }: AvatarProps) {
  const [mouth, setMouth] = useState(0);      // 0 closed … 1 wide open
  const [blink, setBlink] = useState(false);
  const [t, setT] = useState(0);
  const pulse = useRef(0);
  const live = useRef({ mode, micLevel });
  live.current = { mode, micLevel };

  // Each spoken word gives the mouth a fresh "kick"
  useEffect(() => { pulse.current = 1; }, [wordTick]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setT((x) => x + dt);
      pulse.current = Math.max(0, pulse.current - dt * 5);
      const { mode: m } = live.current;
      if (m === "speaking") {
        // Syllable-like rhythm (~5–6 Hz) blended with word pulses
        const syl = Math.abs(Math.sin(now / 1000 * 11)) * (0.55 + 0.45 * Math.sin(now / 1000 * 2.3) ** 2);
        setMouth(Math.min(1, 0.15 + 0.55 * syl + 0.5 * pulse.current));
      } else {
        setMouth((x) => x * 0.8);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Natural blinking every 2.5–5.5 s
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 130); schedule(); }, 2500 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // Expression from the user's mood (empathy, not mimicry of negative emotion)
  const concerned = userMood === "tense" || userMood === "low";
  const bright = userMood === "upbeat" || userMood === "content";
  const browLift = concerned ? 5 : bright ? 3 : mode === "thinking" ? 4 : 0;
  const browTilt = concerned ? 7 : 0; // inner ends up = caring/concerned look
  const smile = mode === "speaking" ? 2 : concerned ? 3 : bright ? 9 : 6;

  // Motion
  const breathe = Math.sin(t * 1.6) * 1.2;
  const bob = mode === "speaking" ? Math.sin(t * 3.1) * 2.2 : 0;
  const nod = mode === "listening" ? Math.sin(t * 4) * 1.5 * (0.4 + micLevel) : 0;
  const tiltDeg = mode === "listening" ? -4 : mode === "thinking" ? 3 : Math.sin(t * 0.7) * 1.5;
  const eyeX = mode === "thinking" ? -3 : Math.sin(t * 0.45) * 1.2;
  const eyeY = mode === "thinking" ? -3 : 0;
  const eyeOpen = blink ? 0.1 : mode === "thinking" ? 0.85 : 1;
  const m = mouth;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Listening soundwave ring */}
      {mode === "listening" && (
        <div aria-hidden style={{ position: "absolute", inset: -6 - micLevel * 14, borderRadius: "50%", border: `3px solid oklch(0.80 0.19 150 / ${0.35 + micLevel * 0.6})`, transition: "inset 0.08s linear" }} />
      )}
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Glitchy is ${mode}`}>
        <defs>
          <radialGradient id="av-bg" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#FFF4EA" /><stop offset="100%" stopColor="#F6D9C3" />
          </radialGradient>
          <linearGradient id="av-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E9B58F" /><stop offset="100%" stopColor="#D59A72" />
          </linearGradient>
          <linearGradient id="av-hair" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5B4636" /><stop offset="55%" stopColor="#7A6250" /><stop offset="100%" stopColor="#B9AFA6" />
          </linearGradient>
          <linearGradient id="av-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2FA37A" /><stop offset="100%" stopColor="#1F7A5B" />
          </linearGradient>
          <clipPath id="av-clip"><circle cx="100" cy="100" r="98" /></clipPath>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#av-bg)" />
        <g clipPath="url(#av-clip)">
          {/* Shoulders */}
          <g transform={`translate(0 ${breathe * 0.6})`}>
            <path d="M28 205 C34 160 64 146 100 146 C136 146 166 160 172 205 Z" fill="url(#av-top)" />
            <path d="M84 146 Q100 162 116 146 L112 140 Q100 150 88 140 Z" fill="#D59A72" />
          </g>
          <g transform={`translate(0 ${breathe + bob + nod}) rotate(${tiltDeg} 100 110)`}>
            {/* Hair back */}
            <path d="M48 98 C44 52 72 30 102 30 C134 30 158 54 152 102 C150 124 146 140 138 150 L62 150 C54 138 50 122 48 98 Z" fill="url(#av-hair)" />
            {/* Neck */}
            <path d="M86 128 L86 146 Q100 154 114 146 L114 128 Z" fill="#CF9169" />
            {/* Ears + earrings */}
            <ellipse cx="58" cy="100" rx="7" ry="11" fill="#D9A07A" />
            <ellipse cx="142" cy="100" rx="7" ry="11" fill="#D9A07A" />
            <circle cx="58" cy="114" r="3.2" fill="#F2C14E" />
            <circle cx="142" cy="114" r="3.2" fill="#F2C14E" />
            {/* Face */}
            <path d="M60 92 C60 62 78 48 100 48 C122 48 140 62 140 92 C140 118 124 138 100 138 C76 138 60 118 60 92 Z" fill="url(#av-skin)" />
            {/* Hair front (side-swept bob with silver streak) */}
            <path d="M58 92 C56 60 76 40 104 40 C128 40 146 56 144 84 C132 70 114 62 94 62 C82 62 70 70 62 86 Z" fill="url(#av-hair)" />
            <path d="M96 42 C110 44 124 52 132 64" stroke="#D8D2CC" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9" />
            {/* Brows */}
            <g transform={`translate(0 ${-browLift})`}>
              <path d={`M74 ${80 + browTilt * 0.2} Q83 ${75 - browTilt * 0.6} 92 ${79 - browTilt}`} stroke="#4A3829" strokeWidth="3.4" fill="none" strokeLinecap="round" />
              <path d={`M108 ${79 - browTilt} Q117 ${75 - browTilt * 0.6} 126 ${80 + browTilt * 0.2}`} stroke="#4A3829" strokeWidth="3.4" fill="none" strokeLinecap="round" />
            </g>
            {/* Eyes */}
            {[83, 117].map((cx) => (
              <g key={cx} transform={`translate(${cx} 92) scale(1 ${eyeOpen}) translate(${-cx} -92)`}>
                <ellipse cx={cx} cy="92" rx="8" ry="6.5" fill="white" />
                <circle cx={cx + eyeX} cy={92 + eyeY} r="4.3" fill="#4B3426" />
                <circle cx={cx + eyeX} cy={92 + eyeY} r="2" fill="#1B1210" />
                <circle cx={cx + eyeX + 1.5} cy={90.5 + eyeY} r="1.2" fill="white" />
              </g>
            ))}
            {/* Lashes (soft) */}
            <path d="M75 87 Q83 82 91 87" stroke="#3A2A20" strokeWidth="1.6" fill="none" opacity={blink ? 0 : 0.8} />
            <path d="M109 87 Q117 82 125 87" stroke="#3A2A20" strokeWidth="1.6" fill="none" opacity={blink ? 0 : 0.8} />
            {/* Cheeks */}
            <ellipse cx="74" cy="108" rx="8" ry="5" fill="#E58E7E" opacity={bright ? 0.45 : 0.28} />
            <ellipse cx="126" cy="108" rx="8" ry="5" fill="#E58E7E" opacity={bright ? 0.45 : 0.28} />
            {/* Nose */}
            <path d="M100 96 Q97 106 99 110 Q102 111 104 109" stroke="#B57A57" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Mouth: smile curve when closed, open lips scale with speech */}
            {m < 0.08 ? (
              <path d={`M88 ${118} Q100 ${118 + smile} 112 ${118}`} stroke="#A44A48" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            ) : (
              <g>
                <path d={`M88 118 Q100 ${116 - 1} 112 118 Q100 ${120 + 4 + m * 12} 88 118 Z`} fill="#6E2A2E" />
                <path d={`M91 ${119 + m * 4} Q100 ${121 + m * 7} 109 ${119 + m * 4}`} stroke="#E07A80" strokeWidth={2 + m * 2} fill="none" strokeLinecap="round" opacity={m > 0.3 ? 0.9 : 0} />
                <path d="M88 118 Q100 114 112 118" stroke="#B5524F" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <rect x="93" y="117.5" width="14" height={Math.max(0, 2.5 * m)} rx="1" fill="white" opacity={m > 0.25 ? 0.95 : 0} />
              </g>
            )}
          </g>
        </g>
        {/* Thinking bubble */}
        {mode === "thinking" && (
          <g>
            {[0, 1, 2].map((i) => <circle key={i} cx={152 + i * 10} cy={42 - i * 6} r={3 + i * 1.5} fill="white" opacity={0.6 + 0.4 * Math.abs(Math.sin(t * 3 + i))} stroke="#E5D8CC" />)}
          </g>
        )}
      </svg>
    </div>
  );
}
