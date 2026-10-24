/**
 * Glitch — Menopause Home
 * Designed for women 45+ who won't spend more than a few minutes in an app: one big voice button,
 * a traffic-light "today" table, three simple charts, alerts, research context and a printable
 * doctor summary. Everything else is captured passively (WHOOP) or by talking to Glitchy.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mic, Printer, X } from "lucide-react";
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend } from "recharts";
import { useApp } from "@/contexts/AppContext";
import { useHealthInsights } from "@/hooks/useHealthInsights";
import { useMenopauseInsights } from "@/hooks/useMenopauseInsights";
import { useMenopauseDashboard } from "@/hooks/useMenopauseDashboard";
import { bpCategory, BP_LABEL, ETHNICITY_OPTIONS, SWAN_VMS_YEARS, SWAN_OVERALL_YEARS, ethnicityContext, type MenoAlert, type Ethnicity } from "@/lib/menopauseSignals";

const INK = "oklch(0.24 0.025 50)";
const MUTED = "oklch(0.50 0.020 60)";
const GREEN = "oklch(0.62 0.13 150)";
const AMBER = "oklch(0.74 0.14 75)";
const RED = "oklch(0.60 0.18 28)";
const font = "'DM Sans', sans-serif";
const card: React.CSSProperties = { background: "white", borderRadius: 24, padding: 18, boxShadow: "0 4px 18px oklch(0.25 0.025 50 / 0.07)" };
const DAY = 86_400_000;
const short = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function MenopauseHome({ onTalk, onOpenFull }: { onTalk: (prompt?: string) => void; onOpenFull: () => void }) {
  const { profile, connectWhoopDemo, updateWomensHealth } = useApp();
  const h = useHealthInsights();
  const m = useMenopauseInsights();
  const d = useMenopauseDashboard();
  const [report, setReport] = useState(false);
  useAlertNotifications(d?.alerts ?? []);
  if (!profile || !m || !d) return null;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  // ── Today-at-a-glance rows ──
  const fl7 = m.flashes.filter((f) => Date.now() - Date.parse(f.at) < 7 * DAY).length / 7;
  const lastWarm = m.warm[m.warm.length - 1];
  const lastFrag = [...d.frag].reverse().find((f) => f.score != null);
  const hrvPct = d.mind.hrvChangePct;
  const lastBp = d.bp[d.bp.length - 1];
  const bpCat = lastBp ? bpCategory(lastBp.systolic, lastBp.diastolic) : null;
  const lastMood = d.moods[d.moods.length - 1];
  type Row = { icon: string; label: string; value: string; sub: string; status: "good" | "watch" | "alert" | "none" };
  const rows: Row[] = [
    { icon: "🔥", label: "Hot flashes", value: `${m.flashesToday} today`, sub: `avg ${fl7.toFixed(1)}/day this week`, status: m.flashesToday >= 8 ? "alert" : m.flashesToday >= 4 ? "watch" : "good" },
    { icon: "🌙", label: "Night sweats", value: !h.connected ? "—" : lastWarm?.likely ? "Last night" : "None last night", sub: `${m.likelyWarm14} nights in 2 weeks`, status: !h.connected ? "none" : lastWarm?.likely ? "watch" : "good" },
    { icon: "😴", label: "Sleep", value: lastFrag?.score == null ? "—" : lastFrag.score >= 60 ? "Broken" : lastFrag.score >= 45 ? "Restless" : "Settled", sub: lastFrag?.wakeUps != null ? `${lastFrag.wakeUps} wake-ups · ${lastFrag.awakeMin ?? "?"} min awake` : "Connect WHOOP", status: lastFrag?.score == null ? "none" : lastFrag.score >= 60 ? "alert" : lastFrag.score >= 45 ? "watch" : "good" },
    { icon: "💓", label: "HRV (stress)", value: hrvPct == null ? "—" : `${hrvPct > 0 ? "+" : ""}${hrvPct}% vs usual`, sub: h.today?.hrv ? `${Math.round(h.today.hrv)} ms last night` : "Connect WHOOP", status: hrvPct == null ? "none" : hrvPct <= -12 ? "alert" : hrvPct <= -5 ? "watch" : "good" },
    { icon: "🩺", label: "Blood pressure", value: lastBp ? `${lastBp.systolic}/${lastBp.diastolic}` : "—", sub: lastBp ? `${BP_LABEL[bpCat!]} · ${short(lastBp.at)}` : 'Say "my BP is 130 over 85"', status: !bpCat ? "none" : bpCat === "normal" ? "good" : bpCat === "elevated" || bpCat === "stage1" ? "watch" : "alert" },
    { icon: "🧠", label: "Mood", value: lastMood ? `${["", "😞", "😕", "😐", "🙂", "😄"][lastMood.mood]} ${lastMood.label ?? ""}`.trim() : "—", sub: d.mind.avgMood7 != null ? `avg ${d.mind.avgMood7}/5 this week` : "Just talk to Glitchy", status: d.mind.level === "reach_out" ? "alert" : d.mind.level === "watch" ? "watch" : lastMood ? "good" : "none" },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-4" style={{ fontFamily: font }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p style={{ fontSize: 15, color: MUTED }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: INK, lineHeight: 1.15 }}>{greet}, {profile.name.split(" ")[0]}</h1>
          <span style={{ display: "inline-block", marginTop: 6, padding: "4px 12px", borderRadius: 999, background: "color-mix(in oklch, var(--accent) 14%, white)", color: "var(--accent-deep)", fontWeight: 700, fontSize: 13 }}>🌗 {m.stage.label}</span>
        </div>
        <button onClick={onOpenFull} style={{ border: "none", background: "transparent", color: MUTED, fontSize: 12.5, fontWeight: 600, textDecoration: "underline", marginTop: 6 }}>Full dashboard</button>
      </div>

      {/* Voice */}
      <motion.div style={{ ...card, background: "linear-gradient(140deg, var(--accent), color-mix(in oklch, var(--accent) 55%, oklch(0.75 0.12 60)))", color: "white", textAlign: "center", padding: "22px 18px" }}>
        <p style={{ fontSize: 19, fontWeight: 800 }}>How are you feeling today?</p>
        <p style={{ fontSize: 14.5, opacity: 0.92, marginTop: 4 }}>Just tap and talk. I'll log everything for you.</p>
        <motion.button onClick={() => onTalk()} whileTap={{ scale: 0.93 }} aria-label="Talk to Glitchy"
          animate={{ boxShadow: ["0 0 0 0 oklch(1 0 0 / 0.45)", "0 0 0 18px oklch(1 0 0 / 0)"] }} transition={{ repeat: Infinity, duration: 1.8 }}
          style={{ margin: "16px auto 12px", width: 96, height: 96, borderRadius: "50%", border: "none", background: "white", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mic size={44} />
        </motion.button>
        <div className="flex flex-wrap justify-center gap-1.5">
          {["I'm having a hot flash", "I slept badly", "My blood pressure is 132 over 84", "Feeling anxious today"].map((t) => (
            <button key={t} onClick={() => onTalk(t)} style={{ padding: "7px 12px", borderRadius: 999, border: "1.5px solid oklch(1 0 0 / 0.5)", background: "oklch(1 0 0 / 0.14)", color: "white", fontSize: 13, fontWeight: 600 }}>“{t}”</button>
          ))}
        </div>
      </motion.div>

      {!h.connected && (
        <button onClick={connectWhoopDemo} style={{ ...card, border: "2px dashed color-mix(in oklch, var(--accent) 40%, transparent)", textAlign: "left", fontSize: 15, color: INK }}>
          ⌚ <b>Connect WHOOP</b> to track night sweats, sleep and HRV automatically. <span style={{ color: "var(--accent)", fontWeight: 700 }}>Try demo data →</span>
        </button>
      )}

      {/* Alerts */}
      <AlertsCard alerts={d.alerts} />

      {/* Today table */}
      <div style={card}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: INK }}>Today at a glance</p>
          {d.demo && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "oklch(0.75 0.12 75 / 0.18)", color: "oklch(0.48 0.10 75)" }}>DEMO</span>}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid oklch(0.93 0.01 70)" }}>
                <td style={{ padding: "11px 0", width: 34, fontSize: 22 }}>{r.icon}</td>
                <td style={{ padding: "11px 6px" }}>
                  <p style={{ fontSize: 15.5, fontWeight: 700, color: INK }}>{r.label}</p>
                  <p style={{ fontSize: 12.5, color: MUTED }}>{r.sub}</p>
                </td>
                <td style={{ padding: "11px 0", textAlign: "right" }}>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>{r.value}</span>
                </td>
                <td style={{ padding: "11px 0 11px 10px", width: 18 }}>
                  <span aria-label={r.status} style={{ display: "block", width: 13, height: 13, borderRadius: "50%", background: r.status === "good" ? GREEN : r.status === "watch" ? AMBER : r.status === "alert" ? RED : "oklch(0.88 0.01 70)" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-3" style={{ marginTop: 8, fontSize: 11.5, color: MUTED }}>
          <span>🟢 on track</span><span>🟡 keep an eye</span><span>🔴 needs attention</span>
        </div>
      </div>

      {/* Charts */}
      <ChartsCard days={h.days} flashes={m.flashes} warm={m.warm} frag={d.frag} bp={d.bp} moods={d.moods} />

      {/* Research context */}
      <ResearchCard ethnicity={profile.womensHealth?.ethnicity} age={profile.age} onSet={(e) => updateWomensHealth({ ethnicity: e })} />

      {/* Doctor */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setReport(true)}
        style={{ ...card, display: "flex", alignItems: "center", gap: 12, border: "none", textAlign: "left" }}>
        <span style={{ fontSize: 30 }}>📋</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: INK }}>Share with my doctor</span>
          <span style={{ display: "block", fontSize: 13.5, color: MUTED }}>A one-page summary of the last 4 weeks to print or show</span>
        </span>
        <Printer size={22} style={{ color: "var(--accent)" }} />
      </motion.button>

      <AnimatePresence>{report && <DoctorReport onClose={() => setReport(false)} />}</AnimatePresence>
      <p style={{ fontSize: 11.5, color: MUTED, textAlign: "center", padding: "0 10px" }}>Wellness insights, not a diagnosis. Treatment decisions belong with you and your clinician.</p>
    </div>
  );
}

