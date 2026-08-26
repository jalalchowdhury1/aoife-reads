// Difficulty-scale history. When a genre's ramp is rebuilt (gentler bottom, same top),
// results recorded BEFORE the cutover were measured on the old scale and must be
// mapped onto the new one, or the profile/adaptation would read an old "ceiling 3"
// as the new "2-piece basics" and undersell her. Pure; applied in computeProfile.
import type { GenreId, SessionRecord, BlockRecord } from "./types";

interface ScaleChange { genre: GenreId; cutover: string; map: Record<number, number> }

export const SCALE_CHANGES: ScaleChange[] = [
  // (none yet — this app's ramps are original; add entries here when a ramp is rebuilt)
];

export function remapCeiling(genre: GenreId, startedAt: string, ceiling: number | null): number | null {
  if (ceiling === null) return null;
  let c = ceiling;
  for (const ch of SCALE_CHANGES) if (ch.genre === genre && startedAt < ch.cutover) c = ch.map[c] ?? c;
  return c;
}

/** Returns a copy of the block with its summary ceiling and item difficulties on the current scale. */
export function remapBlock(block: BlockRecord, startedAt: string): BlockRecord {
  if (!SCALE_CHANGES.some(ch => ch.genre === block.genre && startedAt < ch.cutover)) return block;
  return { ...block, summary: { ...block.summary, ceiling: remapCeiling(block.genre, startedAt, block.summary.ceiling) } };
}

export function remapSession(s: SessionRecord): SessionRecord {
  // Per BLOCK: a part can straddle a cutover (her 2026-08-23 Part A did — the last
  // Balance round was played on the new ramp inside a session that began before it).
  return { ...s, blocks: s.blocks.map(b => remapBlock(b, b.startedAt || s.startedAt)) };
}
