import { describe, it, expect } from "vitest";
import { computeInsights } from "./insights";
import { summarize } from "./types";
import type { BlockRecord, ItemRecord, SessionRecord, Difficulty } from "./types";
import type { QualityFlag } from "./quality";
import { GENRE_LIST } from "../genres";
import { STORY_GAP_BANK } from "../genres/storyGap";
import { storyGap } from "../genres/storyGap";

function mkItem(over: Partial<ItemRecord> & { idx: number; d: Difficulty }): ItemRecord {
  return {
    seed: over.idx + 1, points: over.correct ? 1 : 0, max: 1, correct: false,
    ms: 5000, timedOut: false, response: 0, ...over,
  } as ItemRecord;
}

function mkBlock(genre: BlockRecord["genre"], mode: BlockRecord["mode"], items: ItemRecord[], over?: Partial<BlockRecord>): BlockRecord {
  return {
    genre, mode, startedAt: "2026-08-20T14:00:00.000Z", endedAt: "2026-08-20T14:05:00.000Z",
    items, summary: summarize(items, mode), ...over,
  };
}

function mkSession(over: Partial<SessionRecord> & { id: string; blocks: BlockRecord[] }): SessionRecord {
  return {
    level: 1, part: "A", startedAt: "2026-08-20T14:00:00.000Z", endedAt: "2026-08-20T15:00:00.000Z",
    device: { ua: "t", w: 1, h: 1 }, complete: true, appVersion: "0.1.0", ...over,
  };
}

const NOT_UNDERSTOOD_FLAG: QualityFlag = {
  code: "format-not-understood",
  detail: "First two items missed at difficulty <= 2 - the format may not have been understood.",
};

// Session 1 (2026-08-20): storyGap mastered-d5/struggled-d6/bailed-d7, an
// excluded soundHunt block, one missed storyGap bank item (for herPick),
// and a wordSnap ceiling of 3 (for the deltas test).
const storyGapBlock = mkBlock("storyGap", "staircase", [
  mkItem({ idx: 0, d: 5, correct: true }),
  mkItem({ idx: 1, d: 5, correct: true }),
  mkItem({ idx: 2, d: 6, correct: false }),
  mkItem({ idx: 3, d: 6, correct: false }),
  mkItem({ idx: 4, d: 7, correct: false, bailed: true }),
], { startedAt: "2026-08-20T14:00:00.000Z", endedAt: "2026-08-20T14:03:00.000Z" });

const excludedSoundHuntBlock = mkBlock("soundHunt", "staircase", [
  mkItem({ idx: 0, d: 1, correct: false }),
  mkItem({ idx: 1, d: 1, correct: false }),
  mkItem({ idx: 2, d: 3, correct: true }),
], { startedAt: "2026-08-20T14:10:00.000Z", endedAt: "2026-08-20T14:13:00.000Z", flags: [NOT_UNDERSTOOD_FLAG] });

// A real storyGap bank item, missed: herPick must regenerate from the real
// generate() so the recorded response index resolves to the option she saw.
const sgBank = STORY_GAP_BANK[0];
const sgItem = storyGap.generate(7, sgBank.d, undefined) as { bankId?: string; options: { text: string; correct: boolean }[]; answer: number };
const wrongIdx = sgItem.options.findIndex((o) => !o.correct);
const missedBankBlock = mkBlock("storyGap", "staircase", [
  mkItem({ idx: 0, seed: 7, d: sgBank.d, correct: false, points: 0, max: 1, response: wrongIdx, bankId: sgItem.bankId }),
], { startedAt: "2026-08-20T14:30:00.000Z", endedAt: "2026-08-20T14:31:00.000Z" });

const wordSnapD3 = mkBlock("wordSnap", "staircase", [mkItem({ idx: 0, d: 3, correct: true })], {
  startedAt: "2026-08-20T14:50:00.000Z", endedAt: "2026-08-20T14:51:00.000Z",
});

const session1 = mkSession({
  id: "S1", startedAt: "2026-08-20T14:00:00.000Z", endedAt: "2026-08-20T15:02:00.000Z",
  blocks: [storyGapBlock, excludedSoundHuntBlock, missedBankBlock, wordSnapD3],
});

// Session 2 (2026-08-21): storyGap ceiling improves 5 -> 8.
const session2 = mkSession({
  id: "S2", startedAt: "2026-08-21T14:00:00.000Z", endedAt: "2026-08-21T14:05:00.000Z",
  blocks: [mkBlock("storyGap", "staircase", [mkItem({ idx: 0, d: 8, correct: true })], {
    startedAt: "2026-08-21T14:00:00.000Z", endedAt: "2026-08-21T14:02:00.000Z",
  })],
});

