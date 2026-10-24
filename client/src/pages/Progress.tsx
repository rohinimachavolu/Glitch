/**
 * Luna — Progress
 * Consistency-focused (never weight-shaming). Celebrates check-ins, workouts,
 * and logged days. Reward showing up, not numbers.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { Flame, CalendarCheck, Dumbbell, HeartPulse } from "lucide-react";

export default function Progress() {
  const { checkins, workouts, meals, periods, hotFlashes, profile } = useApp();

  const stats = useMemo(() => {
    const days = new Set<string>();
    checkins.forEach((c) => days.add(c.date));
    workouts.forEach((w) => days.add(w.date));
    // streak = consecutive days ending today with any activity
    let streak = 0;
    const d = new Date();
    while (true) {
      const iso = d.toISOString().split("T")[0];
      if (days.has(iso)) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    return {
      streak,
      checkinCount: checkins.length,
      workoutCount: workouts.length,
      periodCount: periods.length,
      flashCount: hotFlashes.length,
    };
  }, [checkins, workouts, periods, hotFlashes]);

  const cards = [
    { icon: <Flame size={20} />, label: "Day streak", value: stats.streak, color: "oklch(0.66 0.16 35)" },
    { icon: <CalendarCheck size={20} />, label: "Check-ins", value: stats.checkinCount, color: "oklch(0.70 0.14 160)" },
    { icon: <Dumbbell size={20} />, label: "Workouts", value: stats.workoutCount, color: "oklch(0.66 0.13 300)" },
    profile?.healthMode === "menopause"
      ? { icon: <HeartPulse size={20} />, label: "Flashes logged", value: stats.flashCount, color: "oklch(0.78 0.12 85)" }
      : { icon: <HeartPulse size={20} />, label: "Periods logged", value: stats.periodCount, color: "oklch(0.78 0.12 85)" },
  ];

  const badges = [
    { got: stats.checkinCount >= 1, emoji: "🌱", label: "First check-in" },
    { got: stats.streak >= 3, emoji: "🔥", label: "3-day streak" },
    { got: stats.workoutCount >= 5, emoji: "💪", label: "5 workouts" },
    { got: stats.checkinCount >= 10, emoji: "🌙", label: "10 check-ins" },
    { got: stats.streak >= 7, emoji: "⭐", label: "Week strong" },
  ];

  return (
    <div className="luna-app" style={{ minHeight: "100%", padding: "22px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Your progress</h1>
      <p style={{ fontSize: 12, color: "var(--luna-text-muted)" }}>Luna celebrates consistency — showing up matters more than any number.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
            style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
            <div style={{ color: c.color, marginBottom: 6 }}>{c.icon}</div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "var(--luna-text)", fontFamily: "'Playfair Display', serif" }}>{c.value}</p>
            <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>{c.label}</p>
          </motion.div>
        ))}
      </div>

      <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)", marginBottom: 12 }}>Badges</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {badges.map((b, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: b.got ? 1 : 0.35 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: b.got ? "color-mix(in oklch, var(--luna-accent) 18%, transparent)" : "oklch(0.9 0.01 72)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, filter: b.got ? "none" : "grayscale(1)" }}>{b.emoji}</div>
              <span style={{ fontSize: 9, color: "var(--luna-text-muted)", textAlign: "center", maxWidth: 56 }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 14, borderRadius: 16, background: `linear-gradient(135deg, var(--luna-accent), var(--luna-accent2))`, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "white", fontWeight: 500, lineHeight: 1.5 }}>
          {meals.length + stats.checkinCount + stats.workoutCount === 0
            ? "Every journey starts with one small log. You've got this. 🌙"
            : "You're building a healthier rhythm — one day at a time. That's real progress. 🌙"}
        </p>
      </div>
    </div>
  );
}
