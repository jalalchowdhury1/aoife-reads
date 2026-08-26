import { describe, it, expect } from "vitest";
import { flagBlock, flagSession, ensureFlags } from "./quality";
import { summarize } from "./types";
import type { BlockRecord, ItemRecord, SessionRecord } from "./types";

function block(genre: BlockRecord["genre"], mode: BlockRecord["mode"], items: ItemRecord[]): BlockRecord {
  return {
    genre,
    mode,
    startedAt: "2026-08-22T10:00:00.000Z",
    endedAt: "2026-08-22T10:05:00.000Z",
    items,
    summary: summarize(items, mode),
  };
}

describe("flagBlock: format-not-understood", () => {
  it("flags when the first two non-teaching items are both wrong at d <= 2", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 1, points: 0, max: 1, correct: false, ms: 2500, timedOut: false, response: "x" },
      { idx: 1, seed: 2, d: 2, points: 0, max: 1, correct: false, ms: 3000, timedOut: false, response: "y" },
      { idx: 2, seed: 3, d: 1, points: 1, max: 1, correct: true, ms: 2000, timedOut: false, response: "z" },
    ];
    const flags = flagBlock(block("wordSnap", "staircase", items));
    expect(flags.map((f) => f.code)).toContain("format-not-understood");
  });

  it("ignores teaching items when finding the first two", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 1, points: 0, max: 1, correct: false, ms: 2500, timedOut: false, response: "x", teaching: true },
      { idx: 1, seed: 2, d: 1, points: 0, max: 1, correct: false, ms: 3000, timedOut: false, response: "y", teaching: true },
      { idx: 2, seed: 3, d: 3, points: 1, max: 1, correct: true, ms: 2000, timedOut: false, response: "z" },
      { idx: 3, seed: 4, d: 4, points: 1, max: 1, correct: true, ms: 2000, timedOut: false, response: "w" },
    ];
    expect(flagBlock(block("wordSnap", "staircase", items))).toEqual([]);
  });

  it("does not flag wrong items above difficulty 2", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 3, points: 0, max: 1, correct: false, ms: 4000, timedOut: false, response: "x" },
      { idx: 1, seed: 2, d: 4, points: 0, max: 1, correct: false, ms: 4000, timedOut: false, response: "y" },
      { idx: 2, seed: 3, d: 4, points: 1, max: 1, correct: true, ms: 4000, timedOut: false, response: "z" },
    ];
    expect(flagBlock(block("wordSnap", "staircase", items)).map((f) => f.code)).not.toContain("format-not-understood");
  });

  it("flags a 2-item block with zero correct even when both items were teaching items (real incident: Piece Picker/What's Missing)", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 1, points: 0, max: 1, correct: false, ms: 2500, timedOut: false, response: "x", teaching: true },
      { idx: 1, seed: 2, d: 1, points: 0, max: 1, correct: false, ms: 2600, timedOut: false, response: "y", teaching: true },
    ];
    const flags = flagBlock(block("echoWords", "staircase", items));
    expect(flags.map((f) => f.code)).toContain("format-not-understood");
  });

  it("does not flag a normal block with a couple of misses spread through it", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 1, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "a" },
      { idx: 1, seed: 2, d: 2, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "b" },
      { idx: 2, seed: 3, d: 3, points: 0, max: 1, correct: false, ms: 7000, timedOut: false, response: "c" },
      { idx: 3, seed: 4, d: 3, points: 1, max: 1, correct: true, ms: 4000, timedOut: false, response: "d" },
    ];
    expect(flagBlock(block("storyGap", "staircase", items))).toEqual([]);
  });
});

describe("flagBlock: rapid-wrong", () => {
  it("flags when 2+ wrong, non-timed-out answers land under 2s", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 3, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "a" },
      { idx: 1, seed: 2, d: 4, points: 0, max: 1, correct: false, ms: 1500, timedOut: false, response: "b" },
      { idx: 2, seed: 3, d: 4, points: 0, max: 1, correct: false, ms: 1200, timedOut: false, response: "c" },
      { idx: 3, seed: 4, d: 5, points: 1, max: 1, correct: true, ms: 4000, timedOut: false, response: "d" },
    ];
    const flags = flagBlock(block("spellIt", "staircase", items));
    expect(flags.map((f) => f.code)).toContain("rapid-wrong");
  });

  it("does not count a timed-out item even if its recorded ms is small", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 3, points: 0, max: 1, correct: false, ms: 500, timedOut: true, response: null },
      { idx: 1, seed: 2, d: 4, points: 0, max: 1, correct: false, ms: 800, timedOut: true, response: null },
      { idx: 2, seed: 3, d: 4, points: 1, max: 1, correct: true, ms: 4000, timedOut: false, response: "d" },
    ];
    expect(flagBlock(block("spellIt", "staircase", items)).map((f) => f.code)).not.toContain("rapid-wrong");
  });

  it("does not flag a single fast wrong answer (a plausible mis-tap)", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 1, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "a" },
      { idx: 1, seed: 2, d: 2, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "b" },
      { idx: 2, seed: 3, d: 3, points: 0, max: 1, correct: false, ms: 7000, timedOut: false, response: "c" },
    ];
    expect(flagBlock(block("storyGap", "staircase", items))).toEqual([]);
  });
});

