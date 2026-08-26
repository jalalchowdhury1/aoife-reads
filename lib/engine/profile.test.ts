import { describe, it, expect } from "vitest";
import { computeProfile } from "./profile";
import { summarize } from "./types";
import type { SessionRecord, ItemRecord, BlockRecord } from "./types";

function makeSession(): SessionRecord {
  const matrixItems: ItemRecord[] = [
    { idx: 0, seed: 1, d: 7, points: 1, max: 1, correct: true, ms: 4000, timedOut: false, response: "x" },
  ];
  const blockDesignItems: ItemRecord[] = [
    { idx: 0, seed: 2, d: 3, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "y" },
  ];

  return {
    id: "01FIXTURE",
    level: 1,
    part: "A",
    startedAt: "2026-08-20T10:00:00.000Z",
    endedAt: "2026-08-20T10:40:00.000Z",
    device: { ua: "test", w: 1024, h: 768 },
    complete: true,
    appVersion: "0.1.0",
    blocks: [
      {
        genre: "wordSnap", mode: "staircase",
        startedAt: "2026-08-20T10:00:00.000Z", endedAt: "2026-08-20T10:05:00.000Z",
        items: matrixItems, summary: summarize(matrixItems, "staircase"),
      },
      {
        genre: "soundHunt", mode: "staircase",
        startedAt: "2026-08-20T10:10:00.000Z", endedAt: "2026-08-20T10:15:00.000Z",
        items: blockDesignItems, summary: summarize(blockDesignItems, "staircase"),
      },
    ],
  };
}

describe("computeProfile", () => {
  const profile = computeProfile([makeSession()]);

  it("computes per-genre ceilings", () => {
    expect(profile.genres.wordSnap?.ceiling).toBe(7);
    expect(profile.genres.soundHunt?.ceiling).toBe(3);
  });

  it("rolls genres up into domains present in this session", () => {
    expect(profile.domains.CMP.value).toBe(0.7); // wordSnap ceiling 7 / maxD 10
    expect(profile.domains.DEC.value).toBe(0.3); // soundHunt ceiling 3 / maxD 10
  });

  it("flags relative strengths/weaknesses only across present domains", () => {
    expect(profile.domains.CMP.flag).toBe("strength");
    expect(["typical", "weakness"]).toContain(profile.domains.DEC.flag);
    // absent domain: n/a and null
    expect(profile.domains.SPL.value).toBe(null);
    expect(profile.domains.SPL.flag).toBe("n/a");
    for (const d of ["CMP", "DEC"] as const) {
      expect(profile.domains[d].flag).not.toBe("n/a");
      expect(profile.domains[d].value).not.toBe(null);
    }
  });

  it("computes the Reading and Written bundles from present genres only", () => {
    expect(profile.bundles.egai).toBeCloseTo(0.5, 10); // READING = mean(soundHunt 0.3, wordSnap 0.7)
    expect(profile.bundles.cpi).toBe(null);            // WRITTEN: spellIt never played
  });

  it("records a trend entry per session for each genre", () => {
    expect(profile.genres.wordSnap?.trend).toEqual([
      { date: "2026-08-20T10:00:00.000Z", ceiling: 7, points: 1, max: 1 },
    ]);
  });

  it("has an empty flags list when no block was flagged", () => {
    expect(profile.flags).toEqual([]);
  });
});

describe("computeProfile with measurement-quality flags (AGENTS.md decision #14)", () => {
  // A block that mostly timed out (audio/device trouble) still recorded one
  // correct item at d2 — without exclusion this would set the genre's
  // ceiling to 2 (and its value to 0.2), reading as a false weakness even
  // though nothing about her actual ability was measured here.
  function flaggedSession(): SessionRecord {
    const items: ItemRecord[] = [
      { idx: 0, seed: 1, d: 2, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "x" },
      { idx: 1, seed: 2, d: 3, points: 0, max: 1, correct: false, ms: 30000, timedOut: true, response: null },
      { idx: 2, seed: 3, d: 3, points: 0, max: 1, correct: false, ms: 30000, timedOut: true, response: null },
    ];
    const block: BlockRecord = {
      genre: "wordSnap",
      mode: "staircase",
      startedAt: "2026-08-21T10:00:00.000Z",
      endedAt: "2026-08-21T10:05:00.000Z",
      items,
      summary: summarize(items, "staircase"),
      flags: [{ code: "mass-timeouts", detail: "2/3 items timed out." }],
    };
    return {
      id: "01EXCLUDEDBLOCKTEST000001",
      level: 1,
      part: "A",
      startedAt: "2026-08-21T10:00:00.000Z",
      device: { ua: "test", w: 1024, h: 768 },
      complete: true,
      appVersion: "0.1.0",
      blocks: [block],
    };
  }

  const profile = computeProfile([flaggedSession()]);

  it("excludes a mass-timeouts-flagged block from the genre's ceiling/attempted, which would otherwise be a false weakness", () => {
    expect(profile.genres.wordSnap?.ceiling ?? null).toBe(null);
    expect(profile.genres.wordSnap?.attempted ?? 0).toBe(0);
  });

  it("excludes the flagged genre from its domain roll-up instead of reporting a low value", () => {
    expect(profile.domains.CMP.value).toBe(null);
    expect(profile.domains.CMP.flag).toBe("n/a");
  });

  it("still records the block in the genre's trend, marked flagged", () => {
    expect(profile.genres.wordSnap?.trend).toEqual([
      { date: "2026-08-21T10:00:00.000Z", ceiling: 2, points: 1, max: 3, flagged: true },
    ]);
  });

  it("surfaces the flag on the profile for the parent page", () => {
    expect(profile.flags).toEqual([
      { sessionId: "01EXCLUDEDBLOCKTEST000001", part: "A", genre: "wordSnap", code: "mass-timeouts", detail: "2/3 items timed out." },
    ]);
  });
});