// Session 3 (2026-08-22): wordSnap ceiling improves 3 -> 6 (most recent).
const session3 = mkSession({
  id: "S3", startedAt: "2026-08-22T14:00:00.000Z", endedAt: "2026-08-22T14:05:00.000Z",
  blocks: [mkBlock("wordSnap", "staircase", [mkItem({ idx: 0, d: 6, correct: true })], {
    startedAt: "2026-08-22T14:00:00.000Z", endedAt: "2026-08-22T14:02:00.000Z",
  })],
});

// Session 4 (2026-08-19T02:30Z == 2026-08-18 22:30 EDT): UTC-midnight bucketing.
const session4 = mkSession({
  id: "S4", startedAt: "2026-08-19T02:30:00.000Z", endedAt: "2026-08-19T02:36:00.000Z",
  blocks: [mkBlock("spellIt", "staircase", [mkItem({ idx: 0, d: 1, correct: true })], {
    startedAt: "2026-08-19T02:30:00.000Z", endedAt: "2026-08-19T02:35:00.000Z",
  })],
});

const allSessions = [session1, session2, session3, session4];

describe("computeInsights", () => {
  const insights = computeInsights(allSessions);
  const sgSkill = insights.skills.find((s) => s.genre === "storyGap")!;
  const shSkill = insights.skills.find((s) => s.genre === "soundHunt")!;

  it("marks a difficulty mastered at >=2 non-teaching correct", () => {
    expect(sgSkill.perDifficulty.find((p) => p.d === 5)!.mastered).toBe(true);
  });

  it("marks a difficulty struggled at 0 correct across >=2 attempts", () => {
    const d6 = sgSkill.perDifficulty.find((p) => p.d === 6)!;
    expect(d6.attempts).toBe(2);
    expect(d6.correct).toBe(0);
  });

  it("counts a bailed item in bails but never as a struggled attempt", () => {
    expect(sgSkill.bails).toBe(1);
  });

  it("excludes a flagged block from ceiling without dropping its items", () => {
    expect(shSkill.ceiling).toBe(null); // the d3 win sat in an excluded block
    expect(shSkill.excludedBlocks).toBe(1);
    expect(shSkill.items.length).toBe(3); // items still visible in the log
  });

  it("resolves a missed bank item's herPick via a real generate", () => {
    expect(sgSkill.missedBankItems.length).toBe(1);
    expect(sgSkill.missedBankItems[0].bankId).toBe(sgItem.bankId);
    expect(sgSkill.missedBankItems[0].herPick).not.toBeNull();
  });

  it("orders ceiling-change deltas most-recent-first across genres", () => {
    const relevant = insights.deltas.filter((d) => d.genre === "storyGap" || d.genre === "wordSnap");
    expect(relevant.map((d) => [d.genre, d.from, d.to])).toEqual([
      ["wordSnap", 3, 6],
      ["storyGap", 5, 8],
      ["wordSnap", null, 3],
      ["storyGap", null, 5],
    ]);
    for (let i = 1; i < insights.deltas.length; i++) {
      expect(insights.deltas[i - 1].when >= insights.deltas[i].when).toBe(true);
    }
  });

  it("buckets engagement by her America/New_York calendar date, not UTC", () => {
    const aug18 = insights.engagement.byDate.find((d) => d.date === "2026-08-18");
    expect(aug18).toBeDefined();
    expect(insights.engagement.byDate.find((d) => d.date === "2026-08-19")).toBeUndefined();
  });

  it("derives dayStreakEnd from the data, not the wall clock", () => {
    expect(insights.totals.dayStreakEnd).toBe("2026-08-22");
  });

  it("is deterministic (no Date.now, no wall-clock dependence)", () => {
    expect(JSON.stringify(computeInsights(allSessions))).toBe(JSON.stringify(insights));
  });

  it("lists every active genre in GENRE_LIST order", () => {
    expect(insights.skills.map((s) => s.genre)).toEqual([...GENRE_LIST]);
  });

  it("rolls domains and bundles up via computeProfile", () => {
    expect(insights.domains.map((d) => d.domain)).toEqual(["DEC", "CMP", "SPL"]);
  });

  it("produces one timeline entry per session", () => {
    expect(insights.timeline.length).toBe(4);
  });
});