describe("flagBlock: mass-timeouts", () => {
  it("flags at >= 50% of attempted with attempted >= 3", () => {
    const items: ItemRecord[] = Array.from({ length: 4 }, (_, i) => ({
      idx: i,
      seed: i,
      d: 3 as const,
      points: i === 0 ? 1 : 0,
      max: 1,
      correct: i === 0,
      ms: i === 0 ? 3000 : 30000,
      timedOut: i !== 0,
      response: i === 0 ? "x" : null,
    }));
    expect(flagBlock(block("soundHunt", "staircase", items)).map((f) => f.code)).toContain("mass-timeouts");
  });

  it("does not flag under the attempted >= 3 floor", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 0, d: 3, points: 0, max: 1, correct: false, ms: 30000, timedOut: true, response: null },
      { idx: 1, seed: 1, d: 3, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "x" },
    ];
    expect(flagBlock(block("soundHunt", "staircase", items)).map((f) => f.code)).not.toContain("mass-timeouts");
  });
});

describe("flagBlock: speed-accuracy", () => {
  it("flags under 70% accuracy with attempted >= 10", () => {
    const items: ItemRecord[] = Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      seed: i,
      d: 1 as const,
      points: i < 7 ? 1 : 0,
      max: 1,
      correct: i < 7,
      ms: 1000,
      timedOut: false,
      response: "x",
    })); // 7/12 = 58.3%
    expect(flagBlock(block("soundHunt", "speedBlock", items)).map((f) => f.code)).toContain("speed-accuracy");
  });

  it("does not flag under the attempted >= 10 floor", () => {
    const items: ItemRecord[] = Array.from({ length: 5 }, (_, i) => ({
      idx: i,
      seed: i,
      d: 1 as const,
      points: i < 1 ? 1 : 0,
      max: 1,
      correct: i < 1,
      ms: 1000,
      timedOut: false,
      response: "x",
    })); // 1/5 = 20%, but attempted < 10
    expect(flagBlock(block("soundHunt", "speedBlock", items)).map((f) => f.code)).not.toContain("speed-accuracy");
  });

  it("does not apply to a staircase block even at low accuracy", () => {
    const items: ItemRecord[] = Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      seed: i,
      d: 1 as const,
      points: i < 3 ? 1 : 0,
      max: 1,
      correct: i < 3,
      ms: 3000,
      timedOut: false,
      response: "x",
    }));
    expect(flagBlock(block("wordSnap", "staircase", items)).map((f) => f.code)).not.toContain("speed-accuracy");
  });
});

describe("flagBlock: abandoned", () => {
  it("flags a block with zero attempts, and nothing else", () => {
    expect(flagBlock(block("wordSnap", "staircase", []))).toEqual([{ code: "abandoned", detail: "No items attempted." }]);
  });
});

describe("flagBlock: clean blocks", () => {
  it("returns no flags for an ordinary well-performed block", () => {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 3, points: 1, max: 1, correct: true, ms: 4000, timedOut: false, response: "a" },
      { idx: 1, seed: 2, d: 4, points: 1, max: 1, correct: true, ms: 5000, timedOut: false, response: "b" },
      { idx: 2, seed: 3, d: 5, points: 0, max: 1, correct: false, ms: 6000, timedOut: false, response: "c" },
    ];
    expect(flagBlock(block("wordSnap", "staircase", items))).toEqual([]);
  });
});

describe("flagSession", () => {
  it("maps flagged block indices to their flags, skipping clean blocks", () => {
    const clean: ItemRecord[] = [
      { idx: 0, seed: 1, d: 3, points: 1, max: 1, correct: true, ms: 4000, timedOut: false, response: "a" },
    ];
    const bad: ItemRecord[] = [
      { idx: 0, seed: 1, d: 1, points: 0, max: 1, correct: false, ms: 2500, timedOut: false, response: "x" },
      { idx: 1, seed: 2, d: 1, points: 0, max: 1, correct: false, ms: 2600, timedOut: false, response: "y" },
    ];
    const s: SessionRecord = {
      id: "01FLAGSESSIONTEST00000001",
      level: 1,
      part: "A",
      startedAt: "2026-08-22T10:00:00.000Z",
      device: { ua: "test", w: 1, h: 1 },
      complete: true,
      appVersion: "0.1.0",
      blocks: [block("wordSnap", "staircase", clean), block("echoWords", "staircase", bad)],
    };
    const result = flagSession(s);
    expect(Object.keys(result)).toEqual(["1"]);
    expect(result[1].map((f) => f.code)).toContain("format-not-understood");
  });
});

describe("ensureFlags", () => {
  const badItems: ItemRecord[] = [
    { idx: 0, seed: 1, d: 1, points: 0, max: 1, correct: false, ms: 2500, timedOut: false, response: "x" },
    { idx: 1, seed: 2, d: 1, points: 0, max: 1, correct: false, ms: 2600, timedOut: false, response: "y" },
  ];

  function session(id: string, blocks: BlockRecord[]): SessionRecord {
    return {
      id,
      level: 1,
      part: "A",
      startedAt: "2026-08-22T10:00:00.000Z",
      device: { ua: "test", w: 1, h: 1 },
      complete: true,
      appVersion: "0.1.0",
      blocks,
    };
  }

  it("backfills flags on a block that lacks them", () => {
    const [filled] = ensureFlags([session("01FLAGBACKFILLTEST0000001", [block("echoWords", "staircase", badItems)])]);
    expect(filled.blocks[0].flags?.map((f) => f.code)).toContain("format-not-understood");
  });

  it("leaves an already-stamped block untouched", () => {
    const stamped: BlockRecord = { ...block("wordSnap", "staircase", []), flags: [] };
    const [filled] = ensureFlags([session("01FLAGBACKFILLTEST0000002", [stamped])]);
    expect(filled.blocks[0].flags).toEqual([]);
  });
});

