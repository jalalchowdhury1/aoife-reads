// Shared math item shape + the two deterministic problem ladders behind all
// four MTH genres (spec docs/superpowers/specs/2026-08-27-achieve2-math-design.md).
// numberCrunch / mathOnPaper use the COMPUTATION ladder; storyProblems /
// mathOutLoud use the STORY ladder. Everything is generated from (seed, d) —
// no banks — and every answer is a single non-negative integer ≤ 999
// (fairness/math.test.ts sweeps 500 seeds × 10 difficulties per rule).
import type { Difficulty } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng, type Rng } from "../engine/rng";

export interface MathItem {
  bankId?: string;
  d: Difficulty;
  /** Large printed computation ("7 + 5 =") or the story text. */
  problem: string;
  /** Emoji row for d1 counting items (she counts the pictures). */
  emoji?: string;
  /** Spoken via TTS (story problems only — removes the reading load). */
  speak: string | null;
  answer: number;
}

export function scoreMath(item: MathItem, response: number | null) {
  const correct = response !== null && response === item.answer;
  return { points: correct ? 1 : 0, max: 1, correct };
}

const COUNT_EMOJI = ["🍎", "⭐", "🐞", "🌸", "🐟", "🎈"];

/** The Numerical-Operations-style computation ladder, one new idea per band. */
export function generateComputation(seed: number, dIn: Difficulty): MathItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed * 31 + d);
  const make = (problem: string, answer: number, emoji?: string): MathItem => ({
    d: dIn, problem, answer, speak: null, ...(emoji ? { emoji } : {}),
  });

  switch (d) {
    case 1: { // count the pictures
      const n = rng.int(1, 5);
      return make("How many?", n, rng.pick(COUNT_EMOJI).repeat(n));
    }
    case 2: { // add within 5
      const a = rng.int(1, 4); const b = rng.int(1, 5 - a);
      return make(`${a} + ${b} =`, a + b);
    }
    case 3: { // add within 10
      const a = rng.int(2, 8); const b = rng.int(1, 10 - a);
      return make(`${a} + ${b} =`, a + b);
    }
    case 4: { // subtract within 10
      const a = rng.int(3, 10); const b = rng.int(1, a - 1);
      return make(`${a} − ${b} =`, a - b);
    }
    case 5: { // add or subtract within 20
      if (rng.next() < 0.5) {
        const a = rng.int(5, 15); const b = rng.int(2, 20 - a);
        return make(`${a} + ${b} =`, a + b);
      }
      const a = rng.int(11, 20); const b = rng.int(2, 9);
      return make(`${a} − ${b} =`, a - b);
    }
    case 6: { // two-digit add/sub, NO regrouping
      if (rng.next() < 0.5) {
        const a1 = rng.int(1, 7); const a0 = rng.int(0, 8);
        const b1 = rng.int(1, 9 - a1); const b0 = rng.int(0, 9 - a0);
        return make(`${a1 * 10 + a0} + ${b1 * 10 + b0} =`, (a1 + b1) * 10 + a0 + b0);
      }
      const a1 = rng.int(3, 9); const a0 = rng.int(1, 9);
      const b1 = rng.int(1, a1 - 1); const b0 = rng.int(0, a0);
      return make(`${a1 * 10 + a0} − ${b1 * 10 + b0} =`, (a1 - b1) * 10 + (a0 - b0));
    }
    case 7: { // two-digit add/sub WITH regrouping
      if (rng.next() < 0.5) {
        const a0 = rng.int(5, 9); const b0 = rng.int(10 - a0, 9); // ones carry
        const a1 = rng.int(1, 6); const b1 = rng.int(1, 8 - a1);
        return make(`${a1 * 10 + a0} + ${b1 * 10 + b0} =`, a1 * 10 + a0 + b1 * 10 + b0);
      }
      const a1 = rng.int(3, 9); const a0 = rng.int(0, 4); const b0 = rng.int(a0 + 1, 9); // ones borrow
      const b1 = rng.int(1, a1 - 1);
      return make(`${a1 * 10 + a0} − ${b1 * 10 + b0} =`, a1 * 10 + a0 - (b1 * 10 + b0));
    }
    case 8: { // multiplication facts, small tables
      const a = rng.int(2, 5); const b = rng.int(2, 9);
      return make(`${a} × ${b} =`, a * b);
    }
    case 9: { // bigger tables + exact division facts
      if (rng.next() < 0.5) {
        const a = rng.int(6, 9); const b = rng.int(3, 9);
        return make(`${a} × ${b} =`, a * b);
      }
      const b = rng.int(2, 9); const q = rng.int(2, 9);
      return make(`${b * q} ÷ ${b} =`, q);
    }
    default: { // 10: three-digit add/sub or two-digit × one-digit
      const kind = rng.next();
      if (kind < 0.4) {
        const a = rng.int(120, 640); const b = rng.int(100, 999 - a);
        return make(`${a} + ${b} =`, a + b);
      }
      if (kind < 0.7) {
        const a = rng.int(300, 999); const b = rng.int(100, a - 50);
        return make(`${a} − ${b} =`, a - b);
      }
      const a = rng.int(12, 49); const b = rng.int(2, Math.min(9, Math.floor(999 / 49)));
      return make(`${a} × ${b} =`, a * b);
    }
  }
}

