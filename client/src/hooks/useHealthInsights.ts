/**
 * Glitch — derived health insights from WHOOP data + profile.
 * One memoised place for every page (Dashboard, Cycle, Progress) to read the same numbers.
 */
import { useMemo } from "react";
import { useApp, tracksOvulation, CyclePhase } from "@/contexts/AppContext";
import { toDaily, DailyPhysiology } from "@/lib/whoop/types";
import {
  cycleWindows, detectOvulationHistory, phaseMap, cycleAdjustedRecovery, stressScore, energyScore,
  estimateVo2max, trend, zone2MinutesByWeek, isoDay,
  OvulationResult, CycleWindow, AdjustedRecovery, StressScore, EnergyScore, Vo2Estimate, Trend,
} from "@/lib/healthMetrics";

export interface HealthInsights {
  connected: boolean;
  source: "demo" | "live" | null;
  days: DailyPhysiology[];
  today: DailyPhysiology | undefined;
  /** Menstrual cycle analysis — null when the user isn't cycling or is on hormonal contraception */
  cycle: {
    windows: CycleWindow[];
    ovulations: OvulationResult[];
    phases: Map<string, CyclePhase>;
    /** Phase today from detected ovulation (falls back to calendar estimate) */
    currentPhase: CyclePhase | null;
    ovulatoryCycles: number;
    completeCycles: number;
  } | null;
  recovery: AdjustedRecovery | null;
  stress: StressScore | null;
  energy: EnergyScore | null;
  vo2: Vo2Estimate | null;
  vo2Start: Vo2Estimate | null;
  trends: { restingHr: Trend | null; hrv: Trend | null; recovery: Trend | null; sleepPerformance: Trend | null };
  zone2: { weekStart: string; minutes: number }[];
}

export function useHealthInsights(): HealthInsights {
  const { whoop, profile, periodLog } = useApp();

  return useMemo(() => {
    const empty: HealthInsights = {
      connected: false, source: null, days: [], today: undefined, cycle: null, recovery: null, stress: null,
      energy: null, vo2: null, vo2Start: null,
      trends: { restingHr: null, hrv: null, recovery: null, sleepPerformance: null }, zone2: [],
    };
    if (!whoop || !profile) return empty;

    const days = toDaily(whoop);
    const today = days[days.length - 1];
    const wh = profile.womensHealth;

    let cycle: HealthInsights["cycle"] = null;
    if (tracksOvulation(profile) && wh) {
      const starts = [wh.lastPeriodDate, ...periodLog.map((p) => p.startDate)];
      const windows = cycleWindows(starts, wh.cycleLength, today?.date ?? isoDay(new Date()), days.length);
      const ovulations = detectOvulationHistory(days, windows);
      const phases = phaseMap(days, windows, ovulations, wh.cycleLength);
      const complete = ovulations.filter((_, i) => windows[i].complete);
      cycle = {
        windows, ovulations, phases,
        currentPhase: today ? phases.get(today.date) ?? null : null,
        ovulatoryCycles: complete.filter((o) => o.status === "confirmed").length,
        completeCycles: complete.filter((o) => o.status !== "insufficient_data").length,
      };
    }

    const maxHr = whoop.body?.max_heart_rate;
    return {
      connected: true,
      source: whoop.source,
      days,
      today,
      cycle,
      recovery: cycleAdjustedRecovery(days, cycle?.phases ?? null),
      stress: stressScore(days, cycle?.phases ?? null),
      energy: energyScore(today),
      vo2: estimateVo2max(days, profile.age, profile.biologicalSex, maxHr),
      vo2Start: estimateVo2max(days.slice(0, 7), profile.age, profile.biologicalSex, maxHr),
      trends: {
        restingHr: trend(days, "restingHr"),
        hrv: trend(days, "hrv"),
        recovery: trend(days, "recovery"),
        sleepPerformance: trend(days, "sleepPerformance"),
      },
      zone2: zone2MinutesByWeek(whoop.workouts),
    };
  }, [whoop, profile, periodLog]);
}
