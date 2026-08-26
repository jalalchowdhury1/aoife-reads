import type { Genre, Difficulty, BaseDifficulty } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng } from "../engine/rng";
import { scoreReading, type ReadingItem } from "./readingItem";

/**
 * Word Snap (silent word reading, domain CMP): a printed word — NEVER spoken
 * — and four pictures; she taps the picture the word names. Mirrors the
 * earliest WIAT-4 Reading Comprehension items (match printed words to
 * pictures). The research digest's caveat is designed in: from d3 up, at
 * least one distractor picture's name STARTS WITH THE SAME LETTER as the
 * target, so first-letter guessing stops working and she must read the
 * whole word.
 *
 * Word tiers follow the phonics scope: d1-2 CVC → d3-4 digraphs/blends →
 * d5-6 silent-e/vowel teams → d7-8 r-controlled & longer → d9-10
 * multisyllabic (grade 2-3 words).
 */
interface W { word: string; emoji: string }

const TIERS: Record<number, W[]> = {
  1: [
    { word: "cat", emoji: "🐱" }, { word: "dog", emoji: "🐶" }, { word: "sun", emoji: "☀️" },
    { word: "bed", emoji: "🛏️" }, { word: "cup", emoji: "🥤" }, { word: "hat", emoji: "🎩" },
    { word: "pig", emoji: "🐷" }, { word: "bus", emoji: "🚌" }, { word: "box", emoji: "📦" },
    { word: "fox", emoji: "🦉" },
  ],
  2: [
    { word: "hen", emoji: "🐔" }, { word: "map", emoji: "🗺️" }, { word: "pen", emoji: "🖊️" },
    { word: "bug", emoji: "🐞" }, { word: "cow", emoji: "🐮" }, { word: "key", emoji: "🔑" },
    { word: "leg", emoji: "🦵" }, { word: "egg", emoji: "🥚" }, { word: "ant", emoji: "🐜" },
    { word: "car", emoji: "🚗" },
  ],
  3: [
    { word: "fish", emoji: "🐟" }, { word: "ship", emoji: "🚢" }, { word: "bath", emoji: "🛁" },
    { word: "chick", emoji: "🐤" }, { word: "shell", emoji: "🐚" }, { word: "sheep", emoji: "🐑" },
    { word: "cheese", emoji: "🧀" }, { word: "chair", emoji: "🪑" }, { word: "whale", emoji: "🐋" },
    { word: "thumb", emoji: "👍" },
  ],
  4: [
    { word: "frog", emoji: "🐸" }, { word: "star", emoji: "⭐" }, { word: "crab", emoji: "🦀" },
    { word: "drum", emoji: "🥁" }, { word: "clock", emoji: "🕐" }, { word: "snail", emoji: "🐌" },
    { word: "swan", emoji: "🦢" }, { word: "plant", emoji: "🪴" }, { word: "truck", emoji: "🚚" },
    { word: "flag", emoji: "🚩" },
  ],
  5: [
    { word: "cake", emoji: "🎂" }, { word: "kite", emoji: "🪁" }, { word: "bike", emoji: "🚲" },
    { word: "bone", emoji: "🦴" }, { word: "rose", emoji: "🌹" }, { word: "note", emoji: "🎵" },
    { word: "five", emoji: "5️⃣" }, { word: "cube", emoji: "🧊" }, { word: "grapes", emoji: "🍇" },
    { word: "snake", emoji: "🐍" },
  ],
  6: [
    { word: "rain", emoji: "🌧️" }, { word: "boat", emoji: "⛵" }, { word: "moon", emoji: "🌙" },
    { word: "tree", emoji: "🌳" }, { word: "bee", emoji: "🐝" }, { word: "sea", emoji: "🌊" },
    { word: "train", emoji: "🚂" }, { word: "beach", emoji: "🏖️" }, { word: "goat", emoji: "🐐" },
    { word: "feet", emoji: "🦶" },
  ],
  7: [
    { word: "horse", emoji: "🐴" }, { word: "shark", emoji: "🦈" }, { word: "corn", emoji: "🌽" },
    { word: "bird", emoji: "🐦" }, { word: "shirt", emoji: "👕" }, { word: "fork", emoji: "🍴" },
    { word: "farm", emoji: "🚜" }, { word: "purse", emoji: "👛" }, { word: "horn", emoji: "📯" },
    { word: "surfer", emoji: "🏄" },
  ],
  8: [
    { word: "turtle", emoji: "🐢" }, { word: "ladder", emoji: "🪜" }, { word: "rabbit", emoji: "🐰" },
    { word: "monkey", emoji: "🐵" }, { word: "rocket", emoji: "🚀" }, { word: "pencil", emoji: "✏️" },
    { word: "basket", emoji: "🧺" }, { word: "mitten", emoji: "🧤" }, { word: "hammer", emoji: "🔨" },
    { word: "candle", emoji: "🕯️" },
  ],
  9: [
    { word: "elephant", emoji: "🐘" }, { word: "butterfly", emoji: "🦋" }, { word: "penguin", emoji: "🐧" },
    { word: "tomato", emoji: "🍅" }, { word: "umbrella", emoji: "☂️" }, { word: "banana", emoji: "🍌" },
    { word: "octopus", emoji: "🐙" }, { word: "kangaroo", emoji: "🦘" }, { word: "computer", emoji: "💻" },
    { word: "potato", emoji: "🥔" },
  ],
  10: [
    { word: "dinosaur", emoji: "🦕" }, { word: "airplane", emoji: "✈️" }, { word: "mountain", emoji: "⛰️" },
    { word: "telescope", emoji: "🔭" }, { word: "volcano", emoji: "🌋" }, { word: "helicopter", emoji: "🚁" },
    { word: "microscope", emoji: "🔬" }, { word: "lighthouse", emoji: "🗼" }, { word: "crocodile", emoji: "🐊" },
    { word: "strawberry", emoji: "🍓" },
  ],
};

