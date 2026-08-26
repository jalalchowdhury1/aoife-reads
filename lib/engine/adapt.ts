// Remedial adaptation: turns a diagnostic profile into per-block start
// difficulties, rep counts, and repeat blocks for a post-diagnostic level.
// Pure and deterministic given (part, level, profile) — see AGENTS.md §7 for
// the owner's rule this encodes and where the knobs live.
import { SCALE_CHANGES } from "./scale";
import type { BlockConfig, GenreId, LevelConfig, PartConfig, Domain } from "./types";
import { genreValue, DOMAIN_GENRES, type Profile, type DomainStat } from "./profile";
import { GENRES } from "../genres";
import { genreMaxD } from "./types";

export type Strength = "weak" | "typical" | "strong";

export interface ResolvedBlock extends BlockConfig {
  start: number;
  maxItems: number;
  strength: Strength;
  repeat?: boolean;
  /** Multiplier on per-item time caps (weak genres in remedial levels get 1.5× — learning a format under a 30 s cap just produces time-outs). Speed blocks ignore it. */
  timeScale: number;
  teachingItems: number;
  stepUp: number;
  /** Her measured ceiling for this genre on the CURRENT ramp (null = never measured). The runner's ease-in frontier (decision #19) sits above max(knownCeiling, start). */
  knownCeiling: number | null;
}

// Genres scored by throughput (perMinute), not a staircase ceiling. Their
// start/maxItems are unused by the runner (a speed block streams items on a
// wall-clock timer), so remedial mode leaves them at the neutral 1/8 instead
// of doing ceiling math that doesn't apply to them.
const SPEED_GENRES = new Set<GenreId>([]); // no speed-block genres in this app

const ALL_GENRES: GenreId[] = (Object.keys(DOMAIN_GENRES) as Domain[]).flatMap((d) => DOMAIN_GENRES[d]);

function clamp(n: number, maxD: number): number {
  return Math.max(1, Math.min(maxD, n));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** weak/typical/strong for every known genre, relative to her own data. */
export function classifyGenres(profile: Profile): Record<GenreId, Strength> {
  const values: Partial<Record<GenreId, number>> = {};
  for (const g of ALL_GENRES) {
    const stats = profile.genres[g];
    if (!stats) continue;
    const v = genreValue(g, stats);
    if (v !== null) values[g] = v;
  }
  const med = median(Object.values(values) as number[]);

  const domainFlagByGenre: Partial<Record<GenreId, DomainStat["flag"]>> = {};
  for (const domain of Object.keys(DOMAIN_GENRES) as Domain[]) {
    const flag = profile.domains[domain].flag;
    for (const g of DOMAIN_GENRES[domain]) domainFlagByGenre[g] = flag;
  }

  const result = {} as Record<GenreId, Strength>;
  for (const g of ALL_GENRES) {
    const value = values[g];
    const domainFlag = domainFlagByGenre[g];
    if (value === undefined) {
      result[g] = "typical";
      continue;
    }
    // WEAK is judged on the genre's OWN value only (2026-08-22 review: Block
    // Builder at ceiling 7 was being tagged weak just because it shares a
    // domain with Piece Picker). The domain flag may only promote to STRONG.
    if (value < med - 0.1) {
      result[g] = "weak";
    } else if (value >= med + 0.1 || (domainFlag === "strength" && value >= med)) {
      result[g] = "strong";
    } else {
      result[g] = "typical";
    }
  }
  return result;
}

/**
 * Resolves a part's blocks against a level's weighting and her profile.
 * Non-remedial levels resolve start/maxItems literally (still classifying
 * each block's strength for display). Remedial levels start weak genres
 * lower with more reps, strong genres near her ceiling with fewer reps, and
 * append one extra block per weak genre at the end of the part.
 */
export function adaptPart(part: PartConfig, level: LevelConfig, profile: Profile): ResolvedBlock[] {
  const strengths = classifyGenres(profile);
  const remedial = level.weighting === "remedial";

  const resolved: ResolvedBlock[] = part.blocks.map((block) => {

    const maxD = genreMaxD(GENRES[block.genre]);
    const stats = profile.genres[block.genre];
    // A genre whose ramp was rebuilt AFTER her last measurement starts from level 1:
    // the old ceiling says nothing about the new basics (owner, 2026-08-23: "build
    // these from level 0, the absolute easiest stuff first").
    const lastMeasuredAt = stats?.trend.length ? stats.trend[stats.trend.length - 1].date : null;
    const rampRebuiltSince = SCALE_CHANGES.some(ch => ch.genre === block.genre && (lastMeasuredAt === null || lastMeasuredAt < ch.cutover));
    const ceiling = rampRebuiltSince ? null : (stats?.ceiling ?? null);
    // ...and is treated as a practice target (weak) until it has been measured on the new ramp.
    const strength: Strength = rampRebuiltSince ? "weak" : (strengths[block.genre] ?? "typical");

    let start: number;
    let maxItems: number;

    if (!remedial) {
      start = block.start === "fromProfile" ? clamp(ceiling === null ? 1 : ceiling - 1, maxD) : (block.start ?? 1);
      maxItems = block.maxItems ?? 8;
    } else if (SPEED_GENRES.has(block.genre)) {
      start = 1;
      maxItems = 8;
    } else {
      // Practice starts WELL below her best (owner, 2026-08-23: "progress needs to be
      // very slow and one step at a time"): weak → 1, typical → ceiling − 3, strong → ceiling − 2.
      const baseStart =
        strength === "weak" ? 1
        : strength === "typical" ? (ceiling === null ? 1 : ceiling - 3)
        : (ceiling === null ? 1 : ceiling - 2);
      start = clamp(baseStart, maxD);
      const baseMax = strength === "weak" ? 10 : strength === "typical" ? 8 : 6;
      maxItems = block.maxItems !== undefined ? Math.min(block.maxItems, baseMax) : baseMax;
    }

    const teachingItems = block.teachingItems ?? level.teachingItems ?? 0;
    const stepUp = block.stepUp ?? level.stepUp ?? 1;

    const timeScale = block.timeScale ?? (level.weighting === "remedial" && strength === "weak" ? 1.5 : 1);
    return { ...block, start, maxItems, strength, teachingItems, timeScale, stepUp, knownCeiling: ceiling };
  });

  if (!remedial) return resolved;

  const repeats: ResolvedBlock[] = resolved
    .filter((b) => b.strength === "weak")
    .map((b) => ({ ...b, repeat: true, maxItems: Math.min(b.maxItems, 6) }));   // repeats are shorter so a part stays ~15 min

  return [...resolved, ...repeats];
}
