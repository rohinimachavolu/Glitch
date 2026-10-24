/**
 * Glitch — mood analytics combining check-ins with WHOOP physiology and cycle windows.
 */
import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useHealthInsights } from "./useHealthInsights";
import { generateDemoMoods } from "@/lib/whoop/demoData";
import { moodByDay, moodBodyLinks, premenstrualMoodPattern, burnoutRisk, MoodLink, PremenstrualPattern, BurnoutRisk } from "@/lib/mentalHealth";

export interface MindInsights {
  moods: Map<string, number>;
  /** Mood data comes from demo generation, not the user's own check-ins */
  demoMoods: boolean;
  links: MoodLink[];
  premenstrual: PremenstrualPattern | null;
  burnout: BurnoutRisk | null;
}

/** "Oct 24" (legacy log format) → "2026-10-24", assuming the most recent such date. */
function legacyToIso(label: string): string | null {
  const now = new Date();
  const d = new Date(`${label} ${now.getFullYear()}`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > now.getTime() + 86_400_000) d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useMindInsights(): MindInsights {
  const { appraisalLog, wellnessLog, cycleSymptomLog, whoop } = useApp();
  const h = useHealthInsights();

  return useMemo(() => {
    const own: { date: string; mood: number }[] = [
      ...appraisalLog.map((e) => ({ date: e.at.slice(0, 10), mood: e.input.mood })),
      ...wellnessLog.map((e) => ({ date: legacyToIso(e.date) ?? "", mood: e.mood })),
      ...cycleSymptomLog.map((e) => ({ date: legacyToIso(e.date) ?? "", mood: e.mood })),
    ].filter((e) => e.date);

    const useDemo = whoop?.source === "demo" && new Set(own.map((e) => e.date)).size < 14;
    const entries = useDemo
      ? [...generateDemoMoods(h.days, h.cycle?.windows.map((w) => w.start) ?? []), ...own]
      : own;
    const moods = moodByDay(entries);

    return {
      moods,
      demoMoods: useDemo,
      links: h.days.length ? moodBodyLinks(h.days, moods) : [],
      premenstrual: h.cycle ? premenstrualMoodPattern(h.cycle.windows, moods) : null,
      burnout: h.days.length ? burnoutRisk(h.days, moods) : null,
    };
  }, [appraisalLog, wellnessLog, cycleSymptomLog, whoop, h]);
}
