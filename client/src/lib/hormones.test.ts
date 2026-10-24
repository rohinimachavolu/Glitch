import { describe, expect, it } from "vitest";
import { ovulationTrackingAllowed, hormoneSummary } from "./hormones";

describe("hormone context", () => {
  it("keeps ovulation detection on for the copper IUD and hormonal IUD", () => {
    expect(ovulationTrackingAllowed({ consented: true, uses: ["copper_iud"] })).toBe(true);
    expect(ovulationTrackingAllowed({ consented: true, uses: ["hormonal_iud"] })).toBe(true);
  });
  it("turns it off for the pill, implant and IVF", () => {
    expect(ovulationTrackingAllowed({ consented: true, uses: ["combined_pill"] })).toBe(false);
    expect(ovulationTrackingAllowed({ consented: true, uses: ["implant"] })).toBe(false);
    expect(ovulationTrackingAllowed({ consented: true, uses: ["ivf_fertility"] })).toBe(false);
  });
  it("respects 'prefer not to say' and shares nothing with the coach", () => {
    const h = { consented: false, preferNotToSay: true, uses: [] };
    expect(ovulationTrackingAllowed(h)).toBe(true);
    expect(hormoneSummary(h)).toBeNull();
  });
  it("honours the legacy contraception flag", () => {
    expect(ovulationTrackingAllowed(undefined, true)).toBe(false);
  });
});
