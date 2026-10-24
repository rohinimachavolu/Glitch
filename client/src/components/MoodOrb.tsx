/**
 * Glitch — Mood Orb
 * A living blob drawn with 3D Perlin noise. Valence sets the colour (cool blue when low → warm
 * coral/gold when positive); arousal sets how fast and how much it wobbles. It swells while the user
 * speaks (live mic level) and breathes while the coach is "thinking".
 */
import { useEffect, useRef } from "react";
import { perlin3 } from "@/lib/perlin";

export interface OrbState {
  valence: number;   // -1 … 1
  arousal: number;   // 0 … 1
  level?: number;    // 0 … 1 live audio level
  mode?: "idle" | "listening" | "thinking" | "speaking";
}

/** Mood → hue. Low valence = blue/indigo, neutral = sage/teal, positive = coral → gold. */
function hueFor(valence: number) {
  return valence < 0 ? 230 + valence * 30 : 160 - valence * 120;
}

export default function MoodOrb({ state, size = 180 }: { state: OrbState; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(state);
  live.current = state;
  // Smoothed values so mood changes glide rather than jump
  const smooth = useRef({ v: state.valence, a: state.arousal, l: 0 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    let raf = 0;
    let t = 0;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const s = live.current;
      const sm = smooth.current;
      sm.v += (s.valence - sm.v) * 0.04;
      sm.a += (s.arousal - sm.a) * 0.04;
      sm.l += ((s.level ?? 0) - sm.l) * 0.25;

      const speed = reduced ? 0.002 : 0.004 + sm.a * 0.018 + (s.mode === "thinking" ? 0.01 : 0);
      t += speed;
      const cx = size / 2, cy = size / 2;
      const breath = s.mode === "thinking" ? Math.sin(t * 6) * 0.03 : 0;
      const base = size * (0.30 + sm.l * 0.07 + breath);
      const wobble = size * (0.025 + sm.a * 0.07 + sm.l * 0.05);
      const hue = hueFor(sm.v);

      ctx.clearRect(0, 0, size, size);

      // Soft glow
      const glow = ctx.createRadialGradient(cx, cy, base * 0.4, cx, cy, base * 1.6);
      glow.addColorStop(0, `hsla(${hue}, 80%, 65%, 0.35)`);
      glow.addColorStop(1, `hsla(${hue}, 80%, 65%, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Three layered noise blobs for depth
      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        const steps = 96;
        for (let i = 0; i <= steps; i++) {
          const ang = (i / steps) * Math.PI * 2;
          const nx = Math.cos(ang) * 1.2 + layer * 3.1;
          const ny = Math.sin(ang) * 1.2 + layer * 1.7;
          const n = perlin3(nx, ny, t + layer * 0.37);
          const r = base * (1 - layer * 0.14) + n * wobble * (1 - layer * 0.2);
          const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(cx - base * 0.3, cy - base * 0.35, base * 0.1, cx, cy, base * 1.1);
        const h2 = hue + layer * 18;
        g.addColorStop(0, `hsla(${h2}, 90%, ${78 - layer * 6}%, ${0.95 - layer * 0.25})`);
        g.addColorStop(1, `hsla(${h2 + 25}, 70%, ${48 - layer * 4}%, ${0.9 - layer * 0.25})`);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Specular highlight
      ctx.beginPath();
      ctx.ellipse(cx - base * 0.32, cy - base * 0.38, base * 0.22, base * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = "hsla(0, 0%, 100%, 0.35)";
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} aria-hidden="true" />;
}