// ---- story ladder -----------------------------------------------------------

const KIDS = ["Maya", "Tom", "Ella", "Sam", "Nina"] as const;
const THINGS = [
  { one: "apple", many: "apples" },
  { one: "marble", many: "marbles" },
  { one: "sticker", many: "stickers" },
  { one: "cookie", many: "cookies" },
  { one: "shell", many: "shells" },
  { one: "crayon", many: "crayons" },
] as const;

function story(rng: Rng, dIn: Difficulty, text: string, answer: number): MathItem {
  return { d: dIn, problem: text, speak: text, answer };
}

/** The Math-Problem-Solving-style story ladder. Spoken AND shown. */
export function generateStory(seed: number, dIn: Difficulty): MathItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed * 37 + d * 7);
  const kid = rng.pick(KIDS);
  const thing = rng.pick(THINGS);

  switch (d) {
    case 1: { // counting story
      const n = rng.int(2, 5);
      return { ...story(rng, dIn, `Ollie sees ${n} ${thing.many} on the table. How many ${thing.many} does Ollie see?`, n), emoji: "🦉" };
    }
    case 2: { // one-step add within 10
      const a = rng.int(2, 6); const b = rng.int(1, 9 - a);
      return story(rng, dIn, `${kid} has ${a} ${thing.many} and gets ${b} more. How many ${thing.many} does ${kid} have now?`, a + b);
    }
    case 3: { // one-step subtract within 10
      const a = rng.int(4, 10); const b = rng.int(1, a - 1);
      return story(rng, dIn, `There are ${a} birds in a tree. ${b} fly away. How many birds are left?`, a - b);
    }
    case 4: { // one-step within 20, mixed
      if (rng.next() < 0.5) {
        const a = rng.int(6, 14); const b = rng.int(2, 19 - a);
        return story(rng, dIn, `${kid} finds ${a} ${thing.many} and then ${b} more. How many ${thing.many} altogether?`, a + b);
      }
      const a = rng.int(12, 20); const b = rng.int(3, 9);
      return story(rng, dIn, `${kid} bakes ${a} ${thing.many} and gives ${b} away. How many ${thing.many} are left?`, a - b);
    }
    case 5: { // two-step within 20
      const a = rng.int(4, 9); const b = rng.int(2, 6); const c = rng.int(1, Math.min(5, a + b - 1));
      return story(rng, dIn, `${kid} has ${a} ${thing.many}, gets ${b} more, then gives ${c} away. How many ${thing.many} now?`, a + b - c);
    }
    case 6: { // equal-groups multiplication
      const groups = rng.int(2, 5); const each = rng.int(2, 6);
      return story(rng, dIn, `${kid} has ${groups} bags with ${each} ${thing.many} in each bag. How many ${thing.many} altogether?`, groups * each);
    }
    case 7: { // sharing division, exact
      const kids2 = rng.int(2, 5); const each = rng.int(2, 6);
      return story(rng, dIn, `${each * kids2} ${thing.many} are shared equally among ${kids2} children. How many does each child get?`, each);
    }
    case 8: { // money change
      const price = rng.int(2, 8); const paid = rng.pick([10, 20] as const);
      return story(rng, dIn, `A book costs ${price} dollars. ${kid} pays with a ${paid} dollar bill. How much change does ${kid} get?`, paid - price);
    }
    case 9: { // multi-step, three operations
      const a = rng.int(6, 12); const b = rng.int(3, 8); const c = rng.int(2, 5);
      return story(rng, dIn, `${kid} starts with ${a} ${thing.many}, buys ${b} more, then uses ${c} of them. How many ${thing.many} are left?`, a + b - c);
    }
    default: { // 10: halves and quarters of friendly numbers
      if (rng.next() < 0.5) {
        const half = rng.int(3, 12);
        return story(rng, dIn, `${kid} has ${half * 2} ${thing.many} and gives half of them away. How many ${thing.many} are left?`, half);
      }
      const quarter = rng.int(2, 6);
      return story(rng, dIn, `There are ${quarter * 4} ${thing.many} in a box. ${kid} takes one quarter of them. How many does ${kid} take?`, quarter);
    }
  }
}
