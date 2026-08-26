import { describe, it, expect } from "vitest";
import { starsForItem, bonusStar, sessionStars, totalStars, dayStreak, newBests, streakAfter } from "./rewards";
import { summarize } from "./types";
import type { BlockRecord, ItemRecord, SessionRecord } from "./types";

function item(overrides: Partial<ItemRecord> & { idx: number }): ItemRecord {
  return {
    seed: overrides.idx, d: 3, points: 1, max: 1, correct: true,
    ms: 2000, timedOut: false, response: "a",
    ...overrides,
  };
}

function block(genre: BlockRecord["genre"], mode: BlockRecord["mode"], items: ItemRecord[], overrides?: Partial<BlockRecord>): BlockRecord {
  return {
    genre, mode,
    startedAt: "2026-08-22T10:00:00.000Z",
    endedAt: "2026-08-22T10:05:00.000Z",
    items,
    summary: summarize(items, mode),
    ...overrides,
  };
}

function session(overrides: Partial<SessionRecord> & { id: string; blocks: BlockRecord[] }): SessionRecord {
  return {
    level: 1, part: "A", startedAt: "2026-08-22T10:00:00.000Z",
    device: { ua: "test", w: 1, h: 1 }, complete: true, appVersion: "0.1.0",
    ...overrides,
  };
}

describe("starsForItem", () => {
  it("gives 1 star for a plain correct staircase item", () => {
    expect(starsForItem(item({ idx: 0, d: 3, correct: true }), "staircase")).toBe(1);
  });

  it("gives 0 for a miss", () => {
    expect(starsForItem(item({ idx: 0, correct: false, points: 0 }), "staircase")).toBe(0);
  });

  it("gives 0 for a timeout", () => {
    expect(starsForItem(item({ idx: 0, correct: false, points: 0, timedOut: true, response: null }), "staircase")).toBe(0);
  });

  it("gives +1 for difficulty >= 7", () => {
    expect(starsForItem(item({ idx: 0, d: 7, correct: true }), "staircase")).toBe(2);
    expect(starsForItem(item({ idx: 0, d: 10, correct: true }), "staircase")).toBe(2);
    expect(starsForItem(item({ idx: 0, d: 6, correct: true }), "staircase")).toBe(1);
  });

  it("gives +1 for fast", () => {
    expect(starsForItem(item({ idx: 0, d: 3, correct: true, fast: true }), "staircase")).toBe(2);
  });

  it("stacks difficulty and fast bonuses", () => {
    expect(starsForItem(item({ idx: 0, d: 8, correct: true, fast: true }), "staircase")).toBe(3);
  });

  it("speedBlock: 1 star per correct, 0 otherwise, regardless of d/fast", () => {
    expect(starsForItem(item({ idx: 0, d: 9, correct: true, fast: true }), "speedBlock")).toBe(1);
    expect(starsForItem(item({ idx: 0, correct: false, points: 0 }), "speedBlock")).toBe(0);
  });
});

describe("bonusStar", () => {
  it("is deterministic for a given (seed, idx)", () => {
    expect(bonusStar(123, 5)).toBe(bonusStar(123, 5));
  });

  it("never fires on two consecutive indices for the same seed", () => {
    const seed = 777;
    let prev = false;
    for (let idx = 0; idx < 2000; idx++) {
      const cur = bonusStar(seed, idx);
      if (cur) expect(prev, `bonusStar fired twice in a row at idx ${idx}`).toBe(false);
      prev = cur;
    }
  });

  it("fires roughly 1 in 6 times over a large sample (loose bound)", () => {
    const seed = 42;
    let count = 0;
    const n = 6000;
    for (let idx = 0; idx < n; idx++) if (bonusStar(seed, idx)) count++;
    const rate = count / n;
    expect(rate).toBeGreaterThan(0.08);
    expect(rate).toBeLessThan(0.22);
  });

  it("varies by seed (not the same sequence for every seed)", () => {
    const a = Array.from({ length: 50 }, (_, i) => bonusStar(1, i));
    const b = Array.from({ length: 50 }, (_, i) => bonusStar(2, i));
    expect(a).not.toEqual(b);
  });
});

