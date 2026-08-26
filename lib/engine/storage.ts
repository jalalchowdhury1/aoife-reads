// Client-side persistence: a localStorage mirror of every session plus an
// outbox that retries POSTs to /api/sessions. Every localStorage/window touch
// is guarded so this module can also be imported under Vitest (node env),
// where tests inject a fake `globalThis.localStorage`.
import type { GenreId, LevelConfig, SessionRecord } from "./types";
import type { ResolvedBlock } from "./adapt";

const SESSIONS_KEY = "aoife-reads:sessions";
const OUTBOX_KEY = "aoife-reads:outbox";
const MAX_SESSIONS = 200;
const MAX_TRIES = 20;
const STATE_FETCH_TIMEOUT_MS = 5000;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32, no I L O U

function encodeTime(time: number, len: number): string {
  let str = "";
  let t = time;
  for (let i = len - 1; i >= 0; i--) {
    const mod = t % 32;
    str = CROCKFORD[mod] + str;
    t = (t - mod) / 32;
  }
  return str;
}

function randomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** 26-char Crockford-base32 ULID: 10 chars of ms-timestamp + 16 chars of randomness. */
export function ulid(): string {
  const rand = randomBytes(16);
  let randStr = "";
  for (let i = 0; i < rand.length; i++) randStr += CROCKFORD[rand[i] % 32];
  return encodeTime(Date.now(), 10) + randStr;
}

// Guards every localStorage touch so this module is safe under Next.js SSR
// (no `localStorage` global there) and importable under Vitest's node
// environment (no `window`/`localStorage` unless a test injects one).
function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSessions(): SessionRecord[] {
  return readJson<SessionRecord[]>(SESSIONS_KEY, []);
}

export function saveSessionLocal(s: SessionRecord): void {
  if (!hasStorage()) return;
  const sessions = loadSessions();
  const idx = sessions.findIndex((existing) => existing.id === s.id);
  if (idx >= 0) sessions[idx] = s;
  else sessions.push(s);
  const capped = sessions.length > MAX_SESSIONS ? sessions.slice(sessions.length - MAX_SESSIONS) : sessions;
  writeJson(SESSIONS_KEY, capped);
}

export interface OutboxItem {
  session: SessionRecord;
  tries: number;
}

export function loadOutbox(): OutboxItem[] {
  return readJson<OutboxItem[]>(OUTBOX_KEY, []);
}

function saveOutbox(items: OutboxItem[]): void {
  writeJson(OUTBOX_KEY, items);
}

export function enqueue(s: SessionRecord): void {
  if (!hasStorage()) return;
  const outbox = loadOutbox();
  const idx = outbox.findIndex((item) => item.session.id === s.id);
  const entry: OutboxItem = { session: s, tries: 0 };
  if (idx >= 0) outbox[idx] = entry;
  else outbox.push(entry);
  saveOutbox(outbox);
}

/** POSTs every queued session. Returns the number successfully flushed. */
export async function flushOutbox(): Promise<number> {
  const outbox = loadOutbox();
  if (!outbox.length) return 0;

  let flushed = 0;
  const remaining: OutboxItem[] = [];

  for (const item of outbox) {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.session),
      });
      let body: { ok?: boolean; error?: string } = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      if (res.ok && body.ok) {
        flushed++;
        continue; // drop: delivered
      }
      // `{error:"no-kv"}` (status 200) or any non-2xx: keep, bump tries, drop after MAX_TRIES
      const tries = item.tries + 1;
      if (tries < MAX_TRIES) remaining.push({ ...item, tries });
      // else: drop from the outbox (the session stays in the local mirror already)
    } catch {
      // network exception: keep untouched, no increment
      remaining.push(item);
    }
  }

  saveOutbox(remaining);
  return flushed;
}

export function syncState(): "synced" | "pending" {
  return loadOutbox().length === 0 ? "synced" : "pending";
}

