// The Practice queue, ported from aoife-puzzles decision #23 (2026-08-27):
// "for all of these things, make sure we can go back and practice the ones
// we got wrong." Pure: sessions in, replayable item refs out; every item
// regenerates from (genre, seed, d).
//
// What counts as "one she got wrong": a counted miss or timeout in a REAL
// (non-practice) session. Deliberately excluded:
// - bailed items ("Not fun" is agency, not ability);
// - teaching items (the answer was revealed; the miss never counted);
// - EXAMINER genres (their response is a grown-up's judgement — a solo
//   child cannot replay a parent-scored administration);
// - retired genres (none yet in this repo, but the rule ports with the code).
//
// An item leaves the queue once she answers it correctly anywhere later.
// Newest misses first. Practice results themselves NEVER seed the queue and
// NEVER enter computeProfile (SessionRecord.practice).
import type { Difficulty, GenreId, SessionRecord } from "./types";
import { GENRES, EXAMINER_GENRES } from "../genres";

export interface PracticeRef { genre: GenreId; seed: number; d: Difficulty }

const keyOf = (genre: GenreId, seed: number, d: number) => `${genre}:${seed}:${d}`;
const EXAMINER = new Set<GenreId>(EXAMINER_GENRES);

export const PRACTICE_CAP = 30;

export function practiceQueue(sessions: SessionRecord[], cap = PRACTICE_CAP): PracticeRef[] {
  const clearedKeys = new Set<string>();
  for (const s of sessions) {
    for (const b of s.blocks) {
      for (const i of b.items) {
        if (i.correct) clearedKeys.add(keyOf(b.genre, i.seed, i.d));
      }
    }
  }

  const seen = new Set<string>();
  const pending: { ref: PracticeRef; at: string }[] = [];
  // Newest sessions first, so a miss repeated across sessions carries its
  // MOST RECENT date into the newest-first ordering below.
  const newestFirst = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const s of newestFirst) {
    if (s.practice) continue;
    for (const b of s.blocks) {
      const genre = GENRES[b.genre];
      if (!genre || genre.retired || genre.mode !== "staircase" || EXAMINER.has(b.genre)) continue;
      for (const i of b.items) {
        if (i.correct || i.bailed || i.teaching) continue;
        const key = keyOf(b.genre, i.seed, i.d);
        if (clearedKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        pending.push({ ref: { genre: b.genre, seed: i.seed, d: i.d }, at: s.startedAt });
      }
    }
  }

  pending.sort((a, b) => b.at.localeCompare(a.at));
  return pending.slice(0, cap).map((p) => p.ref);
}
