// Research-anchored typical-age bands for the reading/spelling skill each
// difficulty demands. Anchors are CURRICULUM GRADES (Common Core
// foundational-skills scope-and-sequence + the K-5 reading/spelling ladders
// in docs/research/2026-08-26-reading-app-research.md), converted as
// grade K ≈ ages 5-6, grade 1 ≈ 6-7 … grade 5 ≈ 10-11. Same API as the
// aoife-puzzles module so the ported parent Ages tab works unchanged.
// Never percentiles, never IQ numbers, parent page only.
import type { GenreId } from "./types";
import { genreMaxD } from "./types";
import { GENRES } from "../genres";
import type { Insights } from "./insights";

export interface AgeBand { lo: number; hi: number | null }

export interface DifficultyBenchmark {
  dMin: number;
  dMax: number;
  skill: string;
  typicalAge: AgeBand | null;
  basis: string;
}

export interface GenreBenchmark {
  genre: GenreId;
  caveat?: string;
  bands: DifficultyBenchmark[];
}

const PHONICS = "phonics scope-and-sequence: CVC end-K, digraphs/blends gr1, silent-e end gr1, vowel teams + r-controlled end gr2";
const TEXT = "text-complexity ladder: sentence length, vocabulary grade, and inference demand by grade";
const MATHLADDER = "K-5 computation standards ladder: counting and facts K-1, regrouping gr2, times tables and division facts gr3, multi-digit gr4";
const SPELL = "spelling-pattern sequence: CVC K, digraphs/blends gr1, silent-e/teams gr1-2, endings gr2, multisyllabic gr2-3";

