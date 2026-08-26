// Measurement-quality flags (AGENTS.md owner decision #14): a broken or
// misunderstood puzzle block must not quietly become a false weakness in
// her profile. This module only DETECTS problems — it is pure and does no
// I/O. Consumers:
//   - app/api/sessions/route.ts stamps `flagBlock` results onto every block
//     server-side (overwriting anything the client sent) before saving.
//   - lib/engine/profile.ts excludes `format-not-understood`/`mass-timeouts`
//     blocks from ceilings/values (EXCLUDING_CODES below); the other codes
//     are informational only.
//   - lib/engine/telegram.ts appends a warning line per flagged block to the
//     part-completion summary.
//   - app/api/profile/route.ts and app/api/state/route.ts call `ensureFlags`
//     to backfill flags on sessions written before this feature shipped,
//     without a KV migration.
import type { BlockRecord, ItemRecord, SessionRecord } from "./types";

export type QualityFlagCode =
  | "format-not-understood"
  | "rapid-wrong"
  | "mass-timeouts"
  | "speed-accuracy"
  | "rule-not-understood"
  | "not-fun"
  | "abandoned";

export interface QualityFlag { code: QualityFlagCode; detail: string }

/** Blocks carrying one of these codes are excluded from ceilings/values in profile.ts. */
export const EXCLUDING_CODES: ReadonlySet<QualityFlagCode> = new Set(["format-not-understood", "mass-timeouts", "rule-not-understood"]);

const RAPID_WRONG_MS = 2000;
const MASS_TIMEOUT_FLOOR_ATTEMPTED = 3;
const MASS_TIMEOUT_RATE = 0.5;
const SPEED_ACCURACY_FLOOR_ATTEMPTED = 10;
const SPEED_ACCURACY_RATE = 0.7;

function itemLabel(i: ItemRecord): string {
  return `d${i.d} in ${(i.ms / 1000).toFixed(1)}s`;
}

/** Detects measurement-quality problems in a single block. Order of checks
 * doesn't matter for correctness; a block can carry more than one flag,
 * except `abandoned` which is exclusive (there is nothing else to say about
 * a block with zero attempts). */
export function flagBlock(block: BlockRecord): QualityFlag[] {
  const { summary, items, mode } = block;

  if (summary.attempted === 0) {
    return [{ code: "abandoned", detail: "No items attempted." }];
  }

  const flags: QualityFlag[] = [];

  // format-not-understood: either the first two REAL (non-teaching) items of
  // a staircase were both wrong at an easy difficulty (the format itself
  // wasn't grasped), or the whole block ended after two or fewer items with
  // nothing right (e.g. two missed teaching items ended the block early).
  let notUnderstood: string | null = null;
  if (mode === "staircase") {
    const nonTeaching = items.filter((i) => !i.teaching);
    if (nonTeaching.length >= 2) {
      const [first, second] = nonTeaching;
      if (!first.correct && !second.correct && first.d <= 2 && second.d <= 2) {
        notUnderstood = "First two items missed at difficulty ≤ 2 — the format may not have been understood.";
      }
    }
  }
  if (!notUnderstood && summary.attempted <= 2 && summary.correct === 0) {
    notUnderstood = `Only ${summary.attempted} item${summary.attempted === 1 ? "" : "s"} attempted, none correct.`;
  }
  if (notUnderstood) flags.push({ code: "format-not-understood", detail: notUnderstood });

  // Number Echo, 2026-08-22: two backward items answered in 3 s with the digits in
  // FORWARD order — the new rule, not her memory, was the problem. Detect a wrong
  // non-forward item whose response is exactly the digits as spoken.
  const bails = block.items.filter(i => i.bailed).length;
  if (bails > 0) {
    flags.push({ code: "not-fun", detail: `She tapped Not fun ${bails === 1 ? "once" : bails + " times"} — wind the difficulty or format down next time.` });
  }

  // rapid-wrong: two or more wrong (not timed-out) answers under 2s each —
  // looks like tapping without registering the question, not a real miss.
  const rapid = items.filter((i) => !i.correct && !i.timedOut && i.ms < RAPID_WRONG_MS);
  if (rapid.length >= 2) {
    flags.push({
      code: "rapid-wrong",
      detail: `${rapid.length} wrong answers in under 2s (${rapid.map(itemLabel).join(", ")}).`,
    });
  }

  // mass-timeouts: at least half the block timed out (audio/device trouble,
  // not a genuine ceiling).
  if (summary.attempted >= MASS_TIMEOUT_FLOOR_ATTEMPTED && summary.timeouts / summary.attempted >= MASS_TIMEOUT_RATE) {
    flags.push({ code: "mass-timeouts", detail: `${summary.timeouts}/${summary.attempted} items timed out.` });
  }

  // speed-accuracy: guessing through a speed block rather than reading it.
  if (mode === "speedBlock" && summary.attempted >= SPEED_ACCURACY_FLOOR_ATTEMPTED) {
    const accuracy = summary.correct / summary.attempted;
    if (accuracy < SPEED_ACCURACY_RATE) {
      flags.push({
        code: "speed-accuracy",
        detail: `${Math.round(accuracy * 100)}% accuracy on a speed block — may be guessing rather than reading.`,
      });
    }
  }

  return flags;
}

/** Per-block flags for a whole session, keyed by block index. Blocks with no flags are omitted. */
export function flagSession(s: SessionRecord): Record<number, QualityFlag[]> {
  const out: Record<number, QualityFlag[]> = {};
  s.blocks.forEach((block, idx) => {
    const flags = flagBlock(block);
    if (flags.length) out[idx] = flags;
  });
  return out;
}

/** Backfills `block.flags` for sessions written before this feature shipped
 * (no KV migration — see AGENTS.md). Blocks that already carry `.flags`
 * (every session saved from now on) are left untouched. */
export function ensureFlags(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.map((s) => {
    if (s.blocks.every((b) => b.flags !== undefined)) return s;
    const computed = flagSession(s);
    return { ...s, blocks: s.blocks.map((b, i) => (b.flags !== undefined ? b : { ...b, flags: computed[i] ?? [] })) };
  });
}
