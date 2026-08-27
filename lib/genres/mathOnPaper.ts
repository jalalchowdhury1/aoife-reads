import type { Genre, Difficulty } from "../engine/types";
import { scoreExaminer, type ExaminerItem } from "./examinerItem";
import { generateComputation } from "./mathItem";

/**
 * Math on Paper (ACTUAL Numerical Operations administration, domain MTH):
 * the easel shows the problem big; she works it out ON PAPER (copying it
 * down is fine) and writes or says the answer; the grown-up marks it —
 * exactly the response-booklet shape of the real subtest. Reuses Number
 * Crunch's computation ladder so the two stay in lockstep.
 */
function generate(seed: number, d: Difficulty): ExaminerItem {
  const base = generateComputation(seed, d);
  const stimulus = base.emoji ? `${base.emoji}\n${base.problem}` : base.problem;
  return {
    bankId: `mop-${base.problem}-${base.answer}`, d: base.d,
    stimulus,
    expected: String(base.answer),
    parentPrompt: "She may copy it to paper and work it out there. Tap the check if her final answer matches.",
  };
}

export function audit(item: ExaminerItem): string {
  return `<div style="font-family:sans-serif"><p style="font-size:24px;white-space:pre-line">${item.stimulus}</p><p style="color:#6fcf6f">expected: ${item.expected}</p></div>`;
}

export const mathOnPaper: Genre<ExaminerItem, boolean> = {
  id: "mathOnPaper",
  subtest: "Numerical Operations (on paper, parent-scored)",
  domain: "MTH",
  kidTitle: "Math on Paper",
  instructions: "Grown-up: give Aoife paper and a pencil. She works each problem out on paper and tells you or shows you the answer. Tap the check if it is right.",
  sample: () => ({
    item: {
      bankId: "mop-sample", d: 2, stimulus: "1 + 1 =",
      expected: "2", parentPrompt: "She works it on paper.",
    },
    explanation: "A number problem appears. Work it out on your paper with your pencil, then show your grown-up the answer!",
  }),
  generate,
  score: scoreExaminer,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
