/**
 * Luna — PatternReveal
 * Computes correlations across the user's own signals + logged feelings and
 * animates in the strongest "your X tracked your Y" insight. The genuine
 * "aha" moment. Uses the LLM to phrase it warmly; always "your own pattern."
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BiometricEntry, CycleCheckin } from "@/db/types";
import { correlate } from "@/lib/cycleEngine";
import { describePattern } from "@/lib/aiService";

interface PatternRevealProps {
  biometrics: BiometricEntry[];
  checkins: CycleCheckin[];
}

interface Candidate { a: string; b: string; strength: number; direction: string; }

export default function PatternReveal({ biometrics, checkins }: PatternRevealProps) {
  const [line, setLine] = useState<string | null>(null);
  const [cand, setCand] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkinByDate = new Map(checkins.map((c) => [c.date, c]));
    // Align biometrics with same-day check-ins.
    const paired = biometrics
      .map((b) => ({ b, c: checkinByDate.get(b.date) }))
      .filter((p): p is { b: BiometricEntry; c: CycleCheckin } => !!p.c);

    const candidates: Candidate[] = [];
    const push = (a: string, b: string, xs: (number | undefined)[], ys: (number | undefined)[]) => {
      const pairs = xs.map((x, i) => [x, ys[i]] as const).filter(([x, y]) => typeof x === "number" && typeof y === "number") as [number, number][];
      if (pairs.length < 4) return;
      const r = correlate(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
      candidates.push({ a, b, strength: Math.abs(r), direction: r >= 0 ? "together" : "inversely" });
    };

    if (paired.length >= 4) {
      const hrv = paired.map((p) => p.b.hrvMs);
      const temp = paired.map((p) => p.b.skinTempC);
      const rhr = paired.map((p) => p.b.restingHr);
      const energy = paired.map((p) => p.c.energy);
      const mood = paired.map((p) => p.c.mood);
      const cravings = paired.map((p) => p.c.cravings);
      const sleep = paired.map((p) => p.c.sleepQuality);

      push("energy", "HRV", energy, hrv);
      push("mood", "HRV", mood, hrv);
      push("cravings", "resting heart rate", cravings, rhr);
      push("sleep quality", "skin temperature", sleep, temp);
      push("energy", "resting heart rate", energy, rhr);
    } else {
      // Biometric-only fallback (no check-ins yet): temp vs HRV across the cycle.
      const temp = biometrics.map((b) => b.skinTempC);
      const hrv = biometrics.map((b) => b.hrvMs);
      const rhr = biometrics.map((b) => b.restingHr);
      push("skin temperature", "HRV", temp, hrv);
      push("skin temperature", "resting heart rate", temp, rhr);
    }

    const best = candidates.filter((c) => c.strength >= 0.35).sort((a, b) => b.strength - a.strength)[0];
    if (!best) { setLoading(false); setLine(null); return; }
    setCand(best);

    let cancelled = false;
    describePattern({ signalA: best.a, signalB: best.b, strength: best.strength, direction: best.direction })
      .then((txt) => { if (!cancelled) { setLine(txt); setLoading(false); } })
      .catch(() => { if (!cancelled) { setLine(`Your ${best.a} and ${best.b} tended to move ${best.direction}. This is your own pattern, not a diagnosis.`); setLoading(false); } });
    return () => { cancelled = true; };
  }, [biometrics, checkins]);

  if (loading) {
    return (
      <div style={{ padding: 16, borderRadius: 16, background: "var(--luna-surface)", display: "flex", alignItems: "center", gap: 10 }}>
        <motion.div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--luna-accent)" }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.1, repeat: Infinity }} />
        <span style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>Finding a pattern in your signals…</span>
      </div>
    );
  }

  if (!line || !cand) {
    return (
      <div style={{ padding: 16, borderRadius: 16, background: "var(--luna-surface)", border: "1px dashed var(--luna-text-muted)" }}>
        <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>
          Keep logging check-ins alongside your signals — Glitch will surface the hidden rhythms in your body as patterns emerge.
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        style={{
          padding: 16, borderRadius: 18, position: "relative", overflow: "hidden",
          background: `linear-gradient(135deg, var(--luna-accent) 0%, var(--luna-accent2) 100%)`,
          boxShadow: "0 10px 30px var(--luna-glow)",
        }}>
        <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 20% 20%, oklch(1 0 0 / 0.25), transparent 50%)" }}
          animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 4, repeat: Infinity }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 15 }}>✨</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "oklch(1 0 0 / 0.9)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Body's Hidden Rhythm</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: "white", fontWeight: 500, fontFamily: "'Playfair Display', serif" }}>{line}</p>
          <div style={{ marginTop: 8, display: "inline-flex", padding: "2px 8px", borderRadius: 999, background: "oklch(1 0 0 / 0.2)" }}>
            <span style={{ fontSize: 10, color: "white", fontWeight: 600 }}>correlation {(cand.strength * 100).toFixed(0)}% · your own pattern, not a diagnosis</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
