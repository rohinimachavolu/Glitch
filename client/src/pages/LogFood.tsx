/**
 * NutriSense AI — Log Food Tab
 * Design: Organic Wellness Journal
 * Uses real AI food analysis via Forge API (vision model).
 * Ingredient add-ons also use AI nutrition lookup.
 */
import { useState, useRef } from "react";
import { useApp, Meal } from "@/contexts/AppContext";
import { Camera, Plus, CheckCircle2, X, Loader2, AlertCircle } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { analyzeFoodImage, lookupIngredient, FoodAnalysis, IngredientNutrition } from "@/lib/aiService";

type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function LogFood() {
  const { addMeal } = useApp();
  const [mealType, setMealType] = useState<MealType>("Lunch");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [addon, setAddon] = useState("");
  const [addons, setAddons] = useState<IngredientNutrition[]>([]);
  const [addonLoading, setAddonLoading] = useState(false);
  const [logged, setLogged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Convert file to base64 data URL for AI vision
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPhotoUrl(objectUrl);
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzed(null);

    try {
      const base64 = await fileToBase64(file);
      setPhotoBase64(base64);
      const result = await analyzeFoodImage(base64);
      setAnalyzed(result);
    } catch (err) {
      console.error("Food analysis failed:", err);
      setAnalyzeError("AI analysis failed. Please try again or enter details manually.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAddAddon() {
    const ingredient = addon.trim();
    if (!ingredient) return;
    setAddonLoading(true);
    try {
      const result = await lookupIngredient(ingredient);
      if (result.found) {
        setAddons((prev) => [...prev, result]);
        setAddon("");
        toast.success(`Added ${result.name} (+${result.calories} kcal)`);
      } else {
        toast.error(`Could not find nutrition data for "${ingredient}". Try a different name.`);
      }
    } catch {
      toast.error("Ingredient lookup failed. Please try again.");
    } finally {
      setAddonLoading(false);
    }
  }

  function handleLog() {
    if (!analyzed) return;

    const addonTotals = addons.reduce(
      (acc, a) => ({
        calories: acc.calories + a.calories,
        protein:  acc.protein  + a.protein,
        carbs:    acc.carbs    + a.carbs,
        fats:     acc.fats     + a.fats,
        fiber:    acc.fiber    + a.fiber,
        omega3:   acc.omega3   + a.omega3,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, omega3: 0 }
    );

    const meal: Meal = {
      id: nanoid(),
      type: mealType,
      name: analyzed.name,
      imageUrl: photoUrl ?? undefined,
      calories: Math.round(analyzed.calories + addonTotals.calories),
      protein:  Math.round(analyzed.protein  + addonTotals.protein),
      carbs:    Math.round(analyzed.carbs    + addonTotals.carbs),
      fats:     Math.round(analyzed.fats     + addonTotals.fats),
      fiber:    Math.round((analyzed.fiber   + addonTotals.fiber)  * 10) / 10,
      omega3:   Math.round((analyzed.omega3  + addonTotals.omega3) * 10) / 10,
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      loggedAt: new Date().toISOString(),
    };

    addMeal(meal);
    setLogged(true);
    toast.success(`Great job logging ${mealType.toLowerCase()}! 🌿`);
  }

  function handleReset() {
    setPhotoUrl(null);
    setPhotoBase64(null);
    setAnalyzed(null);
    setAnalyzeError(null);
    setAddons([]);
    setAddon("");
    setLogged(false);
  }

  const confidenceBadge = analyzed
    ? analyzed.confidence === "high"   ? { label: "High confidence", color: "oklch(0.72 0.08 148)" }
    : analyzed.confidence === "medium" ? { label: "Medium confidence", color: "oklch(0.78 0.10 75)" }
    :                                    { label: "Low confidence — verify", color: "oklch(0.62 0.12 38)" }
    : null;

  return (
    <div className="flex flex-col gap-0 pb-2">
      {/* Header */}
      <div style={{ padding: "20px 20px 12px" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "oklch(0.25 0.025 50)" }}>
          Log a Meal
        </h1>
        <p style={{ fontSize: 13, color: "oklch(0.55 0.020 60)", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
          Take a photo — AI will identify your food and calculate nutrition.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4">
        {/* Meal type selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 animate-fade-up" style={{ scrollbarWidth: "none" }}>
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setMealType(t)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: mealType === t ? "none" : "1.5px solid oklch(0.88 0.020 72)",
                background: mealType === t ? "oklch(0.62 0.12 38)" : "oklch(0.99 0.010 78)",
                color: mealType === t ? "white" : "oklch(0.45 0.025 50)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Camera / Upload area */}
        {!photoUrl && (
          <div
            className="animate-fade-up animate-fade-up-delay-1"
            onClick={() => fileRef.current?.click()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              height: 200,
              borderRadius: 22,
              border: "2px dashed oklch(0.62 0.12 38 / 0.4)",
              background: "oklch(0.62 0.12 38 / 0.05)",
              cursor: "pointer",
              transition: "all 0.18s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "oklch(0.62 0.12 38 / 0.10)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "oklch(0.62 0.12 38 / 0.05)")}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "oklch(0.62 0.12 38)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 20px oklch(0.62 0.12 38 / 0.35)",
              }}
            >
              <Camera size={28} color="white" />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "oklch(0.35 0.025 50)", fontFamily: "'DM Sans', sans-serif" }}>
                Take or upload a photo
              </p>
              <p style={{ fontSize: 12, color: "oklch(0.55 0.020 60)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                AI will identify your food instantly
              </p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </div>
        )}

        {/* Photo preview + analysis */}
        {photoUrl && !logged && (
          <div className="flex flex-col gap-4 animate-fade-up">
            <div style={{ position: "relative" }}>
              <img
                src={photoUrl}
                alt="Food"
                style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 18 }}
              />
              <button
                onClick={handleReset}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "oklch(0.25 0.025 50 / 0.7)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={14} color="white" />
              </button>

              {/* Analyzing overlay */}
              {analyzing && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 18,
                    background: "oklch(0.25 0.025 50 / 0.55)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <Loader2 size={32} color="white" style={{ animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "white", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                    AI is analyzing your food…
                  </p>
                </div>
              )}
            </div>

            {/* Error state */}
            {analyzeError && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "14px",
                  borderRadius: 14,
                  background: "oklch(0.62 0.12 38 / 0.08)",
                  border: "1px solid oklch(0.62 0.12 38 / 0.3)",
                }}
              >
                <AlertCircle size={18} style={{ color: "oklch(0.62 0.12 38)", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: "oklch(0.40 0.08 38)", fontFamily: "'DM Sans', sans-serif" }}>
                  {analyzeError}
                </p>
              </div>
            )}

            {/* AI result */}
            {analyzed && (
              <>
                <div
                  style={{
                    background: "oklch(0.99 0.010 78)",
                    borderRadius: 18,
                    padding: "16px",
                    boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 18 }}>🤖</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.62 0.12 38)", fontFamily: "'DM Sans', sans-serif" }}>
                        AI Analysis
                      </span>
                    </div>
                    {confidenceBadge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: `${confidenceBadge.color}22`,
                          color: confidenceBadge.color,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {confidenceBadge.label}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "oklch(0.25 0.025 50)", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
                    {analyzed.name}
                  </p>
                  {analyzed.notes && (
                    <p style={{ fontSize: 12, color: "oklch(0.55 0.020 60)", fontFamily: "'DM Sans', sans-serif", marginBottom: 10, fontStyle: "italic" }}>
                      {analyzed.notes}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { l: "Calories", v: analyzed.calories, u: "kcal" },
                      { l: "Protein",  v: analyzed.protein,  u: "g" },
                      { l: "Carbs",    v: analyzed.carbs,    u: "g" },
                      { l: "Fats",     v: analyzed.fats,     u: "g" },
                      { l: "Fiber",    v: analyzed.fiber,    u: "g" },
                      { l: "Omega-3",  v: analyzed.omega3,   u: "g" },
                    ].map(({ l, v, u }) => (
                      <div
                        key={l}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 10,
                          background: "oklch(0.93 0.018 75)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          minWidth: 58,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: "oklch(0.35 0.025 50)", fontFamily: "'DM Sans', sans-serif" }}>
                          {v}{u}
                        </span>
                        <span style={{ fontSize: 10, color: "oklch(0.55 0.020 60)", fontFamily: "'DM Sans', sans-serif" }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add-ons */}
                <div
                  style={{
                    background: "oklch(0.99 0.010 78)",
                    borderRadius: 18,
                    padding: "16px",
                    boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: "oklch(0.35 0.025 50)", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>
                    Add ingredients
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={addon}
                      onChange={(e) => setAddon(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !addonLoading && handleAddAddon()}
                      placeholder="e.g. 1 tbsp flax seeds"
                      disabled={addonLoading}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1.5px solid oklch(0.88 0.020 72)",
                        background: "oklch(0.97 0.015 75)",
                        fontSize: 13,
                        fontFamily: "'DM Sans', sans-serif",
                        color: "oklch(0.25 0.025 50)",
                        outline: "none",
                        opacity: addonLoading ? 0.6 : 1,
                      }}
                    />
                    <button
                      onClick={handleAddAddon}
                      disabled={addonLoading || !addon.trim()}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        background: addonLoading ? "oklch(0.72 0.08 148 / 0.5)" : "oklch(0.72 0.08 148)",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        color: "white",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: addonLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {addonLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
                      Add
                    </button>
                  </div>
                  {addons.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                      {addons.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 10,
                            background: "oklch(0.72 0.08 148 / 0.10)",
                          }}
                        >
                          <span style={{ fontSize: 12, color: "oklch(0.40 0.06 148)", fontFamily: "'DM Sans', sans-serif" }}>
                            + {a.name}
                          </span>
                          <span style={{ fontSize: 11, color: "oklch(0.55 0.020 60)", fontFamily: "'DM Sans', sans-serif" }}>
                            {a.calories} kcal · {a.protein}g P
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Log button */}
                <button
                  onClick={handleLog}
                  style={{
                    padding: "16px",
                    borderRadius: 18,
                    background: "oklch(0.62 0.12 38)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 16,
                    fontFamily: "'DM Sans', sans-serif",
                    border: "none",
                    boxShadow: "0 6px 20px oklch(0.62 0.12 38 / 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle2 size={18} />
                  Confirm & Log {mealType}
                </button>
              </>
            )}
          </div>
        )}

        {/* Success state */}
        {logged && (
          <div
            className="flex flex-col items-center gap-4 py-10 animate-fade-up"
            style={{
              background: "oklch(0.99 0.010 78)",
              borderRadius: 22,
              boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)",
            }}
          >
            <span style={{ fontSize: 56 }}>🌿</span>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "oklch(0.25 0.025 50)" }}>
                Great job logging {mealType.toLowerCase()}!
              </p>
              <p style={{ fontSize: 13, color: "oklch(0.55 0.020 60)", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                Your dashboard has been updated.
              </p>
            </div>
            <button
              onClick={handleReset}
              style={{
                padding: "12px 24px",
                borderRadius: 14,
                background: "oklch(0.62 0.12 38 / 0.12)",
                color: "oklch(0.50 0.10 38)",
                fontWeight: 600,
                fontSize: 14,
                fontFamily: "'DM Sans', sans-serif",
                border: "none",
              }}
            >
              Log another meal
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
