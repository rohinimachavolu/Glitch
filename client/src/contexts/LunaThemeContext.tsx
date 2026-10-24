/**
 * Luna — Adaptive theme provider
 * Recomputes and applies the palette whenever mode, phase, mood, or the hour
 * changes. Sits alongside the base ThemeProvider (dark/light) without replacing it.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "./AppContext";
import { buildPalette, applyPalette, Palette } from "@/lib/theme";

const LunaThemeContext = createContext<Palette | null>(null);

export function LunaThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, cyclePhase, todayMood } = useApp();
  const [hour, setHour] = useState(() => new Date().getHours());

  // Re-evaluate time band periodically (and when tab regains focus).
  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    const id = setInterval(tick, 10 * 60 * 1000);
    window.addEventListener("focus", tick);
    return () => { clearInterval(id); window.removeEventListener("focus", tick); };
  }, []);

  const palette = useMemo(
    () => buildPalette({
      mode: profile?.healthMode ?? "none",
      phase: cyclePhase ?? undefined,
      mood: todayMood,
      hour,
    }),
    [profile?.healthMode, cyclePhase, todayMood, hour],
  );

  useEffect(() => { applyPalette(palette); }, [palette]);

  return <LunaThemeContext.Provider value={palette}>{children}</LunaThemeContext.Provider>;
}

export function useLunaTheme(): Palette {
  const ctx = useContext(LunaThemeContext);
  if (!ctx) throw new Error("useLunaTheme must be used within LunaThemeProvider");
  return ctx;
}