describe("sessionStars / totalStars", () => {
  it("sums explicit item.stars when present", () => {
    const items = [item({ idx: 0, stars: 3 }), item({ idx: 1, stars: 1 })];
    const s = session({ id: "s1", blocks: [block("wordSnap", "staircase", items)] });
    expect(sessionStars(s)).toBe(4);
  });

  it("falls back to starsForItem when item.stars is undefined", () => {
    const items = [
      item({ idx: 0, d: 8, correct: true, fast: true }), // 3
      item({ idx: 1, correct: false, points: 0 }), // 0
    ];
    const s = session({ id: "s2", blocks: [block("wordSnap", "staircase", items)] });
    expect(sessionStars(s)).toBe(3);
  });

  it("mixes explicit and fallback stars across blocks", () => {
    const withStars = [item({ idx: 0, stars: 5 })];
    const withoutStars = [item({ idx: 0, d: 3, correct: true })]; // 1
    const s = session({
      id: "s3",
      blocks: [block("wordSnap", "staircase", withStars), block("storyGap", "staircase", withoutStars)],
    });
    expect(sessionStars(s)).toBe(6);
  });

  it("totalStars sums sessionStars across sessions", () => {
    const s1 = session({ id: "s4", blocks: [block("wordSnap", "staircase", [item({ idx: 0, stars: 2 })])] });
    const s2 = session({ id: "s5", blocks: [block("wordSnap", "staircase", [item({ idx: 0, stars: 3 })])] });
    expect(totalStars([s1, s2])).toBe(5);
  });
});

describe("dayStreak", () => {
  function completeAt(id: string, startedAt: string): SessionRecord {
    return session({ id, startedAt, blocks: [block("wordSnap", "staircase", [item({ idx: 0 })])] });
  }

  it("is 0 with no sessions", () => {
    expect(dayStreak([], "2026-08-22")).toBe(0);
  });

  it("counts a single session today as a streak of 1", () => {
    const sessions = [completeAt("a", "2026-08-22T15:00:00.000Z")];
    expect(dayStreak(sessions, "2026-08-22")).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const sessions = [
      completeAt("a", "2026-08-20T15:00:00.000Z"),
      completeAt("b", "2026-08-21T15:00:00.000Z"),
      completeAt("c", "2026-08-22T15:00:00.000Z"),
    ];
    expect(dayStreak(sessions, "2026-08-22")).toBe(3);
  });

  it("breaks on a gap", () => {
    const sessions = [
      completeAt("a", "2026-08-19T15:00:00.000Z"),
      // gap on the 20th
      completeAt("b", "2026-08-21T15:00:00.000Z"),
      completeAt("c", "2026-08-22T15:00:00.000Z"),
    ];
    expect(dayStreak(sessions, "2026-08-22")).toBe(2);
  });

  it("counts through yesterday when nothing happened today yet", () => {
    const sessions = [
      completeAt("a", "2026-08-20T15:00:00.000Z"),
      completeAt("b", "2026-08-21T15:00:00.000Z"),
    ];
    expect(dayStreak(sessions, "2026-08-22")).toBe(2);
  });

  it("is 0 when neither today nor yesterday has a session", () => {
    const sessions = [completeAt("a", "2026-08-18T15:00:00.000Z")];
    expect(dayStreak(sessions, "2026-08-22")).toBe(0);
  });

  it("ignores incomplete sessions", () => {
    const incomplete: SessionRecord = { ...completeAt("a", "2026-08-22T15:00:00.000Z"), complete: false };
    expect(dayStreak([incomplete], "2026-08-22")).toBe(0);
  });

  it("crosses a UTC midnight boundary correctly via America/New_York", () => {
    // 2026-08-23T03:30Z is 2026-08-22T23:30-04:00 (EDT) -- still Aug 22 in New York.
    const sessions = [completeAt("a", "2026-08-23T03:30:00.000Z")];
    expect(dayStreak(sessions, "2026-08-22")).toBe(1);
    // From "today" = Aug 23's perspective, that same session lands on Aug 22 in
    // New York (yesterday), and the "yesterday if none today" rule still
    // counts it: the streak isn't reset just because she hasn't played yet today.
    expect(dayStreak(sessions, "2026-08-23")).toBe(1);
    // But if today itself already had a session and yesterday (by the NY
    // calendar) did not, the boundary session must not be double counted.
    const withToday = [...sessions, completeAt("b", "2026-08-24T14:00:00.000Z")]; // Aug 24 NY
    expect(dayStreak(withToday, "2026-08-24")).toBe(1);
  });

  it("builds a real multi-day streak across a UTC midnight boundary", () => {
    const sessions = [
      completeAt("a", "2026-08-21T14:00:00.000Z"), // Aug 21 NY
      completeAt("b", "2026-08-23T03:30:00.000Z"), // Aug 22 NY (late UTC evening)
      completeAt("c", "2026-08-23T14:00:00.000Z"), // Aug 23 NY
    ];
    expect(dayStreak(sessions, "2026-08-23")).toBe(3);
  });
});

