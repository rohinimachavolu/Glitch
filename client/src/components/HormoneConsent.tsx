/**
 * Glitch — consent-first hormone & contraception question.
 * Sensitive: nothing is recorded unless the user chooses to share. "Prefer not to say" is first-class.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { HORMONE_OPTIONS, type HormoneContext, type HormoneUse } from "@/lib/hormones";

const INK = "var(--ink)";
const MUTED = "var(--txt-muted)";
const font = "'DM Sans', sans-serif";

type Choice = "share" | "none" | "prefer_not";

export default function HormoneConsent({ value, onChange }: { value: HormoneContext | undefined; onChange: (v: HormoneContext) => void }) {
  const [choice, setChoice] = useState<Choice | null>(!value ? null : value.preferNotToSay ? "prefer_not" : value.uses.length ? "share" : "none");
  const groups = Array.from(new Set(HORMONE_OPTIONS.map((o) => o.group)));

  function toggle(id: HormoneUse) {
    const uses = value?.uses.includes(id) ? value.uses.filter((u) => u !== id) : [...(value?.uses ?? []), id];
    onChange({ consented: true, uses });
  }

  return (
    <div className="flex flex-col gap-2" style={{ padding: 12, borderRadius: 14, background: "var(--app-bg)", border: "1.5px solid var(--line)" }}>
      <div className="flex items-start gap-2">
        <Lock size={15} style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: INK, fontFamily: font }}>Do you use contraception or any hormones?</p>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: font, lineHeight: 1.45 }}>Optional and sensitive. It helps us read your data correctly (e.g. a copper IUD doesn't stop ovulation, the pill usually does). Encrypted on your device only.</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {([["share", "Yes, I'll share"], ["none", "None"], ["prefer_not", "Prefer not to say"]] as [Choice, string][]).map(([id, label]) => (
          <button key={id} aria-pressed={choice === id}
            onClick={() => { setChoice(id); onChange(id === "share" ? { consented: true, uses: value?.uses ?? [] } : id === "none" ? { consented: true, uses: [] } : { consented: false, preferNotToSay: true, uses: [] }); }}
            style={{ flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 11.5, fontWeight: 700, fontFamily: font, border: choice === id ? "2px solid var(--accent)" : "1.5px solid var(--line)", background: choice === id ? "color-mix(in oklch, var(--accent) 16%, var(--card-bg))" : "var(--card-bg)", color: INK }}>
            {label}
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {choice === "share" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            {groups.map((g) => (
              <div key={g} style={{ marginTop: 6 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, fontFamily: font, letterSpacing: 0.4, marginBottom: 4 }}>{g.toUpperCase()}</p>
                <div className="flex flex-wrap gap-1.5">
                  {HORMONE_OPTIONS.filter((o) => o.group === g).map((o) => {
                    const on = !!value?.uses.includes(o.id);
                    return (
                      <motion.button key={o.id} whileTap={{ scale: 0.94 }} onClick={() => toggle(o.id)} aria-pressed={on}
                        style={{ padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, fontFamily: font, border: on ? "none" : "1.5px solid var(--line)", background: on ? "var(--accent)" : "var(--card-bg)", color: on ? "var(--on-accent)" : INK }}>
                        {o.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
            {value?.uses.map((u) => {
              const o = HORMONE_OPTIONS.find((x) => x.id === u)!;
              return <p key={u} style={{ fontSize: 11, color: INK, fontFamily: font, marginTop: 6, lineHeight: 1.45 }}>💡 <b>{o.label}:</b> {o.note}</p>;
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
