import { describe, expect, it } from "vitest";
import { practiceQueue } from "./practice";
import type { BlockRecord, ItemRecord, SessionRecord } from "./types";

function item(over: Partial<ItemRecord>): ItemRecord {
  return {
    idx: 0, seed: 1, d: 3, points: 0, max: 1, correct: false,
    ms: 1000, timedOut: false, response: null, ...over,
  };
}

function block(genre: BlockRecord["genre"], items: ItemRecord[]): BlockRecord {
  return {
    genre, mode: "staircase", startedAt: "2026-08-27T10:00:00Z", endedAt: "2026-08-27T10:05:00Z",
    items, summary: { attempted: items.length, correct: 0, points: 0, max: 0, ceiling: null, medianMs: 0, timeouts: 0 },
  };
}

function session(over: Partial<SessionRecord> & { blocks: BlockRecord[] }): SessionRecord {
  return {
    id: "S", level: 1, part: "A", startedAt: "2026-08-27T10:00:00Z",
    device: { ua: "t", w: 0, h: 0 }, complete: true, appVersion: "t", ...over,
  };
}

describe("practiceQueue (ported decision #23)", () => {
  it("queues counted misses from solo genres, replayable by (genre, seed, d)", () => {
    const s = session({ blocks: [block("numberCrunch", [
      item({ seed: 11, d: 4 }),
      item({ idx: 1, seed: 12, d: 5, timedOut: true }),
      item({ idx: 2, seed: 13, d: 4, correct: true, points: 1, max: 1 }),
    ])] });
    expect(practiceQueue([s])).toEqual([
      { genre: "numberCrunch", seed: 11, d: 4 },
      { genre: "numberCrunch", seed: 12, d: 5 },
    ]);
  });

  it("excludes EXAMINER genres (a solo child cannot replay a parent-scored administration)", () => {
    const s = session({ blocks: [
      block("readAloud", [item({ seed: 1 })]),
      block("mathOnPaper", [item({ seed: 2 })]),
      block("mathOutLoud", [item({ seed: 3 })]),
      block("storyProblems", [item({ seed: 4 })]),
    ] });
    expect(practiceQueue([s])).toEqual([{ genre: "storyProblems", seed: 4, d: 3 }]);
  });

  it("excludes bailed and teaching items", () => {
    const s = session({ blocks: [block("spellIt", [
      item({ seed: 1, bailed: true }),
      item({ idx: 1, seed: 2, teaching: true }),
      item({ idx: 2, seed: 3 }),
    ])] });
    expect(practiceQueue([s])).toEqual([{ genre: "spellIt", seed: 3, d: 3 }]);
  });

  it("clears an item once she answers it correctly in a later practice session, and practice misses never seed the queue", () => {
    const real = session({ blocks: [block("wordSnap", [item({ seed: 9, d: 6 })])] });
    const practice = session({
      id: "P1", level: 0, part: "P", practice: true, startedAt: "2026-08-28T09:00:00Z",
      blocks: [block("wordSnap", [
        item({ seed: 9, d: 6, correct: true, points: 1, max: 1 }),
        item({ idx: 1, seed: 77, d: 6 }), // a miss during practice
      ])],
    });
    expect(practiceQueue([real])).toHaveLength(1);
    expect(practiceQueue([real, practice])).toHaveLength(0);
  });

  it("dedupes across sessions, orders newest-first, and caps", () => {
    const older = session({ id: "S1", startedAt: "2026-08-20T10:00:00Z", blocks: [block("soundHunt", [item({ seed: 5, d: 2 })])] });
    const newer = session({ id: "S2", startedAt: "2026-08-27T10:00:00Z", blocks: [
      block("soundHunt", [item({ seed: 5, d: 2 })]),
      block("storyGap", [item({ seed: 6, d: 4 })]),
    ] });
    expect(practiceQueue([older, newer])).toEqual([
      { genre: "soundHunt", seed: 5, d: 2 },
      { genre: "storyGap", seed: 6, d: 4 },
    ]);
    const many = session({ blocks: [block("numberCrunch", Array.from({ length: 40 }, (_, i) => item({ idx: i, seed: 100 + i })))] });
    expect(practiceQueue([many])).toHaveLength(30);
  });
});
