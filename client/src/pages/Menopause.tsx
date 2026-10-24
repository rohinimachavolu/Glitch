/**
 * Glitch — Menopause module (PRIORITY surface)
 * 7 features: race/ethnicity context, age, hot-flash count, night-sweat
 * detection, sleep fragmentation, perimenopause staging + alerts, mental-health
 * (BP + HRV) check. Big, alive UI with Perlin background. Patterns, not diagnosis.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import {
  detectHotFlashes, detectNightSweats, getSleepFragmentation, getMenopauseTrends,
  getMenopauseSuggestions, assessPerimenopause, getMentalHealthCheck,
} from "@/lib/menopauseEngine";
import { MENOPAUSE } from "@/data/references";
import type { PerimenopauseAssessment, MentalHealthCheck } from "@/db/types";
import CycleOrb from "@/components/CycleOrb";
import SignalWeaver from "@/components/SignalWeaver";
import BiometricTrends from "@/components/BiometricTrends";
import PerlinField from "@/components/PerlinField";
import WhoopConnect from "@/components/WhoopConnect";
import VoiceAssistant from "@/components/VoiceAssistant";
import { Bell, HeartPulse, Moon, Droplets, Flame, Brain } from "lucide-react";

const card: React.CSSProperties = { background: "var(--luna-surface)", borderRadius: 22, padding: 18, boxShadow: "0 6px 20px oklch(0.2 0.02 50 / 0.08)" };

export default function Menopause() {
  const { profile, biometrics, checkins, hotFlashes, records, whoopConnected, usingSample, logHotFlash } = useApp();
  const [tab, setTab] = useState<"overview" | "symptoms" | "sleep" | "signals">("overview");
  const [intensity, setIntensity] = useState(3);
  const [assessment, setAssessment] = useState<PerimenopauseAssessment | null>(null);

  const detected = useMemo(() => detectHotFlashes(biometrics), [biometrics]);
  const allFlashes = useMemo(() => {
    const manual = hotFlashes.filter((h) => h.source === "manual");
    return [...manual, ...detected].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [hotFlashes, detected]);
  const nightSweats = useMemo(() => detectNightSweats(biometrics), [biometrics]);
  const fragmentation = useMemo(() => getSleepFragmentation(biometrics), [biometrics]);
  const trends = useMemo(() => getMenopauseTrends(biometrics), [biometrics]);
  const suggestions = useMemo(() => getMenopauseSuggestions(trends, allFlashes.length), [trends, allFlashes.length]);
  const mental = useMemo<MentalHealthCheck>(() => getMentalHealthCheck(biometrics, records), [biometrics, records]);
  const bioSource = whoopConnected ? "whoop" : "sample";

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    assessPerimenopause({ age: profile.age, biometrics, hotFlashCount: allFlashes.length, nightSweatCount: nightSweats })
      .then((a) => { if (!cancelled) setAssessment(a); });
    return () => { cancelled = true; };
  }, [profile, biometrics, allFlashes.length, nightSweats]);

  // Fire an alert toast once when staging crosses the alert threshold.
  useEffect(() => {
    if (assessment?.alert) {
      toast.custom(() => (
        <div style={{ ...card, border: "1.5px solid var(--luna-accent)", maxWidth: 340 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <Bell size={16} color="var(--luna-accent)" />
            <b style={{ color: "var(--luna-text)", fontSize: 13 }}>{assessment.headline}</b>
          </div>
          <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>Based on your age and signals. This is a pattern to discuss with a clinician, not a diagnosis.</p>
        </div>
      ), { duration: 6000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment?.alert]);

  const TABS = [
    { id: "overview", label: "Overview", emoji: "🌗" },
    { id: "symptoms", label: "Symptoms", emoji: "🔥" },
    { id: "sleep", label: "Sleep", emoji: "🌙" },
    { id: "signals", label: "Signals", emoji: "〰️" },
  ] as const;

  const stageColor = (s?: string) =>
    s === "established" ? "oklch(0.6 0.16 25)" : s === "likely_peri" ? "oklch(0.66 0.14 45)" : s === "possible_early" ? "oklch(0.72 0.12 85)" : "oklch(0.7 0.12 160)";

  return (
    <div className="luna-app" style={{ minHeight: "100%", position: "relative" }}>
      {/* Header with Perlin + orb */}
      <div style={{ position: "relative", padding: "26px 18px 14px", overflow: "hidden", minHeight: 320 }}>
        <PerlinField tint="oklch(0.70 0.14 45)" tint2="oklch(0.74 0.11 25)" opacity={0.55} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 13, color: "var(--luna-text-muted)" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "var(--luna-text)" }}>Hi {profile?.name} 🌗</h1>
              <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>Age {profile?.age}{profile?.raceEthnicity && profile.raceEthnicity !== "prefer_not_to_say" ? ` · menopause support` : ""}</p>
            </div>
            {usingSample && <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: "oklch(0.78 0.10 75 / 0.25)", color: "oklch(0.45 0.1 75)", fontWeight: 700 }}>Sample data</span>}
          </div>
          <div style={{ padding: "8px 0" }}>
            <CycleOrb mode="menopause" label={`${allFlashes.length}`} sublabel="flashes tracked" size={200}
              mood={checkins.find((c) => c.date === new Date().toISOString().split("T")[0])?.mood} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="luna-scroll" style={{ display: "flex", gap: 6, padding: "6px 14px", overflowX: "auto", position: "sticky", top: 0, zIndex: 5, background: "var(--luna-bg)" }}>
        {TABS.map(({ id, label, emoji }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "9px 16px", borderRadius: 999, whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, border: "none",
            background: tab === id ? "var(--luna-accent)" : "var(--luna-surface)", color: tab === id ? "white" : "var(--luna-text-muted)",
          }}>{emoji} {label}</button>
        ))}
      </div>

      <div style={{ padding: "8px 14px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {tab === "overview" && assessment && (
          <>
            {/* Perimenopause staging (feature #2, #6) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ ...card, borderLeft: `5px solid ${stageColor(assessment.stage)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: stageColor(assessment.stage) }}>Perimenopause signals</p>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--luna-text)", lineHeight: 1.2, marginTop: 4 }}>{assessment.headline}</h2>
                </div>
                {assessment.alert && <Bell size={18} color={stageColor(assessment.stage)} />}
              </div>
              {/* Score meter */}
              <div style={{ height: 10, borderRadius: 999, background: "oklch(0.9 0.01 72)", overflow: "hidden", margin: "12px 0 8px" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${assessment.score}%` }} transition={{ duration: 1 }}
                  style={{ height: "100%", borderRadius: 999, background: stageColor(assessment.stage) }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {assessment.contributors.map((c, i) => (
                  <p key={i} style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.5 }}>• {c}</p>
                ))}
              </div>
              <p style={{ fontSize: 10, color: "var(--luna-text-muted)", fontStyle: "italic", marginTop: 8 }}>A pattern to discuss with a clinician — not a diagnosis.</p>
            </motion.div>

            {/* Quick stats row (features #3, #4, #5) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { icon: <Flame size={18} />, v: allFlashes.length, l: "Hot flashes", c: "oklch(0.66 0.16 30)" },
                { icon: <Droplets size={18} />, v: nightSweats, l: "Night sweats", c: "oklch(0.64 0.14 250)" },
                { icon: <Moon size={18} />, v: fragmentation.avgDisturbances, l: "Sleep wakes", c: "oklch(0.64 0.13 300)" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }} style={{ ...card, padding: 14, textAlign: "center" }}>
                  <div style={{ color: s.c, display: "flex", justifyContent: "center", marginBottom: 4 }}>{s.icon}</div>
                  <p style={{ fontSize: 24, fontWeight: 800, color: "var(--luna-text)", fontFamily: "'Playfair Display', serif" }}>{s.v}</p>
                  <p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>{s.l}</p>
                </motion.div>
              ))}
            </div>

            {/* Mental-health check (feature #7) */}
            <div style={{ ...card }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <Brain size={18} color="var(--luna-accent)" />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--luna-text)" }}>Mind & heart check</h2>
              </div>
              <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
                <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>HRV trend</p><p style={{ fontSize: 15, fontWeight: 700, color: "var(--luna-text)" }}>{mental.hrvTrend === "down" ? "↓ lower" : mental.hrvTrend === "up" ? "↑ higher" : "→ steady"}</p></div>
                <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>Blood pressure</p><p style={{ fontSize: 15, fontWeight: 700, color: mental.bp?.flag === "high" ? "oklch(0.6 0.16 25)" : "var(--luna-text)" }}>{mental.bp ? `${mental.bp.systolic}/${mental.bp.diastolic}` : "— add in Records"}</p></div>
              </div>
              <p style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.5 }}>{mental.prompt}</p>
            </div>

            {/* Quick log + suggestions */}
            <div style={{ ...card }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 6 }}>Feeling a hot flash?</h2>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => setIntensity(v)} style={{ flex: 1, height: 34, borderRadius: 10, border: "none", background: v <= intensity ? "oklch(0.66 0.16 30)" : "oklch(0.88 0.02 72)", opacity: v <= intensity ? 1 : 0.4 }} />
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={async () => { await logHotFlash({ timestamp: new Date().toISOString(), source: "manual", intensity }); toast.success("Logged 🔥"); }}
                style={{ width: "100%", padding: 13, borderRadius: 12, background: "oklch(0.66 0.16 30)", color: "white", fontWeight: 700, border: "none" }}>Log hot flash (intensity {intensity})</motion.button>
            </div>

            <div style={{ ...card }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--luna-text)", marginBottom: 10 }}>Supportive steps for you</h2>
              {suggestions.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--luna-bg)", marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <div><p style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>{s.title}</p><p style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.5 }}>{s.detail}</p></div>
                </motion.div>
              ))}
              <p style={{ fontSize: 10, color: "var(--luna-text-muted)", fontStyle: "italic" }}>Supportive suggestions, not medical advice. Glitch never prescribes medication or hormone therapy.</p>
            </div>

            {!whoopConnected && <WhoopConnect />}
          </>
        )}

        {tab === "symptoms" && (
          <div style={{ ...card }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 4 }}>Vasomotor history</h2>
            <p style={{ fontSize: 11, color: "var(--luna-text-muted)", marginBottom: 12 }}>Hot flashes affect {MENOPAUSE.HOT_FLASH_PREVALENCE_LOW}–{MENOPAUSE.HOT_FLASH_PREVALENCE_HIGH}% of people and can last {MENOPAUSE.HOT_FLASH_AVG_DURATION_YEARS_LOW}–{MENOPAUSE.HOT_FLASH_AVG_DURATION_YEARS_HIGH} years on average.</p>
            {allFlashes.length === 0 ? <p style={{ fontSize: 13, color: "var(--luna-text-muted)" }}>No events yet.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allFlashes.slice(0, 25).map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "var(--luna-bg)" }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text)" }}>{new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      <p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>{h.source === "manual" ? `Logged · intensity ${h.intensity}/5` : `Auto · +${h.tempSpikeC}°C, +${h.hrJumpBpm}bpm`}</p>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 600, background: h.source === "manual" ? "oklch(0.66 0.16 30 / 0.15)" : "oklch(0.70 0.14 160 / 0.15)", color: h.source === "manual" ? "oklch(0.5 0.14 30)" : "oklch(0.45 0.1 160)" }}>{h.source === "manual" ? "logged" : "detected"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "sleep" && (
          <>
            <div style={{ ...card, borderLeft: `5px solid ${fragmentation.level === "high" ? "oklch(0.6 0.16 25)" : fragmentation.level === "watch" ? "oklch(0.72 0.12 85)" : "oklch(0.7 0.12 160)"}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}><Moon size={18} color="var(--luna-accent)" /><h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--luna-text)" }}>Sleep fragmentation</h2></div>
              <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>Avg wake-ups</p><p style={{ fontSize: 20, fontWeight: 800, color: "var(--luna-text)" }}>{fragmentation.avgDisturbances}</p></div>
                {fragmentation.avgEfficiency != null && <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>Efficiency</p><p style={{ fontSize: 20, fontWeight: 800, color: "var(--luna-text)" }}>{fragmentation.avgEfficiency}%</p></div>}
                <div><p style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>Night sweats</p><p style={{ fontSize: 20, fontWeight: 800, color: "var(--luna-text)" }}>{nightSweats}</p></div>
              </div>
              <p style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.5 }}>{fragmentation.detail}</p>
            </div>
            <BiometricTrends biometrics={biometrics} source={bioSource} signals={["respRate", "restingHr", "hrvMs", "skinTempC"]} />
          </>
        )}

        {tab === "signals" && (
          <>
            <div style={{ ...card }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 12 }}>Your signals over time</h2>
              <SignalWeaver biometrics={biometrics} checkins={checkins} phaseFor={() => undefined} height={220} />
            </div>
            <BiometricTrends biometrics={biometrics} source={bioSource} signals={["hrvMs", "restingHr", "respRate", "skinTempC"]} />
          </>
        )}
      </div>

      <VoiceAssistant />
    </div>
  );
}
