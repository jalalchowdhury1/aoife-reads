import type { Genre, Difficulty } from "../engine/types";
import { generateStory, scoreMath, type MathItem } from "./mathItem";

/**
 * Story Problems (solo, MTH): the Math-Problem-Solving-style story ladder.
 * SHOWN AND SPOKEN on purpose — the real subtest's examiner reads the
 * problem to the child precisely so it measures math reasoning, not
 * decoding; Ollie's TTS does the same job here. Untimed; number pad answer.
 */
function generate(seed: number, d: Difficulty): MathItem {
  return generateStory(seed, d);
}

export function audit(item: MathItem): string {
  return `<div style="font-family:sans-serif"><p style="max-width:420px">${item.problem}</p><p style="color:#6fcf6f">answer: ${item.answer}</p></div>`;
}

export const storyProblems: Genre<MathItem, number> = {
  id: "storyProblems",
  subtest: "Math Problem Solving (cousin: spoken story problems)",
  domain: "MTH",
  kidTitle: "Story Problems",
  instructions: "Ollie tells you a little number story. Listen, think it through, and type the answer on the number pad. You can hear the story again any time.",
  sample: () => ({
    item: { d: 2, problem: "Ollie has 1 acorn and finds 1 more. How many acorns does Ollie have now?", speak: "Ollie has 1 acorn and finds 1 more. How many acorns does Ollie have now?", answer: 2 },
    explanation: "Listen to the story, then tap the answer. One acorn plus one more acorn is two acorns!",
  }),
  generate,
  score: scoreMath,
  timing: { kind: "none" },
  mode: "staircase",
};
