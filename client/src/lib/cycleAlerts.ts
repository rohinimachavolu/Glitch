/**
 * Glitch — alerts for people who still have periods (regular cycles or perimenopause).
 * Same shape as menopause alerts so the Home screen can show them together.
 */
import type { MenoAlert } from "./menopauseSignals";
import type { OvulationResult, CycleWindow } from "./healthMetrics";

const DAY = 86_400_000;

export function cycleAlerts(i: {
  lastPeriodDate: string;
  cycleLength: number;
  periodStarts: string[];
  windows?: CycleWindow[];
  ovulations?: OvulationResult[];
  premenstrualDip?: { recurring: boolean; avgDip: number } | null;
  age: number;
  now?: Date;
}): MenoAlert[] {
  const now = i.now ?? new Date();
  const out: MenoAlert[] = [];
  if (!i.lastPeriodDate) return out;

  // Late period
  const daysSince = Math.floor((now.getTime() - Date.parse(`${i.lastPeriodDate}T00:00:00Z`)) / DAY);
  const late = daysSince - i.cycleLength;
  if (late >= 7) {
    out.push({ id: `late-${i.lastPeriodDate}`, level: late >= 30 ? "watch" : "info", icon: "📅", title: `Period ${late} days late`,
      detail: i.age >= 40 ? "Skipped or late periods are common in perimenopause. If you could be pregnant, take a test. Log your next period when it comes." : "Stress, illness, travel or training can delay a period. If you could be pregnant, take a test." });
  }

  // Cycle lengths shifting by 7+ days (STRAW+10 early menopause transition)
  const starts = Array.from(new Set([...i.periodStarts, i.lastPeriodDate])).filter(Boolean).sort();
  if (starts.length >= 3) {
    const lengths = starts.slice(1).map((s, k) => Math.round((Date.parse(s) - Date.parse(starts[k])) / DAY));
    const swings = lengths.slice(1).filter((l, k) => Math.abs(l - lengths[k]) >= 7).length;
    if (swings >= 1) out.push({ id: `irregular-${starts[starts.length - 1]}`, level: "info", icon: "🌗", title: "Cycle length is shifting",
      detail: `Recent cycles: ${lengths.join(", ")} days. Changes of 7+ days are an early sign of perimenopause${i.age < 40 ? " (or stress, PCOS or thyroid changes, so worth mentioning to a doctor)" : ""}.` });
  }

  // No ovulation detected in the last complete cycle
  if (i.windows && i.ovulations) {
    const lastComplete = i.windows.map((w, k) => (w.complete ? k : -1)).filter((k) => k >= 0).pop();
    if (lastComplete != null && i.ovulations[lastComplete]?.status === "not_detected") {
      out.push({ id: `anov-${i.windows[lastComplete].start}`, level: "info", icon: "🥚", title: "No ovulation detected last cycle",
        detail: "Your temperature didn't show the usual rise after ovulation. One cycle like this is common; a pattern is worth discussing with a clinician, especially with PCOS or when trying to conceive." });
    }
  }

  // Recurring premenstrual mood dip
  if (i.premenstrualDip?.recurring) {
    out.push({ id: "pms-mood", level: "watch", icon: "🌖", title: "Mood dips before your period",
      detail: `About ${i.premenstrualDip.avgDip} points lower in the week before your period, cycle after cycle. Plan lighter days then; if it disrupts life, ask a clinician about PMDD.` });
  }

  const rank = { urgent: 0, watch: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
