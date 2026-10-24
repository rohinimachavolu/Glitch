/**
 * Glitch — PerlinField
 * A living generative background: flowing Perlin-noise field rendered to canvas,
 * tinted by the current palette (phase/menopause/time). Fills empty space and
 * makes every screen feel alive. Respects prefers-reduced-motion.
 */
import { useEffect, useRef } from "react";

// ── Minimal 2D Perlin/simplex-ish value noise (no deps) ──────
function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed * 9301 + 49297;
  for (let i = 255; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (h: number, x: number, y: number) => {
    const u = (h & 1) === 0 ? x : -x;
    const v = (h & 2) === 0 ? y : -y;
    return u + v;
  };
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = perm[X] + Y, B = perm[X + 1] + Y;
    return (lerp(
      lerp(grad(perm[A], x, y), grad(perm[B], x - 1, y), u),
      lerp(grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1), u),
      v,
    ) + 1) / 2;
  };
}

interface PerlinFieldProps {
  tint?: string;     // base color (oklch or hex)
  tint2?: string;
  opacity?: number;
  speed?: number;
}

export default function PerlinField({ tint = "oklch(0.70 0.14 150)", tint2 = "oklch(0.75 0.12 300)", opacity = 0.5, speed = 1 }: PerlinFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const noise = makeNoise(42);
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      w = parent?.clientWidth ?? window.innerWidth;
      h = parent?.clientHeight ?? window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const GRID = 26; // flow-field cell size
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // Soft gradient base
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, tint); g.addColorStop(1, tint2);
      ctx.globalAlpha = opacity * 0.25;
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      // Flowing noise contours (dots following the field)
      ctx.globalAlpha = opacity;
      for (let y = 0; y < h; y += GRID) {
        for (let x = 0; x < w; x += GRID) {
          const n = noise(x * 0.004 + t * 0.15, y * 0.004 - t * 0.1);
          const angle = n * Math.PI * 4;
          const len = 6 + n * 14;
          const px = x + Math.cos(angle) * len;
          const py = y + Math.sin(angle) * len;
          const r = 1 + n * 2.5;
          ctx.beginPath();
          ctx.fillStyle = n > 0.5 ? tint : tint2;
          ctx.globalAlpha = opacity * (0.15 + n * 0.5);
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      t += 0.012 * speed;
      if (!reduce) rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tint, tint2, opacity, speed]);

  return (
    <canvas ref={canvasRef} aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />
  );
}
