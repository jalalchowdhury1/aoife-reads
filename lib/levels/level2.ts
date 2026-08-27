import type { LevelConfig } from "../engine/types";

/**
 * Level 2 — "Count with Ollie" (2026-08-27, the Math composite's solo
 * diagnostic; spec docs/superpowers/specs/2026-08-27-achieve2-math-design.md).
 * Same recipe as Level 1: teaching items introduce each format, staircase
 * stops after 2 straight misses, no right/wrong feedback, first run is the
 * record. One short part — two genres cover the two real subtests behind
 * the WIAT Mathematics composite (Numerical Operations, Math Problem
 * Solving). Starts at d1 because her math ladder here is unmeasured (the
 * aoife-math fleet trains operations, but this ladder is WIAT-shaped).
 *
 * NOTE: the previous id-2 level ("Test Day with a Grown-Up") moved to id 3
 * while NOTHING had been played (server showed zero completions on
 * 2026-08-27) — solo diagnostics first, then one grown-up day covering all
 * three composites.
 */
export const level2: LevelConfig = {
  id: 2,
  title: "Count with Ollie",
  feedback: "none",
  fun: false, // diagnostic: no right/wrong feedback, so praise stays neutral
  teachingItems: 2,
  parts: [
    {
      id: "A",
      title: "Numbers and Stories",
      sticker: "🧮",
      blocks: [{ genre: "numberCrunch" }, { genre: "storyProblems" }],
    },
  ],
};
