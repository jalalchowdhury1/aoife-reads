import type { LevelConfig } from "../engine/types";

/**
 * Level 3 — "Test Day with a Grown-Up" (2026-08-26 as Level 2, owner
 * request: "make it the actual test"; moved to id 3 on 2026-08-27, before
 * anything had been played, so both solo diagnostics come first). The app
 * becomes the examiner's easel and record form: Aoife reads graded word
 * lists, made-up words, and passages OUT LOUD, writes dictated spelling on
 * PAPER, works math problems on paper, and answers spoken story problems;
 * the grown-up taps got-it / not-yet like the examiner's 1/0. These are the
 * real WIAT/WJ administration FORMATS (items are ours). Part C (2026-08-27)
 * completes the third composite: Mathematics.
 *
 * Every block starts at d1 with stepUp 1: the ladder is climbed fast when
 * she is strong, and the parent-scored record is the closest thing to a
 * practice achievement test the app can produce.
 */
export const level3: LevelConfig = {
  id: 3,
  title: "Test Day with a Grown-Up",
  feedback: "none",
  fun: false, // test-day calm: neutral praise, sticker at the end only
  teachingItems: 0,
  parts: [
    {
      id: "A",
      title: "Reading Out Loud",
      sticker: "🗣️",
      blocks: [{ genre: "readAloud" }, { genre: "soundItOut" }],
    },
    {
      id: "B",
      title: "Stories and a Spelling Test",
      sticker: "📝",
      blocks: [{ genre: "readToMe" }, { genre: "spellOnPaper" }],
    },
    {
      id: "C",
      title: "Math Day",
      sticker: "🧮",
      blocks: [{ genre: "mathOnPaper" }, { genre: "mathOutLoud" }],
    },
  ],
};
