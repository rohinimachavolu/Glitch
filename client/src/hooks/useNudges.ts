/** Glitch — today's proactive nudges (see lib/nudges.ts). */
import { useMemo } from "react";
import { useApp, allowsDeficit } from "@/contexts/AppContext";
import { computeNudges, type Nudge } from "@/lib/nudges";

export function useNudges(): Nudge[] {
  const { profile, meals, nutritionGoals, supplements, supplementTaken } = useApp();
  return useMemo(() => {
    if (!profile) return [];
    return computeNudges({
      now: new Date(),
      meals,
      calorieTarget: nutritionGoals?.calorieTarget,
      proteinTarget: nutritionGoals?.proteinTarget,
      sugarLimit: profile.biologicalSex === "male" ? 36 : 25,
      supplements,
      taken: supplementTaken,
      allowDeficitTalk: allowsDeficit(profile),
    });
  }, [profile, meals, nutritionGoals, supplements, supplementTaken]);
}
