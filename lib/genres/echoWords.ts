import type { Genre, Difficulty } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng, type Rng } from "../engine/rng";
import { scoreReading, type ReadingItem } from "./readingItem";

/**
 * Echo Words (pseudoword decoding, domain DEC): Ollie speaks a MADE-UP word;
 * she taps its written form among near-miss spellings. The research digest's
 * verdict made this the anchor decoding genre: made-up words cannot be
 * memorized as sight words, so this is the strongest screen-only proxy for
 * real decoding (cousin of WIAT-4 Pseudoword Decoding / WJ Word Attack —
 * reversed for a no-read-aloud tablet: recognition instead of production).
 *
 * All words are built from curated onset + rime tables so browser TTS
 * pronounces them cleanly (verified in self-play) — never from free letter
 * combinations. Ramp follows the phonics scope-and-sequence:
 *   d1-2  CVC, common rimes (3 then 4 options)
 *   d3    digraph onset (sh/ch/th + short rime)
 *   d4    digraph coda (-ash, -ick, -uth...)
 *   d5    blend onset (st/fl/tr/gr...)
 *   d6    blend coda (-amp, -est, -ond...)
 *   d7    silent-e rimes (-ake, -ide, -oke, -ute)
 *   d8    vowel teams (-ain, -eet, -oad, -eep)
 *   d9    r-controlled (-arn, -orp, -irt, -urm)
 *   d10   two syllables (CVC + CVC compound pseudowords)
 */

// Real words that could be accidentally assembled — keep the task genuinely
// "made-up". Not exhaustive; fairness tests check assembled items against it.
const REAL = new Set([
  "cat", "hat", "bat", "rat", "mat", "sat", "pat", "fat", "vat", "dog", "log", "fog", "hog", "jog",
  "sit", "hit", "bit", "fit", "kit", "lit", "pit", "wit", "sun", "run", "fun", "bun", "nun", "pun",
  "pen", "hen", "ten", "den", "men", "map", "cap", "gap", "lap", "nap", "rap", "sap", "tap", "zap",
  "big", "dig", "fig", "pig", "wig", "hot", "cot", "dot", "got", "jot", "lot", "not", "pot", "rot",
  "cub", "hub", "rub", "sub", "tub", "bed", "fed", "led", "red", "wed", "bad", "dad", "had", "lad",
  "mad", "pad", "sad", "bag", "gag", "lag", "nag", "rag", "tag", "wag", "ban", "can", "fan", "man",
  "pan", "ran", "tan", "van", "cash", "dash", "gash", "hash", "lash", "mash", "rash", "sash", "wash",
  "kick", "lick", "nick", "pick", "sick", "tick", "wick", "shin", "chin", "thin", "ship", "chip",
  "shop", "chop", "shot", "shut", "stop", "step", "stem", "flip", "flap", "flat", "trip", "trap",
  "trim", "grin", "grip", "grab", "camp", "damp", "lamp", "ramp", "best", "jest", "nest", "pest",
  "rest", "test", "vest", "west", "zest", "bond", "fond", "pond", "bake", "cake", "fake", "lake",
  "make", "rake", "sake", "take", "wake", "bide", "hide", "ride", "side", "tide", "wide", "joke",
  "poke", "woke", "yoke", "cute", "jute", "lute", "mute", "gain", "main", "pain", "rain", "vain",
  "beet", "feet", "meet", "load", "road", "toad", "beep", "deep", "jeep", "keep", "peep", "seep",
  "weep", "barn", "darn", "yarn", "born", "corn", "horn", "morn", "torn", "worn", "dirt", "girt",
  "hurt", "curt", "burn", "turn", "hike", "bike", "like", "mike", "pike", "dine", "fine", "line",
  "mine", "nine", "pine", "vine", "wine", "bone", "cone", "gone", "hone", "tone", "zone",
]);

