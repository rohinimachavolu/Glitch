/**
 * Glitch — Voice Assistant
 * Floating mic. Talk to it like a human: "I ate 100g rice and dal", "log a hot
 * flash", "I feel really stressed and tired". It parses intent, SAVES to the DB,
 * and replies out loud. Falls back gracefully if the browser lacks speech APIs.
 */
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { isSpeechSupported, createRecognizer, parseVoiceIntent, speak } from "@/lib/voice";
import { lookupIngredient, getCoachResponse } from "@/lib/aiService";
import { Mic, X, Loader2 } from "lucide-react";

export default function VoiceAssistant() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<any>(null);
  const supported = isSpeechSupported();

  function start() {
    setTranscript(""); setReply(null);
    const rec = createRecognizer(
      (text, isFinal) => { setTranscript(text); if (isFinal) handle(text); },
      () => setListening(false),
    );
    if (!rec) { toast.error("Voice not supported in this browser"); return; }
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() { recRef.current?.stop?.(); setListening(false); }

  async function handle(text: string) {
    setBusy(true);
    try {
      const intent = await parseVoiceIntent(text);
      let msg = "";
      switch (intent.action) {
        case "log_food": {
          const n = await lookupIngredient(intent.text);
          await app.addMeal({ date: new Date().toISOString().split("T")[0], type: "Snack", name: n.name || intent.text, calories: n.calories, protein: n.protein, carbs: n.carbs, fats: n.fats, fiber: n.fiber, omega3: n.omega3, time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) });
          msg = `Logged ${n.name} — about ${Math.round(n.calories)} calories and ${Math.round(n.protein)}g protein.`;
          break;
        }
        case "log_hot_flash":
          await app.logHotFlash({ timestamp: new Date().toISOString(), source: "manual", intensity: intent.intensity ?? 3 });
          msg = "I logged your hot flash. Take a breath — you've got this.";
          break;
        case "log_period":
          await app.addPeriod({ startDate: new Date().toISOString().split("T")[0] });
          msg = "Period start logged.";
          break;
        case "log_symptom": {
          const base = { mood: 3, energy: 3, stress: 2, bloating: 1, cramps: 1, cravings: 2, sleepQuality: 3 };
          await app.saveCheckin({ date: new Date().toISOString().split("T")[0], ...base, ...intent.fields, symptoms: [], notes: intent.note });
          msg = "I saved how you're feeling today. Thanks for checking in.";
          break;
        }
        default: {
          // Conversational reply via coach
          msg = await getCoachResponse({
            name: app.profile?.name ?? "there",
            healthMode: app.profile?.healthMode ?? "none",
            cyclePhase: app.cyclePhase ?? undefined,
            question: intent.action === "note" ? intent.text : text,
          });
          if (intent.action === "note") {
            await app.addRecord({ kind: "value", label: "Voice note", value: intent.text, date: new Date().toISOString().split("T")[0] });
          }
        }
      }
      setReply(msg);
      speak(msg, true);
    } catch {
      const m = "I couldn't catch that — try again?";
      setReply(m); speak(m, true);
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* Floating mic button */}
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen(true)}
        style={{ position: "fixed", bottom: 88, right: 16, width: 56, height: 56, borderRadius: "50%", zIndex: 40,
          background: "var(--luna-accent)", color: "white", border: "none", boxShadow: "0 8px 24px var(--luna-glow)",
          display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 414, left: "auto" }}>
        <Mic size={24} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { stop(); setOpen(false); }}
            style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(0.15 0.02 285 / 0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 430, background: "var(--luna-surface)", borderRadius: "24px 24px 0 0", padding: 22, paddingBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--luna-text)" }}>Talk to Glitch</h2>
                <button onClick={() => { stop(); setOpen(false); }} style={{ background: "none", border: "none", color: "var(--luna-text-muted)" }}><X size={20} /></button>
              </div>

              {!supported && <p style={{ fontSize: 12, color: "var(--luna-text-muted)", marginBottom: 12 }}>Your browser doesn't support voice input. Try Chrome.</p>}

              {/* Mic orb */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <motion.button whileTap={{ scale: 0.95 }} disabled={!supported || busy}
                  onClick={() => (listening ? stop() : start())}
                  animate={listening ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 1.1, repeat: listening ? Infinity : 0 }}
                  style={{ width: 92, height: 92, borderRadius: "50%", border: "none",
                    background: listening ? "oklch(0.6 0.16 25)" : "var(--luna-accent)", color: "white",
                    boxShadow: `0 0 ${listening ? 40 : 20}px var(--luna-glow)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {busy ? <Loader2 size={34} className="animate-spin" /> : <Mic size={34} />}
                </motion.button>
                <p style={{ fontSize: 13, color: "var(--luna-text-muted)", textAlign: "center", minHeight: 20 }}>
                  {listening ? "Listening… say something like “I ate oats and a banana”" : busy ? "Thinking…" : "Tap to talk"}
                </p>
                {transcript && <p style={{ fontSize: 14, color: "var(--luna-text)", textAlign: "center", fontStyle: "italic" }}>“{transcript}”</p>}
                {reply && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    style={{ padding: 14, borderRadius: 16, background: `linear-gradient(135deg, var(--luna-accent), var(--luna-accent2))`, color: "white", fontSize: 14, lineHeight: 1.5 }}>
                    {reply}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