describe("newBests", () => {
  it("reports a genre whose ceiling beats the earlier best", () => {
    const earlier = [session({ id: "e1", blocks: [block("wordSnap", "staircase", [item({ idx: 0, d: 5 })], { summary: summarize([item({ idx: 0, d: 5 })], "staircase") })] })];
    const current = session({ id: "c1", blocks: [block("wordSnap", "staircase", [item({ idx: 0, d: 7 })])] });
    const result = newBests(current, earlier);
    expect(result).toEqual([{ genre: "wordSnap", ceiling: 7, previous: 5 }]);
  });

  it("returns previous: null for a genre never seen before", () => {
    const current = session({ id: "c2", blocks: [block("soundHunt", "staircase", [item({ idx: 0, d: 4 })])] });
    const result = newBests(current, []);
    expect(result).toEqual([{ genre: "soundHunt", ceiling: 4, previous: null }]);
  });

  it("does not report a genre that did not beat its earlier best", () => {
    const earlier = [session({ id: "e1", blocks: [block("wordSnap", "staircase", [item({ idx: 0, d: 8 })])] })];
    const current = session({ id: "c3", blocks: [block("wordSnap", "staircase", [item({ idx: 0, d: 6 })])] });
    expect(newBests(current, earlier)).toEqual([]);
  });

  it("ignores speedBlock genres (no ceiling)", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ idx: i }));
    const current = session({ id: "c4", blocks: [block("soundHunt", "speedBlock", items)] });
    expect(newBests(current, [])).toEqual([]);
  });

  it("takes the best ceiling within the session when a genre repeats (remedial repeat block)", () => {
    // startedAt is deliberately after the figureWeights scale cutover
    // (2026-08-23T14:00:00Z, lib/engine/scale.ts) so this test isn't also
    // exercising remapSession's old-scale remap -- that's covered separately.
    const current = session({
      id: "c5",
      startedAt: "2026-08-24T10:00:00.000Z",
      blocks: [
        block("storyGap", "staircase", [item({ idx: 0, d: 4 })], { startedAt: "2026-08-24T10:00:00.000Z", endedAt: "2026-08-24T10:01:00.000Z" }),
        block("storyGap", "staircase", [item({ idx: 0, d: 6 })], { startedAt: "2026-08-24T10:02:00.000Z", endedAt: "2026-08-24T10:03:00.000Z" }),
      ],
    });
    expect(newBests(current, [])).toEqual([{ genre: "storyGap", ceiling: 6, previous: null }]);
  });

  it("compares ceilings directly while the scale-history table is empty", () => {
    const items = [{ idx: 0, seed: 1, d: 5 as const, points: 1, max: 1, correct: true, ms: 1000, timedOut: false, response: 1 }];
    const earlier = session({ id: "s1", blocks: [block("storyGap", "staircase", items)] });
    const again = session({ id: "s2", startedAt: "2026-08-27T10:00:00.000Z", blocks: [block("storyGap", "staircase", items)] });
    expect(newBests(again, [earlier])).toEqual([]); // same ceiling, no new best
    expect(newBests(earlier, [])).toEqual([{ genre: "storyGap", ceiling: 5, previous: null }]);
  });
});

describe("streakAfter", () => {
  it("is 0 for an empty list", () => {
    expect(streakAfter([])).toBe(0);
  });

  it("counts consecutive correct items at the end", () => {
    const records = [
      item({ idx: 0, correct: false, points: 0 }),
      item({ idx: 1, correct: true }),
      item({ idx: 2, correct: true }),
      item({ idx: 3, correct: true }),
    ];
    expect(streakAfter(records)).toBe(3);
  });

  it("is 0 when the last item was a miss", () => {
    const records = [item({ idx: 0, correct: true }), item({ idx: 1, correct: false, points: 0 })];
    expect(streakAfter(records)).toBe(0);
  });

  it("counts every item when all are correct", () => {
    const records = [item({ idx: 0 }), item({ idx: 1 }), item({ idx: 2 })];
    expect(streakAfter(records)).toBe(3);
  });
});
