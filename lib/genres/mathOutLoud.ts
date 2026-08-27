import type { Genre, Difficulty } from "../engine/types";
import { scoreExaminer, type ExaminerItem } from "./examinerItem";
import { generateStory } from "./mathItem";

/**
 * Math Out Loud (ACTUAL Math Problem Solving administration, domain MTH):
 * Ollie reads the story problem aloud (the real subtest's examiner does the
 * reading — it measures reasoning, not decoding), the text stays on screen
 * for look-back, paper is allowed, she answers out loud, the grown-up marks
 * it. Reuses Story Problems' ladder so the two stay in lockstep.
 */
function generate(seed: number, d: Difficulty): ExaminerItem {
  const base = generateStory(seed, d);
  return {
    bankId: `mol-${base.answer}-${base.problem.length}-${seed % 1000}`, d: base.d,
    stimulus: base.problem,
    speak: base.problem,
    expected: String(base.answer),
    childHint: "You can use paper to work it out ✏️",
    parentPrompt: "Ollie reads the story. Paper is fine. Tap the check if her answer matches. Replay as often as she likes.",
  };
}

export function audit(item: ExaminerItem): string {
  return `<div style="font-family:sans-serif"><p style="max-width:420px">🔊 ${item.speak}</p><p style="color:#6fcf6f">expected: ${item.expected}</p></div>`;
}

export const mathOutLoud: Genre<ExaminerItem, boolean> = {
  id: "mathOutLoud",
  subtest: "Math Problem Solving (read aloud, parent-scored)",
  domain: "MTH",
  kidTitle: "Math Out Loud",
  instructions: "Grown-up: Ollie reads a number story out loud. Aoife can look at the words and use paper. She says the answer; tap the check if it is right.",
  sample: () => ({
    item: {
      bankId: "mol-sample", d: 2,
      stimulus: "Ollie has 1 acorn and finds 1 more. How many acorns does Ollie have now?",
      speak: "Ollie has 1 acorn and finds 1 more. How many acorns does Ollie have now?",
      expected: "2", childHint: "You can use paper to work it out ✏️",
      parentPrompt: "She answers out loud.",
    },
    explanation: "Ollie tells you a number story. Think it through, use paper if you like, and say the answer out loud!",
  }),
  generate,
  score: scoreExaminer,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
