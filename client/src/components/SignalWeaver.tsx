/**
 * Luna — SignalWeaver
 * Flowing multi-signal visualization with a scrubbable timeline. Renders the
 * hero biometrics (skin temp, resting HR, HRV, respiratory rate) as smooth
 * waves over the cycle, overlaid with logged mood/energy. Scrub to watch the
 * temperature rise after ovulation and HRV dip before the period.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { BiometricEntry, CyclePhase, CycleCheckin } from "@/db/types";

interface SignalWeaverProps {
  biometrics: BiometricEntry[];
  checkins: CycleCheckin[];
  phaseFor: (date: string) => CyclePhase | undefined;
  height?: number;
}

type SigKey = "skinTempC" | "hrvMs" | "restingHr" | "respRate";

const SIGNALS: { key: SigKey; label: string; color: string; unit: string }[] = [
  { key: "skinTempC", label: "Skin Temp", color: "oklch(0.70 0.16 35)",  unit: "°C" },
  { key: "hrvMs",     label: "HRV",       color: "oklch(0.70 0.14 160)", unit: "ms" },
  { key: "restingHr", label: "Resting HR",color: "oklch(0.66 0.16 15)",  unit: "bpm" },
  { key: "respRate",  label: "Resp Rate", color: "oklch(0.66 0.14 260)", unit: "br" },
];

const PHASE_BAND: Record<CyclePhase, string> = {
  menstrual:  "oklch(0.62 0.18 18 / 0.12)",
  follicular: "oklch(0.70 0.14 150 / 0.12)",
  ovulation:  "oklch(0.80 0.16 85 / 0.14)",
  luteal:     "oklch(0.66 0.15 300 / 0.12)",
};

function normalize(values: (number | undefined)[]): (number | null)[] {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (!nums.length) return values.map(() => null);
  const min = Math.min(...nums), max = Math.max(...nums);
  const span = max - min || 1;
  return values.map((v) => (typeof v === "number" ? (v - min) / span : null));
}

// Smooth Catmull-Rom → SVG path.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function SignalWeaver({ biometrics, checkins, phaseFor, height = 200 }: SignalWeaverProps) {
  const [scrub, setScrub] = useState(1); // 0..1 position
  const [active, setActive] = useState<Record<SigKey, boolean>>({
    skinTempC: true, hrvMs: true, restingHr: false, respRate: false,
  });

  const W = 340, H = height, PAD = 10;
  const data = useMemo(() => biometrics.slice(-42), [biometrics]); // ~6 weeks
  const n = data.length;

  const checkinByDate = useMemo(() => {
    const m = new Map<string, CycleCheckin>();
    checkins.forEach((c) => m.set(c.date, c));
    return m;
  }, [checkins]);

  if (n < 2) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--luna-text-muted)", fontSize: 13 }}>
        Not enough signal data yet. Connect WHOOP or keep logging to weave your story.
      </div>
    );
  }

  const xFor = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const scrubIdx = Math.round(scrub * (n - 1));

  const paths = SIGNALS.filter((s) => active[s.key]).map((s) => {
    const norm = normalize(data.map((d) => d[s.key]));
    const pts = norm
      .map((v, i) => (v == null ? null : { x: xFor(i), y: PAD + (1 - v) * (H - PAD * 2) }))
      .filter((p): p is { x: number; y: number } => p != null);
    return { ...s, d: smoothPath(pts), pts };
  });

  const scrubDate = data[scrubIdx]?.date;
  const scrubCheckin = scrubDate ? checkinByDate.get(scrubDate) : undefined;
  const scrubPhase = scrubDate ? phaseFor(scrubDate) : undefined;

  return (
    <div>
      {/* Signal toggles */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {SIGNALS.map((s) => (
          <button key={s.key} onClick={() => setActive((p) => ({ ...p, [s.key]: !p[s.key] }))}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999,
              border: `1.5px solid ${active[s.key] ? s.color : "var(--luna-text-muted)"}`,
              background: active[s.key] ? `${s.color.replace(")", " / 0.14)")}` : "transparent",
              fontSize: 11, fontWeight: 600, color: active[s.key] ? s.color : "var(--luna-text-muted)",
              transition: "all 0.15s",
            }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
          {/* Phase bands */}
          {data.map((d, i) => {
            const ph = phaseFor(d.date);
            if (!ph) return null;
            return <rect key={i} x={xFor(i) - (W / n) / 2} y={0} width={W / n} height={H} fill={PHASE_BAND[ph]} />;
          })}

          {/* Wave paths with draw-in animation */}
          {paths.map((p) => (
            <g key={p.key}>
              <motion.path d={p.d} fill="none" stroke={p.color} strokeWidth={2.5} strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, ease: [0.23, 1, 0.32, 1] }} />
            </g>
          ))}

          {/* Mood dots overlaid */}
          {data.map((d, i) => {
            const c = checkinByDate.get(d.date);
            if (!c) return null;
            const y = PAD + (1 - (c.mood - 1) / 4) * (H - PAD * 2);
            return <circle key={`m${i}`} cx={xFor(i)} cy={y} r={2.5} fill="var(--luna-text)" opacity={0.35} />;
          })}

          {/* Scrub line */}
          <line x1={xFor(scrubIdx)} y1={0} x2={xFor(scrubIdx)} y2={H} stroke="var(--luna-accent)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />
          {paths.map((p) => {
            const pt = p.pts[Math.min(scrubIdx, p.pts.length - 1)];
            return pt ? <circle key={`s${p.key}`} cx={xFor(scrubIdx)} cy={pt.y} r={4} fill={p.color} stroke="white" strokeWidth={1.5} /> : null;
          })}
        </svg>
      </div>

      {/* Scrubber */}
      <input type="range" min={0} max={1} step={0.001} value={scrub} onChange={(e) => setScrub(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--luna-accent)", marginTop: 8 }} aria-label="Scrub timeline" />

      {/* Readout at scrub position */}
      <motion.div key={scrubDate}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "var(--luna-surface)", border: "1px solid var(--luna-accent)", opacity: 0.98 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--luna-text)" }}>
            {scrubDate ? new Date(scrubDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
          </span>
          {scrubPhase && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--luna-accent)", color: "white", textTransform: "capitalize" }}>{scrubPhase}</span>}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {SIGNALS.filter((s) => active[s.key]).map((s) => {
            const v = data[scrubIdx]?.[s.key];
            return (
              <span key={s.key} style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>
                <b style={{ color: s.color }}>{typeof v === "number" ? v : "—"}</b> {s.unit} {s.label}
              </span>
            );
          })}
          {scrubCheckin && (
            <span style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>
              😊 mood <b style={{ color: "var(--luna-text)" }}>{scrubCheckin.mood}/5</b>
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