export function currentPosition(
  levels: LevelConfig[],
  sessions: SessionRecord[]
): { level: number; part: string; blockIndex: number } {
  for (const level of levels) {
    for (const part of level.parts) {
      const partSessions = sessions.filter((s) => s.level === level.id && s.part === part.id);
      if (partSessions.some((s) => s.complete)) continue; // this part is done; move on

      const incomplete = partSessions.filter((s) => !s.complete);
      const latest = incomplete.length
        ? incomplete.reduce((a, b) => (a.startedAt > b.startedAt ? a : b))
        : null;
      return { level: level.id, part: part.id, blockIndex: latest ? latest.blocks.length : 0 };
    }
  }

  // Everything complete: park on the last part of the last level.
  const lastLevel = levels[levels.length - 1];
  const lastPart = lastLevel?.parts[lastLevel.parts.length - 1];
  return { level: lastLevel?.id ?? 1, part: lastPart?.id ?? "A", blockIndex: lastPart?.blocks.length ?? 0 };
}

/** Highest recorded ceiling for a genre across all local sessions, or null if never played. */
export function profileStart(genre: GenreId, sessions: SessionRecord[]): number | null {
  let max: number | null = null;
  for (const s of sessions) {
    for (const b of s.blocks) {
      if (b.genre !== genre || b.summary.ceiling === null) continue;
      max = max === null ? b.summary.ceiling : Math.max(max, b.summary.ceiling);
    }
  }
  return max;
}

/** Minimal record of a session KV knows is complete, from GET /api/state. */
export interface CompletedRef { level: number; part: string; id: string; startedAt: string }

export interface ServerState {
  ok: true;
  completed: CompletedRef[];
  position: { level: number; part: string; blockIndex: number };
  blocks: ResolvedBlock[] | null;
}

/**
 * Calls GET /api/state (the server's source of truth for where she is and
 * how a part should be adapted — see AGENTS.md §2/§5). Returns the parsed
 * body on success, or null on any error, non-2xx response, malformed body,
 * or if it doesn't answer within STATE_FETCH_TIMEOUT_MS (a flaky/offline
 * connection must never hang the runner or the home screen). Callers fall
 * back to local-only data on null.
 */
export async function fetchServerState(level?: number, part?: string): Promise<ServerState | null> {
  if (typeof fetch === "undefined") return null;

  const params = new URLSearchParams();
  if (level !== undefined) params.set("level", String(level));
  if (part !== undefined) params.set("part", part);
  const qs = params.toString();
  const url = qs ? `/api/state?${qs}` : "/api/state";

  const hasAbort = typeof AbortController !== "undefined";
  const controller = hasAbort ? new AbortController() : undefined;
  const timer = hasAbort ? setTimeout(() => controller!.abort(), STATE_FETCH_TIMEOUT_MS) : undefined;

  try {
    const res = await fetch(url, { signal: controller?.signal, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<ServerState> | null;
    if (!body || body.ok !== true) return null;
    return body as ServerState;
  } catch {
    return null; // network error, timeout/abort, or bad JSON
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Unions local sessions with server-known completions the local mirror never
 * saw (lost localStorage, or a different device). For every (level, part)
 * the server says is complete that isn't already present locally (matched by
 * id), synthesizes a minimal complete SessionRecord so `currentPosition` and
 * `computeProfile` treat that part as done without ever needing its items.
 * Local sessions (complete or not) are always kept as-is.
 */
export function mergeSessions(local: SessionRecord[], serverCompleted: CompletedRef[]): SessionRecord[] {
  const localIds = new Set(local.map((s) => s.id));
  const synthesized: SessionRecord[] = [];
  for (const ref of serverCompleted) {
    if (localIds.has(ref.id)) continue;
    synthesized.push({
      id: ref.id,
      level: ref.level,
      part: ref.part,
      startedAt: ref.startedAt,
      device: { ua: "server", w: 0, h: 0 },
      blocks: [],
      complete: true,
      appVersion: "server",
    });
  }
  return [...local, ...synthesized];
}
