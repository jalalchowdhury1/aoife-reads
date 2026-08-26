import type { SessionRecord, GenreId, Domain } from "./types";
import { genreMaxD } from "./types";
import { GENRES } from "../genres";
import { remapSession } from "./scale";
import { EXCLUDING_CODES, type QualityFlagCode } from "./quality";

export interface GenreStats { attempted: number; correct: number; points: number; max: number; ceiling: number | null; medianMs: number; timeouts: number; perMinute?: number; trend: { date: string; ceiling: number | null; points: number; max: number; flagged?: boolean }[] }
export interface DomainStat { value: number | null; z: number | null; flag: "strength" | "typical" | "weakness" | "n/a"; genres: GenreId[] }
// One entry per measurement-quality flag raised anywhere in her session
// history (AGENTS.md decision #14) — shown verbatim on the parent page.
// `format-not-understood`/`mass-timeouts` entries also mean the block that
// raised them was excluded from that genre's ceiling/value/attempted/etc
// below (it still appears in that genre's `trend`, marked `flagged: true`).
export interface ProfileFlag { sessionId: string; part: string; genre: GenreId; code: QualityFlagCode; detail: string }
export interface Profile { sessions: number; genres: Partial<Record<GenreId, GenreStats>>; domains: Record<Domain, DomainStat>; bundles: { egai: number | null; cpi: number | null }; computedAt: string; flags: ProfileFlag[] }
export const DOMAIN_GENRES: Record<Domain, GenreId[]> = {
  DEC: ["soundHunt", "echoWords", "readAloud", "soundItOut"],
  CMP: ["wordSnap", "storyGap", "readAndAnswer", "readToMe"],
  SPL: ["spellIt", "spellOnPaper"],
};
// Achievement-style bundles mirroring the WIAT-4 K-1 composites (research
// digest): Reading = word reading + comprehension; Written = spelling.
// (Alphabet Writing Fluency is handwriting — practiced on paper, not here.)
export const READING: GenreId[] = ["soundHunt", "echoWords", "wordSnap", "storyGap", "readAndAnswer", "readAloud", "soundItOut", "readToMe"];
export const WRITTEN: GenreId[] = ["spellIt", "spellOnPaper"];
// Kept for API compatibility with the ported parent page.
export const EGAI = READING;
export const CPI = WRITTEN;
const SPEED_CEILING_PER_MIN: Partial<Record<GenreId, number>> = {};

const DOMAIN_KEYS: Domain[] = ["DEC", "CMP", "SPL"];
const VC_GENRES = new Set<GenreId>([]); // no 2/1/0-scored genres in this app (all items are 1/0)

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function genreValue(g: GenreId, gs: GenreStats): number | null {
  const speedCeiling = SPEED_CEILING_PER_MIN[g];
  if (speedCeiling !== undefined) {
    return gs.perMinute === undefined ? null : Math.min(1, gs.perMinute / speedCeiling);
  }
  if (VC_GENRES.has(g)) {
    return gs.max > 0 ? gs.points / gs.max : null;
  }
  return gs.ceiling === null ? null : gs.ceiling / genreMaxD(GENRES[g]);
}

function bundleValue(list: GenreId[], genres: Partial<Record<GenreId, GenreStats>>): number | null {
  const vals: number[] = [];
  for (const g of list) {
    const gs = genres[g];
    if (!gs) continue;
    const v = genreValue(g, gs);
    if (v !== null) vals.push(v);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function computeProfile(sessions: SessionRecord[]): Profile {
  // Old-scale results are mapped onto the current ramps first (lib/engine/scale.ts).
  const sorted = sessions.map(remapSession).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const genres: Partial<Record<GenreId, GenreStats>> = {};
  const msByGenre: Partial<Record<GenreId, number[]>> = {};
  const flags: ProfileFlag[] = [];

  for (const session of sorted) {
    for (const block of session.blocks) {
      const g = block.genre;
      const blockFlags = block.flags ?? [];
      for (const f of blockFlags) {
        flags.push({ sessionId: session.id, part: session.part, genre: g, code: f.code, detail: f.detail });
      }
      // A broken or misunderstood block must not become a false weakness
      // (AGENTS.md decision #14): format-not-understood/mass-timeouts
      // blocks are excluded from every aggregate below, but still show up
      // in the genre's trend (flagged: true) and in the flags list above.
      const excluded = blockFlags.some(f => EXCLUDING_CODES.has(f.code));

      let gs = genres[g];
      if (!gs) {
        gs = { attempted: 0, correct: 0, points: 0, max: 0, ceiling: null, medianMs: 0, timeouts: 0, trend: [] };
        genres[g] = gs;
      }

      if (!excluded) {
        gs.attempted += block.summary.attempted;
        gs.correct += block.summary.correct;
        gs.points += block.summary.points;
        gs.max += block.summary.max;
        gs.timeouts += block.summary.timeouts;
        if (block.summary.ceiling !== null) {
          gs.ceiling = gs.ceiling === null ? block.summary.ceiling : Math.max(gs.ceiling, block.summary.ceiling);
        }
        (msByGenre[g] ??= []).push(...block.items.map(i => i.ms));

        if (SPEED_CEILING_PER_MIN[g] !== undefined) {
          const rawMs = new Date(block.endedAt).getTime() - new Date(block.startedAt).getTime();
          const blockMs = Math.max(60_000, rawMs);
          const perMinute = block.summary.correct / (blockMs / 60_000);
          gs.perMinute = gs.perMinute === undefined ? perMinute : Math.max(gs.perMinute, perMinute);
        }
      }

      gs.trend.push({
        date: session.startedAt,
        ceiling: block.summary.ceiling,
        points: block.summary.points,
        max: block.summary.max,
        flagged: excluded ? true : undefined,
      });
    }
  }

  for (const g of Object.keys(genres) as GenreId[]) {
    genres[g]!.medianMs = median(msByGenre[g] ?? []);
  }

  const domains = {} as Record<Domain, DomainStat>;
  const rawValues: Partial<Record<Domain, number>> = {};
  for (const domain of DOMAIN_KEYS) {
    const glist = DOMAIN_GENRES[domain];
    const vals: number[] = [];
    for (const g of glist) {
      const gs = genres[g];
      if (!gs) continue;
      const v = genreValue(g, gs);
      if (v !== null) vals.push(v);
    }
    const value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    domains[domain] = { value, z: null, flag: "n/a", genres: glist };
    if (value !== null) rawValues[domain] = value;
  }

  const presentDomains = DOMAIN_KEYS.filter(d => rawValues[d] !== undefined);
  const values = presentDomains.map(d => rawValues[d]!);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const variance = values.length ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length : 0;
  const sd = Math.sqrt(variance);

  for (const d of presentDomains) {
    const value = rawValues[d]!;
    const z = sd > 0 && presentDomains.length >= 2 ? (value - mean) / sd : 0;
    const flag: DomainStat["flag"] = z >= 0.5 ? "strength" : z <= -0.5 ? "weakness" : "typical";
    domains[d] = { value, z, flag, genres: DOMAIN_GENRES[d] };
  }

  const bundles = { egai: bundleValue(EGAI, genres), cpi: bundleValue(CPI, genres) };

  return { sessions: sessions.length, genres, domains, bundles, computedAt: new Date().toISOString(), flags };
}
