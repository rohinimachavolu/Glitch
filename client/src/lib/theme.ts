/**
 * Luna — Adaptive theming
 * The palette shifts with time of day, cycle phase, and the user's logged mood.
 * This is the signature "living UI" differentiator. Values are OKLCH strings.
 */
import type { CyclePhase, HealthMode } from "@/db/types";

export interface Palette {
  bg: string;          // page background (top of gradient)
  bg2: string;         // page background (bottom of gradient)
  surface: string;     // card surface
  accent: string;      // primary accent
  accent2: string;     // secondary accent
  text: string;
  textMuted: string;
  glow: string;        // orb glow
  name: string;
}

// ── Time of day → base warmth ────────────────────────────────
export type TimeBand = "dawn" | "day" | "dusk" | "night";

export function getTimeBand(hour = new Date().getHours()): TimeBand {
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

const TIME_BG: Record<TimeBand, { bg: string; bg2: string; text: string; textMuted: string; surface: string }> = {
  dawn:  { bg: "oklch(0.96 0.03 60)",  bg2: "oklch(0.93 0.05 35)",  text: "oklch(0.28 0.03 40)", textMuted: "oklch(0.52 0.03 45)", surface: "oklch(0.99 0.015 65)" },
  day:   { bg: "oklch(0.97 0.02 90)",  bg2: "oklch(0.95 0.03 140)", text: "oklch(0.25 0.025 50)", textMuted: "oklch(0.52 0.02 60)", surface: "oklch(0.995 0.01 90)" },
  dusk:  { bg: "oklch(0.90 0.05 30)",  bg2: "oklch(0.82 0.07 350)", text: "oklch(0.28 0.04 20)", textMuted: "oklch(0.48 0.04 20)", surface: "oklch(0.97 0.02 40)" },
  night: { bg: "oklch(0.22 0.03 280)", bg2: "oklch(0.16 0.04 285)", text: "oklch(0.92 0.02 280)", textMuted: "oklch(0.70 0.02 280)", surface: "oklch(0.27 0.03 285)" },
};

// ── Cycle phase → accent hue ─────────────────────────────────
const PHASE_ACCENT: Record<CyclePhase, { accent: string; accent2: string; glow: string; name: string }> = {
  menstrual:  { accent: "oklch(0.60 0.15 18)",  accent2: "oklch(0.70 0.12 10)",  glow: "oklch(0.62 0.18 18)",  name: "Menstrual" },
  follicular: { accent: "oklch(0.68 0.12 150)", accent2: "oklch(0.75 0.10 160)", glow: "oklch(0.70 0.14 150)", name: "Follicular" },
  ovulation:  { accent: "oklch(0.78 0.14 85)",  accent2: "oklch(0.82 0.12 95)",  glow: "oklch(0.80 0.16 85)",  name: "Ovulation" },
  luteal:     { accent: "oklch(0.64 0.13 300)", accent2: "oklch(0.70 0.11 320)", glow: "oklch(0.66 0.15 300)", name: "Luteal" },
};

// Menopause gets its own calm, warm palette (no cycle phases).
const MENOPAUSE_ACCENT = { accent: "oklch(0.66 0.11 40)", accent2: "oklch(0.74 0.09 55)", glow: "oklch(0.70 0.14 45)", name: "Balance" };
// Fitness-only / no reproductive mode → neutral teal.
const NEUTRAL_ACCENT = { accent: "oklch(0.60 0.11 220)", accent2: "oklch(0.68 0.10 200)", glow: "oklch(0.64 0.13 215)", name: "Focus" };

// ── Mood (1–5) → warmth nudge ────────────────────────────────
// Low mood → cooler/softer, high mood → warmer/brighter. Subtle, not jarring.
function moodShift(mood: number | undefined, p: Palette): Palette {
  if (mood == null) return p;
  if (mood <= 2) return { ...p, glow: p.accent2 }; // calmer glow when low
  return p;
}

export function buildPalette(opts: {
  mode: HealthMode;
  phase?: CyclePhase;
  mood?: number;
  hour?: number;
}): Palette {
  const band = getTimeBand(opts.hour);
  const base = TIME_BG[band];

  let accentSet;
  if (opts.mode === "menopause") accentSet = MENOPAUSE_ACCENT;
  else if (opts.mode === "none") accentSet = NEUTRAL_ACCENT;
  else accentSet = PHASE_ACCENT[opts.phase ?? "follicular"];

  const palette: Palette = {
    bg: base.bg,
    bg2: base.bg2,
    surface: base.surface,
    text: base.text,
    textMuted: base.textMuted,
    accent: accentSet.accent,
    accent2: accentSet.accent2,
    glow: accentSet.glow,
    name: `${accentSet.name} · ${band}`,
  };

  return moodShift(opts.mood, palette);
}

/** Apply a palette to CSS custom properties on :root. */
export function applyPalette(p: Palette): void {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.style.setProperty("--luna-bg", p.bg);
  r.style.setProperty("--luna-bg2", p.bg2);
  r.style.setProperty("--luna-surface", p.surface);
  r.style.setProperty("--luna-accent", p.accent);
  r.style.setProperty("--luna-accent2", p.accent2);
  r.style.setProperty("--luna-text", p.text);
  r.style.setProperty("--luna-text-muted", p.textMuted);
  r.style.setProperty("--luna-glow", p.glow);
}
