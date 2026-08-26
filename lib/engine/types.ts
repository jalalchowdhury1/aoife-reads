import type { QualityFlag } from "./quality";

export type GenreId =
  | "soundHunt" | "echoWords"                     // decoding
  | "wordSnap" | "storyGap" | "readAndAnswer"     // comprehension
  | "spellIt";                                    // spelling
export type Domain = "DEC" | "CMP" | "SPL";
// 1-10 is the standard ramp every genre authors by default. A genre may widen
// past 10 via Genre.maxDifficulty ONLY after real data shows she has hit the
// existing top (owner, 2026-08-23: "go beyond level 10 for those she has
// already reached") — see lib/genres/patternTrain.ts / pictureSudoku.ts for
// the first (and, for now, only) genres that do this.
export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export const MAX_DIFFICULTY = 15;
// The default 1-10 ramp every genre's own unit/fairness tests sweep. A genre
// with `maxDifficulty` > 10 additionally tests its own 11..maxDifficulty band
// in its own test files — DIFFICULTIES itself is intentionally NOT widened,
// so every existing per-genre test keeps meaning "the whole ramp" unchanged.
export const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface ScoreResult { points: number; max: number; correct: boolean }
export type Timing =
  | { kind: "item"; ms: (d: Difficulty) => number }
  | { kind: "block"; ms: number }
  | { kind: "none" };

export interface GenerateOpts { excludeBankIds?: string[] }

export interface Genre<I = unknown, R = unknown> {
  id: GenreId; subtest: string; domain: Domain; kidTitle: string;
  instructions: string;                       // spoken + shown on the sample screen
  sample(): { item: I; explanation: string };
  generate(seed: number, d: Difficulty, opts?: GenerateOpts): I;
  score(item: I, response: R | null): ScoreResult;
  timing: Timing;
  mode: "staircase" | "speedBlock";
  bankId?(item: I): string | undefined;       // bank-backed genres only
  audit?(item: I): string;                    // self-contained HTML/SVG snippet for docs/audit/items.html (no React)
  e2e?: E2EPlan;                              // how the Playwright play-through answers this genre generically (required for new genres)
  retired?: boolean;                          // true = kept for her history only; never put in a level (decision #16)
  maxDifficulty?: number;                     // top authored difficulty; default 10 (see MAX_DIFFICULTY above)
}
export function genreMaxD(g: Genre): number { return g.maxDifficulty ?? 10; }
// The original 1-10 ramp every genre except the fluid-reasoning family still uses
// internally (their own PLAN/lookup tables never need entries past 10 because
// their `maxDifficulty` stays the default). `clampToBase` is the one-line,
// behavior-preserving fix these genres' generate() functions use so the widened
// `Difficulty` union type-checks without touching a single band's real content.
export type BaseDifficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const clampToBase = (d: Difficulty): BaseDifficulty => Math.min(d, 10) as BaseDifficulty;
/** Generic play-through recipe: views expose data-testid="answer-option" (tappable answers) and data-testid="done". */
export type E2EPlan =
  | { kind: "options"; pick: number }          // tap `pick` answer-option(s) then Done (pick 1 = tap + Done)
  | { kind: "tapOnly" }                        // tap one answer-option; no Done (speed genres)
  | { kind: "numpad" }                         // tap digit "1" then Done
  | { kind: "buildThenDone" }                  // just press Done (empty build is a valid wrong answer)
  | { kind: "sequence"; taps: number };         // after any exposure/listening, tap `taps` answer-options then Done

export interface GenreViewProps<I, R> {
  item: I; disabled: boolean; display?: "audio" | "both";
  onReady: () => void;                 // call once when the stimulus is fully presented (timer starts)
  onRespond: (r: R, meta?: { replayed?: boolean; audioFallback?: boolean }) => void;
  reveal?: boolean;                    // practice levels: show the correct answer highlighted, inputs inert
  lastResponse?: R | null;             // with reveal: the child's own answer, so the view can contrast it
}

export interface ItemRecord {
  idx: number; seed: number; d: Difficulty; points: number; max: number; correct: boolean;
  ms: number; timedOut: boolean; response: unknown; bankId?: string;
  fast?: boolean; audioFallback?: boolean; replayed?: boolean;
  bailed?: boolean;                    // she tapped "Not fun" on this item (agency, not ability)
  frontier?: boolean;                  // the free first miss at a personal-record difficulty (decision #19); always paired with teaching: true
  teaching?: boolean;                  // a teaching-item that revealed the answer (see BlockConfig.teachingItems)
  stars?: number;                      // stars earned on this item (0 when none); see lib/engine/rewards.ts
}
export interface BlockSummary {
  attempted: number; correct: number; points: number; max: number;
  ceiling: number | null; medianMs: number; timeouts: number; incorrect?: number;
}
export interface BlockRecord {
  genre: GenreId; mode: "staircase" | "speedBlock"; startedAt: string; endedAt: string;
  items: ItemRecord[]; summary: BlockSummary;
  flags?: QualityFlag[];                // server-stamped measurement-quality flags; see lib/engine/quality.ts
}
export interface SessionRecord {
  id: string; level: number; part: string; startedAt: string; endedAt?: string;
  device: { ua: string; w: number; h: number };
  blocks: BlockRecord[]; complete: boolean; appVersion: string;
}

