import type { Genre, Difficulty } from "../engine/types";
import { generateComputation, scoreMath, type MathItem } from "./mathItem";

/**
 * Number Crunch (solo, MTH): the Numerical-Operations-style computation
 * ladder — d1 count the pictures → d10 three-digit add/sub and 2-digit×1.
 * Shown only, never spoken (reading "7 + 5 =" is number reading, part of the
 * skill). Untimed; answered on the number pad.
 */
function generate(seed: number, d: Difficulty): MathItem {
  return generateComputation(seed, d);
}

export function audit(item: MathItem): string {
  const emoji = item.emoji ? `<p style="font-size:28px">${item.emoji}</p>` : "";
  return `<div style="font-family:sans-serif">${emoji}<p style="font-size:24px">${item.problem}</p><p style="color:#6fcf6f">answer: ${item.answer}</p></div>`;
}

export const numberCrunch: Genre<MathItem, number> = {
  id: "numberCrunch",
  subtest: "Numerical Operations (cousin: computation ladder)",
  domain: "MTH",
  kidTitle: "Number Crunch",
  instructions: "Solve the number problem and type the answer on the number pad. For picture ones, count the pictures!",
  sample: () => ({
    item: { d: 2, problem: "1 + 1 =", answer: 2, speak: null },
    explanation: "Read the problem, work it out, and tap the answer on the number pad. One plus one is two!",
  }),
  generate,
  score: scoreMath,
  timing: { kind: "none" },
  mode: "staircase",
};
