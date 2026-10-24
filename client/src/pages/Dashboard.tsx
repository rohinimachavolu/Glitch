/**
 * Glitch — Dashboard (Home Tab)
 * Design: Organic Wellness Journal — warm cream, terracotta rings, sage micro bars
 * All nutrition targets come from AI-generated nutritionGoals in AppContext.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import MacroRing from "@/components/MacroRing";
import MicroBar from "@/components/MicroBar";
import { Flame, Loader2 } from "lucide-react";
import { getMotivationalMessage } from "@/lib/aiService";
import SupplementLogger from "@/components/SupplementLogger";
import BodyStatusCard from "@/components/BodyStatusCard";
import AppraisalCheckIn from "@/components/AppraisalCheckIn";
import NudgeStrip from "@/components/NudgeStrip";
import { PhaseBanner, celebrate } from "@/components/Fun";

const MACRO_COLORS = {
  cal: "var(--accent)",
  protein: "oklch(0.72 0.08 148)",
  carbs: "oklch(0.78 0.10 75)",
  fats: "oklch(0.68 0.09 25)",
};

export default function Dashboard({ onAskCoach }: { onAskCoach?: (prompt: string) => void }) {
  const { profile, nutritionGoals, nutritionLoading, meals, steps, streak } = useApp();
  const [motivMsg, setMotivMsg] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const totals = meals.reduce(
    (acc, m) => ({
      cal:     acc.cal     + m.calories,
      protein: acc.protein + m.protein,
      carbs:   acc.carbs   + m.carbs,
      fats:    acc.fats    + m.fats,
      fiber:   acc.fiber   + m.fiber,
      omega3:  acc.omega3  + m.omega3,
    }),
    { cal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, omega3: 0 }
  );

  // Fetch motivational message once goals are loaded and there are meals
  useEffect(() => {
    if (!profile || !nutritionGoals || meals.length === 0) return;
    let cancelled = false;
    getMotivationalMessage({
      name: profile.name,
      goal: profile.goal,
      caloriesPct: totals.cal / nutritionGoals.calorieTarget,
      proteinPct:  totals.protein / nutritionGoals.proteinTarget,
      streakDays:  streak,
    })
      .then((msg) => { if (!cancelled) setMotivMsg(msg); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals.length]);

  // 🎉 when protein goal is reached (once per day)
  const proteinHit = !!nutritionGoals && totals.protein >= nutritionGoals.proteinTarget;
  useEffect(() => {
    if (!proteinHit) return;
    const key = `glitch.protein.${new Date().toDateString()}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { /* storage unavailable */ }
    celebrate("Protein goal smashed! 💪");
  }, [proteinHit]);

  const stepGoal = nutritionGoals?.stepGoal ?? 8000;
  const dynamicStepGoal =
    nutritionGoals && totals.cal > nutritionGoals.calorieTarget
      ? stepGoal + Math.floor((totals.cal - nutritionGoals.calorieTarget) / 500) * 1000
      : stepGoal;
  const stepPct = Math.min((steps / dynamicStepGoal) * 100, 100);

  // Loading skeleton while AI generates goals
  if (nutritionLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6" style={{ minHeight: "60vh" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "color-mix(in oklch, var(--accent) 12%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2 size={32} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            Personalizing your plan…
          </p>
          <p style={{ fontSize: 13, color: "var(--txt-muted)", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
            Our AI is calculating your nutrition targets and exercise plan based on your profile.
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!nutritionGoals) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6" style={{ minHeight: "60vh" }}>
        <p style={{ fontSize: 14, color: "var(--txt-muted)", fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>
          Could not load your nutrition plan. Please check your connection and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 pb-2">
      {/* Hero header */}
      <div
        style={{
          background: "linear-gradient(160deg, color-mix(in oklch, var(--accent) 12%, transparent) 0%, var(--app-bg) 60%)",
          padding: "20px 20px 16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
            background: "color-mix(in oklch, var(--accent) 12%, transparent)",
            zIndex: 0,
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 13, color: "var(--txt-muted)", fontFamily: "'DM Sans', sans-serif" }}>{today}</p>
              <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>
                {greeting}, {profile?.name ?? "there"} 👋
              </h1>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl"
              style={{ background: "var(--accent)", boxShadow: "0 4px 12px color-mix(in oklch, var(--accent) 30%, transparent)" }}
            >
              <Flame size={14} color="white" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif" }}>
                {streak} day{streak !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* AI rationale banner */}
          {nutritionGoals.rationale && (
            <div
              className="mt-3 px-3 py-2 rounded-xl animate-fade-up"
              style={{ background: "oklch(0.72 0.08 148 / 0.15)", border: "1px solid oklch(0.72 0.08 148 / 0.3)" }}
            >
              <p style={{ fontSize: 12, color: "oklch(0.84 0.08 148)", fontFamily: "'DM Sans', sans-serif" }}>
                🌿 {motivMsg ?? nutritionGoals.rationale}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2">
        <PhaseBanner />
        {onAskCoach && <NudgeStrip onAsk={onAskCoach} />}
        <AppraisalCheckIn />
        <BodyStatusCard />

        {/* Macro rings */}
        <div
          className="animate-fade-up animate-fade-up-delay-1"
          style={{
            background: "var(--card-bg)",
            borderRadius: 22,
            padding: "18px 16px",
            boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)",
          }}
        >
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
            Today's Macros
          </h2>
          <div className="flex justify-around">
            <MacroRing label="Calories" value={totals.cal}     target={nutritionGoals.calorieTarget} unit="kcal" color={MACRO_COLORS.cal}     size={82} />
            <MacroRing label="Protein"  value={totals.protein} target={nutritionGoals.proteinTarget} unit="g"    color={MACRO_COLORS.protein} size={82} />
            <MacroRing label="Carbs"    value={totals.carbs}   target={nutritionGoals.carbsTarget}   unit="g"    color={MACRO_COLORS.carbs}   size={82} />
            <MacroRing label="Fats"     value={totals.fats}    target={nutritionGoals.fatsTarget}    unit="g"    color={MACRO_COLORS.fats}    size={82} />
          </div>
        </div>

        {/* Micronutrients */}
        <div
          className="animate-fade-up animate-fade-up-delay-2"
          style={{
            background: "var(--card-bg)",
            borderRadius: 22,
            padding: "18px 16px",
            boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)",
          }}
        >
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
            Micronutrients
          </h2>
          <div className="flex flex-col gap-3">
            <MicroBar label="Fiber"       value={totals.fiber}  target={nutritionGoals.fiberTarget}  unit="g"   color="oklch(0.72 0.08 148)" />
            <MicroBar label="Omega-3"     value={totals.omega3} target={nutritionGoals.omega3Target} unit="g"   color="oklch(0.62 0.10 200)" />
            <MicroBar label="Vitamin D"   value={0}             target={nutritionGoals.vitDTarget}   unit=" IU" color="oklch(0.78 0.10 75)" />
            <MicroBar label="Vitamin B12" value={0}             target={nutritionGoals.vitB12Target} unit="mcg" color="oklch(0.68 0.09 25)" />
            <MicroBar label="Iron"        value={0}             target={nutritionGoals.ironTarget}   unit="mg"  color="var(--accent)" />
          </div>

        </div>

        {/* Steps */}
        <div
          className="animate-fade-up animate-fade-up-delay-3"
          style={{
            background: "var(--card-bg)",
            borderRadius: 22,
            padding: "18px 16px",
            boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)",
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              Steps Today
            </h2>
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", fontFamily: "'DM Sans', sans-serif" }}>
              {steps.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${stepPct}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, var(--accent), oklch(0.72 0.08 148))",
                transition: "width 1s cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: "var(--txt-muted)", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
            Goal: {dynamicStepGoal.toLocaleString()} steps
            {totals.cal > nutritionGoals.calorieTarget ? " (adjusted for extra calories)" : ""}
          </p>
        </div>

        {/* Supplement Logger */}
        <div className="animate-fade-up animate-fade-up-delay-5">
          <SupplementLogger />
        </div>

        {/* Meals Today */}
        <div className="animate-fade-up animate-fade-up-delay-4">
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
            Meals Today
          </h2>
          {meals.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                borderRadius: 18,
                background: "var(--card-bg)",
                textAlign: "center",
                border: "1.5px dashed var(--line)",
              }}
            >
              <p style={{ fontSize: 32, marginBottom: 8 }}>🍽️</p>
              <p style={{ fontSize: 14, color: "var(--txt-muted)", fontFamily: "'DM Sans', sans-serif" }}>
                No meals logged yet today. Tap <b>Log Food</b> to get started!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {meals.map((meal, i) => (
                <div
                  key={meal.id}
                  className="card-lift"
                  style={{
                    display: "flex",
                    gap: 12,
                    background: "var(--card-bg)",
                    borderRadius: 18,
                    padding: "12px 14px",
                    boxShadow: "0 2px 10px oklch(0.25 0.025 50 / 0.06)",
                    animationDelay: `${0.20 + i * 0.05}s`,
                  }}
                >
                  {meal.imageUrl && (
                    <img
                      src={meal.imageUrl}
                      alt={meal.name}
                      style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
                    />
                  )}
                  <div className="flex flex-col justify-center flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", fontFamily: "'DM Sans', sans-serif" }}>
                        {meal.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "color-mix(in oklch, var(--accent) 12%, transparent)",
                          color: "oklch(0.84 0.12 38)",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {meal.type}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {[
                        { label: "Cal", val: meal.calories, unit: "" },
                        { label: "P",   val: meal.protein,  unit: "g" },
                        { label: "C",   val: meal.carbs,    unit: "g" },
                        { label: "F",   val: meal.fats,     unit: "g" },
                      ].map(({ label, val, unit }) => (
                        <span key={label} style={{ fontSize: 11, color: "var(--txt-muted)", fontFamily: "'DM Sans', sans-serif" }}>
                          <b style={{ color: "var(--ink)" }}>{val}</b>{unit} {label}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: "var(--txt-muted)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                      {meal.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
