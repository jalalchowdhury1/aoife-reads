import type { Genre, Difficulty, BaseDifficulty } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng, type Rng } from "../engine/rng";
import { scoreReading, type ReadingItem } from "./readingItem";

/**
 * Sound Hunt (letter-sound correspondence, domain DEC): Ollie speaks a word
 * and shows its picture — NEVER its spelling — and she taps the letter (or
 * digraph) for the asked sound. Mirrors the earliest WIAT-4 Word Reading
 * items (letter and letter-sound identification) without copying any.
 *
 * Ramp (science-of-reading scope: PA/letter-sounds are an end-of-K skill,
 * digraphs grade 1 — research digest):
 *   d1-2  FIRST sound, common consonants (3 then 4 letter options)
 *   d3-4  first sound, full alphabet incl. trickier onsets
 *   d5-6  LAST sound
 *   d7-8  first sound is a DIGRAPH (sh/ch/th/wh) — options are digraphs
 *   d9-10 MIDDLE (short vowel) sound — options are the five vowels
 */
interface W { word: string; emoji: string; first: string; last: string; vowel: string }

// Curated word-picture pairs. Every word's picture is unambiguous and its
// asked sounds are regular (no "gi(raffe)" soft-g traps, no silent onsets).
const SIMPLE: W[] = [
  { word: "dog", emoji: "🐶", first: "d", last: "g", vowel: "o" },
  { word: "cat", emoji: "🐱", first: "c", last: "t", vowel: "a" },
  { word: "sun", emoji: "☀️", first: "s", last: "n", vowel: "u" },
  { word: "bed", emoji: "🛏️", first: "b", last: "d", vowel: "e" },
  { word: "pig", emoji: "🐷", first: "p", last: "g", vowel: "i" },
  { word: "hat", emoji: "🎩", first: "h", last: "t", vowel: "a" },
  { word: "bus", emoji: "🚌", first: "b", last: "s", vowel: "u" },
  { word: "fox", emoji: "🦉", first: "f", last: "x", vowel: "o" },
  { word: "map", emoji: "🗺️", first: "m", last: "p", vowel: "a" },
  { word: "leg", emoji: "🦵", first: "l", last: "g", vowel: "e" },
  { word: "net", emoji: "🥅", first: "n", last: "t", vowel: "e" },
  { word: "rat", emoji: "🐀", first: "r", last: "t", vowel: "a" },
  { word: "cup", emoji: "🥤", first: "c", last: "p", vowel: "u" },
  { word: "ten", emoji: "🔟", first: "t", last: "n", vowel: "e" },
  { word: "web", emoji: "🕸️", first: "w", last: "b", vowel: "e" },
  { word: "jet", emoji: "✈️", first: "j", last: "t", vowel: "e" },
  { word: "kid", emoji: "🧒", first: "k", last: "d", vowel: "i" },
  { word: "van", emoji: "🚐", first: "v", last: "n", vowel: "a" },
  { word: "zip", emoji: "🤐", first: "z", last: "p", vowel: "i" },
  { word: "gas", emoji: "⛽", first: "g", last: "s", vowel: "a" },
];

const DIGRAPH: W[] = [
  { word: "ship", emoji: "🚢", first: "sh", last: "p", vowel: "i" },
  { word: "shell", emoji: "🐚", first: "sh", last: "l", vowel: "e" },
  { word: "sheep", emoji: "🐑", first: "sh", last: "p", vowel: "e" },
  { word: "chick", emoji: "🐤", first: "ch", last: "k", vowel: "i" },
  { word: "cheese", emoji: "🧀", first: "ch", last: "z", vowel: "e" },
  { word: "chair", emoji: "🪑", first: "ch", last: "r", vowel: "a" },
  { word: "thumb", emoji: "👍", first: "th", last: "m", vowel: "u" },
  { word: "three", emoji: "3️⃣", first: "th", last: "e", vowel: "e" },
  { word: "whale", emoji: "🐋", first: "wh", last: "l", vowel: "a" },
  { word: "wheel", emoji: "🛞", first: "wh", last: "l", vowel: "e" },
];

