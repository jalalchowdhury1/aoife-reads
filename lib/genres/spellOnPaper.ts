import type { Genre, Difficulty, GenerateOpts } from "../engine/types";
import { scoreExaminer, type ExaminerItem } from "./examinerItem";
import { spellIt, type SpellItem } from "./spellIt";

/**
 * Spelling Test (ACTUAL Spelling administration, domain SPL): Ollie dictates
 * — "word… sentence… word" — she WRITES the word on real paper with a real
 * pencil, and the grown-up marks it. This is the WIAT-4/WJ Spelling shape
 * verbatim (and, unlike the typing genre, it also exercises the handwriting
 * the Written Expression composite needs). Reuses the graded dictation tiers.
 */
function generate(seed: number, d: Difficulty, opts?: GenerateOpts): ExaminerItem {
  const base = spellIt.generate(seed, d, opts) as SpellItem;
  return {
    bankId: `sop-${base.word}`, d: base.d,
    speak: `Spell the word ${base.word}. ${base.sentence} ${base.word}.`,
    expected: base.word,
    parentPrompt: "She writes it on PAPER. Tap the check only if every letter is right. Replay the word as often as she likes.",
  };
}

export function audit(item: ExaminerItem): string {
  return `<div style="font-family:sans-serif"><p>🔊 ${item.speak}</p><p style="color:#6fcf6f">correct spelling: ${item.expected}</p></div>`;
}

export const spellOnPaper: Genre<ExaminerItem, boolean> = {
  id: "spellOnPaper",
  subtest: "Spelling (dictated to paper, parent-scored)",
  domain: "SPL",
  kidTitle: "Spelling Test",
  instructions: "Grown-up: give Aoife paper and a pencil. Ollie says each word with a sentence; she writes it down. Tap the check if the whole word is spelled right.",
  sample: () => ({
    item: {
      bankId: "sop-at", d: 1, speak: "Spell the word at. We are at home. at.",
      expected: "at", parentPrompt: "She writes it on paper.",
    },
    explanation: "Ollie says a word. You write it on your paper with your pencil, like a real spelling test!",
  }),
  generate,
  score: scoreExaminer,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
