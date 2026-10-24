/**
 * Luna — WhoopConnect
 * Consent + connect card. If WHOOP isn't configured, explains the app is
 * running on labeled sample data and offers connection when ready.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { isWhoopConfigured } from "@/lib/whoop";
import { Activity } from "lucide-react";

export default function WhoopConnect() {
  const { connectWhoop } = useApp();
  const [consent, setConsent] = useState(false);
  const configured = isWhoopConfigured();

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", border: "1.5px solid var(--luna-accent)", boxShadow: "0 4px 16px var(--luna-glow)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--luna-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Activity size={16} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)" }}>Connect WHOOP</h3>
          <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>Make the signals truly yours</p>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--luna-text-muted)", lineHeight: 1.5, marginBottom: 10 }}>
        Glitch will read only your <b>recovery, sleep, cycle and workout</b> data (skin temperature, heart rate,
        HRV, respiratory rate) — read-only, and only with your consent. You're currently exploring with sample data.
      </p>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--luna-accent)" }} />
        <span style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>I consent to Luna reading my WHOOP health data to personalize my experience.</span>
      </label>
      <motion.button whileTap={{ scale: 0.97 }} disabled={!consent}
        onClick={() => { if (!configured) { toast.info("Add WHOOP credentials to enable live connect. Sample data stays active."); return; } connectWhoop(); }}
        style={{ width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, border: "none",
          background: consent ? "var(--luna-accent)" : "oklch(0.85 0.02 72)", color: consent ? "white" : "var(--luna-text-muted)",
          cursor: consent ? "pointer" : "not-allowed" }}>
        {configured ? "Connect WHOOP" : "Connect WHOOP (demo: sample data)"}
      </motion.button>
    </motion.div>
  );
}
