/**
 * Glitch — adaptive theme.
 * The accent colour, background tint and greeting follow the user's cycle phase or life stage
 * (and age for everyone else), so the app feels like it's "in sync" with them.
 * Accent lightness is lifted for the dark design system; text on accent uses var(--on-accent).
 */
import type { CyclePhase, UserProfile } from "@/contexts/AppContext";

export interface Theme {
  key: string;
  hue: number;
  accent: string;       // main accent
  accentDeep: string;   // darker, for text on tinted backgrounds
  bg: string;           // page background tint
  outer: string;        // area around the phone shell
  emoji: string;
  label: string;        // e.g. "Follicular phase"
  vibe: string;         // one friendly line for the banner
  fontScale: number;
}

export type ThemeMode = "light" | "dark";

function make(key: string, l: number, c: number, h: number, emoji: string, label: string, vibe: string, fontScale = 1, mode: ThemeMode = "dark"): Theme {
  if (mode === "light") {
    // Light design system: deepen the accent so it reads on white, tint the page very faintly.
    return {
      key, hue: h,
      accent: `oklch(${Math.max(0.52, l - 0.04)} ${c} ${h})`,
      accentDeep: `oklch(${Math.max(0.40, l - 0.16)} ${(c * 0.9).toFixed(3)} ${h})`,
      bg: `oklch(0.975 0.006 ${h})`,
      outer: "oklch(0.91 0.008 " + h + ")",
      emoji, label, vibe, fontScale,
    };
  }
  // Dark design system: brighten the accent so it pops on near-black, keep a faint hue tint in the page
  return {
    key, hue: h,
    accent: `oklch(${Math.min(0.82, l + 0.16)} ${c} ${h})`,
    accentDeep: `oklch(${Math.min(0.9, l + 0.27)} ${(c * 0.8).toFixed(3)} ${h})`,
    bg: `oklch(0.165 0.008 ${h})`,
    outer: "#07080A",
    emoji, label, vibe, fontScale,
  };
}

const PHASE: Record<CyclePhase, [number, number, number, string, string, string]> = {
  menstrual:  [0.58, 0.16, 10,  "🌑", "Menstrual phase",  "Rest is productive today. Warmth, iron-rich food and gentle movement."],
  follicular: [0.60, 0.12, 165, "🌱", "Follicular phase", "Energy's rising. Great days to try something new or lift a little heavier."],
  ovulation:  [0.66, 0.16, 55,  "🌕", "Ovulation window", "Peak power and confidence. Go for that PR (warm up well)."],
  luteal:     [0.55, 0.13, 320, "🌖", "Luteal phase",     "Steady wins: protein, magnesium-rich snacks, earlier nights."],
};

export function computeTheme(p: UserProfile | null, phase: CyclePhase | null, mode: ThemeMode = "dark"): Theme {
  const age = p?.age ?? 30;
  const big = age >= 60 ? 1.06 : 1;
  const wh = p?.womensHealth;

  if (wh?.cycleStatus === "no") {
    switch (wh.noCycleReason) {
      case "pregnant": return make("pregnant", 0.66, 0.13, 45, "🤰", "Pregnancy", "Growing a human is hard work. Fuel well and move gently.", big, mode);
      case "postpartum": return make("postpartum", 0.60, 0.10, 230, "👶", "Postpartum", "Recovery first. Every small win counts right now.", big, mode);
      case "perimenopause": return make("perimenopause", 0.58, 0.14, 30, "🌗", "Perimenopause", "Strength, sleep and steady blood sugar are your superpowers.", big, mode);
      case "menopause": return make("menopause", 0.60, 0.13, 70, "🌕", "Menopause", "Heavy lifts, heart health and good sleep. You've got this.", big, mode);
      case "not_started": return make("teen", 0.60, 0.18, 300, "✨", "Growing strong", "Fun movement, regular meals, lots of water.", 1, mode);
    }
  }
  if (phase) {
    const [l, c, h, emoji, label, vibe] = PHASE[phase];
    return make(phase, l, c, h, emoji, label, vibe, big, mode);
  }
  if (wh && (wh.hormonalContraception || wh.hormones?.uses.length)) return make("steady", 0.60, 0.10, 150, "🌿", "Steady rhythm", "Your recovery score leads the way today.", big, mode);

  // Everyone else: by age
  if (age < 25) return make("young", 0.58, 0.17, 270, "⚡", "Let's go", "Build habits now and they'll carry you for decades.", big, mode);
  if (age < 50) return make("prime", 0.62, 0.12, 38, "🔥", "Your day", "Small, consistent wins beat perfect plans.", big, mode);
  return make("wise", 0.55, 0.10, 200, "🌊", "Your day", "Strength, heart health and sleep: the big three.", big, mode);
}

/** Write the theme to CSS variables so every component picks it up. */
export function applyTheme(t: Theme) {
  const r = document.documentElement.style;
  r.setProperty("--accent", t.accent);
  r.setProperty("--accent-deep", t.accentDeep);
  r.setProperty("--app-bg", t.bg);
  r.setProperty("--app-outer", t.outer);
  r.setProperty("--background", t.bg);
  r.setProperty("--primary", t.accent);
  r.setProperty("--ring", t.accent);
  document.documentElement.style.fontSize = `${16 * t.fontScale}px`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.accent);
}
