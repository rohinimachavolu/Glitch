/**
 * Glitch — "Glitchy noticed…" swipeable nudge cards (Dashboard + coach).
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useNudges } from "@/hooks/useNudges";

const INK = "var(--ink)";
const MUTED = "var(--txt-muted)";
const font = "'DM Sans', sans-serif";

export default function NudgeStrip({ onAsk, compact }: { onAsk: (prompt: string) => void; compact?: boolean }) {
  const nudges = useNudges();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = nudges.filter((n) => !dismissed.includes(n.id));
  if (!visible.length) return null;

  return (
    <div>
      {!compact && (
        <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: font }}>Glitchy noticed</p>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto" style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", paddingBottom: 2 }}>
        <AnimatePresence initial={false}>
          {visible.map((n, i) => (
            <motion.div key={n.id} layout initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.05 } }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ scrollSnapAlign: "start", flex: "0 0 82%", maxWidth: 320, padding: 13, borderRadius: 18, background: "var(--card-bg)", border: "1.5px solid color-mix(in oklch, var(--accent) 22%, transparent)", boxShadow: "0 4px 14px oklch(0.25 0.025 50 / 0.06)", position: "relative" }}>
              <button onClick={() => setDismissed((d) => [...d, n.id])} aria-label="Dismiss" style={{ position: "absolute", top: 8, right: 8, border: "none", background: "transparent", color: MUTED, padding: 2 }}><X size={14} /></button>
              <p style={{ fontSize: 13.5, fontWeight: 800, color: INK, fontFamily: font, paddingRight: 18 }}>{n.emoji} {n.title}</p>
              <p style={{ fontSize: 12, color: INK, fontFamily: font, lineHeight: 1.45, marginTop: 4 }}>{n.body}</p>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => onAsk(n.ask)}
                style={{ marginTop: 8, padding: "7px 12px", borderRadius: 999, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontWeight: 700, fontSize: 11.5, fontFamily: font }}>
                Help me with this →
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
