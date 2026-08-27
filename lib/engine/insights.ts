// Pure "insights" computation layer for the parent dashboard: turns her raw
// session history into everything the dashboard needs to render, with no
// I/O of its own (the caller loads sessions, e.g. via sessionsStore.ts).
//
// Purity / correctness contract:
//  - Every function here takes `sessions: SessionRecord[]` already loaded.
//  - `remapSession` (lib/engine/scale.ts) is applied exactly ONCE, at the
//    top of `computeInsights`, so a genre whose ramp was rebuilt (decision:
//    "Difficulty scales have history", AGENTS.md §5) reads on today's scale
//    even for sessions recorded before the cutover.
//  - `computeProfile` is called separately on the RAW `sessions` argument
//    (never on the already-remapped list) — it does its own single
//    `remapSession` pass internally, and `SCALE_CHANGES` maps are NOT
//    idempotent: remapping an already-remapped pre-cutover ceiling a second
//    time would shift it again and silently corrupt it.
//  - `ensureFlags` (lib/engine/quality.ts) is the CALLER's job, same as
//    `app/api/profile/route.ts` / `app/api/state/route.ts` already do
//    before calling `computeProfile`. This module accepts `sessions` as-is
//    and reads `block.flags` directly; a session saved before decision #14
//    shipped and never backfilled reads here as if it carried no flags.
//  - No `Date.now()` anywhere. `generatedAt` and `totals.dayStreakEnd` are
//    both derived from the sessions themselves so the module stays
//    deterministic and testable.
import type {
  BlockRecord, BlockSummary, Difficulty, Domain, GenreId, ItemRecord, SessionRecord,
} from "./types";
import { genreMaxD } from "./types";
import { GENRES, GENRE_LIST } from "../genres";
import { remapSession } from "./scale";
import { EXCLUDING_CODES, type QualityFlagCode } from "./quality";
import { computeProfile } from "./profile";
import { starsForItem, totalStars, dayStreak } from "./rewards";

export interface ItemDetail {
  date: string; level: number; part: string; genre: GenreId; d: number;
  correct: boolean; points: number; max: number; seconds: number; timedOut: boolean;
  fast: boolean; teaching: boolean; bailed: boolean; excludedBlock: boolean;
  bankId?: string; seed: number;
}

export interface SkillDetail {
  genre: GenreId; kidTitle: string; retired: boolean; maxD: number;
  ceiling: number | null;
  // one per block, chronological
  ceilingDates: { date: string; ceiling: number | null; excluded: boolean }[];
  perDifficulty: {
    d: number; attempts: number; correct: number; timeouts: number; medianSeconds: number | null;
    mastered: boolean; // >=2 correct, counting only non-teaching, non-excluded
  }[];
  speed?: { runs: { date: string; perMinute: number; accuracy: number }[]; bestPerMinute: number };
  fastRate: number | null; // fast items / correct items (staircase only)
  teachingMisses: number; bails: number; excludedBlocks: number;
  flags: { date: string; code: string; detail: string }[];
  // wrong, non-teaching choice-genre items with a bankId (from valid blocks only —
  // a broken/misunderstood block's misses are not a real vocabulary signal either).
  missedBankItems: { date: string; bankId: string; herPick: string | null; d: number }[];
  items: ItemDetail[]; // full chronological log
}

export interface MatrixCell { status: "mastered" | "passed" | "seen" | "struggled" | "unreached"; attempts: number; correct: number }

export interface Insights {
  generatedAt: string | null; // latest session endedAt/startedAt, NOT wall clock
  totals: { sessions: number; minutes: number; items: number; stars: number; dayStreakEnd: string | null };
  domains: { domain: Domain; label: string; value: number | null; flag: string; genres: GenreId[] }[];
  bundles: { egai: number | null; cpi: number | null };
  skills: SkillDetail[]; // active first (GENRE_LIST order), then retired with data
  matrix: { genre: GenreId; kidTitle: string; retired: boolean; maxD: number; cells: MatrixCell[] }[];
  timeline: {
    sessionId: string; date: string; level: number; part: string; complete: boolean; minutes: number;
    blocks: {
      genre: GenreId; kidTitle: string; mode: string; summary: BlockSummary;
      flags: { code: string; detail: string }[]; excluded: boolean; items: ItemDetail[];
    }[];
  }[];
  deltas: { genre: GenreId; kidTitle: string; from: number | null; to: number | null; when: string }[]; // ceiling changes, most recent first
  engagement: { byDate: { date: string; minutes: number; items: number; stars: number; bails: number }[] };
}

// ---------------------------------------------------------------------------
// small pure helpers
// ---------------------------------------------------------------------------

