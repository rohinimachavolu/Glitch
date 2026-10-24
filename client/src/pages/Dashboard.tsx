/**
 * Luna — Dashboard (nutrition + daily overview)
 * Works for every mode. Shows today's nutrition, a coach line, steps, and a
 * quick cross-link to the user's hero surface.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { getCoachResponse } from "@/lib/aiService";
import { NUTRITION_ANCHORS } from "@/data/references";
import { Flame, Sparkles } from "lucide-react";
import VoiceAssistant from "@/components/VoiceAssistant";
import SpotifyCard from "@/components/SpotifyCard";
import PerlinField from "@/components/PerlinField";

function Ring({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const pct = Math.min(value / target, 1);
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={36} cy={36} r={r} fill="none" stroke="oklch(0.88 0.02 72)" strokeWidth={6} />
          <motion.circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--luna-text)" }}>{Math.round(value)}</span>
          <span style={{ fontSize: 8, color: "var(--luna-text-muted)" }}>/{target}{unit}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--luna-text-muted)" }}>{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { profile, meals, cyclePhase, cycleDay, biometrics, checkins, cycleStats } = useApp();
  const [coach, setCoach] = useState<string | null>(null);

  const totals = meals.reduce((a, m) => ({
    cal: a.cal + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs,
    fats: a.fats + m.fats, fiber: a.fiber + m.fiber,
  }), { cal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });

  const target = {
    cal: profile?.goal === "build_muscle" ? 2200 : profile?.goal === "lose_weight" ? 1750 : 2000,
    protein: Math.round((profile?.weight ?? 65) * NUTRITION_ANCHORS.PROTEIN_G_PER_KG),
    carbs: 220, fats: 60, fiber: NUTRITION_ANCHORS.FIBER_G,
  };

  useEffect(() => {
    if (!profile) return;
    const today = checkins.find((c) => c.date === new Date().toISOString().split("T")[0]);
    const recovery = biometrics[biometrics.length - 1]?.recoveryScore;
    let cancelled = false;
    getCoachResponse({
      name: profile.name, healthMode: profile.healthMode,
      cyclePhase: cyclePhase ?? undefined, cycleDay: cycleDay ?? undefined,
      mood: today?.mood, energy: today?.energy, stress: today?.stress,
      recentRecovery: recovery, loggedCycles: cycleStats.count,
    }).then((m) => { if (!cancelled) setCoach(m); }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.name, cyclePhase]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="luna-app" style={{ minHeight: "100%", padding: "22px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>{greeting}</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--luna-text)" }}>{profile?.name} 🌙</h1>
      </div>

      {/* Coach line */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ padding: 14, borderRadius: 16, background: `linear-gradient(135deg, var(--luna-accent), var(--luna-accent2))`, boxShadow: "0 8px 22px var(--luna-glow)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Sparkles size={18} color="white" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: "white", lineHeight: 1.5, fontWeight: 500 }}>{coach ?? "Glitch is thinking about your day…"}</p>
      </motion.div>

      {/* Nutrition rings */}
      <div style={{ padding: 16, borderRadius: 20, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 14 }}>Today's nutrition</h2>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <Ring label="Calories" value={totals.cal} target={target.cal} unit="" color="oklch(0.66 0.14 35)" />
          <Ring label="Protein" value={totals.protein} target={target.protein} unit="g" color="oklch(0.70 0.14 160)" />
          <Ring label="Carbs" value={totals.carbs} target={target.carbs} unit="g" color="oklch(0.78 0.12 85)" />
          <Ring label="Fiber" value={totals.fiber} target={target.fiber} unit="g" color="oklch(0.66 0.13 300)" />
        </div>
      </div>

      {/* Meals */}
      <div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 10 }}>Meals today</h2>
        {meals.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 16, background: "var(--luna-surface)", textAlign: "center", border: "1.5px dashed oklch(0.85 0.02 72)" }}>
            <p style={{ fontSize: 28, marginBottom: 6 }}>🍽️</p>
            <p style={{ fontSize: 13, color: "var(--luna-text-muted)" }}>No meals logged. Tap <b>Log</b> to add one.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {meals.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 14, background: "var(--luna-surface)" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>{m.name}</p>
                  <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>{m.calories} cal · {m.protein}g P · {m.type}</p>
                </div>
                <span style={{ fontSize: 10, color: "var(--luna-text-muted)" }}>{m.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--luna-text-muted)", justifyContent: "center" }}>
        <Flame size={13} /> Nutrition anchors from NIH dietary references, personalized by Luna
      </div>
    </div>
  );
}
