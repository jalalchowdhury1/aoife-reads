import { describe, it, expect } from "vitest";
import { makeRng } from "./rng";

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = makeRng(42),
      b = makeRng(42);
    expect(a.int(1, 100)).toBe(b.int(1, 100));
  });
  it("int respects inclusive bounds", () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const n = r.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
  it("pick returns a member; shuffle preserves members", () => {
    const r = makeRng(1);
    expect([10, 20, 30]).toContain(r.pick([10, 20, 30]));
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});
