/**
 * Luna — Log Food
 * Photo (AI vision) or text entry. Emotional-eating aware: optional "how were
 * you feeling" tag, no shaming, no "over your limit" alerts.
 */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { analyzeFoodImage, lookupIngredient } from "@/lib/aiService";
import { Camera, Plus, Loader2 } from "lucide-react";

type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const MOODS = ["🙂 Content", "😓 Stressed", "😔 Sad", "😑 Bored", "😠 Angry", "🎉 Celebrating"];

export default function LogFood() {
  const { addMeal } = useApp();
  const [mealType, setMealType] = useState<MealType>("Lunch");
  const [text, setText] = useState("");
  const [mood, setMood] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fileToB64 = (f: File) => new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f);
  });

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const b64 = await fileToB64(f);
      const a = await analyzeFoodImage(b64);
      await addMeal({
        date: new Date().toISOString().split("T")[0], type: mealType, name: a.name,
        calories: a.calories, protein: a.protein, carbs: a.carbs, fats: a.fats, fiber: a.fiber, omega3: a.omega3,
        mood, time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      });
      toast.success(`Logged ${a.name} 🍽️`);
    } catch { toast.error("Couldn't analyze — try text entry"); }
    finally { setBusy(false); }
  }

  async function onText() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const n = await lookupIngredient(text);
      await addMeal({
        date: new Date().toISOString().split("T")[0], type: mealType, name: n.name || text,
        calories: n.calories, protein: n.protein, carbs: n.carbs, fats: n.fats, fiber: n.fiber, omega3: n.omega3,
        mood, time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      });
      setText("");
      toast.success("Logged 🍽️");
    } catch { toast.error("Lookup failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="luna-app" style={{ minHeight: "100%", padding: "22px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Log food</h1>

      <div style={{ display: "flex", gap: 6 }}>
        {MEAL_TYPES.map((m) => (
          <button key={m} onClick={() => setMealType(m)} style={{ flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: mealType === m ? "none" : "1.5px solid oklch(0.85 0.02 72)", background: mealType === m ? "var(--luna-accent)" : "transparent", color: mealType === m ? "white" : "var(--luna-text-muted)" }}>{m}</button>
        ))}
      </div>

      {/* Photo */}
      <div onClick={() => !busy && fileRef.current?.click()}
        style={{ padding: 24, borderRadius: 18, background: "var(--luna-surface)", border: "2px dashed var(--luna-accent)", textAlign: "center", cursor: "pointer" }}>
        {busy ? <Loader2 size={26} className="animate-spin" color="var(--luna-accent)" style={{ margin: "0 auto" }} />
          : <Camera size={26} color="var(--luna-accent)" style={{ margin: "0 auto 8px" }} />}
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>Snap a photo of your meal</p>
        <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>AI estimates the nutrition</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPhoto} />
      </div>

      {/* Text */}
      <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)", marginBottom: 8 }}>Or describe it</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 100g rice & dal" onKeyDown={(e) => e.key === "Enter" && onText()}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1.5px solid oklch(0.85 0.02 72)", background: "var(--luna-bg)", color: "var(--luna-text)", outline: "none" }} />
          <motion.button whileTap={{ scale: 0.95 }} onClick={onText} disabled={busy} style={{ padding: "0 16px", borderRadius: 10, background: "var(--luna-accent)", color: "white", border: "none" }}><Plus size={18} /></motion.button>
        </div>
      </div>

      {/* Emotional context (opt-in, no shaming) */}
      <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)", marginBottom: 4 }}>How were you feeling? <span style={{ fontWeight: 400, fontSize: 11, color: "var(--luna-text-muted)" }}>(optional)</span></h2>
        <p style={{ fontSize: 11, color: "var(--luna-text-muted)", marginBottom: 8 }}>No judgment — this just helps Luna understand your patterns.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MOODS.map((m) => (
            <button key={m} onClick={() => setMood(mood === m ? undefined : m)} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, border: mood === m ? "none" : "1.5px solid oklch(0.85 0.02 72)", background: mood === m ? "var(--luna-accent)" : "transparent", color: mood === m ? "white" : "var(--luna-text-muted)" }}>{m}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