export const BENCHMARKS: Partial<Record<GenreId, GenreBenchmark>> = {
  soundHunt: {
    genre: "soundHunt",
    bands: [
      { dMin: 1, dMax: 2, skill: "First sound of a spoken word", typicalAge: { lo: 4, hi: 6 }, basis: PHONICS },
      { dMin: 3, dMax: 4, skill: "First sounds across the whole alphabet", typicalAge: { lo: 5, hi: 6 }, basis: PHONICS },
      { dMin: 5, dMax: 6, skill: "LAST sound of a spoken word", typicalAge: { lo: 5, hi: 7 }, basis: PHONICS },
      { dMin: 7, dMax: 8, skill: "Digraph first sounds (sh, ch, th, wh)", typicalAge: { lo: 6, hi: 7 }, basis: PHONICS },
      { dMin: 9, dMax: 10, skill: "Middle (short-vowel) sounds", typicalAge: { lo: 5, hi: 7 }, basis: PHONICS },
    ],
  },
  echoWords: {
    genre: "echoWords",
    caveat: "Recognition version of pseudoword decoding — the strongest screen-only decoding proxy.",
    bands: [
      { dMin: 1, dMax: 2, skill: "Decode made-up CVC words (mip, dop)", typicalAge: { lo: 5, hi: 7 }, basis: PHONICS },
      { dMin: 3, dMax: 3, skill: "Digraph onsets (shib, chud)", typicalAge: { lo: 6, hi: 7 }, basis: PHONICS },
      { dMin: 4, dMax: 4, skill: "Digraph endings (-ash, -ick)", typicalAge: { lo: 6, hi: 7 }, basis: PHONICS },
      { dMin: 5, dMax: 6, skill: "Blends (stap, gomp)", typicalAge: { lo: 6, hi: 7 }, basis: PHONICS },
      { dMin: 7, dMax: 7, skill: "Silent-e (shote, dake)", typicalAge: { lo: 6, hi: 8 }, basis: PHONICS },
      { dMin: 8, dMax: 8, skill: "Vowel teams (gleet, froad)", typicalAge: { lo: 7, hi: 8 }, basis: PHONICS },
      { dMin: 9, dMax: 9, skill: "R-controlled (marn, dorp)", typicalAge: { lo: 7, hi: 8 }, basis: PHONICS },
      { dMin: 10, dMax: 10, skill: "Two-syllable made-up words", typicalAge: { lo: 7, hi: 9 }, basis: PHONICS },
    ],
  },
  wordSnap: {
    genre: "wordSnap",
    bands: [
      { dMin: 1, dMax: 2, skill: "Read CVC words silently (cat, bus)", typicalAge: { lo: 5, hi: 7 }, basis: PHONICS },
      { dMin: 3, dMax: 4, skill: "Digraph and blend words (fish, frog)", typicalAge: { lo: 6, hi: 7 }, basis: PHONICS },
      { dMin: 5, dMax: 6, skill: "Silent-e and vowel-team words (cake, rain)", typicalAge: { lo: 6, hi: 8 }, basis: PHONICS },
      { dMin: 7, dMax: 8, skill: "R-controlled and two-syllable words (horse, turtle)", typicalAge: { lo: 7, hi: 8 }, basis: PHONICS },
      { dMin: 9, dMax: 10, skill: "Long words (elephant, telescope)", typicalAge: { lo: 7, hi: 9 }, basis: PHONICS },
    ],
  },
  storyGap: {
    genre: "storyGap",
    bands: [
      { dMin: 1, dMax: 2, skill: "Fill the gap in a 3-6 word sentence", typicalAge: { lo: 5, hi: 7 }, basis: TEXT },
      { dMin: 3, dMax: 4, skill: "Grade-1 sentences with two ideas", typicalAge: { lo: 6, hi: 8 }, basis: TEXT },
      { dMin: 5, dMax: 6, skill: "Grade-2 sentences needing world knowledge", typicalAge: { lo: 7, hi: 9 }, basis: TEXT },
      { dMin: 7, dMax: 8, skill: "Grade-3 sentences needing inference", typicalAge: { lo: 8, hi: 10 }, basis: TEXT },
      { dMin: 9, dMax: 9, skill: "Grade-4 academic vocabulary in context", typicalAge: { lo: 9, hi: 11 }, basis: TEXT },
      { dMin: 10, dMax: 10, skill: "Grade-5 subtle word distinctions", typicalAge: { lo: 10, hi: 12 }, basis: TEXT },
    ],
  },
  readAndAnswer: {
    genre: "readAndAnswer",
    bands: [
      { dMin: 1, dMax: 2, skill: "One-two sentences, literal question", typicalAge: { lo: 5, hi: 7 }, basis: TEXT },
      { dMin: 3, dMax: 4, skill: "Short grade-1 story; first inferences", typicalAge: { lo: 6, hi: 8 }, basis: TEXT },
      { dMin: 5, dMax: 6, skill: "Grade-2 paragraph, inference", typicalAge: { lo: 7, hi: 9 }, basis: TEXT },
      { dMin: 7, dMax: 8, skill: "Grade-3 paragraph, main idea", typicalAge: { lo: 8, hi: 10 }, basis: TEXT },
      { dMin: 9, dMax: 9, skill: "Grade-4 passage, vocabulary in context", typicalAge: { lo: 9, hi: 11 }, basis: TEXT },
      { dMin: 10, dMax: 10, skill: "Grade-5 passage, chained inference", typicalAge: { lo: 10, hi: 12 }, basis: TEXT },
    ],
  },
  spellIt: {
    genre: "spellIt",
    caveat: "Typed spelling measures spelling knowledge; handwriting still needs paper practice.",
    bands: [
      { dMin: 1, dMax: 2, skill: "Spell VC/CVC words (at, cat)", typicalAge: { lo: 5, hi: 7 }, basis: SPELL },
      { dMin: 3, dMax: 3, skill: "Digraph words (ship, bath)", typicalAge: { lo: 6, hi: 7 }, basis: SPELL },
      { dMin: 4, dMax: 4, skill: "Blend words (stop, jump)", typicalAge: { lo: 6, hi: 7 }, basis: SPELL },
      { dMin: 5, dMax: 5, skill: "Silent-e words (cake, ride)", typicalAge: { lo: 6, hi: 8 }, basis: SPELL },
      { dMin: 6, dMax: 6, skill: "Vowel-team words (rain, boat)", typicalAge: { lo: 7, hi: 8 }, basis: SPELL },
      { dMin: 7, dMax: 7, skill: "R-controlled words (bird, farm)", typicalAge: { lo: 7, hi: 8 }, basis: SPELL },
      { dMin: 8, dMax: 8, skill: "Endings (-ing, -es, -ed)", typicalAge: { lo: 7, hi: 9 }, basis: SPELL },
      { dMin: 9, dMax: 9, skill: "Two-syllable words (rabbit, pencil)", typicalAge: { lo: 7, hi: 9 }, basis: SPELL },
      { dMin: 10, dMax: 10, skill: "Common tricky words (because, friend)", typicalAge: { lo: 7, hi: 9 }, basis: SPELL },
    ],
  },
};

