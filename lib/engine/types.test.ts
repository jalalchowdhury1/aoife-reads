import { describe, it, expect } from "vitest";
import { summarize } from "./types";
import type { ItemRecord } from "./types";

describe("summarize", () => {
  const items: ItemRecord[] = [
    { idx: 0, seed: 1, d: 2, points: 1, max: 1, correct: true, ms: 800, timedOut: false, response: "a" },
    { idx: 1, seed: 2, d: 3, points: 0, max: 1, correct: false, ms: 1200, timedOut: false, response: "b" },
    { idx: 2, seed: 3, d: 3, points: 0, max: 1, correct: false, ms: 1200, timedOut: true, response: null },
  ];

  it("summarizes a staircase block", () => {
    const s = summarize(items, "staircase");
    expect(s).toEqual({ attempted: 3, correct: 1, points: 1, max: 3, ceiling: 2, medianMs: 1200, timeouts: 1 });
  });

  it("adds incorrect for a speedBlock", () => {
    const s = summarize(items, "speedBlock");
    expect(s.incorrect).toBe(2);
    expect(s.ceiling).toBe(null);
  });
});
