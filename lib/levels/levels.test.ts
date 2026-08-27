import { describe, expect, it } from "vitest";
import { GENRES, GENRE_LIST } from "../genres";
import type { GenreId } from "../engine/types";
import { LEVELS, RELEASED_LEVELS } from "./index";

describe("LEVELS registry", () => {
  it("has unique, ascending level ids", () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  for (const level of LEVELS) {
    describe(`Level ${level.id} (${level.title})`, () => {
      it("only references genre ids that exist in the registry", () => {
        for (const part of level.parts) {
          for (const block of part.blocks) {
            expect(Object.keys(GENRES)).toContain(block.genre);
          }
        }
      });

      it("has unique part ids", () => {
        const ids = level.parts.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }
});

function usesEveryGenreOnce(level: (typeof LEVELS)[number]) {
  const used: GenreId[] = level.parts.flatMap((p) => p.blocks.map((b) => b.genre));
  const counts = new Map<GenreId, number>();
  for (const g of used) counts.set(g, (counts.get(g) ?? 0) + 1);
  for (const g of GENRE_LIST) expect(counts.get(g)).toBe(1);
  expect(used.length).toBe(GENRE_LIST.length);
}

describe("Level 1 (Find Your Reading Powers — the diagnostic)", () => {
  const level1 = LEVELS.find((l) => l.id === 1)!;

  it("is the ungraded diagnostic: no feedback, no remedial weighting, teaching items on", () => {
    expect(level1.feedback).toBe("none");
    expect(level1.weighting).toBeUndefined();
    expect(level1.teachingItems).toBe(2);
    expect(level1.fun).toBe(false);
  });

  it("uses each of the six SOLO genres exactly once across its two parts", () => {
    const used = level1.parts.flatMap((p) => p.blocks.map((b) => b.genre));
    expect(used).toEqual(["soundHunt", "echoWords", "wordSnap", "storyGap", "readAndAnswer", "spellIt"]);
    expect(level1.parts.map((p) => p.id)).toEqual(["A", "B"]);
  });

  it("every block starts at d1 — this level exists to FIND her level, so nothing presumes one", () => {
    for (const part of level1.parts) {
      for (const block of part.blocks) {
        expect(block.start, block.genre).toBeUndefined();
      }
    }
  });
});

describe("Level 2 (Count with Ollie — the Math composite's solo diagnostic, 2026-08-27)", () => {
  const level2 = LEVELS.find((l) => l.id === 2)!;

  it("uses exactly the two solo math genres in one short part", () => {
    const used = level2.parts.flatMap((p) => p.blocks.map((b) => b.genre));
    expect(used).toEqual(["numberCrunch", "storyProblems"]);
    expect(level2.parts).toHaveLength(1);
  });

  it("is the ungraded diagnostic recipe: no feedback, fun off, teaching items on, starts d1", () => {
    expect(level2.feedback).toBe("none");
    expect(level2.fun).toBe(false);
    expect(level2.teachingItems).toBe(2);
    for (const part of level2.parts) for (const b of part.blocks) expect(b.start).toBeUndefined();
  });
});

describe("Level 3 (Test Day with a Grown-Up — actual-format, parent-scored; moved from id 2 on 2026-08-27 with zero plays recorded)", () => {
  const level3 = LEVELS.find((l) => l.id === 3)!;

  it("uses exactly the six examiner genres across three parts (Reading, Written, Math)", () => {
    const used = level3.parts.flatMap((p) => p.blocks.map((b) => b.genre));
    expect(used).toEqual(["readAloud", "soundItOut", "readToMe", "spellOnPaper", "mathOnPaper", "mathOutLoud"]);
    expect(level3.parts.map((p) => p.id)).toEqual(["A", "B", "C"]);
  });

  it("is test-day calm: no feedback, no fun layer, no teaching items, everything starts d1", () => {
    expect(level3.feedback).toBe("none");
    expect(level3.fun).toBe(false);
    expect(level3.teachingItems).toBe(0);
    for (const part of level3.parts) for (const b of part.blocks) expect(b.start).toBeUndefined();
  });
});

describe("Level 99 (hidden QA level)", () => {
  const levelQa = LEVELS.find((l) => l.id === 99)!;

  it("exists in the registry but is hidden (released: false)", () => {
    expect(levelQa).toBeDefined();
    expect(levelQa.released).toBe(false);
  });

  it("has one part with every genre in GENRE_LIST exactly once", () => {
    expect(levelQa.parts.length).toBe(1);
    usesEveryGenreOnce(levelQa);
  });

  it("caps every block at maxItems: 2", () => {
    for (const block of levelQa.parts[0].blocks) {
      expect(block.maxItems).toBe(2);
    }
  });
});

describe("release gating", () => {
  it("Levels 1, 2 and 3 are released; the QA level (99) never is", () => {
    expect(RELEASED_LEVELS.map((l) => l.id)).toEqual([1, 2, 3]);
  });
});
