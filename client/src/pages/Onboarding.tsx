/**
 * Luna — Onboarding
 * Branches by biological sex → health mode. Men & prefer-not-to-say NEVER see
 * reproductive-health questions. Determines healthMode: cycling | irregular |
 * pcos | menopause | pregnancy | none.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import type {
  BiologicalSex, HealthMode, FitnessGoal, Equipment, WorkoutStyle,
  PmsSymptom, MenopauseSymptom, HealthCondition, RaceEthnicity, FitnessLevel,
} from "@/db/types";
import { ChevronRight, Moon } from "lucide-react";

const GOALS: { id: FitnessGoal; label: string; emoji: string }[] = [
  { id: "lose_weight", label: "Lose weight", emoji: "🔥" },
  { id: "maintain", label: "Stay healthy", emoji: "⚖️" },
  { id: "build_muscle", label: "Build strength", emoji: "💪" },
  { id: "manage_diabetes", label: "Manage blood sugar", emoji: "🌿" },
  { id: "bone_strength", label: "Bone & muscle health", emoji: "🦴" },
];

const EQUIPMENT: { id: Equipment; label: string; emoji: string }[] = [
  { id: "none", label: "Bodyweight", emoji: "🤸" },
  { id: "dumbbells", label: "Dumbbells", emoji: "🏋️" },
  { id: "resistance_bands", label: "Bands", emoji: "🎗️" },
  { id: "kettlebells", label: "Kettlebells", emoji: "⚙️" },
  { id: "pull_up_bar", label: "Pull-up bar", emoji: "🔩" },
  { id: "full_gym", label: "Full gym", emoji: "🏟️" },
];

const STYLES: { id: WorkoutStyle; label: string; emoji: string }[] = [
  { id: "walking", label: "Walking", emoji: "🚶" },
  { id: "calisthenics", label: "Calisthenics", emoji: "🤸" },
  { id: "weight_training", label: "Weights", emoji: "🏋️" },
  { id: "yoga", label: "Yoga", emoji: "🧘" },
  { id: "running", label: "Running", emoji: "🏃" },
  { id: "hiit", label: "HIIT", emoji: "⚡" },
  { id: "pilates", label: "Pilates", emoji: "🌀" },
];

const PMS: { id: PmsSymptom; label: string; emoji: string }[] = [
  { id: "cramps" as any, label: "Cramps", emoji: "🤕" },
  { id: "bloating", label: "Bloating", emoji: "💧" },
  { id: "cravings", label: "Cravings", emoji: "🍫" },
  { id: "fatigue", label: "Fatigue", emoji: "😴" },
  { id: "mood_swings", label: "Mood swings", emoji: "🌊" },
  { id: "headaches", label: "Headaches", emoji: "🤯" },
  { id: "acne", label: "Acne", emoji: "🔴" },
  { id: "breast_tenderness", label: "Tenderness", emoji: "💗" },
];

const MENO: { id: MenopauseSymptom; label: string; emoji: string }[] = [
  { id: "hot_flashes", label: "Hot flashes", emoji: "🔥" },
  { id: "night_sweats", label: "Night sweats", emoji: "💦" },
  { id: "sleep_issues", label: "Sleep issues", emoji: "🌙" },
  { id: "mood_changes", label: "Mood changes", emoji: "🌊" },
  { id: "joint_pain", label: "Joint pain", emoji: "🦵" },
  { id: "brain_fog", label: "Brain fog", emoji: "🌫️" },
  { id: "low_energy", label: "Low energy", emoji: "🔋" },
  { id: "palpitations", label: "Palpitations", emoji: "💓" },
];

const CONDITIONS: { id: HealthCondition; label: string }[] = [
  { id: "pcos", label: "PCOS" },
  { id: "endometriosis", label: "Endometriosis" },
  { id: "heavy_periods", label: "Heavy periods" },
  { id: "thyroid", label: "Thyroid" },
  { id: "diabetes", label: "Diabetes" },
  { id: "hypertension", label: "High BP" },
  { id: "none", label: "None" },
];

const card = (active: boolean): React.CSSProperties => ({
  padding: "12px 14px", borderRadius: 14, textAlign: "left", transition: "all 0.15s",
  border: active ? "2px solid var(--luna-accent)" : "1.5px solid oklch(0.85 0.02 72)",
  background: active ? "color-mix(in oklch, var(--luna-accent) 10%, transparent)" : "var(--luna-surface)",
  color: "var(--luna-text)", fontWeight: 600, fontSize: 13,
});

function Chip<T extends string>({ items, sel, toggle }: { items: { id: T; label: string; emoji?: string }[]; sel: T[]; toggle: (id: T) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map(({ id, label, emoji }) => {
        const a = sel.includes(id);
        return (
          <button key={id} onClick={() => toggle(id)} style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, transition: "all 0.15s",
            border: a ? "none" : "1.5px solid oklch(0.85 0.02 72)",
            background: a ? "var(--luna-accent)" : "var(--luna-surface)",
            color: a ? "white" : "var(--luna-text-muted)",
          }}>{emoji} {label}</button>
        );
      })}
    </div>
  );
}

export default function Onboarding() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState<BiologicalSex>("female");
  const [mode, setMode] = useState<HealthMode>("cycling");
  const [goal, setGoal] = useState<FitnessGoal>("maintain");
  const [equipment, setEquipment] = useState<Equipment[]>(["none"]);
  const [styles, setStyles] = useState<WorkoutStyle[]>(["walking"]);
  const [cycleLength, setCycleLength] = useState(28);
  const [pms, setPms] = useState<PmsSymptom[]>([]);
  const [meno, setMeno] = useState<MenopauseSymptom[]>([]);
  const [conditions, setConditions] = useState<HealthCondition[]>(["none"]);
  const [race, setRace] = useState<RaceEthnicity>("prefer_not_to_say");
  const [fitLevel, setFitLevel] = useState<FitnessLevel>("beginner");

  const isFemale = sex === "female";
  const reproMode = isFemale && mode !== "none";
  const isCycleMode = reproMode && mode !== "menopause" && mode !== "pregnancy";
  const isMeno = reproMode && mode === "menopause";

  // Trimmed sequence: fewer, essential steps only.
  const steps: string[] = ["Welcome", "You", ...(isFemale ? ["Your journey"] : []),
    ...(isCycleMode ? ["Cycle"] : []), ...(isMeno ? ["Menopause"] : []),
    "Goal", "Ready"];
  const last = steps.length - 1;

  const tog = <T,>(arr: T[], set: (v: T[]) => void, id: T) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  function next() {
    if (step === 1 && (!name || !age || !weight || !height)) return;
    if (step < last) { setStep(step + 1); return; }
    completeOnboarding({
      name, age: Number(age), weight: Number(weight), height: Number(height),
      biologicalSex: sex, raceEthnicity: race, fitnessLevel: fitLevel,
      healthMode: isFemale ? mode : "none", goal,
      equipment: ["none", "dumbbells"], workoutStyles: ["walking", "weight_training"],
      cycleLength: isCycleMode ? cycleLength : undefined,
      commonSymptoms: isCycleMode ? pms : undefined,
      menopauseSymptoms: isMeno ? meno : undefined,
      healthConditions: reproMode ? conditions : undefined,
    });
  }

  const label = steps[step];
  const input = (ph: string, v: string, set: (s: string) => void, type = "text") => (
    <input type={type} value={v} onChange={(e) => set(e.target.value)} placeholder={ph}
      style={{ padding: "11px 14px", borderRadius: 12, border: "1.5px solid oklch(0.85 0.02 72)", background: "var(--luna-surface)", fontSize: 14, color: "var(--luna-text)", outline: "none", width: "100%" }} />
  );

  return (
    <div className="luna-app luna-scroll" style={{ position: "relative", overflow: "auto", height: "100dvh", padding: "40px 22px 28px", display: "flex", flexDirection: "column" }}>
      <div className="luna-aurora" />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--luna-accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px var(--luna-glow)" }}>
            <Moon size={18} color="white" />
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 19, color: "var(--luna-text)" }}>Glitch</div>
            <div style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>Menopause & cycle companion</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: i === step ? 3 : 1, height: 5, borderRadius: 999, background: i <= step ? "var(--luna-accent)" : "oklch(0.85 0.02 72)", transition: "all 0.3s" }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

            {label === "Welcome" && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 14 }}>
                <span style={{ fontSize: 46 }}>🌙</span>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "var(--luna-text)", lineHeight: 1.2 }}>
                  Your body has a rhythm. Luna helps you see it.
                </h1>
                <p style={{ fontSize: 14, color: "var(--luna-text-muted)", lineHeight: 1.6 }}>
                  Cycle-aware and menopause-aware support that turns your wearable signals and how you feel into a living picture — with or without a WHOOP.
                </p>
              </div>
            )}

            {label === "You" && (
              <>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Let's get to know you</h1>
                {input("Your name", name, setName)}
                <div style={{ display: "flex", gap: 10 }}>
                  {input("Age", age, setAge, "number")}
                  {input("Weight (kg)", weight, setWeight, "number")}
                  {input("Height (cm)", height, setHeight, "number")}
                </div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text-muted)", marginTop: 4 }}>Biological sex</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([["female", "Female ♀"], ["male", "Male ♂"], ["prefer_not_to_say", "Prefer not to say"]] as [BiologicalSex, string][]).map(([id, l]) => (
                    <button key={id} onClick={() => setSex(id)} style={{ ...card(sex === id), flex: 1, textAlign: "center", fontSize: 12 }}>{l}</button>
                  ))}
                </div>
                {!isFemale && (
                  <p style={{ fontSize: 11, color: "var(--luna-text-muted)", fontStyle: "italic" }}>
                    You'll get the fitness & nutrition experience — no cycle questions.
                  </p>
                )}
              </>
            )}

            {label === "Your journey" && (
              <>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Where are you right now?</h1>
                <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>This shapes everything Luna shows you.</p>
                {([
                  ["cycling", "🌸 I have regular cycles", "Track phases, symptoms & predictions"],
                  ["irregular", "🌀 My cycles are irregular", "Wider predictions, pattern-aware"],
                  ["pcos", "💠 I have / suspect PCOS", "Surface patterns to discuss with a clinician"],
                  ["menopause", "🌗 I'm in peri/menopause", "Hot-flash tracking & transition support"],
                  ["pregnancy", "🤰 I'm pregnant", "Gentle logging & support only"],
                  ["none", "🏃 Just fitness & nutrition", "Skip cycle features"],
                ] as [HealthMode, string, string][]).map(([id, t, d]) => (
                  <button key={id} onClick={() => setMode(id)} style={{ ...card(mode === id), display: "flex", flexDirection: "column", gap: 2 }}>
                    <span>{t}</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--luna-text-muted)" }}>{d}</span>
                  </button>
                ))}
              </>
            )}

            {label === "Cycle" && (
              <>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Your cycle</h1>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>Average cycle length</label>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-accent)" }}>{cycleLength} days</span>
                </div>
                <input type="range" min={21} max={45} value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--luna-accent)" }} />
                <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>You'll log your actual periods inside — this is just a starting point. Most cycles vary several days month to month.</p>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text-muted)", marginTop: 6 }}>Symptoms you usually notice</label>
                <Chip items={PMS} sel={pms} toggle={(id) => tog(pms, setPms, id)} />
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text-muted)", marginTop: 6 }}>Any conditions? (optional)</label>
                <Chip items={CONDITIONS} sel={conditions} toggle={(id) => id === "none" ? setConditions(["none"]) : tog(conditions.filter((c) => c !== "none"), setConditions, id)} />
              </>
            )}

            {label === "Menopause" && (
              <>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Your transition</h1>
                <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>Glitch tracks hot flashes, night sweats, sleep & recovery, and flags perimenopause signals.</p>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text-muted)" }}>Symptoms you experience</label>
                <Chip items={MENO} sel={meno} toggle={(id) => tog(meno, setMeno, id)} />
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text-muted)", marginTop: 6 }}>Race / ethnicity <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <Chip items={([
                  ["asian","Asian"],["black","Black"],["hispanic","Hispanic"],["white","White"],
                  ["middle_eastern","M. Eastern"],["multiracial","Multiracial"],["other","Other"],["prefer_not_to_say","Skip"],
                ] as [RaceEthnicity,string][]).map(([id,label]) => ({ id, label }))}
                  sel={[race]} toggle={(id) => setRace(id)} />
              </>
            )}

            {label === "Goal" && (
              <>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>What's your goal?</h1>
                {GOALS.map(({ id, label: l, emoji }) => (
                  <button key={id} onClick={() => setGoal(id)} style={{ ...card(goal === id), display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{emoji}</span> {l}
                  </button>
                ))}
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--luna-text-muted)", marginTop: 8 }}>Your fitness level</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["beginner","intermediate","advanced"] as FitnessLevel[]).map((l) => (
                    <button key={l} onClick={() => setFitLevel(l)} style={{ ...card(fitLevel === l), flex: 1, textAlign: "center", fontSize: 12, textTransform: "capitalize" }}>{l}</button>
                  ))}
                </div>
              </>
            )}



            {label === "Ready" && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, gap: 16, textAlign: "center" }}>
                <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: 56 }}>🌙</motion.span>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 25, fontWeight: 700, color: "var(--luna-text)" }}>You're all set, {name}!</h1>
                <p style={{ fontSize: 13, color: "var(--luna-text-muted)", lineHeight: 1.6 }}>
                  Luna has loaded a sample of signal data so you can explore right away. Connect WHOOP anytime to make it yours.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <motion.button whileTap={{ scale: 0.97 }} onClick={next}
          style={{ marginTop: 18, padding: "15px", borderRadius: 15, background: "var(--luna-accent)", color: "white", fontWeight: 700, fontSize: 15, border: "none", boxShadow: "0 8px 22px var(--luna-glow)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {step === last ? "Enter Glitch" : "Continue"} <ChevronRight size={18} />
        </motion.button>
      </div>
    </div>
  );
}
