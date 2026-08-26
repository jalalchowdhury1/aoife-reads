// Stars and streaks: the scoring half of the "fun engine" (owner brief
// 2026-08-23). Pure and deterministic — no I/O, no Date.now(); every
// randomized decision is seeded.
import { makeRng } from "./rng";
import { remapSession } from "./scale";
import type { GenreId, ItemRecord, SessionRecord } from "./types";

/**
 * Stars for a single item.
 * - speedBlock: 1 star per correct item, 0 otherwise.
 * - staircase: a correct item is 1 star, +1 more if it was answered at
 *   difficulty >= 7, +1 more if it was flagged `fast`. A miss or timeout
 *   (item.correct === false) earns 0.
 */
export function starsForItem(item: ItemRecord, mode: "staircase" | "speedBlock"): number {
  if (mode === "speedBlock") return item.correct ? 1 : 0;
  if (!item.correct) return 0;
  let stars = 1;
  if (item.d >= 7) stars += 1;
  if (item.fast) stars += 1;
  return stars;
}

/** Raw "would a bonus star trigger here" roll for one (seed, idx) slot. */
function rawBonusRoll(seed: number, idx: number): boolean {
  return makeRng(seed * 31 + idx).next() < 1 / 6;
}

/**
 * Deterministic "surprise" bonus star: roughly 1 in 6 correct items, and
 * never on two consecutive indices for the same seed (if idx-1 would have
 * triggered, idx is suppressed so the slot doesn't repeat back to back).
 * Callers should only call this for items that were actually correct.
 */
export function bonusStar(seed: number, idx: number): boolean {
  return rawBonusRoll(seed, idx) && !rawBonusRoll(seed, idx - 1);
}

/** Sum of every item's stars in a session (falls back to starsForItem for items saved before `stars` existed). */
export function sessionStars(s: SessionRecord): number {
  let total = 0;
  for (const block of s.blocks) {
    for (const item of block.items) {
      total += item.stars ?? starsForItem(item, block.mode);
    }
  }
  return total;
}

/** Sum of sessionStars across every session given. */
export function totalStars(sessions: SessionRecord[]): number {
  return sessions.reduce((sum, s) => sum + sessionStars(s), 0);
}

// Her local calendar date is what "a day" means for a streak, not the UTC
// date a timestamp happens to fall on (AGENTS.md: iPad, America/New_York).
const NY_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

function nyDate(iso: string): string {
  return NY_DATE_FORMATTER.format(new Date(iso));
}

/** Shifts a YYYY-MM-DD calendar date string by `days` (positive or negative), calendar arithmetic only (no timezone). */
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Consecutive calendar days, ending "today" (or "yesterday" if nothing
 * happened today yet), with at least one complete session. `today` is a
 * YYYY-MM-DD local date string; session dates come from `startedAt`
 * converted to the same local (America/New_York) calendar date, so a
 * session at 2026-08-23T03:30Z (which is still Aug 22 evening in New York)
 * counts toward Aug 22, not Aug 23.
 */
export function dayStreak(sessions: SessionRecord[], today: string): number {
  const completeDates = new Set(sessions.filter((s) => s.complete).map((s) => nyDate(s.startedAt)));

  let cursor: string;
  if (completeDates.has(today)) {
    cursor = today;
  } else {
    cursor = shiftDate(today, -1);
    if (!completeDates.has(cursor)) return 0;
  }

  let streak = 0;
  while (completeDates.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/**
 * Genres where `session`'s ceiling beats the best ceiling seen in `earlier`
 * (staircase blocks only, after remapSession so old-scale ceilings compare
 * fairly against rebuilt ramps). When a genre appears in more than one block
 * of the same session (e.g. a remedial repeat block), its best ceiling
 * within the session is what gets compared.
 */
export function newBests(
  session: SessionRecord,
  earlier: SessionRecord[],
): { genre: GenreId; ceiling: number; previous: number | null }[] {
  const remappedSession = remapSession(session);
  const remappedEarlier = earlier.map(remapSession);

  const bestEarlier = new Map<GenreId, number>();
  for (const s of remappedEarlier) {
    for (const block of s.blocks) {
      if (block.mode !== "staircase" || block.summary.ceiling === null) continue;
      const prev = bestEarlier.get(block.genre);
      bestEarlier.set(block.genre, prev === undefined ? block.summary.ceiling : Math.max(prev, block.summary.ceiling));
    }
  }

  const bestThisSession = new Map<GenreId, number>();
  for (const block of remappedSession.blocks) {
    if (block.mode !== "staircase" || block.summary.ceiling === null) continue;
    const prev = bestThisSession.get(block.genre);
    bestThisSession.set(block.genre, prev === undefined ? block.summary.ceiling : Math.max(prev, block.summary.ceiling));
  }

  const results: { genre: GenreId; ceiling: number; previous: number | null }[] = [];
  for (const [genre, ceiling] of bestThisSession) {
    const previous = bestEarlier.get(genre) ?? null;
    if (previous === null || ceiling > previous) {
      results.push({ genre, ceiling, previous });
    }
  }
  return results;
}

/** Consecutive correct items at the end of `records`. */
export function streakAfter(records: ItemRecord[]): number {
  let streak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (!records[i].correct) break;
    streak++;
  }
  return streak;
}
