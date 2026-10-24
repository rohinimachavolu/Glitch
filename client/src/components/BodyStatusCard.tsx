/**
 * Glitch — Body Status card (Dashboard)
 * Today's WHOOP-derived recovery (cycle-adjusted), stress, energy and VO2max.
 * Tap a tile to see what's driving it.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Activity, Battery, Brain, HeartPulse, Watch } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useHealthInsights } from "@/hooks/useHealthInsights";

const INK = "oklch(0.25 0.025 50)";
const MUTED = "oklch(0.55 0.020 60)";
const CARD = "oklch(0.99 0.010 78)";
const GOOD = "oklch(0.66 0.11 148)";
const OK = "oklch(0.75 0.12 75)";
const BAD = "oklch(0.62 0.15 30)";
const font = "'DM Sans', sans-serif";

const tierColor = (v: number, goodAbove = 66, okAbove = 34) => (v >= goodAbove ? GOOD : v >= okAbove ? OK : BAD);

type Tile = "stress" | "energy" | "vo2";

export default function BodyStatusCard() {
  const { connectWhoopDemo } = useApp();
  const h = useHealthInsights();
  const [open, setOpen] = useState<Tile | null>(null);

  if (!h.connected) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: `linear-gradient(135deg, ${INK} 0%, oklch(0.32 0.04 40) 100%)`, borderRadius: 22, padding: 18, color: "white" }}>
        <div className="flex items-center gap-2 mb-2">
          <Watch size={18} />
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700 }}>Connect your WHOOP</p>
        </div>
        <p style={{ fontSize: 12.5, opacity: 0.8, fontFamily: font, lineHeight: 1.5, marginBottom: 14 }}>
          Unlock cycle-adjusted recovery, stress, energy, VO₂max and ovulation confirmation from your heart rate, HRV and skin temperature.
        </p>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => toast.info("Live WHOOP sign-in needs the backend — coming next. Try demo data for now.")}
            style={{ flex: 1, padding: "11px", borderRadius: 13, border: "none", background: "white", color: INK, fontWeight: 700, fontSize: 13, fontFamily: font }}>
            Connect WHOOP
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => { connectWhoopDemo(); toast.success("Loaded 90 days of demo WHOOP data"); }}
            style={{ flex: 1, padding: "11px", borderRadius: 13, border: "1.5px solid oklch(1 0 0 / 0.35)", background: "transparent", color: "white", fontWeight: 600, fontSize: 13, fontFamily: font }}>
            Try demo data
          </motion.button>
        </div>
      </motion.div>
    );
  }

  const rec = h.recovery;
  const recColor = rec ? tierColor(rec.raw) : MUTED;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: CARD, borderRadius: 22, padding: 16, boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: "oklch(0.35 0.025 50)" }}>Body Status</h2>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, fontFamily: font, background: h.source === "demo" ? "oklch(0.75 0.12 75 / 0.18)" : "oklch(0.66 0.11 148 / 0.18)", color: h.source === "demo" ? "oklch(0.50 0.10 75)" : "oklch(0.45 0.10 148)" }}>
          {h.source === "demo" ? "DEMO DATA" : "WHOOP LIVE"}
        </span>
      </div>

      {/* Recovery */}
      {rec && (
        <div className="flex items-center gap-4 mb-4">
          <Ring value={rec.raw} color={recColor} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p style={{ fontSize: 12, fontWeight: 700, color: MUTED, fontFamily: font, letterSpacing: 0.4 }}>RECOVERY</p>
              {rec.phase && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "oklch(0.62 0.12 38 / 0.12)", color: "oklch(0.52 0.12 38)", fontFamily: font, textTransform: "capitalize" }}>
                  {rec.phase} phase
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: INK, fontFamily: font, marginTop: 4, lineHeight: 1.45 }}>{rec.message}</p>
            {rec.delta != null && (
              <p style={{ fontSize: 11, color: rec.delta >= 0 ? GOOD : BAD, fontFamily: font, marginTop: 4, fontWeight: 700 }}>
                {rec.delta >= 0 ? "▲" : "▼"} {Math.abs(rec.delta)} vs your {rec.phase ? `${rec.phase} average` : "baseline"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tiles */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <TileButton active={open === "stress"} onClick={() => setOpen(open === "stress" ? null : "stress")}
          icon={<Brain size={15} />} label="Stress" value={h.stress ? `${h.stress.score}` : "—"}
          sub={h.stress?.level ?? "building"} color={h.stress ? tierColor(100 - h.stress.score, 60, 35) : MUTED} />
        <TileButton active={open === "energy"} onClick={() => setOpen(open === "energy" ? null : "energy")}
          icon={<Battery size={15} />} label="Energy" value={h.energy ? `${h.energy.score}%` : "—"}
          sub={h.energy?.label ?? "—"} color={h.energy ? tierColor(h.energy.score, 70, 40) : MUTED} />
        <TileButton active={open === "vo2"} onClick={() => setOpen(open === "vo2" ? null : "vo2")}
          icon={<HeartPulse size={15} />} label="VO₂max" value={h.vo2 ? `${h.vo2.value}` : "—"}
          sub={h.vo2?.category ?? "—"} color={h.vo2 ? (["Excellent", "Superior"].includes(h.vo2.category) ? GOOD : h.vo2.category === "Good" ? OK : BAD) : MUTED} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key={open} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 14, background: "oklch(0.95 0.015 75)" }}>
              {open === "stress" && h.stress && (
                <>
                  <Detail title="What's driving it" />
                  {h.stress.drivers.map((d) => <Bullet key={d} text={d} />)}
                  <Note text={h.cycle ? "Compared with your own baseline for this cycle phase, so normal hormonal HRV dips don't count as stress." : "Compared with your own 30-day HRV, resting heart rate and sleep."} />
                </>
              )}
              {open === "energy" && h.energy && h.today && (
                <>
                  <Detail title="Your battery today" />
                  <Bullet text={`Charged by recovery ${h.today.recovery ?? "—"}% and sleep ${h.today.sleepPerformance ?? "—"}%`} />
                  <Bullet text={`Drained by ${h.today.strain?.toFixed(1) ?? 0} strain so far`} />
                  <Note text={h.energy.score < 45 ? "Keep today light: a walk, mobility, an early night." : "Good day for a harder session if you feel up to it."} />
                </>
              )}
              {open === "vo2" && h.vo2 && (
                <>
                  <Detail title="Cardio fitness estimate" />
                  <Bullet text={`15.3 × max HR ${h.vo2.hrMax} ÷ resting HR ${h.vo2.hrRest}`} />
                  {h.vo2Start && <Bullet text={`${h.vo2Start.value} → ${h.vo2.value} ml/kg/min over ${h.days.length} days`} />}
                  <Note text="VO₂max is one of the strongest predictors of long-term heart health. Zone-2 cardio and a falling resting heart rate push it up. Estimate (Uth et al., 2004), not a lab test." />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Ring({ value, color }: { value: number; color: string }) {
  const size = 84, sw = 9, r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(0.90 0.015 72)" strokeWidth={sw} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.1, ease: [0.23, 1, 0.32, 1] }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: INK, fontFamily: font }}>{value}%</span>
      </div>
    </div>
  );
}

function TileButton({ active, onClick, icon, label, value, sub, color }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} aria-expanded={active}
      style={{ padding: "10px 8px", borderRadius: 14, border: active ? `2px solid ${color}` : "1.5px solid oklch(0.90 0.015 72)", background: active ? "oklch(0.97 0.012 75)" : CARD, textAlign: "left", transition: "border-color 0.15s" }}>
      <div className="flex items-center gap-1" style={{ color, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: font, color: MUTED }}>{label}</span>
      </div>
      <p style={{ fontSize: 19, fontWeight: 800, color: INK, fontFamily: font, lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: 10.5, fontWeight: 600, color, fontFamily: font, textTransform: "capitalize" }}>{sub}</p>
    </motion.button>
  );
}

const Detail = ({ title }: { title: string }) => (
  <p className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, color: MUTED, fontFamily: font, letterSpacing: 0.4, marginBottom: 6 }}>
    <Activity size={12} /> {title.toUpperCase()}
  </p>
);
const Bullet = ({ text }: { text: string }) => (
  <p style={{ fontSize: 12.5, color: INK, fontFamily: font, marginBottom: 3 }}>• {text}</p>
);
const Note = ({ text }: { text: string }) => (
  <p style={{ fontSize: 11, color: MUTED, fontFamily: font, marginTop: 6, lineHeight: 1.45 }}>{text}</p>
);