// Actual-format, parent-scored subtests share their solo counterparts' ladders.
BENCHMARKS.readAloud = {
  genre: "readAloud",
  caveat: "Parent-scored read-aloud — the closest format to the real Word Reading subtest.",
  bands: [
    { dMin: 1, dMax: 1, skill: "Name letters", typicalAge: { lo: 4, hi: 6 }, basis: PHONICS },
    { dMin: 2, dMax: 3, skill: "Read CVC words aloud", typicalAge: { lo: 5, hi: 7 }, basis: PHONICS },
    { dMin: 4, dMax: 4, skill: "Digraphs and blends aloud", typicalAge: { lo: 6, hi: 7 }, basis: PHONICS },
    { dMin: 5, dMax: 6, skill: "Silent-e and vowel-team words aloud", typicalAge: { lo: 6, hi: 8 }, basis: PHONICS },
    { dMin: 7, dMax: 7, skill: "Two-syllable words aloud", typicalAge: { lo: 7, hi: 8 }, basis: PHONICS },
    { dMin: 8, dMax: 8, skill: "Common irregular words (said, laugh)", typicalAge: { lo: 6, hi: 8 }, basis: PHONICS },
    { dMin: 9, dMax: 9, skill: "Grade-3/4 long words aloud", typicalAge: { lo: 8, hi: 10 }, basis: PHONICS },
    { dMin: 10, dMax: 10, skill: "Grade-4/5 words (mysterious, ancient)", typicalAge: { lo: 9, hi: 11 }, basis: PHONICS },
  ],
};
BENCHMARKS.soundItOut = {
  genre: "soundItOut",
  caveat: "Parent-scored pseudoword reading — the real Word Attack / Pseudoword Decoding format.",
  bands: BENCHMARKS.echoWords!.bands,
};
BENCHMARKS.readToMe = {
  genre: "readToMe",
  caveat: "Read aloud + grown-up-asked questions — the real passage-comprehension administration.",
  bands: BENCHMARKS.readAndAnswer!.bands,
};
BENCHMARKS.spellOnPaper = {
  genre: "spellOnPaper",
  caveat: "Dictation to PAPER, parent-marked — the real Spelling format, handwriting included.",
  bands: BENCHMARKS.spellIt!.bands,
};
// Mathematics composite (2026-08-27): grade-anchored bands for the solo
// ladders; the administered forms share them (same generators).
BENCHMARKS.numberCrunch = {
  genre: "numberCrunch",
  bands: [
    { dMin: 1, dMax: 1, skill: "Count objects to 5", typicalAge: { lo: 3, hi: 5 }, basis: MATHLADDER },
    { dMin: 2, dMax: 3, skill: "Addition within 10", typicalAge: { lo: 5, hi: 6 }, basis: MATHLADDER },
    { dMin: 4, dMax: 4, skill: "Subtraction within 10", typicalAge: { lo: 5, hi: 7 }, basis: MATHLADDER },
    { dMin: 5, dMax: 5, skill: "Add and subtract within 20", typicalAge: { lo: 6, hi: 7 }, basis: MATHLADDER },
    { dMin: 6, dMax: 6, skill: "Two-digit sums, no regrouping", typicalAge: { lo: 6, hi: 8 }, basis: MATHLADDER },
    { dMin: 7, dMax: 7, skill: "Two-digit sums WITH regrouping", typicalAge: { lo: 7, hi: 8 }, basis: MATHLADDER },
    { dMin: 8, dMax: 8, skill: "Times tables (2 to 5)", typicalAge: { lo: 8, hi: 9 }, basis: MATHLADDER },
    { dMin: 9, dMax: 9, skill: "Bigger times tables + division facts", typicalAge: { lo: 8, hi: 10 }, basis: MATHLADDER },
    { dMin: 10, dMax: 10, skill: "Three-digit sums + 2-digit multiplication", typicalAge: { lo: 9, hi: 10 }, basis: MATHLADDER },
  ],
};
BENCHMARKS.storyProblems = {
  genre: "storyProblems",
  bands: [
    { dMin: 1, dMax: 1, skill: "Counting story", typicalAge: { lo: 3, hi: 5 }, basis: MATHLADDER },
    { dMin: 2, dMax: 3, skill: "One-step stories within 10", typicalAge: { lo: 5, hi: 7 }, basis: MATHLADDER },
    { dMin: 4, dMax: 4, skill: "One-step stories within 20", typicalAge: { lo: 6, hi: 7 }, basis: MATHLADDER },
    { dMin: 5, dMax: 5, skill: "Two-step stories", typicalAge: { lo: 7, hi: 8 }, basis: MATHLADDER },
    { dMin: 6, dMax: 6, skill: "Equal-groups stories (times idea)", typicalAge: { lo: 7, hi: 9 }, basis: MATHLADDER },
    { dMin: 7, dMax: 7, skill: "Sharing stories (division idea)", typicalAge: { lo: 7, hi: 9 }, basis: MATHLADDER },
    { dMin: 8, dMax: 8, skill: "Money and change stories", typicalAge: { lo: 7, hi: 9 }, basis: MATHLADDER },
    { dMin: 9, dMax: 9, skill: "Multi-step stories", typicalAge: { lo: 8, hi: 10 }, basis: MATHLADDER },
    { dMin: 10, dMax: 10, skill: "Halves and quarters stories", typicalAge: { lo: 8, hi: 10 }, basis: MATHLADDER },
  ],
};
BENCHMARKS.mathOnPaper = {
  genre: "mathOnPaper",
  caveat: "Administered form of the same computation ladder as Number Crunch.",
  bands: BENCHMARKS.numberCrunch!.bands,
};
BENCHMARKS.mathOutLoud = {
  genre: "mathOutLoud",
  caveat: "Administered form of the same story ladder as Story Problems.",
  bands: BENCHMARKS.storyProblems!.bands,
};

