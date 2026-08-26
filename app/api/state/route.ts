import { NextResponse } from "next/server";
import { kvReady } from "@/lib/engine/kv";
import { loadAllSessions } from "@/lib/engine/sessionsStore";
import { currentPosition } from "@/lib/engine/storage";
import { computeProfile } from "@/lib/engine/profile";
import { adaptPart, type ResolvedBlock } from "@/lib/engine/adapt";
import { ensureFlags } from "@/lib/engine/quality";
import { LEVELS, RELEASED_LEVELS } from "@/lib/levels";

// Public (no PARENT_KEY): this is what the child's own device calls to learn
// where she is and what a part should look like, WITHOUT ever exposing her
// items, points, ceilings, or the raw profile itself — only the resolved
// plan (start/maxItems/teachingItems/timeScale/strength/repeat) for the one
// part asked about. See AGENTS.md §2/§5: the server is the source of truth
// for position and adaptation; local storage is a mirror/offline fallback.
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(req: Request) {
  if (!kvReady()) return NextResponse.json({ ok: false }, { status: 200, headers: NO_STORE });

  // ensureFlags backfills measurement-quality flags (AGENTS.md decision
  // #14) on sessions written before this feature shipped, so a remedial
  // level's start/reps are computed off the flag-aware profile even for
  // her existing Level 1 data, with no KV migration.
  const sessions = ensureFlags(await loadAllSessions());

  const completed = sessions
    .filter((s) => s.complete)
    .map((s) => ({ level: s.level, part: s.part, id: s.id, startedAt: s.startedAt }));

  const position = currentPosition(RELEASED_LEVELS, sessions);

  const { searchParams } = new URL(req.url);
  const levelParam = searchParams.get("level");
  const partParam = searchParams.get("part");

  let blocks: ResolvedBlock[] | null = null;
  if (levelParam !== null && partParam !== null) {
    const levelId = Number(levelParam);
    const levelCfg = LEVELS.find((l) => l.id === levelId);
    const partCfg = levelCfg?.parts.find((p) => p.id === partParam);
    if (levelCfg && partCfg) {
      blocks = adaptPart(partCfg, levelCfg, computeProfile(sessions));
    }
  }

  return NextResponse.json({ ok: true, completed, position, blocks }, { status: 200, headers: NO_STORE });
}
