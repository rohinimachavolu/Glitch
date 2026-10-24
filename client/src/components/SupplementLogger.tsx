/**
 * NutriSense AI — Supplement Logger
 * Add, view, and remove daily supplements.
 * Design: Organic Wellness Journal
 */
import { useState } from "react";
import { useApp, Supplement } from "@/contexts/AppContext";
import { Plus, X, Pill } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";

const COMMON_SUPPLEMENTS = [
  { name: "Vitamin D3",   dose: "1000 IU",  emoji: "☀️" },
  { name: "Vitamin B12",  dose: "500 mcg",  emoji: "⚡" },
  { name: "Omega-3",      dose: "1000 mg",  emoji: "🐟" },
  { name: "Iron",         dose: "18 mg",    emoji: "🔩" },
  { name: "Magnesium",    dose: "200 mg",   emoji: "💊" },
  { name: "Zinc",         dose: "15 mg",    emoji: "🔬" },
  { name: "Protein Powder", dose: "30 g",   emoji: "🥤" },
  { name: "Creatine",     dose: "5 g",      emoji: "💪" },
  { name: "Ashwagandha",  dose: "300 mg",   emoji: "🌿" },
  { name: "Probiotics",   dose: "10B CFU",  emoji: "🦠" },
];

const TIME_OPTIONS = ["Morning", "Afternoon", "Evening", "With Meal", "Before Workout", "After Workout"];

export default function SupplementLogger() {
  const { supplements, addSupplement, removeSupplement } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("Morning");
  const [emoji, setEmoji] = useState("💊");

  function handleAdd() {
    if (!name.trim()) return;
    const s: Supplement = { id: nanoid(), name: name.trim(), dose: dose.trim() || "—", time, emoji };
    addSupplement(s);
    setName(""); setDose(""); setTime("Morning"); setEmoji("💊");
    setOpen(false);
    toast.success(`${s.emoji} ${s.name} added to your supplement log!`);
  }

  function handleQuickAdd(s: { name: string; dose: string; emoji: string }) {
    const alreadyAdded = supplements.some((sup) => sup.name === s.name);
    if (alreadyAdded) { toast.info(`${s.name} is already in your log.`); return; }
    addSupplement({ id: nanoid(), name: s.name, dose: s.dose, time: "Morning", emoji: s.emoji });
    toast.success(`${s.emoji} ${s.name} added!`);
  }

  return (
    <div
      style={{
        background: "oklch(0.99 0.010 78)",
        borderRadius: 20,
        padding: "16px",
        boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pill size={16} style={{ color: "oklch(0.62 0.12 38)" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "oklch(0.35 0.025 50)", fontFamily: "'DM Sans', sans-serif" }}>
            Supplements
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 12px", borderRadius: 10,
            background: open ? "oklch(0.93 0.018 75)" : "oklch(0.62 0.12 38)",
            color: open ? "oklch(0.35 0.025 50)" : "white",
            fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", border: "none",
            transition: "all 0.15s",
          }}
        >
          <Plus size={12} /> {open ? "Cancel" : "Add"}
        </button>
      </div>

      {/* Current supplements */}
      {supplements.length === 0 && !open && (
        <p style={{ fontSize: 13, color: "oklch(0.65 0.015 60)", fontFamily: "'DM Sans', sans-serif", textAlign: "center", padding: "8px 0" }}>
          No supplements logged yet. Tap Add to get started.
        </p>
      )}

      {supplements.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {supplements.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between"
              style={{ padding: "9px 12px", borderRadius: 12, background: "oklch(0.93 0.018 75)" }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.25 0.025 50)", fontFamily: "'DM Sans', sans-serif" }}>
                    {s.name}
                  </p>
                  <p style={{ fontSize: 11, color: "oklch(0.55 0.020 60)", fontFamily: "'DM Sans', sans-serif" }}>
                    {s.dose} · {s.time}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeSupplement(s.id)}
                style={{ background: "none", border: "none", padding: 4, color: "oklch(0.65 0.015 60)", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {open && (
        <div className="flex flex-col gap-3 animate-fade-up">
          {/* Quick-add common supplements */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.55 0.020 60)", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
              QUICK ADD
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_SUPPLEMENTS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => handleQuickAdd(s)}
                  style={{
                    padding: "5px 10px", borderRadius: 999,
                    border: "1.5px solid oklch(0.88 0.020 72)",
                    background: supplements.some((sup) => sup.name === s.name) ? "oklch(0.72 0.08 148 / 0.15)" : "oklch(0.99 0.010 78)",
                    fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                    color: supplements.some((sup) => sup.name === s.name) ? "oklch(0.40 0.06 148)" : "oklch(0.45 0.025 50)",
                    transition: "all 0.15s",
                  }}
                >
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "oklch(0.88 0.020 72)" }} />

          {/* Custom entry */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.55 0.020 60)", fontFamily: "'DM Sans', sans-serif" }}>
            CUSTOM
          </p>
          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="💊"
              style={{ width: 44, padding: "9px 8px", borderRadius: 10, border: "1.5px solid oklch(0.88 0.020 72)", background: "oklch(0.97 0.015 75)", fontSize: 18, textAlign: "center", outline: "none" }}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Supplement name"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid oklch(0.88 0.020 72)", background: "oklch(0.97 0.015 75)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "oklch(0.25 0.025 50)", outline: "none" }}
            />
          </div>
          <div className="flex gap-2">
            <input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="Dose (e.g. 500 mg)"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid oklch(0.88 0.020 72)", background: "oklch(0.97 0.015 75)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "oklch(0.25 0.025 50)", outline: "none" }}
            />
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid oklch(0.88 0.020 72)", background: "oklch(0.97 0.015 75)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: "oklch(0.25 0.025 50)", outline: "none" }}
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            style={{
              padding: "11px", borderRadius: 12,
              background: name.trim() ? "oklch(0.62 0.12 38)" : "oklch(0.88 0.020 72)",
              color: name.trim() ? "white" : "oklch(0.65 0.015 60)",
              fontWeight: 600, fontSize: 14, fontFamily: "'DM Sans', sans-serif", border: "none",
              cursor: name.trim() ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            Add Supplement
          </button>
        </div>
      )}
    </div>
  );
}