function tierFor(d: BaseDifficulty): W[] {
  return TIERS[d];
}

/** Distractor pool: same tier ± one, preferring a same-first-letter neighbor from d3 up. */
function generate(seed: number, dIn: Difficulty): ReadingItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed);
  const tier = tierFor(d);
  const target = rng.pick(tier);
  const optionCount = d === 1 ? 3 : 4;

  const pool: W[] = [];
  for (const t of [d, Math.max(1, d - 1) as BaseDifficulty, Math.min(10, d + 1) as BaseDifficulty]) {
    for (const w of tierFor(t)) {
      if (w.word !== target.word && w.emoji !== target.emoji && !pool.some((p) => p.emoji === w.emoji)) pool.push(w);
    }
  }
  const distractors: W[] = [];
  if (d >= 3) {
    const sameStart = pool.filter((w) => w.word[0] === target.word[0]);
    if (sameStart.length > 0) distractors.push(rng.pick(sameStart));
  }
  for (const w of rng.shuffle(pool)) {
    if (distractors.length >= optionCount - 1) break;
    if (!distractors.some((x) => x.emoji === w.emoji || x.word === w.word)) distractors.push(w);
  }

  const entries = rng.shuffle([
    { emoji: target.emoji, correct: true },
    ...distractors.map((w) => ({ emoji: w.emoji, correct: false })),
  ]);
  return {
    d: dIn,
    bigWord: target.word,
    speak: null, // she must READ it — the word is never spoken
    options: entries,
    answer: entries.findIndex((e) => e.correct),
    explanation: `The word says ${target.word} — that is the ${target.emoji}.`,
  };
}

function sample(): { item: ReadingItem; explanation: string } {
  return {
    item: {
      d: 1, bigWord: "cat", speak: null,
      options: [{ emoji: "🐱", correct: true }, { emoji: "☀️", correct: false }, { emoji: "🚌", correct: false }],
      answer: 0, explanation: "The word says cat — that is the 🐱.",
    },
    explanation: "Read the word quietly in your head: c-a-t, cat. Then tap the cat.",
  };
}

export function audit(item: ReadingItem): string {
  return (
    `<div style="font-family:sans-serif"><div style="font-size:30px;font-weight:bold">${item.bigWord}</div>` +
    item.options.map((o, i) => `<span style="border:3px solid ${i === item.answer ? "#6fcf6f" : "#ccc"};border-radius:8px;padding:4px 10px;margin:3px;display:inline-block;font-size:34px">${o.emoji}</span>`).join("") +
    `</div>`
  );
}

export const wordSnap: Genre<ReadingItem, number> = {
  id: "wordSnap",
  subtest: "Word Reading (silent)",
  domain: "CMP",
  kidTitle: "Word Snap",
  instructions: "Read the word quietly in your head — Ollie stays quiet for this one! Then tap the picture the word names.",
  sample,
  generate,
  score: scoreReading,
  timing: { kind: "none" },
  mode: "staircase",
};
