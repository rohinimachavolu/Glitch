/**
 * Glitch — Mind & Mood (Progress tab)
 * Mood trend with premenstrual shading, mood↔body links, burnout flag, a 1-minute PHQ-2/GAD-2
 * check, and always-visible support resources. Screening and patterns only — never a diagnosis.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Brain, LifeBuoy, Phone } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useHealthInsights } from "@/hooks/useHealthInsights";
import { useMindInsights } from "@/hooks/useMindInsights";
import {
  SCREENER_ITEMS, SCREENER_OPTIONS, SUPPORT_RESOURCES, scoreScreener, interpretScreener,
} from "@/lib/mentalHealth";

const INK = "oklch(0.25 0.025 50)";
const MUTED = "oklch(0.55 0.020 60)";
const ACCENT = "oklch(0.62 0.12 38)";
const CALM = "oklch(0.58 0.09 260)";
const CARD = "oklch(0.99 0.010 78)";
const font = "'DM Sans', sans-serif";
const DAY = 86_400_000;

export default function MindCard() {
  const { screenerLog, addScreener } = useApp();
  const h = useHealthInsights();
  const m = useMindInsights();
  const [screening, setScreening] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showHelp, setShowHelp] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const lastScreen = screenerLog[screenerLog.length - 1];
  const lastResult = lastScreen ? interpretScreener(lastScreen) : null;

  // Last 30 days of mood
  const since = new Date(Date.now() - 29 * DAY).toISOString().slice(0, 10);
  const chart = Array.from(m.moods.entries())
    .filter(([d]) => d >= since)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mood]) => ({ date, label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), mood: +mood.toFixed(1) }));

  // Shade the 7 days before each period in view
  const shade = (h.cycle?.windows ?? [])
    .filter((w) => w.complete)
    .map((w) => {
      const end = Date.parse(`${w.end}T00:00:00Z`);
      const from = new Date(end - 6 * DAY).toISOString().slice(0, 10);
      const a = chart.find((c) => c.date >= from), b = [...chart].reverse().find((c) => c.date <= w.end);
      return a && b && a.date <= b.date ? { x1: a.label, x2: b.label } : null;
    })
    .filter((x): x is { x1: string; x2: string } => !!x);

  const insights: { icon: string; text: string; tone: "info" | "warn" }[] = [];
  m.links.forEach((l) => insights.push({ icon: l.id === "sleep" ? "🌙" : "🫀", text: l.message, tone: "info" }));
  if (m.premenstrual?.recurring) {
    insights.push({ icon: "🌖", tone: "warn", text: `Your mood drops about ${m.premenstrual.avgDip} points in the week before your period (${m.premenstrual.cyclesWithDip} of ${m.premenstrual.cyclesAnalysed} cycles). If it disrupts work or relationships, it's worth asking a clinician about PMDD.` });
  }
  if (m.burnout?.flagged) {
    insights.push({ icon: "🔥", tone: "warn", text: `Burnout warning: HRV is down ${Math.abs(m.burnout.hrvChangePct!)}% over two weeks, sleep is averaging ${m.burnout.avgSleep}% and mood ${m.burnout.avgMood}/5. Protect rest this week.` });
  }

  function submitScreen() {
    const r = scoreScreener(answers, today);
    addScreener(r);
    setScreening(false);
    setAnswers({});
    if (interpretScreener(r).positive) setShowHelp(true);
  }

  const answeredAll = SCREENER_ITEMS.every((i) => answers[i.id] != null);

  return (
    <div style={{ background: CARD, borderRadius: 22, padding: 16, boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Brain size={17} style={{ color: CALM }} />
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: INK }}>Mind & Mood</p>
        </div>
        {m.demoMoods && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "oklch(0.75 0.12 75 / 0.18)", color: "oklch(0.50 0.10 75)", fontFamily: font }}>DEMO MOODS</span>}
      </div>
      <p style={{ fontSize: 12, color: MUTED, fontFamily: font, marginBottom: 10 }}>From your check-ins, matched with sleep, HRV and your cycle.</p>

      {chart.length >= 5 ? (
        <div style={{ height: 120, marginLeft: -22 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CALM} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CALM} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} interval={6} />
              <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} width={34} />
              <Tooltip formatter={(v: number) => [`${v}/5`, "Mood"]} contentStyle={{ borderRadius: 10, fontSize: 12, fontFamily: font }} />
              {shade.map((s) => <ReferenceArea key={s.x1} x1={s.x1} x2={s.x2} fill={ACCENT} fillOpacity={0.08} />)}
              <Area type="monotone" dataKey="mood" stroke={CALM} strokeWidth={2.2} fill="url(#moodFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: MUTED, fontFamily: font, padding: "8px 0" }}>Do a few "How are you, really?" check-ins on Home and your mood trend appears here.</p>
      )}
      {shade.length > 0 && <p style={{ fontSize: 10.5, color: MUTED, fontFamily: font, marginTop: 2 }}>Shaded: the week before your period</p>}

      {insights.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {insights.map((i) => (
            <div key={i.text} className="flex gap-2" style={{ padding: "9px 11px", borderRadius: 12, background: i.tone === "warn" ? "oklch(0.62 0.12 38 / 0.08)" : "oklch(0.58 0.09 260 / 0.08)" }}>
              <span style={{ fontSize: 15 }}>{i.icon}</span>
              <p style={{ fontSize: 12.5, color: INK, fontFamily: font, lineHeight: 1.45 }}>{i.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weekly check */}
      <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "oklch(0.95 0.015 75)" }}>
        <AnimatePresence initial={false} mode="wait">
          {!screening ? (
            <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: font }}>1-minute wellbeing check</p>
                  <p style={{ fontSize: 11.5, color: MUTED, fontFamily: font }}>
                    {lastScreen ? `Last: ${lastScreen.date} · ${lastResult!.positive ? "worth a follow-up" : "no warning signs"}` : "4 questions doctors use (PHQ-2 + GAD-2)"}
                  </p>
                </div>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setScreening(true)}
                  style={{ padding: "8px 14px", borderRadius: 11, border: "none", background: CALM, color: "white", fontWeight: 700, fontSize: 12.5, fontFamily: font, flexShrink: 0 }}>
                  {lastScreen ? "Retake" : "Start"}
                </motion.button>
              </div>
              {lastResult && <p style={{ fontSize: 12, color: INK, fontFamily: font, marginTop: 8, lineHeight: 1.45 }}>{lastResult.message}</p>}
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 12, color: MUTED, fontFamily: font, marginBottom: 8 }}>Over the last 2 weeks, how often have you been bothered by…</p>
              {SCREENER_ITEMS.map((item) => (
                <div key={item.id} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: font, marginBottom: 5 }}>{item.text}</p>
                  <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {SCREENER_OPTIONS.map((opt, v) => (
                      <button key={opt} onClick={() => setAnswers((a) => ({ ...a, [item.id]: v }))} aria-pressed={answers[item.id] === v}
                        style={{ padding: "7px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 600, fontFamily: font, textAlign: "left", border: answers[item.id] === v ? `2px solid ${CALM}` : "1.5px solid oklch(0.88 0.020 72)", background: answers[item.id] === v ? "oklch(0.58 0.09 260 / 0.10)" : CARD, color: INK }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => { setScreening(false); setAnswers({}); }} style={{ padding: "9px 14px", borderRadius: 11, border: "1.5px solid oklch(0.88 0.020 72)", background: CARD, color: INK, fontWeight: 600, fontSize: 12.5, fontFamily: font }}>Cancel</button>
                <button onClick={submitScreen} disabled={!answeredAll}
                  style={{ flex: 1, padding: "9px", borderRadius: 11, border: "none", background: answeredAll ? CALM : "oklch(0.80 0.02 260)", color: "white", fontWeight: 700, fontSize: 12.5, fontFamily: font }}>
                  See result
                </button>
              </div>
              <p style={{ fontSize: 10.5, color: MUTED, fontFamily: font, marginTop: 6 }}>A screening, not a diagnosis. Answers stay encrypted on your device.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Support */}
      <button onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}
        className="flex items-center gap-2" style={{ marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 12, border: "none", background: showHelp ? "oklch(0.58 0.09 260 / 0.10)" : "transparent", color: CALM, fontWeight: 700, fontSize: 13, fontFamily: font, textAlign: "left" }}>
        <LifeBuoy size={16} /> Need to talk to someone?
      </button>
      <AnimatePresence initial={false}>
        {showHelp && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div className="flex flex-col gap-1.5" style={{ paddingTop: 6 }}>
              {SUPPORT_RESOURCES.map((r) => (
                <a key={r.label} href={r.href} className="flex items-center gap-3" style={{ padding: "10px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.020 72)", textDecoration: "none" }}>
                  <Phone size={15} style={{ color: CALM, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: font }}>{r.label}</p>
                    <p style={{ fontSize: 11.5, color: MUTED, fontFamily: font }}>{r.detail}</p>
                  </div>
                </a>
              ))}
              <p style={{ fontSize: 10.5, color: MUTED, fontFamily: font, padding: "2px 4px" }}>In immediate danger, call 911.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
