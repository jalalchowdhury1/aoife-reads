import { describe, it, expect } from "vitest";
import { formatPartSummary } from "./telegram";
import { summarize } from "./types";
import type { SessionRecord, ItemRecord, LevelConfig } from "./types";

const level: LevelConfig = {
  id: 1,
  title: "Find Your Superpowers",
  feedback: "none",
  parts: [
    { id: "A", title: "Shapes", sticker: "🧩", blocks: [{ genre: "wordSnap" }, { genre: "soundHunt" }] },
    { id: "B", title: "Memory and Speed", sticker: "⚡", blocks: [{ genre: "wordSnap" }, { genre: "soundHunt" }] },
  ],
};

function makeSession(): SessionRecord {
  const matrixItems: ItemRecord[] = [
    { idx: 0, seed: 1, d: 1, points: 1, max: 1, correct: true, ms: 2000, timedOut: false, response: "a" },
    { idx: 1, seed: 2, d: 2, points: 1, max: 1, correct: true, ms: 3000, timedOut: false, response: "b" },
    { idx: 2, seed: 3, d: 3, points: 0, max: 1, correct: false, ms: 8000, timedOut: true, response: null },
  ];
  const codingItems: ItemRecord[] = Array.from({ length: 10 }, (_, i) => ({
    idx: i,
    seed: i,
    d: 1 as const,
    points: i < 8 ? 1 : 0,
    max: 1,
    correct: i < 8,
    ms: 1000,
    timedOut: false,
    response: "z",
  }));

  return {
    id: "01FIXTURETELEGRAM0000000001",
    level: 1,
    part: "A",
    startedAt: "2026-08-20T10:00:00.000Z",
    endedAt: "2026-08-20T10:17:00.000Z",
    device: { ua: "test", w: 1024, h: 768 },
    complete: true,
    appVersion: "0.1.0",
    blocks: [
      {
        genre: "wordSnap",
        mode: "staircase",
        startedAt: "2026-08-20T10:00:00.000Z",
        endedAt: "2026-08-20T10:05:00.000Z",
        items: matrixItems,
        summary: summarize(matrixItems, "staircase"),
      },
      {
        genre: "soundHunt",
        mode: "speedBlock",
        startedAt: "2026-08-20T10:10:00.000Z",
        endedAt: "2026-08-20T10:12:00.000Z",
        items: codingItems,
        summary: summarize(codingItems, "speedBlock"),
      },
    ],
  };
}

describe("formatPartSummary", () => {
  const msg = formatPartSummary(makeSession(), level);
  const lines = msg.split("\n");

  it("has the level/part header with duration in minutes", () => {
    expect(lines[0]).toBe("🧩 Word Woods — Level 1 Part A done (17 min)");
  });

  it("uses each genre's kidTitle from the registry", () => {
    expect(lines[1]).toContain("Word Snap");
    expect(lines[2]).toContain("Sound Hunt");
  });

  it("shows correct/attempted and ceiling for the staircase block", () => {
    expect(lines[1]).toMatch(/2\/3 · ceiling 2/);
  });

  it("shows a time-out note only on the block that had one", () => {
    expect(lines[1]).toContain("time-out");
    expect(lines[2]).not.toContain("time-out");
  });

  it("never shows a ceiling for the speed block", () => {
    expect(lines[2]).not.toContain("ceiling");
    expect(lines[2]).toMatch(/8\/10/);
  });

  it("ends with the parent page link", () => {
    expect(lines[lines.length - 1]).toBe("Parent page: https://aoife-reads.vercel.app/parent");
  });

  it("uses the completed part's own sticker as the header emoji", () => {
    const partB = formatPartSummary({ ...makeSession(), part: "B" }, level);
    expect(partB.split("\n")[0]).toBe("⚡ Word Woods — Level 1 Part B done (17 min)");
  });
});

describe("formatPartSummary with measurement-quality flags", () => {
  function sessionWithFlaggedBlock(): SessionRecord {
    const s = makeSession();
    return {
      ...s,
      blocks: [
        {
          ...s.blocks[0],
          flags: [
            {
              code: "format-not-understood",
              detail: "First two items missed at difficulty ≤ 2 — the format may not have been understood.",
            },
          ],
        },
        s.blocks[1],
      ],
    };
  }

  const msg = formatPartSummary(sessionWithFlaggedBlock(), level);
  const lines = msg.split("\n");

  it("appends a check line for the flagged block using its kidTitle and detail", () => {
    expect(lines).toContain(
      "⚠️ check: Word Snap — First two items missed at difficulty ≤ 2 — the format may not have been understood."
    );
  });

  it("adds the 'not counted in her profile' note when any block is flagged", () => {
    expect(lines).toContain("Flagged blocks are not counted in her profile.");
  });

  it("still ends with the parent page link", () => {
    expect(lines[lines.length - 1]).toBe("Parent page: https://aoife-reads.vercel.app/parent");
  });

  it("adds no flag lines or note when no block is flagged", () => {
    const clean = formatPartSummary(makeSession(), level);
    expect(clean).not.toContain("⚠️ check:");
    expect(clean).not.toContain("Flagged blocks are not counted in her profile.");
  });
});
