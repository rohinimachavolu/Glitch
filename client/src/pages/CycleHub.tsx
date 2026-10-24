/**
 * Luna — CycleHub (hero surface for cycling / irregular / pcos modes)
 * The living centerpiece: orb + signal weaver + pattern reveal + range
 * prediction + logging + PCOS pattern flags.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { getCyclePhase } from "@/lib/cycleEngine";
import { getPcosSignals } from "@/lib/pcosSignals";
import CycleOrb from "@/components/CycleOrb";
import SignalWeaver from "@/components/SignalWeaver";
import PatternReveal from "@/components/PatternReveal";
import BiometricTrends from "@/components/BiometricTrends";
import PerlinField from "@/components/PerlinField";
import VoiceAssistant from "@/components/VoiceAssistant";
import SpotifyCard from "@/components/SpotifyCard";
import { PHASE_NUTRITION } from "@/data/references";
import type { CyclePhase, FlowLevel, PmsSymptom } from "@/db/types";
import WhoopConnect from "@/components/WhoopConnect";

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: "Menstrual", follicular: "Follicular", ovulation: "Ovulation", luteal: "Luteal",
};
const PHASE_NOTE: Record<CyclePhase, string> = {
  menstrual: "Rest and restore. Be gentle with yourself today.",
  follicular: "Energy is rising — a good window for new goals.",
  ovulation: "Peak energy. Great time for things that challenge you.",
  luteal: "Wind down. Prioritize steady blood sugar and sleep.",
};
const PERLIN_TINT: Record<CyclePhase, [string, string]> = {
  menstrual: ["oklch(0.62 0.18 18)", "oklch(0.72 0.14 10)"],
  follicular: ["oklch(0.70 0.14 150)", "oklch(0.78 0.12 165)"],
  ovulation: ["oklch(0.80 0.16 85)", "oklch(0.85 0.13 100)"],
  luteal: ["oklch(0.66 0.15 300)", "oklch(0.72 0.12 325)"],
};

export default function CycleHub() {
  const {
    profile, periods, checkins, biometrics, cycleDay, cyclePhase, cycleLength,
    prediction, cycleStats, whoopConnected, usingSample, addPeriod, saveCheckin,
  } = useApp();

  const [tab, setTab] = useState<"today" | "signals" | "log" | "patterns">("today");
  const mode = profile?.healthMode ?? "cycling";

  const phaseFor = useMemo(() => {
    if (!periods.length) return () => undefined;
    const starts = periods.map((p) => new Date(p.startDate).getTime()).sort((a, b) => a - b);
    return (date: string): CyclePhase | undefined => {
      const t = new Date(date).getTime();
      const prior = starts.filter((s) => s <= t).pop();
      if (prior == null) return undefined;
      const day = Math.floor((t - prior) / 86400000) + 1;
      return getCyclePhase(day, cycleLength);
    };
  }, [periods, cycleLength]);

  const pcosFlags = useMemo(
    () => (mode === "pcos" || mode === "irregular") ? getPcosSignals({ cycleStats, biometrics }) : [],
    [mode, cycleStats, biometrics],
  );

  const nutrition = cyclePhase ? PHASE_NUTRITION[cyclePhase] : null;
  const bioSource = whoopConnected ? "whoop" : "sample";

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const TABS = [
    { id: "today", label: "Today", emoji: "🌙" },
    { id: "signals", label: "Signals", emoji: "〰️" },
    { id: "patterns", label: "Patterns", emoji: "✨" },
    { id: "log", label: "Log", emoji: "📝" },
  ] as const;

  return (
    <div className="luna-app" style={{ minHeight: "100%", position: "relative" }}>
      {/* Header with orb */}
      <div style={{ position: "relative", padding: "24px 18px 10px", overflow: "hidden", minHeight: 340 }}>
        <PerlinField tint={PERLIN_TINT[cyclePhase ?? "follicular"][0]} tint2={PERLIN_TINT[cyclePhase ?? "follicular"][1]} opacity={0.5} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div>
              <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Hi {profile?.name} 🌙</h1>
            </div>
            {usingSample && <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 999, background: "oklch(0.78 0.10 75 / 0.2)", color: "oklch(0.5 0.1 75)", fontWeight: 600 }}>Sample data</span>}
          </div>

          <div style={{ padding: "16px 0" }}>
            <CycleOrb
              mode={mode}
              phase={cyclePhase}
              label={cycleDay ? `Day ${cycleDay}` : "Log"}
              sublabel={cyclePhase ? PHASE_LABEL[cyclePhase] : "your period"}
              mood={checkins.find((c) => c.date === new Date().toISOString().split("T")[0])?.mood}
              size={240}
            />
          </div>

          {cyclePhase && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ padding: "10px 14px", borderRadius: 14, background: "var(--luna-surface)", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--luna-text)", fontWeight: 500 }}>{PHASE_NOTE[cyclePhase]}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, padding: "6px 14px", overflowX: "auto" }} className="luna-scroll">
        {TABS.map(({ id, label, emoji }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "7px 14px", borderRadius: 999, whiteSpace: "nowrap", fontSize: 12, fontWeight: 600, border: "none", transition: "all 0.15s",
            background: tab === id ? "var(--luna-accent)" : "var(--luna-surface)",
            color: tab === id ? "white" : "var(--luna-text-muted)",
          }}>{emoji} {label}</button>
        ))}
      </div>

      <div style={{ padding: "6px 14px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {tab === "today" && (
          <>
            {/* Prediction range */}
            {prediction && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)" }}>Next period</h2>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 700, textTransform: "uppercase",
                    background: prediction.confidence === "high" ? "oklch(0.70 0.14 160 / 0.18)" : prediction.confidence === "moderate" ? "oklch(0.78 0.1 75 / 0.2)" : "oklch(0.62 0.12 18 / 0.15)",
                    color: prediction.confidence === "high" ? "oklch(0.45 0.1 160)" : prediction.confidence === "moderate" ? "oklch(0.5 0.1 75)" : "oklch(0.5 0.12 18)" }}>
                    {prediction.confidence} confidence
                  </span>
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: "var(--luna-accent)", fontFamily: "'Playfair Display', serif" }}>
                  {fmt(prediction.rangeStart)} – {fmt(prediction.rangeEnd)}
                </p>
                <p style={{ fontSize: 11, color: "var(--luna-text-muted)", marginTop: 6, lineHeight: 1.5 }}>{prediction.basis}</p>
              </motion.div>
            )}

            {/* Pattern reveal (hero) */}
            <PatternReveal biometrics={biometrics} checkins={checkins} />

            {/* PCOS flags */}
            {pcosFlags.length > 0 && (
              <div style={{ padding: 16, borderRadius: 18, background: "oklch(0.68 0.09 25 / 0.08)", border: "1px solid oklch(0.68 0.09 25 / 0.25)" }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "oklch(0.5 0.1 25)", marginBottom: 8 }}>🔎 Patterns worth noting</h2>
                {pcosFlags.map((f, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>{f.flag}</p>
                    <p style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.5 }}>{f.detail}</p>
                  </div>
                ))}
                <p style={{ fontSize: 10, color: "var(--luna-text-muted)", fontStyle: "italic", marginTop: 4 }}>
                  These are patterns to discuss with a clinician — not a diagnosis.
                </p>
              </div>
            )}

            {/* Nutrition this phase */}
            {nutrition && (
              <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)", marginBottom: 8 }}>🥗 Nutrition this phase</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {nutrition.priority.map((p) => (
                    <span key={p} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "color-mix(in oklch, var(--luna-accent) 15%, transparent)", color: "var(--luna-accent)" }}>{p}</span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "var(--luna-text-muted)", fontStyle: "italic", lineHeight: 1.5 }}>{nutrition.note}</p>
              </div>
            )}

            {!whoopConnected && <WhoopConnect />}
          </>
        )}

        {tab === "signals" && (
          <>
            <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 4 }}>Weave your signals</h2>
              <p style={{ fontSize: 11, color: "var(--luna-text-muted)", marginBottom: 12 }}>Scrub the timeline — watch your skin temp rise after ovulation and HRV dip before your period.</p>
              <SignalWeaver biometrics={biometrics} checkins={checkins} phaseFor={phaseFor} />
            </div>
            <BiometricTrends biometrics={biometrics} phaseFor={phaseFor} source={bioSource} />
          </>
        )}

        {tab === "patterns" && (
          <>
            <PatternReveal biometrics={biometrics} checkins={checkins} />
            <BiometricTrends biometrics={biometrics} phaseFor={phaseFor} source={bioSource} />
            {/* Cycle history */}
            <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)", marginBottom: 10 }}>📊 Your cycle history</h2>
              {cycleStats.count === 0 ? (
                <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>Log a few periods to see your cycle-length history.</p>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                    <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>Avg length</p><p style={{ fontSize: 18, fontWeight: 800, color: "var(--luna-accent)" }}>{Math.round(cycleStats.mean ?? 0)}d</p></div>
                    <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>Variation</p><p style={{ fontSize: 18, fontWeight: 800, color: "var(--luna-text)" }}>±{Math.round(cycleStats.sd ?? 0)}d</p></div>
                    <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>Cycles</p><p style={{ fontSize: 18, fontWeight: 800, color: "var(--luna-text)" }}>{cycleStats.count}</p></div>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 50 }}>
                    {cycleStats.lengths.map((l, i) => (
                      <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(l / 45) * 100}%` }} transition={{ delay: i * 0.05 }}
                        style={{ flex: 1, background: "var(--luna-accent)", borderRadius: "4px 4px 0 0", minHeight: 4, opacity: 0.7 }} title={`${l} days`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {tab === "log" && <LogSection onPeriod={addPeriod} onCheckin={saveCheckin} cycleDay={cycleDay} commonSymptoms={profile?.commonSymptoms ?? []} />}
      </div>
      <VoiceAssistant />
    </div>
  );
}

// ── Logging section ──────────────────────────────────────────
function LogSection({ onPeriod, onCheckin, cycleDay, commonSymptoms }: {
  onPeriod: (e: { startDate: string; flow?: FlowLevel }) => Promise<void>;
  onCheckin: (e: any) => Promise<void>;
  cycleDay: number | null;
  commonSymptoms: PmsSymptom[];
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [flow, setFlow] = useState<FlowLevel>("medium");
  const [sym, setSym] = useState({ mood: 3, energy: 3, stress: 2, bloating: 1, cramps: 1, cravings: 2, sleepQuality: 3 });
  const [notes, setNotes] = useState("");

  const sliders: [keyof typeof sym, string][] = [
    ["mood", "Mood"], ["energy", "Energy"], ["stress", "Stress"], ["cramps", "Cramps"],
    ["bloating", "Bloating"], ["cravings", "Cravings"], ["sleepQuality", "Sleep"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Period */}
      <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 10 }}>Log a period start</h2>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid oklch(0.85 0.02 72)", background: "var(--luna-bg)", color: "var(--luna-text)", width: "100%", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["spotting", "light", "medium", "heavy"] as FlowLevel[]).map((f) => (
            <button key={f} onClick={() => setFlow(f)} style={{ flex: 1, padding: "7px", borderRadius: 10, fontSize: 11, fontWeight: 600, textTransform: "capitalize", border: flow === f ? "none" : "1.5px solid oklch(0.85 0.02 72)", background: flow === f ? "var(--luna-accent)" : "transparent", color: flow === f ? "white" : "var(--luna-text-muted)" }}>{f}</button>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={async () => { await onPeriod({ startDate: date, flow }); toast.success("Period logged 🌸"); }}
          style={{ width: "100%", padding: 12, borderRadius: 12, background: "var(--luna-accent)", color: "white", fontWeight: 700, border: "none" }}>Save period</motion.button>
      </div>

      {/* Daily check-in */}
      <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 10 }}>Daily check-in</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sliders.map(([k, l]) => (
            <div key={k}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "var(--luna-text)" }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--luna-accent)" }}>{sym[k]}/5</span>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => setSym((p) => ({ ...p, [k]: v }))}
                    style={{ flex: 1, height: 26, borderRadius: 6, border: "none", background: v <= sym[k] ? "var(--luna-accent)" : "oklch(0.88 0.02 72)", opacity: v <= sym[k] ? 1 : 0.4, transition: "all 0.12s" }} />
                ))}
              </div>
            </div>
          ))}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How are you feeling? (optional)" rows={2}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid oklch(0.85 0.02 72)", background: "var(--luna-bg)", color: "var(--luna-text)", fontSize: 13, resize: "none", outline: "none" }} />
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={async () => {
              await onCheckin({ date: new Date().toISOString().split("T")[0], cycleDay: cycleDay ?? undefined, ...sym, symptoms: commonSymptoms, notes });
              toast.success("Check-in saved 🌙");
            }}
            style={{ padding: 12, borderRadius: 12, background: "var(--luna-accent)", color: "white", fontWeight: 700, border: "none" }}>Save check-in</motion.button>
        </div>
      </div>
    </div>
  );
}
