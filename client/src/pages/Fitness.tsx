/**
 * Glitch — Fitness
 * Suggests exercises FIRST (by phase + level, with form figures), asks your
 * level, then lets you log with RPE. Reflects YOUR own pattern across the cycle.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { correlate } from "@/lib/cycleEngine";
import { suggestExercises, Exercise } from "@/lib/exerciseLibrary";
import { FITNESS_EVIDENCE } from "@/data/references";
import type { FitnessLevel, WorkoutStyle } from "@/db/types";
import PostureFigure from "@/components/PostureFigure";
import PerlinField from "@/components/PerlinField";
import { Dumbbell, Plus, ChevronRight } from "lucide-react";

const card: React.CSSProperties = { background: "var(--luna-surface)", borderRadius: 20, padding: 18, boxShadow: "0 6px 20px oklch(0.2 0.02 50 / 0.07)" };

export default function Fitness() {
  const { profile, workouts, cycleDay, cyclePhase, addWorkout, reload } = useApp();
  const mode = profile?.healthMode ?? "none";
  const [level, setLevel] = useState<FitnessLevel>(profile?.fitnessLevel ?? "beginner");
  const [levelSet, setLevelSet] = useState(!!profile?.fitnessLevel);
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [rpe, setRpe] = useState(5);

  const suggestion = useMemo(() => suggestExercises(cyclePhase, level, mode), [cyclePhase, level, mode]);

  const insight = useMemo(() => {
    if (mode === "none" || mode === "menopause") return null;
    const withRpe = workouts.filter((w) => typeof w.perceivedEffort === "number" && typeof w.cycleDay === "number");
    if (withRpe.length < 4) return null;
    const r = correlate(withRpe.map((w) => w.cycleDay!), withRpe.map((w) => w.perceivedEffort!));
    if (Math.abs(r) < 0.35) return "So far your effort levels look steady across your cycle.";
    return r > 0
      ? "Your sessions have tended to feel harder later in your cycle — that's your own pattern."
      : "Your sessions have tended to feel easier later in your cycle — interesting, and uniquely yours.";
  }, [workouts, mode]);

  async function setLevelAndSave(l: FitnessLevel) {
    setLevel(l); setLevelSet(true);
    const { profileRepo } = await import("@/db/repositories");
    await profileRepo.update({ fitnessLevel: l });
    await reload();
  }

  async function logExercise(ex: Exercise) {
    await addWorkout({
      date: new Date().toISOString().split("T")[0], name: ex.name, type: (ex.focus === "strength" ? "weight_training" : ex.focus === "cardio" ? "running" : "yoga") as WorkoutStyle,
      perceivedEffort: rpe, cycleDay: cycleDay ?? undefined, completed: true,
    });
    setPicked(null);
    toast.success(`Logged ${ex.name} 💪`);
  }

  return (
    <div className="luna-app" style={{ minHeight: "100%", position: "relative" }}>
      <div style={{ position: "relative", padding: "24px 16px 10px", overflow: "hidden", minHeight: 140 }}>
        <PerlinField tint="oklch(0.68 0.13 160)" tint2="oklch(0.66 0.13 300)" opacity={0.4} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--luna-text)" }}>Move</h1>
          {cyclePhase && mode !== "menopause" && <p style={{ fontSize: 13, color: "var(--luna-text-muted)" }}>You're in your <b style={{ color: "var(--luna-accent)" }}>{cyclePhase}</b> phase (day {cycleDay})</p>}
        </div>
      </div>

      <div style={{ padding: "6px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Level selector (ask for input) */}
        <div style={{ ...card }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)", marginBottom: 4 }}>What's your level?</h2>
          <p style={{ fontSize: 11, color: "var(--luna-text-muted)", marginBottom: 10 }}>Suggestions adapt to this. You can change it anytime.</p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["beginner", "intermediate", "advanced"] as FitnessLevel[]).map((l) => (
              <button key={l} onClick={() => setLevelAndSave(l)} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 600, textTransform: "capitalize", border: level === l && levelSet ? "none" : "1.5px solid oklch(0.85 0.02 72)", background: level === l && levelSet ? "var(--luna-accent)" : "transparent", color: level === l && levelSet ? "white" : "var(--luna-text-muted)" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Phase-first suggestions */}
        <div style={{ ...card }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "var(--luna-text)", marginBottom: 6 }}>Suggested for you today</h2>
          <p style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.5, marginBottom: 12 }}>{suggestion.intro}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestion.recommended.map((ex, i) => (
              <motion.button key={ex.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setPicked(picked?.id === ex.id ? null : ex)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: picked?.id === ex.id ? "color-mix(in oklch, var(--luna-accent) 12%, transparent)" : "var(--luna-bg)", border: picked?.id === ex.id ? "1.5px solid var(--luna-accent)" : "1.5px solid transparent", textAlign: "left" }}>
                <span style={{ fontSize: 24 }}>{ex.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--luna-text)" }}>{ex.name}</p>
                  <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>{ex.sets} · {ex.focus} · {ex.level}</p>
                </div>
                <ChevronRight size={18} color="var(--luna-text-muted)" style={{ transform: picked?.id === ex.id ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
              </motion.button>
            ))}
          </div>

          {/* Expanded form guide */}
          <AnimatePresence>
            {picked && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden", marginTop: 12 }}>
                <div style={{ display: "flex", gap: 14, padding: 14, borderRadius: 16, background: "var(--luna-bg)" }}>
                  <PostureFigure points={picked.posture.points} label={picked.posture.label} size={130} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--luna-text)", marginBottom: 6 }}>Form cues</p>
                    {picked.cues.map((c, i) => (
                      <p key={i} style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.6 }}>✓ {c}</p>
                    ))}
                  </div>
                </div>
                {/* RPE + log */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--luna-text)" }}>How hard did it feel? (RPE)</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--luna-accent)" }}>{rpe}/10</span>
                  </div>
                  <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--luna-accent)", marginBottom: 10 }} />
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => logExercise(picked)}
                    style={{ width: "100%", padding: 12, borderRadius: 12, background: "var(--luna-accent)", color: "white", fontWeight: 700, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Plus size={16} /> Log this
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {insight && (
          <div style={{ padding: 14, borderRadius: 16, background: `linear-gradient(135deg, var(--luna-accent), var(--luna-accent2))`, boxShadow: "0 8px 22px var(--luna-glow)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "oklch(1 0 0 / 0.9)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Your training pattern</p>
            <p style={{ fontSize: 13, color: "white", lineHeight: 1.5 }}>{insight}</p>
          </div>
        )}

        {/* History */}
        {workouts.length > 0 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--luna-text)", marginBottom: 10 }}>Recent</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...workouts].reverse().slice(0, 10).map((w) => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 14, background: "var(--luna-surface)" }}>
                  <div><p style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>{w.name}</p>
                    <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>RPE {w.perceivedEffort}/10{w.cycleDay ? ` · day ${w.cycleDay}` : ""} · {w.date}</p></div>
                  <Dumbbell size={16} color="var(--luna-text-muted)" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!FITNESS_EVIDENCE.PHASE_RULE_IS_PRESCRIPTIVE && (
          <p style={{ fontSize: 10, color: "var(--luna-text-muted)", fontStyle: "italic", textAlign: "center", lineHeight: 1.5 }}>
            The science on cycle phase and performance is mixed, so Glitch suggests and reflects your own pattern rather than prescribing when to train hard.
          </p>
        )}
      </div>
    </div>
  );
}
