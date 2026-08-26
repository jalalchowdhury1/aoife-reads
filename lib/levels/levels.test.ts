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

  it("uses every genre exactly once across its two parts", () => {
    usesEveryGenreOnce(level1);
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
  it("only Level 1 is released; the QA level (99) never is", () => {
    expect(RELEASED_LEVELS.map((l) => l.id)).toEqual([1]);
  });
});
