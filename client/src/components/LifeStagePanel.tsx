/**
 * Glitch — Life-stage view for the Cycle tab when the user has no current cycle
 * (pregnancy, postpartum, perimenopause, menopause, pre-menarche, other).
 */
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { LIFE_STAGES } from "@/lib/lifeStage";
import { useHealthInsights } from "@/hooks/useHealthInsights";

const INK = "var(--ink)";
const MUTED = "var(--txt-muted)";
const font = "'DM Sans', sans-serif";
const card = { background: "var(--card-bg)", borderRadius: 20, padding: 16, boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" };

export default function LifeStagePanel() {
  const { profile } = useApp();
  const h = useHealthInsights();
  const wh = profile!.womensHealth!;
  const info = LIFE_STAGES[wh.noCycleReason ?? "other"];

  const weeksPregnant = wh.noCycleReason === "pregnant" && wh.dueDate
    ? Math.max(0, Math.min(42, 40 - Math.round((Date.parse(wh.dueDate) - Date.now()) / (7 * 86_400_000))))
    : null;

  // Night-time skin temperature spikes can reflect hot flushes in (peri)menopause
  const tempSpikes = (wh.noCycleReason === "perimenopause" || wh.noCycleReason === "menopause") && h.days.length > 14
    ? (() => {
        const temps = h.days.map((d) => d.skinTemp).filter((t): t is number => t != null);
        const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
        return h.days.slice(-14).filter((d) => d.skinTemp != null && d.skinTemp > avg + 0.35).length;
      })()
    : null;

  const sections: [string, string, string[]][] = [
    ["🏃", "Movement", info.fitness],
    ["🥗", "Nutrition", info.nutrition],
    ["👀", "Worth watching", info.watch],
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pt-3">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ ...card, background: "linear-gradient(150deg, color-mix(in oklch, var(--accent) 14%, transparent) 0%, var(--card-bg) 70%)" }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 40 }}>{info.emoji}</span>
          <div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 19, fontWeight: 700, color: INK }}>{info.label}</p>
            {weeksPregnant != null && (
              <p style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.84 0.14 38)", fontFamily: font }}>About {weeksPregnant} weeks · trimester {weeksPregnant < 14 ? 1 : weeksPregnant < 28 ? 2 : 3}</p>
            )}
          </div>
        </div>
        <p style={{ fontSize: 13, color: INK, fontFamily: font, lineHeight: 1.5, marginTop: 10 }}>{info.summary}</p>
      </motion.div>

      {tempSpikes != null && (
        <div style={card}>
          <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, fontFamily: font, letterSpacing: 0.4 }}>NIGHT-TIME TEMPERATURE SPIKES · LAST 14 NIGHTS</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: INK, fontFamily: font }}>{tempSpikes}</p>
          <p style={{ fontSize: 11.5, color: MUTED, fontFamily: font }}>Nights with skin temperature well above your norm, which can reflect hot flushes or night sweats. Track against caffeine, alcohol and late meals.</p>
        </div>
      )}

      {sections.map(([emoji, title, items], i) => (
        <motion.div key={title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }} style={card}>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: font, marginBottom: 8 }}>{emoji} {title}</p>
          <div className="flex flex-col gap-1.5">
            {items.map((t) => (
              <div key={t} style={{ padding: "8px 11px", borderRadius: 10, background: "var(--surface-2)" }}>
                <p style={{ fontSize: 12.5, color: INK, fontFamily: font }}>{t}</p>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      <p style={{ fontSize: 10.5, color: MUTED, fontFamily: font, textAlign: "center", padding: "0 12px" }}>
        General wellness guidance — not medical advice. Your clinician knows your situation best.
      </p>
    </div>
  );
}