const CONSONANTS = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z"];
const DIGRAPHS = ["sh", "ch", "th", "wh"];
const VOWELS = ["a", "e", "i", "o", "u"];

type Mode = "first" | "last" | "digraph" | "vowel";

function bandFor(d: BaseDifficulty): { mode: Mode; optionCount: number } {
  if (d <= 2) return { mode: "first", optionCount: d === 1 ? 3 : 4 };
  if (d <= 4) return { mode: "first", optionCount: 4 };
  if (d <= 6) return { mode: "last", optionCount: 4 };
  if (d <= 8) return { mode: "digraph", optionCount: 4 };
  return { mode: "vowel", optionCount: 5 };
}

function buildOptions(rng: Rng, answer: string, pool: string[], count: number): { options: { text: string; correct: boolean }[]; answerIdx: number } {
  const distractors = rng.shuffle(pool.filter((p) => p !== answer)).slice(0, count - 1);
  const entries = rng.shuffle([{ text: answer, correct: true }, ...distractors.map((t) => ({ text: t, correct: false }))]);
  return { options: entries, answerIdx: entries.findIndex((e) => e.correct) };
}

function generate(seed: number, dIn: Difficulty): ReadingItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed);
  const { mode, optionCount } = bandFor(d);
  const w = mode === "digraph" ? rng.pick(DIGRAPH) : rng.pick(SIMPLE);

  const target = mode === "first" ? w.first : mode === "last" ? w.last : mode === "digraph" ? w.first : w.vowel;
  const pool = mode === "digraph" ? DIGRAPHS : mode === "vowel" ? VOWELS : [...CONSONANTS, "x"];
  const { options, answerIdx } = buildOptions(rng, target, pool, optionCount);

  const ask =
    mode === "last" ? `Which letter makes the LAST sound in ${w.word}?`
    : mode === "vowel" ? `Which letter makes the middle sound in ${w.word}?`
    : mode === "digraph" ? `Which letters make the first sound in ${w.word}?`
    : `Which letter makes the first sound in ${w.word}?`;

  return {
    d: dIn, emoji: w.emoji, speak: ask, options, answer: answerIdx,
    explanation: `${w.word} ${mode === "last" ? "ends" : mode === "vowel" ? "has the middle sound" : "starts"} with "${target}".`,
  };
}

function sample(): { item: ReadingItem; explanation: string } {
  return {
    item: {
      d: 1, emoji: "🐶", speak: "Which letter makes the first sound in dog?",
      options: [{ text: "d", correct: true }, { text: "s", correct: false }, { text: "m", correct: false }],
      answer: 0, explanation: 'dog starts with "d".',
    },
    explanation: "Dog starts with the d sound. So you tap the letter d.",
  };
}

export function audit(item: ReadingItem): string {
  return (
    `<div style="font-family:sans-serif"><div style="font-size:40px">${item.emoji ?? ""}</div>` +
    `<p>🔊 ${item.speak}</p>` +
    item.options.map((o, i) => `<span style="border:3px solid ${i === item.answer ? "#6fcf6f" : "#ccc"};border-radius:8px;padding:4px 10px;margin:3px;display:inline-block;font-size:22px">${o.text}</span>`).join("") +
    `</div>`
  );
}

export const soundHunt: Genre<ReadingItem, number> = {
  id: "soundHunt",
  subtest: "Letter-Sound Knowledge",
  domain: "DEC",
  kidTitle: "Sound Hunt",
  instructions: "Ollie says a word and shows its picture. Listen for the sound he asks about, then tap the letter that makes it.",
  sample,
  generate,
  score: scoreReading,
  timing: { kind: "none" },
  mode: "staircase",
};
