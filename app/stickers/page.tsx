"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVELS } from "@/lib/levels";
import { loadSessions, fetchServerState, mergeSessions } from "@/lib/engine/storage";
import type { SessionRecord } from "@/lib/engine/types";
import { computeBadges, BADGE_DEFS as BADGE_CATALOG, type Badge } from "@/lib/engine/badges";
import { BigButton } from "@/components/BigButton";

function isPartComplete(sessions: SessionRecord[], level: number, part: string): boolean {
  return sessions.some((s) => s.level === level && s.part === part && s.complete);
}

interface PartSticker {
  sticker: string;
  title: string;
  earned: boolean;
}

export default function StickerBookPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [earned, setEarned] = useState<Record<string, Badge>>({});
  const [partStickers, setPartStickers] = useState<PartSticker[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Same data source as home (app/page.tsx): server position/completions
      // merged with the local session mirror. Badges/stars need FULL sessions
      // (not just the "completed" refs /api/state returns), so on a brand
      // new device with an empty local mirror, only the part stickers (which
      // only need "was this part completed") will show — the badge grid
      // stays all-unearned until this device has played something locally.
      const local = loadSessions();
      const state = await fetchServerState();
      if (cancelled) return;
      const sessions = state ? mergeSessions(local, state.completed) : local;

      const badges = computeBadges(sessions);
      const earnedMap: Record<string, Badge> = {};
      for (const b of badges) earnedMap[b.id] = b;

      const stickers: PartSticker[] = LEVELS.flatMap((level) =>
        level.parts.map((p) => ({
          sticker: p.sticker,
          title: p.title,
          earned: isPartComplete(sessions, level.id, p.id),
        }))
      );

      setEarned(earnedMap);
      setPartStickers(stickers);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <main className="flex flex-1 bg-cream" />;
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 bg-cream p-8 text-center">
      <h1 className="font-bubble text-4xl text-ink">Sticker Book</h1>

      <section className="flex flex-col items-center gap-3">
        <h2 className="font-bubble text-2xl text-ink">Parts</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {partStickers.map((p, i) => (
            <div
              key={i}
              className={`flex h-20 w-20 items-center justify-center rounded-3xl text-4xl transition ${
                p.earned ? "bg-white shadow-lg" : "bg-white/60 opacity-50 grayscale"
              }`}
              aria-label={`${p.title}: ${p.earned ? "earned" : "not earned yet"}`}
            >
              {p.sticker}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-3">
        <h2 className="font-bubble text-2xl text-ink">Badges</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {BADGE_CATALOG.map((b) => {
            const got = earned[b.id];
            return (
              <div
                key={b.id}
                className={`flex w-32 flex-col items-center gap-1 rounded-3xl p-3 shadow-lg ${
                  got ? "bg-white" : "bg-white/60"
                }`}
                aria-label={`${b.name}: ${got ? "earned" : "not earned yet"}`}
              >
                {got ? (
                  <span className="text-4xl" aria-hidden>
                    {b.emoji}
                  </span>
                ) : (
                  <span className="text-4xl text-ink/25" aria-hidden>
                    ?
                  </span>
                )}
                <span className={`font-bubble text-sm ${got ? "text-ink" : "text-ink/40"}`}>{b.name}</span>
                {got && (
                  <>
                    <span className="text-xs text-ink/60">{got.blurb}</span>
                    <span className="text-xs text-ink/40">{new Date(got.earnedAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <BigButton onClick={() => router.push("/")} tone="teal">
        Home
      </BigButton>
    </main>
  );
}
