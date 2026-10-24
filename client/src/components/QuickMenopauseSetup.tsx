/**
 * Glitch — 1-minute menopause setup. Three big-tap screens; everything else has sensible defaults
 * and can be filled in later by talking to Glitchy.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import type { HormoneContext } from "@/lib/hormones";
import { ETHNICITY_OPTIONS, type Ethnicity } from "@/lib/menopauseSignals";
import HormoneConsent from "./HormoneConsent";

const INK = "#F4F5F7";
const MUTED = "#8B909A";
const font = "'DM Sans', sans-serif";
const input: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid var(--line)", fontSize: 18, fontFamily: font, color: INK, background: "var(--card-bg)", outline: "none" };

type Where = "changing" | "stopped" | "unsure";

export default function QuickMenopauseSetup({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { setProfile } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [where, setWhere] = useState<Where | null>(null);
  const [lastPeriod, setLastPeriod] = useState("");
  const [ethnicity, setEthnicity] = useState<Ethnicity | "prefer_not" | undefined>();
  const [hormones, setHormones] = useState<HormoneContext | undefined>();

  const canNext = step === 0 ? !!name.trim() && Number(age) >= 30 : step === 1 ? !!where : true;

  function finish() {
    setProfile({
      name: name.trim(), age: Number(age), weight: Number(weight) || 70, height: Number(height) || 163,
      goal: "maintain", equipment: ["none"], workoutStyles: ["calisthenics", "yoga"], biologicalSex: "female",
      womensHealth: {
        cycleStatus: "no", noCycleReason: where === "stopped" ? "menopause" : "perimenopause",
        lastPeriodDate: lastPeriod, cycleLength: 28, commonSymptoms: [], healthConditions: ["none"],
        ...(ethnicity ? { ethnicity } : {}),
        ...(hormones ? { hormones } : {}),
      },
    });
    onDone();
  }

  const choice = (id: Where, emoji: string, title: string, sub: string) => (
    <motion.button key={id} whileTap={{ scale: 0.97 }} onClick={() => setWhere(id)} aria-pressed={where === id}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 18, textAlign: "left", border: where === id ? "3px solid var(--accent)" : "2px solid var(--line)", background: where === id ? "color-mix(in oklch, var(--accent) 8%, var(--card-bg))" : "white" }}>
      <span style={{ fontSize: 32 }}>{emoji}</span>
      <span><span style={{ display: "block", fontSize: 18, fontWeight: 800, color: INK }}>{title}</span><span style={{ display: "block", fontSize: 14, color: MUTED }}>{sub}</span></span>
    </motion.button>
  );

  return (
    <div className="flex flex-col min-h-dvh" style={{ padding: "28px 20px 24px", fontFamily: font, background: "var(--app-bg)" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <button onClick={step === 0 ? onBack : () => setStep(step - 1)} aria-label="Back" style={{ border: "none", background: "transparent", padding: 4, color: INK }}><ChevronLeft size={26} /></button>
        <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} style={{ width: i === step ? 28 : 10, height: 8, borderRadius: 999, background: i <= step ? "var(--accent)" : "var(--surface-2)", transition: "all 0.25s" }} />)}</div>
        <span style={{ width: 34 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-3 flex-1">
          {step === 0 && (
            <>
              <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 30, fontWeight: 700, color: INK }}>Hi there 🌗</h1>
              <p style={{ fontSize: 17, color: MUTED, marginBottom: 6 }}>Three quick questions and you're set.</p>
              <input style={input} placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} aria-label="First name" />
              <input style={input} placeholder="Your age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} aria-label="Age" />
              <div className="flex gap-2">
                <input style={input} placeholder="Weight kg (optional)" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} aria-label="Weight in kg" />
                <input style={input} placeholder="Height cm (optional)" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} aria-label="Height in cm" />
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 700, color: INK }}>Where are you right now?</h1>
              {choice("changing", "🌗", "My periods are changing", "Irregular, skipping, heavier or lighter")}
              {choice("stopped", "🌕", "My periods have stopped", "No period for a while")}
              {choice("unsure", "🤔", "I'm not sure", "Hot flashes, sleep or mood changes")}
              <label style={{ fontSize: 16, fontWeight: 700, color: INK, marginTop: 8 }}>When was your last period? <span style={{ color: MUTED, fontWeight: 500 }}>(rough guess is fine)</span></label>
              <input type="date" style={input} value={lastPeriod} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setLastPeriod(e.target.value)} aria-label="Last period date" />
            </>
          )}
          {step === 2 && (
            <>
              <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 700, color: INK }}>Optional, but helpful</h1>
              <p style={{ fontSize: 15, color: MUTED }}>Skip anything you like. It stays encrypted on your phone.</p>
              <HormoneConsent value={hormones} onChange={setHormones} />
              <p style={{ fontSize: 15, fontWeight: 700, color: INK, marginTop: 6 }}>Your background <span style={{ color: MUTED, fontWeight: 500 }}>(research shows hot flashes differ between groups)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {ETHNICITY_OPTIONS.map((o) => (
                  <button key={o.id} onClick={() => setEthnicity(o.id)} aria-pressed={ethnicity === o.id} style={{ padding: "9px 13px", borderRadius: 999, fontSize: 14, fontWeight: 600, border: ethnicity === o.id ? "none" : "1.5px solid var(--line)", background: ethnicity === o.id ? "var(--accent)" : "var(--card-bg)", color: ethnicity === o.id ? "var(--on-accent)" : INK }}>{o.label}</button>
                ))}
                <button onClick={() => setEthnicity("prefer_not")} aria-pressed={ethnicity === "prefer_not"} style={{ padding: "9px 13px", borderRadius: 999, fontSize: 14, fontWeight: 600, border: "1.5px dashed var(--line)", background: ethnicity === "prefer_not" ? "var(--surface-2)" : "var(--card-bg)", color: MUTED }}>Prefer not to say</button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <motion.button whileTap={{ scale: 0.97 }} disabled={!canNext} onClick={() => (step < 2 ? setStep(step + 1) : finish())}
        style={{ marginTop: 18, padding: "18px", borderRadius: 18, border: "none", fontSize: 19, fontWeight: 800, color: "var(--on-accent)", background: canNext ? "var(--accent)" : "oklch(0.82 0.02 60)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {step < 2 ? "Next" : "Start"} <ChevronRight size={22} />
      </motion.button>
    </div>
  );
}
