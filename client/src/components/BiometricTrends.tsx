/**
 * Luna — BiometricTrends ("Your Signals")
 * Skin temperature, heart rate, HRV, respiratory rate as animated sparklines vs
 * the user's own baseline, color-coded by cycle phase. Pattern, not diagnosis.
 */
import { motion } from "framer-motion";
import type { BiometricEntry, CyclePhase, SignalTrend } from "@/db/types";
import { getBiometricTrend } from "@/lib/cycleEngine";

interface BiometricTrendsProps {
  biometrics: BiometricEntry[];
  phaseFor?: (date: string) => CyclePhase | undefined;
  signals?: SignalTrend["signal"][];
  source?: "whoop" | "sample";
}

const META: Record<string, { icon: string; color: string }> = {
  skinTempC: { icon: "🌡️", color: "oklch(0.70 0.16 35)" },
  restingHr: { icon: "❤️", color: "oklch(0.66 0.16 15)" },
  hrvMs:     { icon: "🫀", color: "oklch(0.70 0.14 160)" },
  respRate:  { icon: "🫁", color: "oklch(0.66 0.14 260)" },
  avgHr:     { icon: "💓", color: "oklch(0.68 0.15 25)" },
};

function Sparkline({ trend, color }: { trend: SignalTrend; color: string }) {
  const vals = trend.points.map((p) => p.value);
  if (vals.length < 2) return <div style={{ height: 40 }} />;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 120, H = 40;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / span) * H}`).join(" ");
  const baselineY = H - ((trend.points[0].baseline - min) / span) * H;
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <line x1={0} y1={baselineY} x2={W} y2={baselineY} stroke="var(--luna-text-muted)" strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
      <motion.polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }} />
      <circle cx={W} cy={H - ((vals[vals.length - 1] - min) / span) * H} r={3} fill={color} />
    </svg>
  );
}

export default function BiometricTrends({ biometrics, phaseFor, signals, source }: BiometricTrendsProps) {
  const keys = (signals ?? ["skinTempC", "restingHr", "hrvMs", "respRate"]) as SignalTrend["signal"][];
  const trends = keys.map((k) => getBiometricTrend(biometrics, k, phaseFor));

  return (
    <div style={{ background: "var(--luna-surface)", borderRadius: 20, padding: 16, boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)" }}>Your Signals</h2>
        {source && (
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 600,
            background: source === "whoop" ? "oklch(0.70 0.14 160 / 0.15)" : "oklch(0.78 0.10 75 / 0.18)",
            color: source === "whoop" ? "oklch(0.45 0.1 160)" : "oklch(0.5 0.1 75)" }}>
            {source === "whoop" ? "WHOOP" : "Sample data"}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {trends.map((t, i) => {
          const m = META[t.signal];
          const arrow = t.direction === "up" ? "↑" : t.direction === "down" ? "↓" : "→";
          return (
            <motion.div key={t.signal}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 96 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text)" }}>{m.icon} {t.label}</span>
                <span style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>
                  {arrow} {t.deltaFromBaseline > 0 ? "+" : ""}{t.deltaFromBaseline} {t.unit} vs baseline
                </span>
              </div>
              <Sparkline trend={t} color={m.color} />
            </motion.div>
          );
        })}
      </div>
      <p style={{ fontSize: 10, color: "var(--luna-text-muted)", marginTop: 10, lineHeight: 1.4 }}>
        Shown against your own rolling baseline. These are patterns to notice, not a medical measurement.
      </p>
    </div>
  );
}
