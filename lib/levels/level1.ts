import type { LevelConfig } from "../engine/types";

/**
 * Level 1 — "Find Your Reading Powers" (the diagnostic, same recipe that
 * worked in aoife-puzzles): teaching items introduce each format, staircase
 * stops after 2 straight misses, no right/wrong feedback, and the first run
 * is the record. Two ~15-minute parts.
 *
 * Every block starts at d1 on purpose: we genuinely do not know where she
 * sits on the reading ladder yet (the whole app exists to find out), and
 * the staircase climbs fast from wins.
 */
export const level1: LevelConfig = {
  id: 1,
  title: "Find Your Reading Powers",
  feedback: "none",
  fun: false, // diagnostic: no right/wrong feedback, so praise stays neutral
  teachingItems: 2,
  parts: [
    {
      id: "A",
      title: "Sounds and Words",
      sticker: "🔤",
      blocks: [{ genre: "soundHunt" }, { genre: "echoWords" }, { genre: "wordSnap" }],
    },
    {
      id: "B",
      title: "Stories and Spelling",
      sticker: "📖",
      blocks: [{ genre: "storyGap" }, { genre: "readAndAnswer" }, { genre: "spellIt" }],
    },
  ],
};