// ── Alerts + notifications ───────────────────────────────────
function useAlertNotifications(alerts: MenoAlert[]) {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let sent: string[] = [];
    try { sent = JSON.parse(localStorage.getItem("glitch.notified") ?? "[]"); } catch { /* storage unavailable */ }
    const fresh = alerts.filter((a) => a.level !== "info" && !sent.includes(a.id));
    for (const a of fresh) new Notification(`Glitch: ${a.title}`, { body: a.detail, tag: a.id });
    if (fresh.length) try { localStorage.setItem("glitch.notified", JSON.stringify([...sent, ...fresh.map((a) => a.id)].slice(-200))); } catch { /* ignore */ }
  }, [alerts]);
}

function AlertsCard({ alerts }: { alerts: MenoAlert[] }) {
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  if (!alerts.length) return (
    <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 24 }}>✅</span>
      <p style={{ fontSize: 15, color: INK }}>No alerts right now. Your signals look steady.</p>
    </div>
  );
  const color = (l: MenoAlert["level"]) => (l === "urgent" ? RED : l === "watch" ? AMBER : "oklch(0.60 0.08 230)");
  return (
    <div style={card}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: INK }}>Alerts</p>
        {perm === "default" && (
          <button onClick={() => Notification.requestPermission().then(setPerm)} className="flex items-center gap-1"
            style={{ padding: "7px 12px", borderRadius: 999, border: "none", background: "var(--accent)", color: "white", fontSize: 12.5, fontWeight: 700 }}>
            <Bell size={14} /> Notify me
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {alerts.map((a) => (
          <div key={a.id} style={{ padding: "12px 13px", borderRadius: 16, background: `color-mix(in oklch, ${color(a.level)} 10%, white)`, borderLeft: `5px solid ${color(a.level)}` }}>
            <p style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>{a.icon} {a.title}</p>
            <p style={{ fontSize: 13.5, color: INK, lineHeight: 1.5, marginTop: 3 }}>{a.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Charts ───────────────────────────────────────────────────
type ChartTab = "flashes" | "sleep" | "heart";
function ChartsCard({ days, flashes, warm, frag, bp, moods }: {
  days: { date: string; hrv: number | null }[]; flashes: { at: string; night?: boolean }[]; warm: { date: string; likely: boolean }[];
  frag: { date: string; score: number | null; wakeUps: number | null }[]; bp: { at: string; systolic: number; diastolic: number }[]; moods: { at: string; mood: number }[];
}) {
  const [tab, setTab] = useState<ChartTab>("flashes");
  const last28 = Array.from({ length: 28 }, (_, i) => new Date(Date.now() - (27 - i) * DAY).toISOString().slice(0, 10));
  const warmSet = new Set(warm.filter((w) => w.likely).map((w) => w.date));
  const flashData = last28.map((dte) => ({
    label: short(dte),
    day: flashes.filter((f) => f.at.slice(0, 10) === dte && !f.night).length,
    night: warmSet.has(dte) || flashes.some((f) => f.at.slice(0, 10) === dte && f.night) ? 1 : 0,
  }));
  const fragByDate = new Map(frag.map((f) => [f.date, f]));
  const sleepData = last28.map((dte) => ({ label: short(dte), wakeUps: fragByDate.get(dte)?.wakeUps ?? null, score: fragByDate.get(dte)?.score ?? null }));
  const hrvByDate = new Map(days.map((x) => [x.date, x.hrv]));
  const moodByDate = new Map<string, number>();
  moods.forEach((mm) => moodByDate.set(mm.at.slice(0, 10), mm.mood));
  const bpByDate = new Map(bp.map((b) => [b.at.slice(0, 10), b]));
  const heartData = last28.map((dte) => ({ label: short(dte), hrv: hrvByDate.get(dte) ?? null, mood: moodByDate.has(dte) ? moodByDate.get(dte)! * 10 : null, sys: bpByDate.get(dte)?.systolic ?? null, dia: bpByDate.get(dte)?.diastolic ?? null }));

  const tabs: [ChartTab, string][] = [["flashes", "🔥 Hot flashes"], ["sleep", "😴 Sleep"], ["heart", "💓 Heart & mood"]];
  const axis = { tick: { fontSize: 11, fill: MUTED }, tickLine: false, axisLine: false };
  return (
    <div style={card}>
      <p style={{ fontSize: 18, fontWeight: 800, color: INK, marginBottom: 10 }}>Last 4 weeks</p>
      <div className="flex gap-1.5" style={{ marginBottom: 12 }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
            style={{ flex: 1, padding: "9px 4px", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 700, background: tab === id ? "var(--accent)" : "oklch(0.95 0.012 75)", color: tab === id ? "white" : INK }}>{label}</button>
        ))}
      </div>
      <div style={{ height: 200, marginLeft: -16 }}>
        <ResponsiveContainer width="100%" height="100%">
          {tab === "flashes" ? (
            <BarChart data={flashData}>
              <XAxis dataKey="label" interval={6} {...axis} />
              <YAxis allowDecimals={false} width={30} {...axis} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} formatter={(v: number, n: string) => (n === "night" ? [v ? "Yes" : "No", "Night sweat"] : [v, "Daytime flashes"])} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "day" ? "Daytime flashes" : "Night sweat")} />
              <Bar dataKey="day" stackId="a" fill="oklch(0.68 0.16 45)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="night" stackId="a" fill="oklch(0.45 0.12 270)" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : tab === "sleep" ? (
            <ComposedChart data={sleepData}>
              <XAxis dataKey="label" interval={6} {...axis} />
              <YAxis yAxisId="w" width={30} {...axis} />
              <YAxis yAxisId="s" orientation="right" domain={[0, 100]} width={30} {...axis} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "wakeUps" ? "Wake-ups" : "Fragmentation (0–100)")} />
              <Bar yAxisId="w" dataKey="wakeUps" fill="oklch(0.75 0.06 250)">
                {sleepData.map((s) => <Cell key={s.label} fill={(s.score ?? 0) >= 60 ? "oklch(0.55 0.14 270)" : "oklch(0.80 0.05 250)"} />)}
              </Bar>
              <Line yAxisId="s" type="monotone" dataKey="score" stroke="oklch(0.60 0.17 28)" strokeWidth={2.5} dot={false} connectNulls />
              <ReferenceLine yAxisId="s" y={60} stroke="oklch(0.60 0.17 28)" strokeDasharray="4 4" />
            </ComposedChart>
          ) : (
            <LineChart data={heartData}>
              <XAxis dataKey="label" interval={6} {...axis} />
              <YAxis yAxisId="bp" domain={[60, 160]} width={34} {...axis} />
              <YAxis yAxisId="h" orientation="right" width={30} {...axis} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => ({ sys: "BP systolic", dia: "BP diastolic", hrv: "HRV (ms)", mood: "Mood (1–5, ×10)" } as Record<string, string>)[v] ?? v} />
              <ReferenceLine yAxisId="bp" y={130} stroke={AMBER} strokeDasharray="4 4" />
              <Line yAxisId="bp" dataKey="sys" stroke={RED} strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
              <Line yAxisId="bp" dataKey="dia" stroke="oklch(0.70 0.12 28)" strokeWidth={2} connectNulls dot={{ r: 2 }} />
              <Line yAxisId="h" dataKey="hrv" stroke={GREEN} strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="h" dataKey="mood" stroke="transparent" legendType="circle" isAnimationActive={false} dot={{ r: 4, fill: "oklch(0.55 0.12 300)", stroke: "white", strokeWidth: 1 }} activeDot={{ r: 6 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>
        {tab === "flashes" ? "Purple caps = nights WHOOP flagged as night sweats (warm skin + broken sleep)." : tab === "sleep" ? "Dark bars = broken nights. Above the dashed line, sleep was badly fragmented." : "Dashed line = 130 systolic, where blood pressure counts as high. Falling HRV with low mood is a sign to look after yourself."}
      </p>
    </div>
  );
}

// ── Research context (ethnicity + age) ───────────────────────
function ResearchCard({ ethnicity, age, onSet }: { ethnicity?: Ethnicity | "prefer_not"; age: number; onSet: (e: Ethnicity | "prefer_not") => void }) {
  const [picking, setPicking] = useState(false);
  const e = ethnicity === "prefer_not" ? undefined : ethnicity;
  const ctx = ethnicityContext(e);
  const data = SWAN_VMS_YEARS.map((r) => ({ ...r, mine: r.key === e }));
  return (
    <div style={card}>
      <p style={{ fontSize: 18, fontWeight: 800, color: INK }}>What research says</p>
      <p style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>How long hot flashes last (SWAN study, median years)</p>
      <div style={{ height: 170, marginLeft: -10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
            <XAxis type="number" domain={[0, 12]} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="group" width={98} tick={{ fontSize: 12, fill: INK }} tickLine={false} axisLine={false} />
            <ReferenceLine x={SWAN_OVERALL_YEARS} stroke={MUTED} strokeDasharray="3 3" label={{ value: `all ${SWAN_OVERALL_YEARS}`, fontSize: 10, fill: MUTED, position: "top" }} />
            <Tooltip formatter={(v: number) => [`${v} years`, "Median"]} contentStyle={{ borderRadius: 12, fontSize: 13 }} />
            <Bar dataKey="years" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 12, fill: INK }}>
              {data.map((r) => <Cell key={r.group} fill={r.mine ? "oklch(0.60 0.16 40)" : "oklch(0.85 0.04 60)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {ctx && <p style={{ fontSize: 14, color: INK, lineHeight: 1.5, marginTop: 6 }}>{ctx}</p>}
      <p style={{ fontSize: 13.5, color: INK, lineHeight: 1.5, marginTop: 6 }}>
        At {age}, {age < 45 ? "hot flashes this early can signal early menopause, which is worth a doctor's visit." : age < 52 ? "you're in the most common window: hot flashes usually peak in late perimenopause and the first 2 years after your last period." : "symptoms often ease, while heart and bone health matter more each year."}
      </p>
      {!ethnicity || picking ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: INK }}>Optional: add your background for research context</p>
          <p style={{ fontSize: 11.5, color: MUTED, marginBottom: 6 }}>Only used to show what studies found for women like you. Never used to score you. Stays on your device.</p>
          <div className="flex flex-wrap gap-1.5">
            {ETHNICITY_OPTIONS.map((o) => (
              <button key={o.id} onClick={() => { onSet(o.id); setPicking(false); }} style={{ padding: "6px 11px", borderRadius: 999, border: ethnicity === o.id ? "none" : "1.5px solid oklch(0.88 0.02 72)", background: ethnicity === o.id ? "var(--accent)" : "white", color: ethnicity === o.id ? "white" : INK, fontSize: 12.5, fontWeight: 600 }}>{o.label}</button>
            ))}
            <button onClick={() => { onSet("prefer_not"); setPicking(false); }} style={{ padding: "6px 11px", borderRadius: 999, border: "1.5px dashed oklch(0.80 0.02 72)", background: "white", color: MUTED, fontSize: 12.5, fontWeight: 600 }}>Prefer not to say</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setPicking(true)} style={{ marginTop: 8, border: "none", background: "transparent", color: "var(--accent)", fontWeight: 700, fontSize: 12.5, padding: 0 }}>Change background</button>
      )}
      <p style={{ fontSize: 10.5, color: MUTED, marginTop: 8 }}>Avis NE et al. Duration of menopausal vasomotor symptoms over the menopause transition. JAMA Intern Med. 2015. Group medians, not predictions.</p>
    </div>
  );
}

// ── Doctor report ────────────────────────────────────────────
function DoctorReport({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const h = useHealthInsights();
  const m = useMenopauseInsights()!;
  const d = useMenopauseDashboard()!;
  const weeks = [3, 2, 1, 0].map((w) => {
    const end = Date.now() - w * 7 * DAY, start = end - 7 * DAY;
    const inW = (iso: string) => { const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso); return t > start && t <= end; };
    const fl = m.flashes.filter((f) => inW(f.at));
    const frag = d.frag.filter((f) => inW(f.date) && f.score != null);
    const hrv = h.days.filter((x) => inW(x.date) && x.hrv != null).map((x) => x.hrv!);
    const bp = d.bp.filter((b) => inW(b.at));
    const mood = d.moods.filter((x) => inW(x.at)).map((x) => x.mood);
    const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    return {
      label: `${short(new Date(start + DAY).toISOString())}–${short(new Date(end).toISOString())}`,
      flashes: (fl.filter((f) => !f.night).length / 7).toFixed(1),
      sweats: m.warm.filter((x) => x.likely && inW(x.date)).length,
      wake: avg(frag.map((f) => f.wakeUps ?? 0))?.toFixed(0) ?? "—",
      hrv: avg(hrv)?.toFixed(0) ?? "—",
      bp: bp.length ? `${Math.round(avg(bp.map((b) => b.systolic))!)}/${Math.round(avg(bp.map((b) => b.diastolic))!)}` : "—",
      mood: avg(mood)?.toFixed(1) ?? "—",
    };
  });
  const cell: React.CSSProperties = { padding: "8px 6px", borderBottom: "1px solid #e5e0d8", fontSize: 13, textAlign: "center" };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(30,20,10,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} className="print-area"
        style={{ width: "100%", maxWidth: 430, maxHeight: "92dvh", overflowY: "auto", background: "white", borderRadius: "24px 24px 0 0", padding: 20, fontFamily: font, color: INK }}>
        <div className="flex items-center justify-between no-print">
          <button onClick={() => window.print()} className="flex items-center gap-1.5" style={{ padding: "10px 16px", borderRadius: 999, border: "none", background: "var(--accent)", color: "white", fontWeight: 700, fontSize: 14 }}><Printer size={16} /> Print / save PDF</button>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", padding: 6 }}><X size={22} /></button>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 14 }}>Menopause symptom summary</h2>
        <p style={{ fontSize: 13, color: MUTED }}>{profile?.name}, age {profile?.age} · {m.stage.label}{m.stage.timing && m.stage.timing !== "typical" ? ` (${m.stage.timing} menopause)` : ""} · generated {new Date().toLocaleDateString()}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead>
            <tr style={{ background: "#f6f1ea" }}>
              {["Week", "Hot flashes /day", "Night sweats", "Wake-ups /night", "HRV ms", "BP avg", "Mood /5"].map((t) => <th key={t} style={{ ...cell, fontSize: 11.5, fontWeight: 800 }}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.label}>
                <td style={{ ...cell, textAlign: "left", fontWeight: 700 }}>{w.label}</td>
                <td style={cell}>{w.flashes}</td><td style={cell}>{w.sweats}</td><td style={cell}>{w.wake}</td><td style={cell}>{w.hrv}</td><td style={cell}>{w.bp}</td><td style={cell}>{w.mood}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {m.triggers.length > 0 && <p style={{ fontSize: 13, marginTop: 12 }}><b>Possible triggers:</b> {m.triggers.map((t) => `${t.label} (${t.ratio}×)`).join(", ")}</p>}
        {m.lastMrs && <p style={{ fontSize: 13, marginTop: 6 }}><b>Menopause Rating Scale:</b> {m.lastMrs.total}/44 ({m.lastMrs.severity}); somatic {m.lastMrs.somatic}, psychological {m.lastMrs.psychological}, urogenital {m.lastMrs.urogenital}</p>}
        <p style={{ fontSize: 13, marginTop: 10, fontWeight: 800 }}>Questions for my doctor</p>
        <ul style={{ paddingLeft: 18, marginTop: 4 }}>{m.clinician.map((c) => <li key={c} style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.45 }}>{c}</li>)}</ul>
        <p style={{ fontSize: 11, color: MUTED, marginTop: 10 }}>Data from WHOOP (sleep, skin temperature, HRV), home BP readings and voice check-ins via Glitch. Night sweats are inferred from nightly skin temperature and sleep disruption. Not a diagnosis.</p>
      </motion.div>
    </motion.div>
  );
}
