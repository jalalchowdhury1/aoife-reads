// Shared item shape for the ACTUAL-format, parent-scored subtests ("Test Day
// with a Grown-Up"). The app plays the examiner's easel and record form: the
// child-facing stimulus is shown big; the grown-up judges the spoken/written
// response and taps got-it / not-yet. The response the engine records is that
// judgement (true = credited), exactly like an examiner's 1/0 on the form.
import type { Difficulty } from "../engine/types";

export interface ExaminerItem {
  bankId?: string;
  d: Difficulty;
  /** Large printed stimulus she reads ALOUD (word, pseudoword, or passage). */
  stimulus?: string;
  /** Spoken via TTS (spelling dictation); nothing shown when this is set. */
  speak?: string;
  /** A question the grown-up asks after the reading (readToMe only). */
  question?: string;
  /** What counts as correct — shown in the grown-up strip, never spoken. */
  expected: string;
  /** One-line instruction for the grown-up on this item. */
  parentPrompt: string;
}

export function scoreExaminer(item: ExaminerItem, response: boolean | null) {
  const correct = response === true;
  return { points: correct ? 1 : 0, max: 1, correct };
}
