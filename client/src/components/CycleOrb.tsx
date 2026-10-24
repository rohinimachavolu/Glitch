/**
 * Luna — CycleOrb
 * The living centerpiece. A breathing, color-shifting orb whose hue, pulse,
 * and particle motion reflect the current cycle phase / menopause mode, mood,
 * and time of day. This is the signature "wow" element.
 */
import { motion } from "framer-motion";
import type { CyclePhase, HealthMode } from "@/db/types";

interface CycleOrbProps {
  phase?: CyclePhase | null;
  mode: HealthMode;
  label: string;        // big center label (e.g. "Day 14")
  sublabel: string;     // small under label (e.g. "Ovulation")
  mood?: number;        // 1–5 affects pulse energy
  size?: number;
}

const PHASE_COLORS: Record<CyclePhase, [string, string]> = {
  menstrual:  ["oklch(0.62 0.18 18)",  "oklch(0.72 0.14 10)"],
  follicular: ["oklch(0.70 0.14 150)", "oklch(0.78 0.12 165)"],
  ovulation:  ["oklch(0.80 0.16 85)",  "oklch(0.85 0.13 100)"],
  luteal:     ["oklch(0.66 0.15 300)", "oklch(0.72 0.12 325)"],
};

function colorsFor(mode: HealthMode, phase?: CyclePhase | null): [string, string] {
  if (mode === "menopause") return ["oklch(0.70 0.14 45)", "oklch(0.78 0.11 60)"];
  if (mode === "none") return ["oklch(0.64 0.13 215)", "oklch(0.72 0.11 200)"];
  return PHASE_COLORS[phase ?? "follicular"];
}

export default function CycleOrb({ phase, mode, label, sublabel, mood = 3, size = 220 }: CycleOrbProps) {
  const [c1, c2] = colorsFor(mode, phase);
  // Mood modulates breathing: calmer when low, livelier when high.
  const pulseScale = 1 + (mood / 5) * 0.06;
  const pulseDur = 5 - (mood / 5) * 1.5; // 3.5s–5s

  const rings = [0, 1, 2];

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      {/* Outer glow */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute", inset: -size * 0.12, borderRadius: "50%",
          background: `radial-gradient(circle, ${c1} 0%, transparent 68%)`,
          filter: "blur(18px)", opacity: 0.55,
        }}
        animate={{ scale: [1, pulseScale, 1], opacity: [0.45, 0.65, 0.45] }}
        transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Rotating conic rings */}
      {rings.map((i) => (
        <motion.div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            inset: i * 10,
            borderRadius: "50%",
            background: `conic-gradient(from ${i * 90}deg, ${c1}, ${c2}, ${c1})`,
            maskImage: "radial-gradient(circle, transparent 62%, black 64%, black 70%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(circle, transparent 62%, black 64%, black 70%, transparent 72%)",
            opacity: 0.5 - i * 0.12,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 22 + i * 10, repeat: Infinity, ease: "linear" }}
        />
      ))}

      {/* Core */}
      <motion.div
        style={{
          position: "absolute", inset: size * 0.14, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${c2}, ${c1})`,
          boxShadow: `inset 0 0 ${size * 0.15}px oklch(1 0 0 / 0.25), 0 10px 40px ${c1}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}
        animate={{ scale: [1, pulseScale, 1] }}
        transition={{ duration: pulseDur, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.span
          style={{ fontSize: size * 0.16, fontWeight: 800, color: "oklch(1 0 0 / 0.96)", fontFamily: "'Playfair Display', serif", lineHeight: 1 }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        >
          {label}
        </motion.span>
        <span style={{ fontSize: size * 0.055, fontWeight: 600, color: "oklch(1 0 0 / 0.85)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
          {sublabel}
        </span>
      </motion.div>

      {/* Orbiting dot */}
      <motion.div
        aria-hidden
        style={{ position: "absolute", inset: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      >
        <div style={{
          position: "absolute", top: -4, left: "50%", width: 10, height: 10, borderRadius: "50%",
          background: "oklch(1 0 0 / 0.9)", boxShadow: `0 0 12px ${c2}`, transform: "translateX(-50%)",
        }} />
      </motion.div>
    </div>
  );
}
