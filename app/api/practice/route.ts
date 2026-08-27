import { NextResponse } from "next/server";
import { kvReady } from "@/lib/engine/kv";
import { loadAllSessions } from "@/lib/engine/sessionsStore";
import { practiceQueue } from "@/lib/engine/practice";

// Public like /api/state (it is what her own device calls) and equally
// tight-lipped: only replayable refs (genre, seed, d) ever leave — the item
// itself regenerates deterministically on-device, and no answer, score, or
// profile number is in the payload. See lib/engine/practice.ts for what
// qualifies for the queue (owner decision #23).
export async function GET() {
  if (!kvReady()) return NextResponse.json({ ok: false, error: "no-kv" }, { status: 200 });
  const sessions = await loadAllSessions();
  return NextResponse.json({ ok: true, pending: practiceQueue(sessions) });
}
