import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentPosition,
  enqueue,
  fetchServerState,
  flushOutbox,
  loadOutbox,
  loadSessions,
  mergeSessions,
  profileStart,
  saveSessionLocal,
  syncState,
  ulid,
} from "./storage";
import type { CompletedRef } from "./storage";
import { summarize } from "./types";
import type { ItemRecord, LevelConfig, SessionRecord } from "./types";
import { LEVELS } from "../levels";

/** Minimal in-memory Storage stand-in; Vitest runs in a plain node environment (no jsdom). */
class MapStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

beforeEach(() => {
  globalThis.localStorage = new MapStorage() as unknown as Storage;
});

function makeSession(overrides: Partial<SessionRecord> & { level: number; part: string }): SessionRecord {
  return {
    id: ulid(),
    startedAt: "2026-08-20T10:00:00.000Z",
    device: { ua: "test", w: 1024, h: 768 },
    complete: false,
    appVersion: "0.1.0",
    blocks: [],
    ...overrides,
  };
}

describe("ulid", () => {
  it("produces a 26-char Crockford base32 id", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("produces distinct ids across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => ulid()));
    expect(ids.size).toBe(50);
  });
});

describe("saveSessionLocal / loadSessions", () => {
  it("returns an empty list when nothing was saved", () => {
    expect(loadSessions()).toEqual([]);
  });

  it("round-trips a session", () => {
    const s = makeSession({ level: 1, part: "A" });
    saveSessionLocal(s);
    expect(loadSessions()).toEqual([s]);
  });

  it("upserts by id instead of duplicating", () => {
    const s = makeSession({ id: "SESSION-1", level: 1, part: "A" });
    saveSessionLocal(s);
    saveSessionLocal({ ...s, complete: true });
    const sessions = loadSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].complete).toBe(true);
  });

  it("caps the mirror at 200 sessions, dropping the oldest", () => {
    for (let i = 0; i < 205; i++) {
      saveSessionLocal(makeSession({ id: `S${i}`, level: 1, part: "A" }));
    }
    const sessions = loadSessions();
    expect(sessions).toHaveLength(200);
    expect(sessions[0].id).toBe("S5");
    expect(sessions[sessions.length - 1].id).toBe("S204");
  });
});

describe("outbox / flushOutbox / syncState", () => {
  it("is synced when the outbox is empty", () => {
    expect(syncState()).toBe("synced");
  });

  it("is pending right after enqueue", () => {
    enqueue(makeSession({ level: 1, part: "A" }));
    expect(syncState()).toBe("pending");
  });

  it("drops the item once the server confirms {ok:true}", async () => {
    enqueue(makeSession({ id: "S1", level: 1, part: "A" }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true, notified: false }) }) as unknown as typeof fetch;

    const flushed = await flushOutbox();

    expect(flushed).toBe(1);
    expect(loadOutbox()).toEqual([]);
    expect(syncState()).toBe("synced");
  });

  it("keeps the item and bumps tries on {error:'no-kv'}", async () => {
    enqueue(makeSession({ id: "S1", level: 1, part: "A" }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ error: "no-kv" }) }) as unknown as typeof fetch;

    await flushOutbox();

    const outbox = loadOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].tries).toBe(1);
    expect(syncState()).toBe("pending");
  });

  it("keeps the item and bumps tries on a non-2xx response", async () => {
    enqueue(makeSession({ id: "S1", level: 1, part: "A" }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "bad-session" }) }) as unknown as typeof fetch;

    await flushOutbox();

    expect(loadOutbox()[0].tries).toBe(1);
  });

  it("keeps the item unchanged (no try bump) on a network exception", async () => {
    enqueue(makeSession({ id: "S1", level: 1, part: "A" }));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;

    await flushOutbox();

    const outbox = loadOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].tries).toBe(0);
  });

  it("drops the item after 20 failed tries", async () => {
    enqueue(makeSession({ id: "S1", level: 1, part: "A" }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ error: "no-kv" }) }) as unknown as typeof fetch;

    for (let i = 0; i < 20; i++) await flushOutbox();

    expect(loadOutbox()).toEqual([]);
  });
});

