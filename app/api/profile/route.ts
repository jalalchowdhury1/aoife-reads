import { NextResponse } from "next/server";
import { kvReady } from "@/lib/engine/kv";
import { loadAllSessions } from "@/lib/engine/sessionsStore";
import { isParent } from "@/lib/engine/gate";
import { computeProfile } from "@/lib/engine/profile";
import { ensureFlags } from "@/lib/engine/quality";

export async function GET(req: Request) {
  if (!isParent(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!kvReady()) return NextResponse.json({ error: "no-kv" }, { status: 200 });
  // ensureFlags backfills measurement-quality flags on sessions written
  // before AGENTS.md decision #14 shipped, without a KV migration.
  const sessions = ensureFlags(await loadAllSessions());
  return NextResponse.json(computeProfile(sessions));
}
