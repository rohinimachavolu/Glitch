/**
 * Glitch — playful bits: theme sync, phase banner and confetti.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, getCycleDay, getCyclePhase, hasActiveCycle, tracksOvulation } from "@/contexts/AppContext";
import { useHealthInsights } from "@/hooks/useHealthInsights";
import { computeTheme, applyTheme, type Theme } from "@/lib/theme";

const font = "'DM Sans', sans-serif";

/** Current theme from profile + (detected or calendar) cycle phase. */
export function useTheme(): Theme {
  const { profile } = useApp();
  const h = useHealthInsights();
  return useMemo(() => {
    const wh = profile?.womensHealth;
    const phase = hasActiveCycle(profile) && tracksOvulation(profile) && wh?.lastPeriodDate
      ? h.cycle?.currentPhase ?? getCyclePhase(getCycleDay(wh.lastPeriodDate, wh.cycleLength), wh.cycleLength)
      : null;
    return computeTheme(profile, phase);
  }, [profile, h.cycle?.currentPhase]);
}

export function ThemeSync() {
  const t = useTheme();
  useEffect(() => applyTheme(t), [t]);
  return null;
}

export function PhaseBanner() {
  const { profile } = useApp();
  const t = useTheme();
  const wh = profile?.womensHealth;
  const day = hasActiveCycle(profile) && wh?.lastPeriodDate ? getCycleDay(wh.lastPeriodDate, wh.cycleLength) : null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ position: "relative", overflow: "hidden", borderRadius: 22, padding: "14px 16px", color: "white",
        background: `linear-gradient(120deg, ${t.accent}, oklch(0.70 0.13 ${(t.hue + 40) % 360}))`, boxShadow: `0 8px 24px color-mix(in oklch, ${t.accent} 35%, transparent)` }}>
      {/* drifting bubbles */}
      {[0, 1, 2].map((i) => (
        <motion.span key={i} aria-hidden animate={{ y: [0, -10, 0], x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 4 + i, delay: i * 0.7, ease: "easeInOut" }}
          style={{ position: "absolute", right: 14 + i * 34, top: 8 + (i % 2) * 26, width: 26 - i * 6, height: 26 - i * 6, borderRadius: "50%", background: "oklch(1 0 0 / 0.18)" }} />
      ))}
      <div className="flex items-center gap-3" style={{ position: "relative" }}>
        <motion.span animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 3.5, repeatDelay: 2 }} style={{ fontSize: 34 }}>{t.emoji}</motion.span>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, fontFamily: font }}>{t.label}{day ? ` · Day ${day}` : ""}</p>
          <p style={{ fontSize: 12.5, fontFamily: font, opacity: 0.95, lineHeight: 1.4 }}>{t.vibe}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Confetti ─────────────────────────────────────────────────
export function celebrate(message?: string) {
  window.dispatchEvent(new CustomEvent("glitch:celebrate", { detail: message }));
}

export function Confetti() {
  const [burst, setBurst] = useState<{ id: number; msg?: string } | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      setBurst({ id: Date.now(), msg: (e as CustomEvent).detail });
      setTimeout(() => setBurst(null), 2200);
    };
    window.addEventListener("glitch:celebrate", on);
    return () => window.removeEventListener("glitch:celebrate", on);
  }, []);
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    x: (Math.random() - 0.5) * 360, y: -(160 + Math.random() * 260), r: Math.random() * 540, d: 0.9 + Math.random() * 0.8,
    c: [`var(--accent)`, "oklch(0.80 0.15 85)", "oklch(0.72 0.14 160)", "oklch(0.70 0.16 330)"][i % 4], s: 6 + Math.random() * 6, round: i % 3 === 0,
  })), [burst?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AnimatePresence>
      {burst && (
        <div key={burst.id} aria-hidden style={{ position: "fixed", left: "50%", bottom: 140, zIndex: 200, pointerEvents: "none" }}>
          {pieces.map((p, i) => (
            <motion.span key={i} initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }} animate={{ x: p.x, y: [0, p.y, p.y + 220], opacity: [1, 1, 0], rotate: p.r }}
              transition={{ duration: p.d + 0.6, ease: "easeOut" }}
              style={{ position: "absolute", width: p.s, height: p.round ? p.s : p.s * 0.5, borderRadius: p.round ? "50%" : 2, background: p.c }} />
          ))}
          {burst.msg && (
            <motion.p initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: -60, scale: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 999, background: "var(--card-bg)", color: "var(--accent-deep)", fontWeight: 800, fontSize: 14, fontFamily: font, boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>
              {burst.msg}
            </motion.p>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
