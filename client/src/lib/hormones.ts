/**
 * Glitch — hormone & contraception context.
 * Asked only with explicit consent ("prefer not to say" is always fine). Each option changes how Glitch
 * reads wearable data — e.g. the copper IUD doesn't stop ovulation, while the combined pill, implant
 * and injection usually do, so temperature-based ovulation detection is switched off for those.
 */

export type HormoneUse =
  | "combined_pill" | "progestin_pill" | "hormonal_iud" | "copper_iud" | "implant" | "injection" | "patch_ring"
  | "ivf_fertility" | "estrogen_hrt" | "progesterone" | "testosterone";

export interface HormoneOption {
  id: HormoneUse;
  label: string;
  group: "Contraception" | "Fertility" | "Hormone therapy";
  /** Usually prevents ovulation → turn temperature ovulation detection off */
  suppressesOvulation: boolean;
  note: string;
}

export const HORMONE_OPTIONS: HormoneOption[] = [
  { id: "combined_pill", label: "Combined pill", group: "Contraception", suppressesOvulation: true, note: "Usually prevents ovulation, so we track symptoms and recovery instead of ovulation. Bleeds on the break week are withdrawal bleeds." },
  { id: "progestin_pill", label: "Progestin-only pill (mini-pill)", group: "Contraception", suppressesOvulation: true, note: "Often prevents ovulation (depends on type), so we don't rely on temperature-based ovulation detection." },
  { id: "hormonal_iud", label: "Hormonal IUD", group: "Contraception", suppressesOvulation: false, note: "Many people still ovulate with a hormonal IUD, so ovulation detection stays on, though periods may be light or absent." },
  { id: "copper_iud", label: "Copper IUD", group: "Contraception", suppressesOvulation: false, note: "Hormone-free: your natural cycle continues and ovulation detection works normally. Periods can be heavier, so we watch iron." },
  { id: "implant", label: "Implant", group: "Contraception", suppressesOvulation: true, note: "Usually prevents ovulation; bleeding can be irregular. We focus on recovery and symptoms." },
  { id: "injection", label: "Injection (e.g. Depo)", group: "Contraception", suppressesOvulation: true, note: "Prevents ovulation. Long-term use can affect bone density, so weight-bearing exercise and calcium matter." },
  { id: "patch_ring", label: "Patch or ring", group: "Contraception", suppressesOvulation: true, note: "Usually prevents ovulation, similar to the combined pill." },
  { id: "ivf_fertility", label: "IVF / fertility treatment", group: "Fertility", suppressesOvulation: true, note: "Fertility medications drive your hormones, so we pause cycle predictions. Follow your clinic's plan; we'll support sleep, stress and nutrition." },
  { id: "estrogen_hrt", label: "Estrogen (HRT)", group: "Hormone therapy", suppressesOvulation: false, note: "Estrogen therapy often reduces hot flashes and night sweats, so we'll show whether yours are easing." },
  { id: "progesterone", label: "Progesterone / progestogen", group: "Hormone therapy", suppressesOvulation: false, note: "Progesterone can raise body temperature slightly and affect sleep, which we factor into temperature readings." },
  { id: "testosterone", label: "Testosterone", group: "Hormone therapy", suppressesOvulation: false, note: "Testosterone can raise resting heart rate and change cycles; we interpret trends with that in mind." },
];

export interface HormoneContext {
  consented: boolean;
  preferNotToSay?: boolean;
  uses: HormoneUse[];
}

/** Should temperature-based ovulation detection run? */
export function ovulationTrackingAllowed(h: HormoneContext | undefined, legacyHormonalContraception?: boolean): boolean {
  if (legacyHormonalContraception) return false;
  if (!h?.consented || h.preferNotToSay) return true;
  return !h.uses.some((u) => HORMONE_OPTIONS.find((o) => o.id === u)?.suppressesOvulation);
}

export function hormoneNotes(h: HormoneContext | undefined): HormoneOption[] {
  if (!h?.consented || h.preferNotToSay) return [];
  return h.uses.map((u) => HORMONE_OPTIONS.find((o) => o.id === u)!).filter(Boolean);
}

/** Short summary for the AI coach (only when the user consented). */
export function hormoneSummary(h: HormoneContext | undefined): string | null {
  const notes = hormoneNotes(h);
  return notes.length ? notes.map((n) => n.label).join(", ") : null;
}
