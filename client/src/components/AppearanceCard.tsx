/**
 * Glitch — Appearance (light / dark theme toggle).
 * The accent colour still adapts to the user's cycle/life stage; this only flips the
 * light/dark surface palette. The choice is remembered on the device.
 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const font = "'DM Sans', sans-serif";

export default function AppearanceCard() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: 22, padding: 16, boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" }}>
      <div className="flex items-center gap-2 mb-1">
        {isDark ? <Moon size={16} style={{ color: "var(--accent)" }} /> : <Sun size={16} style={{ color: "var(--accent)" }} />}
        <p style={{ fontFamily: font, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Appearance</p>
      </div>
      <p style={{ fontSize: 12, color: "var(--txt-muted)", fontFamily: font, lineHeight: 1.5, marginBottom: 12 }}>
        Switch between a dark and a light look. Your accent colour still follows your cycle or life stage.
      </p>

      <div role="radiogroup" aria-label="Theme" className="flex gap-2">
        {([["light", "☀️ Light"], ["dark", "🌙 Dark"]] as const).map(([id, label]) => {
          const active = theme === id;
          return (
            <button key={id} role="radio" aria-checked={active}
              onClick={() => { if (!active) toggleTheme?.(); }}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 12,
                border: active ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                background: active ? "color-mix(in oklch, var(--accent) 10%, var(--card-bg))" : "var(--card-bg)",
                color: "var(--ink)", fontSize: 13.5, fontWeight: 700, fontFamily: font,
              }}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