describe("currentPosition", () => {
  const levels: LevelConfig[] = [
    {
      id: 1,
      title: "L1",
      feedback: "none",
      parts: [
        { id: "A", title: "A", sticker: "🧩", blocks: [{ genre: "wordSnap" }, { genre: "soundHunt" }] },
        { id: "B", title: "B", sticker: "⚡", blocks: [{ genre: "spellIt" }, { genre: "soundHunt" }] },
      ],
    },
  ];

  it("starts at the first level's first part when there is no history", () => {
    expect(currentPosition(levels, [])).toEqual({ level: 1, part: "A", blockIndex: 0 });
  });

  it("moves to the next part once the current one has a complete session", () => {
    const sessions = [makeSession({ level: 1, part: "A", complete: true, blocks: [{} as never, {} as never] })];
    expect(currentPosition(levels, sessions)).toEqual({ level: 1, part: "B", blockIndex: 0 });
  });

  it("reports blockIndex from the latest incomplete session of the current part", () => {
    const sessions: SessionRecord[] = [
      makeSession({ level: 1, part: "A", complete: true, blocks: [{} as never, {} as never] }),
      makeSession({
        id: "B-EARLIER",
        level: 1,
        part: "B",
        complete: false,
        startedAt: "2026-08-20T09:00:00.000Z",
        blocks: [{} as never],
      }),
      makeSession({
        id: "B-LATEST",
        level: 1,
        part: "B",
        complete: false,
        startedAt: "2026-08-20T11:00:00.000Z",
        blocks: [{} as never, {} as never],
      }),
    ];
    expect(currentPosition(levels, sessions)).toEqual({ level: 1, part: "B", blockIndex: 2 });
  });

  it("parks on the last part once every part is complete", () => {
    const sessions = [
      makeSession({ level: 1, part: "A", complete: true, blocks: [{} as never, {} as never] }),
      makeSession({ level: 1, part: "B", complete: true, blocks: [{} as never, {} as never] }),
    ];
    expect(currentPosition(levels, sessions)).toEqual({ level: 1, part: "B", blockIndex: 2 });
  });
});

describe("currentPosition against the real LEVELS registry", () => {
  it("stays on the last released part once every Level 1 part is complete (no next level exists yet)", () => {
    const level1Complete = LEVELS[0].parts.map((part) =>
      makeSession({ level: 1, part: part.id, complete: true, blocks: part.blocks.map(() => ({} as never)) })
    );
    const released = LEVELS.filter((l) => l.released !== false);
    const pos = currentPosition(released, level1Complete);
    expect(pos.level).toBe(1); // the QA level (99, unreleased) must never surface
  });

  it("stays on Level 1 while any of its parts is still incomplete", () => {
    const allButLastComplete = LEVELS[0].parts.slice(0, -1).map((part) =>
      makeSession({ level: 1, part: part.id, complete: true, blocks: part.blocks.map(() => ({} as never)) })
    );
    const lastPart = LEVELS[0].parts[LEVELS[0].parts.length - 1];
    expect(currentPosition(LEVELS, allButLastComplete)).toEqual({ level: 1, part: lastPart.id, blockIndex: 0 });
  });
});

describe("profileStart", () => {
  it("returns null when the genre has never been played", () => {
    expect(profileStart("wordSnap", [])).toBeNull();
  });

  it("returns the max ceiling recorded for the genre across sessions", () => {
    const low: ItemRecord[] = [{ idx: 0, seed: 1, d: 5, points: 1, max: 1, correct: true, ms: 100, timedOut: false, response: 1 }];
    const high: ItemRecord[] = [{ idx: 0, seed: 2, d: 7, points: 1, max: 1, correct: true, ms: 100, timedOut: false, response: 1 }];
    const s1 = makeSession({
      level: 1,
      part: "A",
      complete: true,
      blocks: [{ genre: "wordSnap", mode: "staircase", startedAt: "t", endedAt: "t", items: low, summary: summarize(low, "staircase") }],
    });
    const s2 = makeSession({
      level: 1,
      part: "A",
      complete: true,
      blocks: [{ genre: "wordSnap", mode: "staircase", startedAt: "t", endedAt: "t", items: high, summary: summarize(high, "staircase") }],
    });
    expect(profileStart("wordSnap", [s1, s2])).toBe(7);
  });

  it("ignores other genres", () => {
    const items: ItemRecord[] = [{ idx: 0, seed: 1, d: 4, points: 1, max: 1, correct: true, ms: 100, timedOut: false, response: 1 }];
    const s = makeSession({
      level: 1,
      part: "A",
      complete: true,
      blocks: [{ genre: "soundHunt", mode: "staircase", startedAt: "t", endedAt: "t", items, summary: summarize(items, "staircase") }],
    });
    expect(profileStart("wordSnap", [s])).toBeNull();
  });
});

