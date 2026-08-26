import { describe, it, expect } from "vitest";
import { SCALE_CHANGES, remapCeiling } from "./scale";

// This app's ramps are original, so the scale-history table starts empty.
// The machinery stays (it saved aoife-puzzles three times): when a ramp is
// rebuilt, add a SCALE_CHANGES entry and real remap tests alongside it.
describe("difficulty scale history", () => {
  it("starts with no ramp rebuilds", () => {
    expect(SCALE_CHANGES).toEqual([]);
  });

  it("passes ceilings through unchanged while the table is empty", () => {
    expect(remapCeiling("wordSnap", "2026-08-26T12:00:00Z", 4)).toBe(4);
    expect(remapCeiling("spellIt", "2026-08-26T12:00:00Z", null)).toBe(null);
  });
});