const B: Record<number, { onsets: string[]; rimes: string[] }> = {
  1: { onsets: ["b", "d", "f", "g", "h", "j", "l", "m", "n", "p"], rimes: ["ip", "op", "ab", "ud", "eg"] },
  2: { onsets: ["b", "d", "f", "g", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z"], rimes: ["ip", "op", "ab", "ud", "eg", "im", "ot", "un", "ad", "ib"] },
  3: { onsets: ["sh", "ch", "th", "wh"], rimes: ["ib", "op", "ud", "eg", "im", "ab", "un", "iv"] },
  4: { onsets: ["b", "d", "g", "j", "l", "m", "n", "p", "v", "z"], rimes: ["ash", "ick", "uth", "osh", "ech"] },
  5: { onsets: ["st", "fl", "tr", "gr", "bl", "sp", "cl", "dr"], rimes: ["ip", "ab", "op", "un", "eg", "id"] },
  6: { onsets: ["b", "d", "g", "h", "j", "l", "m", "n", "s", "v"], rimes: ["amp", "est", "ond", "ilt", "usk"] },
  7: { onsets: ["d", "g", "j", "l", "m", "n", "p", "sh", "bl", "pl"], rimes: ["ake", "ide", "oke", "ute", "ane"] },
  8: { onsets: ["d", "gl", "fr", "sm", "j", "pl", "tw", "sn"], rimes: ["ain", "eet", "oad", "eep", "ail"] },
  9: { onsets: ["d", "f", "g", "j", "l", "m", "n", "p", "v", "z"], rimes: ["arn", "orp", "irt", "urm", "erd"] },
  10: { onsets: [], rimes: [] }, // two-syllable band builds from d2 parts
};

function makeWord(rng: Rng, band: { onsets: string[]; rimes: string[] }): string {
  for (let i = 0; i < 60; i++) {
    const w = rng.pick(band.onsets) + rng.pick(band.rimes);
    if (!REAL.has(w)) return w;
  }
  return rng.pick(band.onsets) + rng.pick(band.rimes);
}

function makeTwoSyllable(rng: Rng): string {
  const part = () => makeWord(rng, B[2]);
  for (let i = 0; i < 60; i++) {
    const w = part() + part();
    if (!REAL.has(w) && w.length <= 8) return w;
  }
  return part() + part();
}

/** Distractors = one-substitution neighbors of the target, built from the same band tables so every option looks decodable. */
function neighbors(rng: Rng, target: string, band: { onsets: string[]; rimes: string[] }, twoSyll: boolean): string[] {
  const out = new Set<string>();
  for (let i = 0; i < 200 && out.size < 8; i++) {
    let cand: string;
    if (twoSyll) {
      cand = rng.next() < 0.5 ? makeWord(rng, B[2]) + target.slice(target.length / 2) : target.slice(0, Math.ceil(target.length / 2)) + makeWord(rng, B[2]);
      if (cand.length > 9) continue;
    } else if (rng.next() < 0.5) {
      cand = rng.pick(band.onsets) + target.slice(target.length - rimeLen(target, band));
    } else {
      cand = target.slice(0, target.length - rimeLen(target, band)) + rng.pick(band.rimes);
    }
    if (cand !== target && !REAL.has(cand)) out.add(cand);
  }
  return [...out];
}

function rimeLen(target: string, band: { onsets: string[]; rimes: string[] }): number {
  const rime = band.rimes.find((r) => target.endsWith(r));
  return rime ? rime.length : 2;
}

function generate(seed: number, dIn: Difficulty): ReadingItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed);
  const twoSyll = d === 10;
  const band = twoSyll ? B[2] : B[d];
  const target = twoSyll ? makeTwoSyllable(rng) : makeWord(rng, band);
  const optionCount = d === 1 ? 3 : 4;
  const pool = neighbors(rng, target, band, twoSyll).slice(0, optionCount - 1);
  const entries = rng.shuffle([{ text: target, correct: true }, ...pool.map((t) => ({ text: t, correct: false }))]);
  return {
    d: dIn,
    speak: `${target}. Tap the word that says ${target}.`,
    options: entries,
    answer: entries.findIndex((e) => e.correct),
    explanation: `The word Ollie said is spelled ${target.split("").join("-")}.`,
  };
}

function sample(): { item: ReadingItem; explanation: string } {
  return {
    item: {
      d: 1, speak: "mip. Tap the word that says mip.",
      options: [{ text: "mip", correct: true }, { text: "mop", correct: false }, { text: "nip", correct: false }],
      answer: 0, explanation: "The word Ollie said is spelled m-i-p.",
    },
    explanation: "Ollie said mip. M-i-p says mip — it is a silly made-up word, and that is the fun part!",
  };
}

export function audit(item: ReadingItem): string {
  return (
    `<div style="font-family:sans-serif"><p>🔊 ${item.speak}</p>` +
    item.options.map((o, i) => `<span style="border:3px solid ${i === item.answer ? "#6fcf6f" : "#ccc"};border-radius:8px;padding:4px 10px;margin:3px;display:inline-block;font-size:22px">${o.text}</span>`).join("") +
    `</div>`
  );
}

export const echoWords: Genre<ReadingItem, number> = {
  id: "echoWords",
  subtest: "Pseudoword Decoding",
  domain: "DEC",
  kidTitle: "Echo Words",
  instructions: "Ollie says a silly made-up word. Sound it out in your head, then tap the word that spells what he said.",
  sample,
  generate,
  score: scoreReading,
  timing: { kind: "none" },
  mode: "staircase",
};
