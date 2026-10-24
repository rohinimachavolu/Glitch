/**
 * Glitch — everything the Menopause Home shows, in one place.
 */
import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useHealthInsights } from "./useHealthInsights";
import { useMenopauseInsights } from "./useMenopauseInsights";
import { generateDemoBp, generateDemoMoods } from "@/lib/whoop/demoData";
import { sleepFragmentation, mentalHealthCheck, menopauseAlerts, type BpReading, type FragNight, type MindCheck, type MenoAlert } from "@/lib/menopauseSignals";

export interface MenoDashboard {
  bp: BpReading[];
  moods: { at: string; mood: number; label?: string }[];
  frag: FragNight[];
  mind: MindCheck;
  alerts: MenoAlert[];
  demo: boolean;
}

export function useMenopauseDashboard(): MenoDashboard | null {
  const { bpLog, moodLog, appraisalLog, whoop } = useApp();
  const h = useHealthInsights();
  const m = useMenopauseInsights();

  return useMemo(() => {
    if (!m) return null;
    const demo = whoop?.source === "demo";
    // Demo mode keeps its BP history even after the user logs a real reading
    const bp = demo ? [...generateDemoBp(), ...bpLog].sort((a, b) => a.at.localeCompare(b.at)) : bpLog;
    const own = [...moodLog, ...appraisalLog.map((e) => ({ at: e.at, mood: e.input.mood, label: e.stateLabel }))];
    const moods = own.length >= 5 || !demo
      ? own
      : [...generateDemoMoods(h.days, []).map((x) => ({ at: `${x.date}T18:00:00Z`, mood: x.mood })), ...own];
    moods.sort((a, b) => a.at.localeCompare(b.at));
    const frag = sleepFragmentation(h.days);
    const mind = mentalHealthCheck(h.days, moods, bp);
    const alerts = menopauseAlerts({ stage: m.stage, warm: m.warm, frag, flashes: m.flashes, bp, mind });
    return { bp, moods, frag, mind, alerts, demo };
  }, [bpLog, moodLog, appraisalLog, whoop, h.days, m]);
}