export interface BlockConfig {
  genre: GenreId; start?: number | "fromProfile"; maxItems?: number; display?: "audio" | "both";
  teachingItems?: number;              // overrides the level-wide teachingItems for this block
  stepUp?: number;                     // overrides the level-wide stepUp for this block
  // Overrides a speed genre's block-length countdown (normally SPEED_BLOCK_MS
  // = 120s). Only meaningful for `mode: "speedBlock"` genres (coding,
  // symbolSearch); staircase genres ignore it. Used by the hidden QA level
  // (lib/levels/levelQa.ts) so an e2e play-through doesn't have to sit
  // through a real 2-minute speed block. See app/play/page.tsx's block
  // Countdown (`cfg.blockMs ?? genre.timing.ms`).
  blockMs?: number;
  // Multiplies this block's per-item time limit (timed staircase genres only).
  // 1.5 = 50% more thinking time. Overrides the remedial default; used by
  // confidence levels where a strong genre's top items were lost to the
  // clock, not the maths (Level 4: her two d10 Story Sums TIMEOUTS).
  timeScale?: number;
}
export interface PartConfig { id: string; title: string; sticker: string; blocks: BlockConfig[] }
export interface LevelConfig {
  id: number; title: string; feedback: "none" | "mark" | "reveal"; parts: PartConfig[];
  weighting?: "none" | "remedial";     // remedial = adapt starts/reps/repeats to her profile (lib/engine/adapt.ts)
  released?: boolean;                  // false = hidden from Play/home until the owner releases it (direct ?level= links still work)
  stepUp?: number;                     // correct-in-a-row needed per step (1 = diagnostic, 2 = practice)
  // Level-wide default count of "teaching items": the first N items of each
  // block get corrective feedback (answer reveal) if missed, and a miss
  // there does not count toward the staircase's two-consecutive-wrong stop
  // rule. Mirrors WISC-V teaching items. A block's own `teachingItems`
  // overrides this. See lib/engine/staircase.ts and AGENTS.md §8/decision 8.
  teachingItems?: number;
  // Whether this level is part of the "fun engine" (praise variety, stars,
  // badges) rather than the ungraded diagnostic. Defaults to true; Level 1
  // (the diagnostic, feedback: "none") sets this to false so the runner uses
  // correctness-free "neutralNext" praise lines instead of celebrating
  // right/wrong answers she is never shown. See lib/engine/praise.ts.
  fun?: boolean;
  // false disables the fast lane (staircase climbs ONLY on stepUp-in-a-row,
  // never per fast answer). Owner decision #18: on a confidence-building
  // level the whole point is a slow, win-heavy ramp — the fast lane would
  // rush her straight back to the frontier that made her tap "Not fun".
  fastLane?: boolean;
  // Ease-in bundle (owner decision #19): at personal-record difficulties the
  // first miss is free (answer shown, no penalty, retry), a counted miss
  // steps DOWN one level for a rebuild win, the per-item clock gets 1.5x (so
  // the data says whether a frontier miss was time or ability), and every
  // answer-reveal waits for HER tap instead of a timer ("Ollie takes sweet
  // time"). See lib/engine/staircase.ts.
  easeIn?: boolean;
}

export function summarize(items: ItemRecord[], mode: "staircase" | "speedBlock"): BlockSummary {
  const attempted = items.length;
  const correct = items.filter(i => i.correct).length;
  const points = items.reduce((s, i) => s + i.points, 0);
  const max = items.reduce((s, i) => s + i.max, 0);
  const ceiling = mode === "staircase" ? items.filter(i => i.points > 0).reduce<number | null>((m, i) => (m === null || i.d > m ? i.d : m), null) : null;
  const sorted = items.map(i => i.ms).sort((a, b) => a - b);
  const medianMs = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const timeouts = items.filter(i => i.timedOut).length;
  const s: BlockSummary = { attempted, correct, points, max, ceiling, medianMs, timeouts };
  if (mode === "speedBlock") s.incorrect = attempted - correct;
  return s;
}