// Her local calendar date (AGENTS.md: iPad, America/New_York) is what "a
// day" means everywhere below — mirrors lib/engine/rewards.ts's private
// NY_DATE_FORMATTER/nyDate, duplicated here since those aren't exported.
const NY_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
function nyDate(iso: string): string {
  return NY_DATE_FORMATTER.format(new Date(iso));
}

/** Shifts a YYYY-MM-DD calendar date string by `days` (calendar arithmetic only, no timezone). Mirrors rewards.ts's private shiftDate. */
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Block duration in minutes, clamped to 0 for a negative or implausible (>60min) span — a corrupt timestamp pair, not real usage. */
function blockMinutes(block: BlockRecord): number {
  const ms = new Date(block.endedAt).getTime() - new Date(block.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0 || ms > 60 * 60_000) return 0;
  return ms / 60_000;
}

function isExcluded(flags: { code: QualityFlagCode }[] | undefined): boolean {
  return (flags ?? []).some((f) => EXCLUDING_CODES.has(f.code));
}

const DOMAIN_LABELS: Record<Domain, string> = {
  DEC: "Decoding",
  CMP: "Reading Comprehension",
  SPL: "Spelling",
  MTH: "Math",
};
const DOMAIN_ORDER: Domain[] = ["DEC", "CMP", "SPL", "MTH"];

// Bank-backed genres whose response IS a fixed multiple-choice pick — as
// opposed to arithmetic, whose bankId points at a template with no single
// fixed prompt/options to report a "herPick" against.
const BANK_CHOICE_GENRES = new Set<GenreId>(["storyGap", "readAndAnswer"]);

function toItemDetail(session: SessionRecord, block: BlockRecord, item: ItemRecord, excludedBlock: boolean): ItemDetail {
  return {
    date: block.startedAt, level: session.level, part: session.part, genre: block.genre,
    d: item.d, correct: item.correct, points: item.points, max: item.max,
    seconds: item.ms / 1000, timedOut: item.timedOut,
    fast: item.fast === true, teaching: item.teaching === true, bailed: item.bailed === true,
    excludedBlock, bankId: item.bankId, seed: item.seed,
  };
}

/**
 * Resolves what she actually picked for a wrong bank-backed item, by
 * regenerating the item from its own (seed, d) — the same pattern
 * lib/engine/quality.ts already uses to re-derive an item for post-hoc
 * analysis (its animalParade/digitSpan rule-not-understood checks). Retired
 * genres are allowed too — that is where all of her Level 1/2 misses live —
 * but ONLY under two consistency guards, because a retired genre's generator
 * may have changed since she played it (level-0 ramp rebuilds, bank moves):
 * the regenerated item must carry the SAME bankId the play recorded, and the
 * option at her recorded index must score exactly the points she was awarded.
 * If either check fails the pick resolves to null rather than risk showing a
 * wrong "her pick" (decision #14: a false detail is worse than no detail).
 * Options are shuffled per-seed, so the recorded response (an index, or a
 * {pair, reason} for Which Two) can only be read back against a freshly
 * regenerated item, never the raw bank order.
 */
function resolveHerPick(
  genreId: GenreId, seed: number, d: Difficulty, response: unknown,
  recorded: { bankId?: string; points: number },
): string | null {
  const genreDef = GENRES[genreId];
  if (!genreDef) return null;
  try {
    if (typeof response !== "number") return null;
    const item = genreDef.generate(seed, d) as { bankId?: string; options: { text: string; points?: number }[] };
    if (response < 0 || response >= item.options.length) return null;
    // Consistency guards (see doc comment): same bank entry, same score.
    if (recorded.bankId && item.bankId !== recorded.bankId) return null;
    const opt = item.options[response];
    if (typeof opt.points === "number" && opt.points !== recorded.points) return null;
    return opt.text;
  } catch {
    return null;
  }
}

function buildMatrixCells(items: ItemDetail[], maxD: number): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (let d = 1; d <= maxD; d++) {
    // Bailed items and excluded-block items are skipped entirely — they are
    // never "attempts" for mastery purposes.
    const atD = items.filter((i) => i.d === d && !i.bailed && !i.excludedBlock);
    const attempts = atD.length;
    const correct = atD.filter((i) => i.correct).length;
    const correctNonTeaching = atD.filter((i) => i.correct && !i.teaching).length;
    let status: MatrixCell["status"];
    if (attempts === 0) status = "unreached";
    else if (correctNonTeaching >= 2) status = "mastered";
    else if (correct >= 1) status = "passed";
    else if (attempts >= 2) status = "struggled";
    else status = "seen";
    cells.push({ status, attempts, correct });
  }
  return cells;
}

interface InternalItem { detail: ItemDetail; response: unknown }
interface GenreBlockEntry { block: BlockRecord; excluded: boolean; flags: { code: QualityFlagCode; detail: string }[] }

