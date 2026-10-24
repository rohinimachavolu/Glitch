/**
 * Glitch — "Did I ovulate?" card (Cycle tab)
 * Shows temperature-confirmed ovulation per cycle and the skin-temperature curve for the
 * most recent complete cycle. Regular ovulation returning is one of the clearest signs that
 * lifestyle change is working for PCOS. Wellness insight, not a diagnosis.
 */
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import { useApp } from "@/contexts/AppContext";
import { useHealthInsights } from "@/hooks/useHealthInsights";
import type { OvulationResult } from "@/lib/healthMetrics";

const INK = "oklch(0.25 0.025 50)";
const MUTED = "oklch(0.55 0.020 60)";
const GOOD = "oklch(0.62 0.11 148)";
const WARN = "oklch(0.62 0.14 40)";
const font = "'DM Sans', sans-serif";

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const STATUS: Record<OvulationResult["status"], { label: string; color: string; bg: string; icon: string }> = {
  confirmed:         { label: "Ovulated",         color: GOOD,  bg: "oklch(0.62 0.11 148 / 0.12)", icon: "✓" },
  not_detected:      { label: "No shift found",   color: WARN,  bg: "oklch(0.62 0.14 40 / 0.12)",  icon: "!" },
  pending:           { label: "In progress",      color: MUTED, bg: "oklch(0.90 0.015 72)",        icon: "…" },
  insufficient_data: { label: "Not enough data",  color: MUTED, bg: "oklch(0.90 0.015 72)",        icon: "?" },
};

export default function OvulationCard() {
  const { profile, connectWhoopDemo } = useApp();
  const h = useHealthInsights();
  const wh = profile?.womensHealth;
  const card = { background: "oklch(0.99 0.010 78)", borderRadius: 20, padding: 16, boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" };

  if (wh?.hormonalContraception) {
    return (
      <div style={card}>
        <Title />
        <p style={{ fontSize: 12.5, color: MUTED, fontFamily: font, lineHeight: 1.5 }}>
          Most hormonal birth control pauses ovulation, so temperature-based detection is switched off. We still use your WHOOP data for recovery, stress and energy.
        </p>
      </div>
    );
  }

  if (!h.connected) {
    return (
      <div style={card}>
        <Title />
        <p style={{ fontSize: 12.5, color: MUTED, fontFamily: font, lineHeight: 1.5, marginBottom: 10 }}>
          After ovulation, progesterone raises skin temperature ~0.3 °C and resting heart rate a few beats. WHOOP measures both every night, so Glitch can confirm whether you actually ovulated, instead of guessing from the calendar.
        </p>
        <motion.button whileTap={{ scale: 0.96 }} onClick={connectWhoopDemo}
          style={{ padding: "9px 14px", borderRadius: 12, border: "none", background: "oklch(0.62 0.12 38)", color: "white", fontWeight: 700, fontSize: 12.5, fontFamily: font }}>
          Try with demo WHOOP data
        </motion.button>
      </div>
    );
  }

  const cyc = h.cycle;
  if (!cyc) return null;

  // Chart: most recent complete cycle with a result
  const idx = cyc.windows.map((w, i) => (w.complete ? i : -1)).filter((i) => i >= 0).pop();
  const win = idx != null ? cyc.windows[idx] : undefined;
  const ov = idx != null ? cyc.ovulations[idx] : undefined;
  const chart = win
    ? h.days.filter((d) => d.date >= win.start && d.date <= win.end && d.skinTemp != null)
        .map((d, i) => ({ day: i + 1, date: d.date, temp: d.skinTemp, rhr: d.restingHr }))
    : [];
  const ovDay = ov?.status === "confirmed" ? ov.ovulationCycleDay : undefined;
  const temps = chart.map((c) => c.temp as number);
  const yMin = temps.length ? Math.floor((Math.min(...temps) - 0.1) * 10) / 10 : 33;
  const yMax = temps.length ? Math.ceil((Math.max(...temps) + 0.1) * 10) / 10 : 35;

  const history = cyc.ovulations.filter((o, i) => cyc.windows[i].complete || o.status === "confirmed" || o.status === "pending");
  const pcos = wh?.healthConditions.includes("pcos");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={card}>
      <Title />

      {/* Score */}
      <div className="flex items-end gap-2 mb-3">
        <span style={{ fontSize: 30, fontWeight: 800, color: INK, fontFamily: font, lineHeight: 1 }}>{cyc.ovulatoryCycles}/{cyc.completeCycles}</span>
        <span style={{ fontSize: 12, color: MUTED, fontFamily: font, paddingBottom: 3 }}>recent cycles with confirmed ovulation</span>
      </div>

      {/* Per-cycle timeline */}
      <div className="flex flex-col gap-1.5 mb-3">
        {history.map((o) => {
          const s = STATUS[o.status];
          return (
            <div key={o.cycleStart} className="flex items-center justify-between" style={{ padding: "7px 10px", borderRadius: 11, background: s.bg }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: s.color, color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, fontFamily: font }}>Cycle from {fmt(o.cycleStart)}</span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: s.color, fontFamily: font }}>
                {o.status === "confirmed" ? `Day ${o.ovulationCycleDay} · +${o.tempShift}°C` : s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Temperature curve */}
      {chart.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, fontFamily: font, letterSpacing: 0.4, marginBottom: 4 }}>
            SKIN TEMPERATURE · CYCLE FROM {fmt(win!.start).toUpperCase()}
          </p>
          <div style={{ height: 130, marginLeft: -18 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} interval={4} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(2)} °C`, "Skin temp"]} labelFormatter={(d) => `Cycle day ${d}`} contentStyle={{ borderRadius: 10, fontSize: 12, fontFamily: font }} />
                {ovDay && <ReferenceArea x1={ovDay + 1} x2={chart.length} fill="oklch(0.62 0.12 38)" fillOpacity={0.07} />}
                {ovDay && <ReferenceLine x={ovDay} stroke="oklch(0.62 0.12 38)" strokeDasharray="4 3" label={{ value: "Ovulation", position: "insideTopLeft", fontSize: 10, fill: "oklch(0.52 0.12 38)" }} />}
                <Line type="monotone" dataKey="temp" stroke="oklch(0.62 0.12 38)" strokeWidth={2.2} dot={false} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <p style={{ fontSize: 11.5, color: MUTED, fontFamily: font, lineHeight: 1.5, marginTop: 8 }}>
        {ov?.status === "not_detected"
          ? "No sustained temperature rise in this cycle — it may not have included ovulation. One cycle like this is common; a pattern is worth raising with a clinician."
          : "A sustained rise after ovulation (shaded) is progesterone at work. Detected with a temperature \"3-over-6\" rule plus resting heart rate."}
        {pcos && cyc.ovulatoryCycles > 0 && " For PCOS, ovulation returning is a strong sign your habits are working."}
      </p>
    </motion.div>
  );
}

function Title() {
  return (
    <div className="flex items-center justify-between mb-2">
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: INK }}>Did I ovulate?</p>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "oklch(0.62 0.12 38 / 0.12)", color: "oklch(0.52 0.12 38)", fontFamily: font }}>WHOOP-CONFIRMED</span>
    </div>
  );
}
