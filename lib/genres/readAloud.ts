import type { Genre, Difficulty, GenerateOpts } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng } from "../engine/rng";
import { scoreExaminer, type ExaminerItem } from "./examinerItem";

/**
 * Read It Out Loud (ACTUAL Word Reading format, domain DEC): a graded word
 * appears big on screen; she reads it ALOUD; the grown-up taps got-it /
 * not-yet — exactly how WIAT-4 Word Reading / WJ Letter-Word Identification
 * are administered (child reads a graded list aloud, examiner scores).
 * Items are ours; only the FORMAT is the real test's.
 *
 * Ladder: d1 letter names → d2-3 CVC → d4 digraphs/blends → d5 silent-e →
 * d6 vowel teams → d7 r-controlled + two-syllable → d8 common irregulars →
 * d9 grade-3/4 multisyllabic → d10 grade-4/5 words.
 */
const TIERS: Record<number, string[]> = {
  1: ["s", "m", "t", "b", "a", "o", "e", "r", "d", "g"],
  2: ["cat", "sun", "map", "dog", "pig", "bed", "cup", "hat", "run", "sit"],
  3: ["leg", "box", "jam", "wet", "fun", "zip", "van", "kid", "hot", "bug"],
  4: ["ship", "chat", "thin", "stop", "flag", "jump", "swim", "wish", "drum", "nest"],
  5: ["cake", "ride", "home", "kite", "nose", "cute", "gate", "five", "wave", "smile"],
  6: ["rain", "boat", "keep", "play", "team", "road", "seat", "night", "coat", "green"],
  7: ["bird", "farm", "corn", "turtle", "rabbit", "pencil", "winter", "sister", "garden", "morning"],
  8: ["said", "once", "who", "does", "were", "laugh", "friend", "again", "enough", "because"],
  9: ["important", "different", "remember", "together", "suddenly", "favorite", "mountain", "question", "carefully", "surprise"],
  10: ["mysterious", "celebration", "temperature", "adventure", "curious", "delicious", "invisible", "experiment", "ancient", "imagination"],
};

function generate(seed: number, dIn: Difficulty, opts?: GenerateOpts): ExaminerItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed);
  const exclude = new Set(opts?.excludeBankIds ?? []);
  for (let widen = 0; widen <= 9; widen++) {
    for (const tier of [d - widen, d + widen]) {
      if (tier < 1 || tier > 10) continue;
      const c = TIERS[tier].filter((w) => !exclude.has(`rl-${w}`));
      if (c.length) {
        const w = rng.pick(c);
        return {
          bankId: `rl-${w}`, d: tier as Difficulty, stimulus: w, expected: w,
          parentPrompt: d === 1 ? "She says the letter's NAME out loud." : "She reads the word out loud. Self-corrections count.",
        };
      }
    }
  }
  const w = rng.pick(TIERS[d]);
  return { bankId: `rl-${w}`, d: dIn, stimulus: w, expected: w, parentPrompt: "She reads the word out loud." };
}

export { TIERS as READ_ALOUD_TIERS };

export function audit(item: ExaminerItem): string {
  return `<div style="font-family:sans-serif"><div style="font-size:34px;font-weight:bold">${item.stimulus}</div><p style="color:#889;font-size:12px">grown-up: ${item.parentPrompt}</p></div>`;
}

export const readAloud: Genre<ExaminerItem, boolean> = {
  id: "readAloud",
  subtest: "Word Reading (read aloud, parent-scored)",
  domain: "DEC",
  kidTitle: "Read It Out Loud",
  instructions: "Grown-up: Aoife reads each word out loud to you. Tap the green check if she reads it right, the gray X if not. No hints during a word — help AFTER the round.",
  sample: () => ({
    item: { bankId: "rl-cat", d: 2, stimulus: "cat", expected: "cat", parentPrompt: "She reads the word out loud." },
    explanation: "A word appears. Read it out loud in your biggest voice, and your grown-up listens.",
  }),
  generate,
  score: scoreExaminer,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
