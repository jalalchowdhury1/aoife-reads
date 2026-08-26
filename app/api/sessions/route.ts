import { NextResponse } from "next/server";
import { kvReady, kvSet, kvDel, kvExists, kvLpush, kvSetNx } from "@/lib/engine/kv";
import { loadAllSessions } from "@/lib/engine/sessionsStore";
import { sendTelegram, formatPartSummary } from "@/lib/engine/telegram";
import { isParent } from "@/lib/engine/gate";
import { flagBlock } from "@/lib/engine/quality";
import { LEVELS } from "@/lib/levels";
import type { SessionRecord } from "@/lib/engine/types";

const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/; // ulid

export async function POST(req: Request) {
  if (!kvReady()) return NextResponse.json({ error: "no-kv" }, { status: 200 });
  const raw = await req.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "too-large" }, { status: 413 });
  const s = JSON.parse(raw) as SessionRecord;
  if (!ID.test(s.id) || typeof s.level !== "number" || !Array.isArray(s.blocks)) {
    return NextResponse.json({ error: "bad-session" }, { status: 400 });
  }

  // Server-stamped measurement-quality flags (AGENTS.md decision #14) —
  // always overwrite whatever the client sent, so this is the one place
  // flags are decided from.
  s.blocks = s.blocks.map((b) => ({ ...b, flags: flagBlock(b) }));

  const existed = await kvExists(`session:${s.id}`);
  await kvSet(`session:${s.id}`, s);
  if (!existed) await kvLpush("index", s.id);

  let notified = false;
  if (s.complete && (await kvSetNx(`notified:${s.id}`, new Date().toISOString()))) {
    const level = LEVELS.find((l) => l.id === s.level);
    notified = level ? await sendTelegram(formatPartSummary(s, level)) : false;
    if (!notified) await kvDel(`notified:${s.id}`); // allow retry on the next POST
  }

  return NextResponse.json({ ok: true, notified });
}

export async function GET(req: Request) {
  if (!isParent(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!kvReady()) return NextResponse.json({ error: "no-kv" }, { status: 200 });
  const sessions = await loadAllSessions();
  const level = new URL(req.url).searchParams.get("level");
  return NextResponse.json(level ? sessions.filter((s) => s.level === Number(level)) : sessions);
}