function buildSkill(g: GenreId, internalItems: InternalItem[], blockEntries: GenreBlockEntry[]): SkillDetail {
  const genreDef = GENRES[g];
  const maxD = genreMaxD(genreDef);
  const items = internalItems.map((x) => x.detail);

  const ceilingDates = blockEntries.map((e) => ({
    date: e.block.startedAt, ceiling: e.block.summary.ceiling, excluded: e.excluded,
  }));

  let ceiling: number | null = null;
  for (const e of blockEntries) {
    if (e.excluded || e.block.summary.ceiling === null) continue;
    ceiling = ceiling === null ? e.block.summary.ceiling : Math.max(ceiling, e.block.summary.ceiling);
  }

  const perDifficulty: SkillDetail["perDifficulty"] = [];
  for (let d = 1; d <= maxD; d++) {
    const atD = items.filter((i) => i.d === d && !i.bailed && !i.excludedBlock);
    const attempts = atD.length;
    const correct = atD.filter((i) => i.correct).length;
    const timeouts = atD.filter((i) => i.timedOut).length;
    const seconds = atD.map((i) => i.seconds).sort((a, b) => a - b);
    const medianSeconds = seconds.length ? seconds[Math.floor(seconds.length / 2)] : null;
    const masteredCount = atD.filter((i) => i.correct && !i.teaching).length;
    perDifficulty.push({ d, attempts, correct, timeouts, medianSeconds, mastered: masteredCount >= 2 });
  }

  let speed: SkillDetail["speed"];
  if (genreDef.mode === "speedBlock") {
    const runs = blockEntries.filter((e) => !e.excluded).map((e) => {
      const minutes = blockMinutes(e.block);
      const perMinute = minutes > 0 ? e.block.summary.correct / minutes : 0;
      const accuracy = e.block.summary.attempted > 0 ? e.block.summary.correct / e.block.summary.attempted : 0;
      return { date: e.block.startedAt, perMinute, accuracy };
    });
    const bestPerMinute = runs.reduce((m, r) => Math.max(m, r.perMinute), 0);
    speed = { runs, bestPerMinute };
  }

  let fastRate: number | null = null;
  if (genreDef.mode === "staircase") {
    const eligible = items.filter((i) => !i.bailed && !i.excludedBlock);
    const correctItems = eligible.filter((i) => i.correct);
    fastRate = correctItems.length > 0 ? correctItems.filter((i) => i.fast).length / correctItems.length : null;
  }

  const teachingMisses = items.filter((i) => i.teaching && !i.correct).length;
  const bails = items.filter((i) => i.bailed).length;
  const excludedBlocksCount = blockEntries.filter((e) => e.excluded).length;
  const flags = blockEntries.flatMap((e) => e.flags.map((f) => ({ date: e.block.startedAt, code: f.code as string, detail: f.detail })));

  const missedBankItems: SkillDetail["missedBankItems"] = [];
  if (BANK_CHOICE_GENRES.has(g)) {
    for (const { detail, response } of internalItems) {
      if (detail.correct || detail.teaching || detail.bailed || detail.excludedBlock || !detail.bankId) continue;
      const herPick = resolveHerPick(g, detail.seed, detail.d as Difficulty, response, { bankId: detail.bankId, points: detail.points });
      missedBankItems.push({ date: detail.date, bankId: detail.bankId, herPick, d: detail.d });
    }
  }

  return {
    genre: g, kidTitle: genreDef.kidTitle, retired: genreDef.retired === true, maxD,
    ceiling, ceilingDates, perDifficulty, speed, fastRate,
    teachingMisses, bails, excludedBlocks: excludedBlocksCount, flags, missedBankItems, items,
  };
}