export function benchmarkAt(genre: GenreId, d: number): DifficultyBenchmark | null {
  const gb = BENCHMARKS[genre];
  if (!gb) return null;
  return gb.bands.find((b) => d >= b.dMin && d <= b.dMax) ?? null;
}

/** The strongest demonstrated band at/below `ceiling` (highest typical-age floor). */
export function cumulativeBenchmark(genre: GenreId, ceiling: number | null): DifficultyBenchmark | null {
  const gb = BENCHMARKS[genre];
  if (!gb || ceiling === null) return null;
  let best: DifficultyBenchmark | null = null;
  for (const b of gb.bands) {
    if (b.dMin > ceiling) continue;
    if (b.typicalAge === null) continue;
    if (best === null || best.typicalAge === null || b.typicalAge.lo > best.typicalAge.lo) best = b;
  }
  return best;
}

export const DOB = "2021-01-11";
export function ageYearsAt(iso: string | null): number {
  const at = iso ? new Date(iso) : new Date(DOB);
  const dob = new Date(DOB + "T00:00:00Z");
  return (at.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export type MeasureStatus = "still-winning" | "at-top" | "bailed" | "measured";

export function measureStatus(insights: Insights, genre: GenreId): MeasureStatus | null {
  let latest: { date: string; correct: number; attempted: number; ceiling: number | null; bailed: boolean } | null = null;
  for (const session of insights.timeline) {
    for (const block of session.blocks) {
      if (block.genre !== genre || block.excluded || block.mode !== "staircase") continue;
      const bailed = block.items.some((i) => i.bailed);
      const entry = {
        date: session.date,
        correct: block.summary.correct,
        attempted: block.summary.attempted,
        ceiling: block.summary.ceiling,
        bailed,
      };
      if (latest === null || entry.date > latest.date) latest = entry;
    }
  }
  if (latest === null) return null;
  if (latest.bailed) return "bailed";
  const maxD = genreMaxD(GENRES[genre]);
  if (latest.ceiling !== null && latest.ceiling >= maxD) return "at-top";
  if (latest.attempted >= 4 && latest.correct >= latest.attempted - 1) return "still-winning";
  return "measured";
}

export type AgeVerdict = "ahead" | "age-typical" | "below-band" | "no-anchor";

export function ageVerdict(band: AgeBand | null, ageYears: number): AgeVerdict {
  if (band === null) return "no-anchor";
  if (ageYears < band.lo - 0.25) return "ahead";
  if (band.hi !== null && ageYears > band.hi + 0.25) return "below-band";
  return "age-typical";
}