describe("mergeSessions", () => {
  it("returns local sessions unchanged when there is no server data", () => {
    const local = [makeSession({ id: "L1", level: 1, part: "A" })];
    expect(mergeSessions(local, [])).toEqual(local);
  });

  it("dedupes by id: a server-completed ref matching a local session id adds nothing", () => {
    const local = [makeSession({ id: "L1", level: 1, part: "A", complete: true })];
    const serverCompleted: CompletedRef[] = [{ level: 1, part: "A", id: "L1", startedAt: "2026-08-20T10:00:00.000Z" }];
    const merged = mergeSessions(local, serverCompleted);
    expect(merged).toHaveLength(1);
    expect(merged).toEqual(local);
  });

  it("keeps a local incomplete session as-is even if the server has no matching completion", () => {
    const local = [makeSession({ id: "L1", level: 1, part: "B", complete: false })];
    const merged = mergeSessions(local, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(local[0]);
    expect(merged[0].complete).toBe(false);
  });

  it("adds a synthetic minimal complete session for a server-only completion", () => {
    const local: SessionRecord[] = [];
    const serverCompleted: CompletedRef[] = [{ level: 1, part: "A", id: "SERVER-1", startedAt: "2026-08-19T10:00:00.000Z" }];
    const merged = mergeSessions(local, serverCompleted);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "SERVER-1",
      level: 1,
      part: "A",
      startedAt: "2026-08-19T10:00:00.000Z",
      blocks: [],
      complete: true,
    });
  });

  it("makes currentPosition treat a server-only completion as done even though local knows nothing about it", () => {
    const levels: LevelConfig[] = [
      {
        id: 1,
        title: "L1",
        feedback: "none",
        parts: [
          { id: "A", title: "A", sticker: "🧩", blocks: [{ genre: "wordSnap" }] },
          { id: "B", title: "B", sticker: "⚡", blocks: [{ genre: "spellIt" }] },
        ],
      },
    ];
    const local: SessionRecord[] = []; // fresh device / wiped localStorage
    const serverCompleted: CompletedRef[] = [{ level: 1, part: "A", id: "SERVER-1", startedAt: "2026-08-19T10:00:00.000Z" }];
    const merged = mergeSessions(local, serverCompleted);
    expect(currentPosition(levels, merged)).toEqual({ level: 1, part: "B", blockIndex: 0 });
  });

  it("keeps local and server-only sessions both when they cover different parts", () => {
    const local = [makeSession({ id: "L1", level: 1, part: "B", complete: false })];
    const serverCompleted: CompletedRef[] = [{ level: 1, part: "A", id: "SERVER-1", startedAt: "2026-08-19T10:00:00.000Z" }];
    const merged = mergeSessions(local, serverCompleted);
    expect(merged.map((s) => s.id).sort()).toEqual(["L1", "SERVER-1"]);
  });
});

describe("fetchServerState", () => {
  it("returns the parsed body on a successful {ok:true} response", async () => {
    const state = {
      ok: true,
      completed: [{ level: 1, part: "A", id: "S1", startedAt: "2026-08-20T10:00:00.000Z" }],
      position: { level: 1, part: "B", blockIndex: 0 },
      blocks: null,
    };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => state }) as unknown as typeof fetch;

    await expect(fetchServerState()).resolves.toEqual(state);
  });

  it("passes level/part as query params", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true, completed: [], position: { level: 1, part: "A", blockIndex: 0 }, blocks: [] }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchServerState(2, "B");

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/state?level=2&part=B");
  });

  it("returns null on a non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as unknown as typeof fetch;
    await expect(fetchServerState()).resolves.toBeNull();
  });

  it("returns null when the body reports ok:false", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false }) }) as unknown as typeof fetch;
    await expect(fetchServerState()).resolves.toBeNull();
  });

  it("returns null on a network exception instead of throwing", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await expect(fetchServerState()).resolves.toBeNull();
  });
});
