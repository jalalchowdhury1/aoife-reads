import { describe, expect, it } from "vitest";
import { generateComputation, generateStory } from "../mathItem";
import { numberCrunch } from "../numberCrunch";
import { storyProblems } from "../storyProblems";
import { mathOnPaper } from "../mathOnPaper";
import { mathOutLoud } from "../mathOutLoud";
import type { Difficulty } from "../../engine/types";

// Fairness sweep for the Mathematics ladders (validity-is-sacred): every
// rule is tied to a way a generated item could write a FALSE weakness.
const SEEDS = Array.from({ length: 500 }, (_, i) => i * 7919 + 13);
const DIFFS: Difficulty[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DASH_CHARS = ["-", "–", "—"]; // TTS house rule (− U+2212 is the math minus, allowed in computations only)

/** Parses "a op b =" and recomputes the expected answer. */
function recompute(problem: string): number | null {
  const m = problem.match(/^(\d+) ([+−×÷]) (\d+) =$/);
  if (!m) return null;
  const a = Number(m[1]); const b = Number(m[3]);
  switch (m[2]) {
    case "+": return a + b;
    case "−": return a - b;
    case "×": return a * b;
    case "÷": return b === 0 ? null : a / b;
    default: return null;
  }
}

describe("computation ladder (numberCrunch / mathOnPaper)", () => {
  it("is deterministic: same (seed, d) always builds the identical item", () => {
    for (const d of DIFFS) {
      const a = generateComputation(123456, d);
      const b = generateComputation(123456, d);
      expect(b).toEqual(a);
    }
  });

  it("every answer is a whole number 0..999 and the printed problem really computes to it", () => {
    for (const d of DIFFS) {
      for (const seed of SEEDS) {
        const item = generateComputation(seed, d);
        expect(Number.isInteger(item.answer), `${d}/${seed}`).toBe(true);
        expect(item.answer, `${d}/${seed}`).toBeGreaterThanOrEqual(0);
        expect(item.answer, `${d}/${seed}`).toBeLessThanOrEqual(999);
        if (d === 1) {
          // counting item: the emoji row must contain exactly `answer` pictures
          expect(item.emoji, `${d}/${seed}`).toBeTruthy();
          expect(Array.from(item.emoji!).length, `${d}/${seed} emoji count`).toBe(item.answer);
        } else {
          const expected = recompute(item.problem);
          expect(expected, `${d}/${seed}: unparseable "${item.problem}"`).not.toBeNull();
          expect(item.answer, `${d}/${seed}: "${item.problem}"`).toBe(expected);
        }
      }
    }
  });

  it("subtraction never goes negative and division is always exact (no remainders anywhere on the ramp)", () => {
    for (const d of DIFFS) {
      for (const seed of SEEDS) {
        const item = generateComputation(seed, d);
        expect(item.answer).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(item.answer)).toBe(true);
      }
    }
  });

  it("d6 two-digit problems truly need no regrouping and d7 problems truly do", () => {
    for (const seed of SEEDS) {
      const i6 = generateComputation(seed, 6);
      const m6 = i6.problem.match(/^(\d+) ([+−]) (\d+) =$/)!;
      const [a6, b6] = [Number(m6[1]), Number(m6[3])];
      if (m6[2] === "+") expect((a6 % 10) + (b6 % 10), `d6 ${i6.problem}`).toBeLessThanOrEqual(9);
      else expect(a6 % 10, `d6 ${i6.problem}`).toBeGreaterThanOrEqual(b6 % 10);

      const i7 = generateComputation(seed, 7);
      const m7 = i7.problem.match(/^(\d+) ([+−]) (\d+) =$/)!;
      const [a7, b7] = [Number(m7[1]), Number(m7[3])];
      if (m7[2] === "+") expect((a7 % 10) + (b7 % 10), `d7 ${i7.problem}`).toBeGreaterThan(9);
      else expect(a7 % 10, `d7 ${i7.problem}`).toBeLessThan(b7 % 10);
    }
  });
});

describe("story ladder (storyProblems / mathOutLoud)", () => {
  it("is deterministic and always spoken (speak === problem — the TTS removes the reading load)", () => {
    for (const d of DIFFS) {
      const a = generateStory(654321, d);
      expect(generateStory(654321, d)).toEqual(a);
      expect(a.speak).toBe(a.problem);
    }
  });

  it("every story is a short question with a whole-number answer 0..999 and no dash characters", () => {
    for (const d of DIFFS) {
      for (const seed of SEEDS) {
        const item = generateStory(seed, d);
        expect(item.problem.endsWith("?"), `${d}/${seed}: "${item.problem}"`).toBe(true);
        expect(item.problem.length, `${d}/${seed}`).toBeLessThanOrEqual(200);
        expect(Number.isInteger(item.answer)).toBe(true);
        expect(item.answer).toBeGreaterThanOrEqual(0);
        expect(item.answer).toBeLessThanOrEqual(999);
        for (const dash of DASH_CHARS) {
          expect(item.problem.includes(dash), `${d}/${seed}: dash in "${item.problem}"`).toBe(false);
        }
      }
    }
  });
});

describe("the four genres wire the ladders consistently", () => {
  it("solo and examiner forms of the SAME ladder agree on the answer for the same (seed, d)", () => {
    for (const d of DIFFS) {
      for (const seed of SEEDS.slice(0, 50)) {
        const solo = numberCrunch.generate(seed, d);
        const exam = mathOnPaper.generate(seed, d);
        expect(exam.expected, `${d}/${seed}`).toBe(String(solo.answer));

        const soloS = storyProblems.generate(seed, d);
        const examS = mathOutLoud.generate(seed, d);
        expect(examS.expected, `${d}/${seed}`).toBe(String(soloS.answer));
        expect(examS.speak, `${d}/${seed}`).toBe(soloS.problem);
      }
    }
  });

  it("examiner math items always carry a parentPrompt and an expected answer", () => {
    for (const d of DIFFS) {
      const p = mathOnPaper.generate(d * 101, d);
      const s = mathOutLoud.generate(d * 101, d);
      for (const item of [p, s]) {
        expect(item.expected.length).toBeGreaterThan(0);
        expect(item.parentPrompt.length).toBeGreaterThan(0);
      }
    }
  });
});
