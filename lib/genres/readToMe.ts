import type { Genre, Difficulty, GenerateOpts } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng } from "../engine/rng";
import { scoreExaminer, type ExaminerItem } from "./examinerItem";
import { READ_ANSWER_BANK } from "./readAndAnswer";

/**
 * Read To Me (ACTUAL passage-comprehension administration, domain CMP): she
 * reads the passage OUT LOUD to the grown-up, the grown-up asks the printed
 * question, she answers in her own words, and the grown-up judges it — the
 * WIAT-4 Reading Comprehension shape (examiner-delivered questions, open
 * answers, look-back allowed). Reuses the graded passage bank; the grown-up
 * strip shows what counts as correct.
 */
function toItem(b: (typeof READ_ANSWER_BANK)[number]): ExaminerItem {
  return {
    bankId: `rtm-${b.id}`, d: b.d, stimulus: b.passage, question: b.question,
    expected: b.options[b.answer],
    parentPrompt: "She reads the story out loud, then answers your question in her own words. Any answer that MEANS this counts. She may look back.",
  };
}

function generate(seed: number, dIn: Difficulty, opts?: GenerateOpts): ExaminerItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed);
  const exclude = new Set(opts?.excludeBankIds ?? []);
  for (let widen = 0; widen <= 9; widen++) {
    const c = READ_ANSWER_BANK.filter((b) => Math.abs(b.d - d) === widen && !exclude.has(`rtm-${b.id}`));
    if (c.length) return toItem(rng.pick(c));
  }
  return toItem(rng.pick(READ_ANSWER_BANK));
}

export function audit(item: ExaminerItem): string {
  return `<div style="font-family:sans-serif"><p style="font-size:15px">${item.stimulus}</p><p><b>Ask: ${item.question}</b></p><p style="color:#6fcf6f">counts as correct: ${item.expected}</p></div>`;
}

export const readToMe: Genre<ExaminerItem, boolean> = {
  id: "readToMe",
  subtest: "Passage Comprehension (read aloud + asked questions, parent-scored)",
  domain: "CMP",
  kidTitle: "Read To Me",
  instructions: "Grown-up: Aoife reads the little story OUT LOUD to you. Then ask her the question printed under it. Tap the check if her answer means the right thing — her own words are fine, and she may look back at the story.",
  sample: () => ({
    item: {
      bankId: "rtm-ra-01", d: 1, stimulus: "The cat sat on the mat.", question: "Who sat on the mat?",
      expected: "the cat", parentPrompt: "She reads aloud, then answers your question.",
    },
    explanation: "You read the story out loud to your grown-up, like YOU are the storyteller. Then they ask you a question about it.",
  }),
  generate,
  score: scoreExaminer,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