export function computeInsights(sessions: SessionRecord[]): Insights {
  const sorted = sessions.map(remapSession).sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const blocksByGenre = new Map<GenreId, GenreBlockEntry[]>();
  const itemsByGenre = new Map<GenreId, InternalItem[]>();

  for (const session of sorted) {
    for (const block of session.blocks) {
      const flags = block.flags ?? [];
      const excluded = isExcluded(flags);

      let barr = blocksByGenre.get(block.genre);
      if (!barr) { barr = []; blocksByGenre.set(block.genre, barr); }
      barr.push({ block, excluded, flags });

      let iarr = itemsByGenre.get(block.genre);
      if (!iarr) { iarr = []; itemsByGenre.set(block.genre, iarr); }
      for (const item of block.items) {
        iarr.push({ detail: toItemDetail(session, block, item, excluded), response: item.response });
      }
    }
  }

  // Active genres always appear (GENRE_LIST order); retired genres only if she has ever played them.
  const genreOrder: GenreId[] = [...GENRE_LIST];

  const skills = genreOrder.map((g) => buildSkill(g, itemsByGenre.get(g) ?? [], blocksByGenre.get(g) ?? []));

  const matrix = genreOrder.map((g) => {
    const genreDef = GENRES[g];
    const maxD = genreMaxD(genreDef);
    const items = (itemsByGenre.get(g) ?? []).map((x) => x.detail);
    return { genre: g, kidTitle: genreDef.kidTitle, retired: genreDef.retired === true, maxD, cells: buildMatrixCells(items, maxD) };
  });

  // ---- timeline: one entry per session, chronological ----
  const timeline: Insights["timeline"] = sorted.map((session) => {
    const blocks = session.blocks.map((block) => {
      const flags = block.flags ?? [];
      const excluded = isExcluded(flags);
      const genreDef = GENRES[block.genre];
      const items = block.items.map((item) => toItemDetail(session, block, item, excluded));
      return {
        genre: block.genre, kidTitle: genreDef.kidTitle, mode: block.mode, summary: block.summary,
        flags: flags.map((f) => ({ code: f.code as string, detail: f.detail })), excluded, items,
      };
    });
    const minutes = session.blocks.reduce((sum, b) => sum + blockMinutes(b), 0);
    return { sessionId: session.id, date: session.startedAt, level: session.level, part: session.part, complete: session.complete, minutes, blocks };
  });

  // ---- deltas: every ceiling increase for every staircase genre, most recent first ----
  const deltas: Insights["deltas"] = [];
  for (const [g, blockEntries] of blocksByGenre) {
    const genreDef = GENRES[g];
    if (genreDef.mode !== "staircase") continue;
    let best: number | null = null;
    for (const e of blockEntries) {
      if (e.excluded || e.block.summary.ceiling === null) continue;
      const c = e.block.summary.ceiling;
      if (best === null || c > best) {
        deltas.push({ genre: g, kidTitle: genreDef.kidTitle, from: best, to: c, when: e.block.startedAt });
        best = c;
      }
    }
  }
  deltas.sort((a, b) => b.when.localeCompare(a.when));

  // ---- engagement: per NY-calendar-date usage, from every block regardless of validity flags (time spent is real either way) ----
  const engagementMap = new Map<string, { minutes: number; items: number; stars: number; bails: number }>();
  for (const session of sorted) {
    for (const block of session.blocks) {
      const key = nyDate(block.startedAt);
      let e = engagementMap.get(key);
      if (!e) { e = { minutes: 0, items: 0, stars: 0, bails: 0 }; engagementMap.set(key, e); }
      e.minutes += blockMinutes(block);
      e.items += block.items.length;
      e.bails += block.items.filter((i) => i.bailed).length;
      e.stars += block.items.reduce((s, i) => s + (i.stars ?? starsForItem(i, block.mode)), 0);
    }
  }
  const byDate = [...engagementMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));

  // ---- totals ----
  let generatedAt: string | null = null;
  for (const s of sorted) {
    const candidate = s.endedAt ?? s.startedAt;
    if (generatedAt === null || candidate > generatedAt) generatedAt = candidate;
  }

  // dayStreakEnd: the Insights API exposes only the ENDING date of her
  // current streak (no length field) — derived deterministically from the
  // data itself (never wall-clock "today"). "today" for streak purposes is
  // the NY calendar date of `generatedAt`; lib/engine/rewards.ts's
  // `dayStreak` tells us whether a streak is currently active as of that
  // date, and if so, its end is either that date itself or the day before
  // (exactly rewards.ts's own cursor rule — replayed here since dayStreak
  // returns only a length, not the end date).
  let dayStreakEnd: string | null = null;
  if (generatedAt) {
    const today = nyDate(generatedAt);
    if (dayStreak(sorted, today) > 0) {
      const completeDates = new Set(sorted.filter((s) => s.complete).map((s) => nyDate(s.startedAt)));
      dayStreakEnd = completeDates.has(today) ? today : shiftDate(today, -1);
    }
  }

  const totals = {
    sessions: sessions.length,
    minutes: sorted.reduce((sum, s) => sum + s.blocks.reduce((bs, b) => bs + blockMinutes(b), 0), 0),
    items: sorted.reduce((sum, s) => sum + s.blocks.reduce((bs, b) => bs + b.items.length, 0), 0),
    stars: totalStars(sorted),
    dayStreakEnd,
  };

  // ---- domains / bundles: delegate to computeProfile on the RAW sessions (see purity contract above) ----
  const profile = computeProfile(sessions);
  const domains = DOMAIN_ORDER.map((domain) => {
    const stat = profile.domains[domain];
    return { domain, label: DOMAIN_LABELS[domain], value: stat.value, flag: stat.flag as string, genres: stat.genres };
  });

  return {
    generatedAt, totals, domains, bundles: profile.bundles,
    skills, matrix, timeline, deltas, engagement: { byDate },
  };
}
