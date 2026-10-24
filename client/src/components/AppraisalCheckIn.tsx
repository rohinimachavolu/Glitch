/**
 * Glitch — "How are you, really?" appraisal check-in (Dashboard)
 * 20-second check-in → engine in lib/appraisal.ts combines it with WHOOP physiology → one
 * evidence-based strategy, an alternative, a timer, and "did it help?" feedback the engine learns from.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { ChevronRight, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useApp, getCycleDay, getCyclePhase, tracksOvulation, AppraisalEntry } from "@/contexts/AppContext";
import { useHealthInsights } from "@/hooks/useHealthInsights";
import {
  coach, type Appraisal, type AteFeeling, type BodyContext, type CheckInInput,
  type CoachingResult, type CravingType, type Strategy, type StrategyId, type StrategyStats, type Trigger,
} from "@/lib/appraisal";
import { phraseCoaching } from "@/lib/aiService";
import { celebrate } from "./Fun";

const INK = "oklch(0.25 0.025 50)";
const MUTED = "oklch(0.55 0.020 60)";
const ACCENT = "var(--accent)";
const SAGE = "oklch(0.62 0.10 148)";
const CARD = "oklch(0.99 0.010 78)";
const font = "'DM Sans', sans-serif";

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const ENERGY = ["🪫", "😴", "🙂", "⚡", "🔥"];
const CRAVINGS: [CravingType, string][] = [["none", "None"], ["sweet", "🍫 Sweet"], ["salty", "🥨 Salty"], ["carbs", "🍞 Carbs"], ["fast_food", "🍔 Fast food"], ["alcohol", "🍷 Alcohol"]];
const APPRAISALS: [Appraisal, string, string][] = [
  ["challenge", "💪", "A challenge I can handle"],
  ["threat", "😰", "Overwhelming"],
  ["loss", "😔", "Like I already blew it"],
  ["neutral", "😌", "Pretty normal"],
];
const TRIGGERS: [Trigger, string][] = [["stressed", "Stressed"], ["tired", "Tired"], ["bored", "Bored"], ["lonely", "Lonely"], ["hungry", "Hungry"], ["conflict", "Conflict"], ["celebrating", "Celebrating"], ["pms", "PMS"]];
const ATE: [AteFeeling, string][] = [["fine", "😊 Fine"], ["guilty", "😣 Guilty"], ["ashamed", "😞 Ashamed"]];

const EMPTY: CheckInInput = { mood: 3, energy: 3, craving: "none", cravingIntensity: 0, appraisal: "neutral", control: 3, triggers: [], ateFeeling: null, note: "" };

export default function AppraisalCheckIn() {
  const { profile, meals, appraisalLog, addAppraisal, rateAppraisal } = useApp();
  const h = useHealthInsights();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<CheckInInput>(EMPTY);
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [aiLine, setAiLine] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [active, setActive] = useState<Strategy | null>(null);
  const [rated, setRated] = useState<boolean | null>(null);

  const set = <K extends keyof CheckInInput>(k: K, v: CheckInInput[K]) => setInput((p) => ({ ...p, [k]: v }));
  const toggleTrigger = (t: Trigger) => set("triggers", input.triggers.includes(t) ? input.triggers.filter((x) => x !== t) : [...input.triggers, t]);

  const stats = useMemo(() => {
    const s: Partial<Record<StrategyId, StrategyStats>> = {};
    for (const e of appraisalLog) {
      if (!e.tried || e.helped == null) continue;
      const cur = s[e.tried] ?? { shown: 0, helped: 0 };
      s[e.tried] = { shown: cur.shown + 1, helped: cur.helped + (e.helped ? 1 : 0) };
    }
    return s;
  }, [appraisalLog]);

  function bodyContext(): BodyContext {
    const wh = profile?.womensHealth;
    const cycling = tracksOvulation(profile);
    const cycleDay = cycling ? getCycleDay(wh!.lastPeriodDate, wh!.cycleLength) : null;
    const lastMeal = meals.map((m) => m.loggedAt).filter(Boolean).sort().pop();
    return {
      physioStress: h.stress,
      physioEnergy: h.energy?.score ?? null,
      recovery: h.recovery?.raw ?? null,
      sleepPerformance: h.today?.sleepPerformance ?? null,
      phase: cycling ? h.cycle?.currentPhase ?? getCyclePhase(cycleDay!, wh!.cycleLength) : null,
      cycleDay,
      cycleLength: cycling ? wh!.cycleLength : null,
      hoursSinceMeal: lastMeal ? (Date.now() - Date.parse(lastMeal)) / 3_600_000 : null,
      hour: new Date().getHours(),
    };
  }

  function finish() {
    const recentMoods = appraisalLog.slice(-2).map((e) => e.input.mood);
    const r = coach(input, bodyContext(), stats, recentMoods);
    const id = nanoid();
    const entry: AppraisalEntry = {
      id, at: new Date().toISOString(), input, stateLabel: r.stateLabel, mismatch: r.mismatch,
      primary: r.primary.id, alternative: r.alternative.id,
    };
    addAppraisal(entry);
    setEntryId(id);
    setResult(r);
    setActive(r.primary);
    setRated(null);
    setStep(3);
    if (!appraisalLog.some((e) => new Date(e.at).toDateString() === new Date().toDateString())) celebrate("Checked in. That's self-care 🫶");
    if (!r.safety) {
      setAiLoading(true);
      phraseCoaching({ stateLabel: r.stateLabel, insight: r.insight, strategyTitle: r.primary.title, note: input.note })
        .then(setAiLine).finally(() => setAiLoading(false));
    }
  }

  function close() {
    setOpen(false);
    setTimeout(() => { setStep(0); setInput(EMPTY); setResult(null); setAiLine(null); setActive(null); setEntryId(null); }, 250);
  }

  function rate(helped: boolean) {
    if (!entryId || !active) return;
    rateAppraisal(entryId, active.id, helped);
    setRated(helped);
  }

  const last = appraisalLog[appraisalLog.length - 1];

  if (!open) {
    return (
      <motion.button whileTap={{ scale: 0.98 }} onClick={() => setOpen(true)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 20, border: "none", textAlign: "left",
          background: "linear-gradient(120deg, color-mix(in oklch, var(--accent) 14%, transparent), oklch(0.72 0.08 148 / 0.14))", boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.05)" }}>
        <span style={{ fontSize: 28 }}>{last ? MOODS[last.input.mood - 1] : "🫶"}</span>
        <div className="flex-1">
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: INK }}>How are you, really?</p>
          <p style={{ fontSize: 12, color: MUTED, fontFamily: font }}>
            {last ? `Last check-in: ${last.stateLabel.toLowerCase()} · tap to check in again` : "20-second check-in on mood, cravings and stress, matched with your body data"}
          </p>
        </div>
        <ChevronRight size={18} style={{ color: MUTED }} />
      </motion.button>
    );
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: CARD, borderRadius: 22, padding: 16, boxShadow: "0 6px 24px oklch(0.25 0.025 50 / 0.10)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: i === step ? 22 : 8, height: 6, borderRadius: 999, background: i <= step ? ACCENT : "oklch(0.88 0.020 72)", transition: "all 0.25s" }} />
          ))}
        </div>
        <button onClick={close} aria-label="Close check-in" style={{ border: "none", background: "transparent", color: MUTED, padding: 4 }}><X size={18} /></button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
          {step === 0 && (
            <>
              <Q>How's your mood?</Q>
              <EmojiRow items={MOODS} value={input.mood} onChange={(v) => set("mood", v)} />
              <Q top>And your energy?</Q>
              <EmojiRow items={ENERGY} value={input.energy} onChange={(v) => set("energy", v)} />
            </>
          )}

          {step === 1 && (
            <>
              <Q>Any cravings right now?</Q>
              <Chips items={CRAVINGS} isOn={(id) => input.craving === id} onTap={(id) => { set("craving", id); if (id === "none") set("cravingIntensity", 0); else if (!input.cravingIntensity) set("cravingIntensity", 3); }} />
              {input.craving !== "none" && (
                <>
                  <Q top>How strong? <span style={{ color: ACCENT }}>{input.cravingIntensity}/5</span></Q>
                  <input type="range" min={1} max={5} value={input.cravingIntensity} onChange={(e) => set("cravingIntensity", Number(e.target.value))} style={{ width: "100%", accentColor: ACCENT }} aria-label="Craving strength" />
                </>
              )}
              <Q top>Just ate something? How do you feel about it?</Q>
              <Chips items={ATE} isOn={(id) => input.ateFeeling === id} onTap={(id) => set("ateFeeling", input.ateFeeling === id ? null : id)} />
            </>
          )}

          {step === 2 && (
            <>
              <Q>Right now, today feels…</Q>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {APPRAISALS.map(([id, emoji, label]) => (
                  <motion.button key={id} whileTap={{ scale: 0.96 }} onClick={() => set("appraisal", id)}
                    style={{ padding: "12px 10px", borderRadius: 14, textAlign: "left", border: input.appraisal === id ? `2px solid ${ACCENT}` : "1.5px solid oklch(0.88 0.020 72)", background: input.appraisal === id ? "color-mix(in oklch, var(--accent) 8%, transparent)" : CARD }}>
                    <span style={{ fontSize: 20 }}>{emoji}</span>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: INK, fontFamily: font, marginTop: 2 }}>{label}</p>
                  </motion.button>
                ))}
              </div>
              <Q top>How much control do you feel? <span style={{ color: ACCENT }}>{["None", "A little", "Some", "Mostly", "Totally"][input.control - 1]}</span></Q>
              <input type="range" min={1} max={5} value={input.control} onChange={(e) => set("control", Number(e.target.value))} style={{ width: "100%", accentColor: ACCENT }} aria-label="Sense of control" />
              <Q top>What's going on? <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span></Q>
              <Chips items={TRIGGERS} isOn={(id) => input.triggers.includes(id)} onTap={toggleTrigger} />
              <textarea value={input.note} onChange={(e) => set("note", e.target.value)} placeholder="Anything else? (stays on your device)" rows={2}
                style={{ width: "100%", marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.020 72)", background: CARD, fontSize: 13, fontFamily: font, color: INK, resize: "none", outline: "none" }} />
            </>
          )}

          {step === 3 && result && active && (
            <ResultView result={result} active={active} aiLine={aiLine} aiLoading={aiLoading} rated={rated}
              onSwap={() => { setActive(active.id === result.primary.id ? result.alternative : result.primary); setRated(null); }}
              onRate={rate} hasBody={h.connected} />
          )}
        </motion.div>
      </AnimatePresence>

      {step < 3 ? (
        <div className="flex gap-2 mt-4">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{ padding: "12px 16px", borderRadius: 14, border: "1.5px solid oklch(0.88 0.020 72)", background: CARD, color: INK, fontWeight: 600, fontSize: 14, fontFamily: font }}>Back</button>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => (step === 2 ? finish() : setStep(step + 1))}
            style={{ flex: 1, padding: "12px", borderRadius: 14, border: "none", background: ACCENT, color: "white", fontWeight: 700, fontSize: 14, fontFamily: font, boxShadow: "0 6px 18px color-mix(in oklch, var(--accent) 30%, transparent)" }}>
            {step === 2 ? "Get my suggestion" : "Next"}
          </motion.button>
        </div>
      ) : (
        <button onClick={close} style={{ width: "100%", marginTop: 12, padding: "11px", borderRadius: 14, border: "1.5px solid oklch(0.88 0.020 72)", background: CARD, color: INK, fontWeight: 600, fontSize: 13.5, fontFamily: font }}>Done</button>
      )}
    </motion.div>
  );
}

function ResultView({ result, active, aiLine, aiLoading, rated, onSwap, onRate, hasBody }: {
  result: CoachingResult; active: Strategy; aiLine: string | null; aiLoading: boolean; rated: boolean | null;
  onSwap: () => void; onRate: (helped: boolean) => void; hasBody: boolean;
}) {
  const other = active.id === result.primary.id ? result.alternative : result.primary;
  return (
    <div className="flex flex-col gap-3">
      {result.safety && (
        <div role="alert" style={{ padding: "12px 14px", borderRadius: 14, background: "oklch(0.62 0.15 30 / 0.10)", border: "1.5px solid oklch(0.62 0.15 30 / 0.4)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.45 0.15 30)", fontFamily: font, lineHeight: 1.5 }}>{result.safety.message}</p>
          <a href="tel:988" style={{ display: "inline-block", marginTop: 8, padding: "8px 14px", borderRadius: 10, background: "oklch(0.55 0.15 30)", color: "white", fontWeight: 700, fontSize: 13, fontFamily: font, textDecoration: "none" }}>Call or text 988</a>
        </div>
      )}

      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, fontFamily: font, letterSpacing: 0.4 }}>WHAT'S HAPPENING</p>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: INK, marginTop: 2 }}>{result.stateLabel}</p>
        {result.mismatch && (
          <span style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "oklch(0.72 0.08 148 / 0.15)", color: "oklch(0.42 0.08 148)", fontFamily: font }}>
            {result.mismatch === "mind_stressed_body_ok" ? "🧠 MIND STRESSED · 💚 BODY RECOVERED" : "🧠 MIND GOOD · 🫀 BODY LOADED"}
          </span>
        )}
        <p style={{ fontSize: 13, color: INK, fontFamily: font, lineHeight: 1.5, marginTop: 6 }}>{result.insight}</p>
        {!hasBody && <p style={{ fontSize: 11, color: MUTED, fontFamily: font, marginTop: 4 }}>Connect WHOOP (or demo data) to compare how you feel with what your body shows.</p>}
      </div>

      {(aiLoading || aiLine) && (
        <div className="flex gap-2" style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.72 0.08 148 / 0.10)" }}>
          <Sparkles size={15} style={{ color: SAGE, flexShrink: 0, marginTop: 2 }} />
          {aiLoading
            ? <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ height: 12, width: "80%", borderRadius: 6, background: "oklch(0.72 0.08 148 / 0.3)", marginTop: 3 }} />
            : <p style={{ fontSize: 13, color: "oklch(0.35 0.06 148)", fontFamily: font, lineHeight: 1.45, fontStyle: "italic" }}>{aiLine}</p>}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={active.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          style={{ padding: 14, borderRadius: 16, border: `2px solid ${ACCENT}`, background: "color-mix(in oklch, var(--accent) 5%, transparent)" }}>
          <div className="flex items-center justify-between">
            <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: font, letterSpacing: 0.4 }}>TRY THIS · {active.minutes} MIN</p>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: INK, fontFamily: font, marginTop: 2 }}>{active.title}</p>
          <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {active.steps.map((s) => <li key={s} style={{ fontSize: 13, color: INK, fontFamily: font, marginBottom: 3 }}>{s}</li>)}
          </ol>
          <p style={{ fontSize: 11.5, color: MUTED, fontFamily: font, marginTop: 8, lineHeight: 1.45 }}>Why: {active.why}</p>
          {active.minutes <= 10 && <Timer minutes={active.minutes} key={`t-${active.id}`} />}
        </motion.div>
      </AnimatePresence>

      <button onClick={onSwap} style={{ padding: "10px 12px", borderRadius: 12, border: "1.5px dashed oklch(0.80 0.03 60)", background: "transparent", color: INK, fontSize: 12.5, fontWeight: 600, fontFamily: font, textAlign: "left" }}>
        Not feeling it? Try instead: <b>{other.title}</b>
      </button>

      <div className="flex items-center justify-between" style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.95 0.015 75)" }}>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: INK, fontFamily: font }}>{rated == null ? "Did this help?" : rated ? "Thanks! I'll suggest this more." : "Got it, I'll try something else next time."}</p>
        {rated == null && (
          <div className="flex gap-2">
            <FeedbackBtn onClick={() => onRate(true)} label="It helped"><ThumbsUp size={16} /></FeedbackBtn>
            <FeedbackBtn onClick={() => onRate(false)} label="It didn't help"><ThumbsDown size={16} /></FeedbackBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function Timer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState<number | null>(null);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (ref.current) clearInterval(ref.current); }, []);
  function start() {
    setLeft(minutes * 60);
    ref.current = setInterval(() => setLeft((l) => {
      if (l == null || l <= 1) { if (ref.current) clearInterval(ref.current); return 0; }
      return l - 1;
    }), 1000);
  }
  const mm = left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : `${minutes}:00`;
  return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={left == null ? start : undefined}
      style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 12, border: "none", background: left === 0 ? SAGE : ACCENT, color: "white", fontWeight: 700, fontSize: 14, fontFamily: font, fontVariantNumeric: "tabular-nums" }}>
      {left == null ? `▶ Start ${mm}` : left === 0 ? "✓ Done, how do you feel?" : `⏳ ${mm}`}
    </motion.button>
  );
}

const Q = ({ children, top }: { children: React.ReactNode; top?: boolean }) => (
  <p style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: font, marginTop: top ? 14 : 0, marginBottom: 8 }}>{children}</p>
);

function EmojiRow({ items, value, onChange }: { items: string[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex justify-between gap-1.5">
      {items.map((e, i) => (
        <motion.button key={i} whileTap={{ scale: 0.88 }} onClick={() => onChange(i + 1)} aria-pressed={value === i + 1}
          animate={{ scale: value === i + 1 ? 1.12 : 1 }}
          style={{ flex: 1, padding: "10px 0", borderRadius: 14, fontSize: 24, border: value === i + 1 ? `2px solid ${ACCENT}` : "1.5px solid oklch(0.90 0.015 72)", background: value === i + 1 ? "color-mix(in oklch, var(--accent) 8%, transparent)" : CARD }}>
          {e}
        </motion.button>
      ))}
    </div>
  );
}

function Chips<T extends string>({ items, isOn, onTap }: { items: [T, string][]; isOn: (id: T) => boolean; onTap: (id: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([id, label]) => (
        <motion.button key={id} whileTap={{ scale: 0.94 }} onClick={() => onTap(id)} aria-pressed={isOn(id)}
          style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, fontFamily: font, border: isOn(id) ? "none" : "1.5px solid oklch(0.88 0.020 72)", background: isOn(id) ? ACCENT : CARD, color: isOn(id) ? "white" : "oklch(0.40 0.025 50)" }}>
          {label}
        </motion.button>
      ))}
    </div>
  );
}

function FeedbackBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} aria-label={label}
      style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid oklch(0.88 0.020 72)", background: CARD, color: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </motion.button>
  );
}

