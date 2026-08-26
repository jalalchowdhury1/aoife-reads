// Shared item shape for the five choice-based reading genres. Every genre
// normalizes to this so one view (components/genres/ReadingChoiceView.tsx)
// renders them all. The split between `shown` and `spoken` is load-bearing
// (research digest, docs/research/2026-08-26-reading-app-research.md):
// what the child must READ is shown and never spoken; what tests LISTENING
// or dictation is spoken and never shown.
import type { Difficulty } from "../engine/types";

export interface ReadingOption {
  /** Written text option (word, letter, digraph) — mutually exclusive with emoji. */
  text?: string;
  /** Picture option. */
  emoji?: string;
  correct: boolean;
}

export interface ReadingItem {
  bankId?: string;
  d: Difficulty;
  /** Large printed word / pseudoword the child must read silently. */
  bigWord?: string;
  /** Sentence or passage the child must read silently ("___" marks a gap). */
  passage?: string;
  /** Question shown under the passage (readAndAnswer only). */
  question?: string;
  /** Supporting picture (soundHunt shows the word's picture, never its spelling). */
  emoji?: string;
  /** Spoken via TTS on mount, replayable. Null = nothing is spoken (she must read). */
  speak: string | null;
  options: ReadingOption[];
  answer: number; // index of the correct option (exactly one is correct)
  explanation: string;
}

export function scoreReading(item: ReadingItem, response: number | null) {
  const correct = response !== null && response === item.answer;
  return { points: correct ? 1 : 0, max: 1, correct };
}
