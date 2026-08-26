"use client";
import { useEffect, useRef, useState } from "react";
import type ConfettiModule from "canvas-confetti";
import type { PartConfig } from "@/lib/engine/types";
import type { Badge } from "@/lib/engine/badges";
import { flushOutbox, syncState } from "@/lib/engine/storage";
import { BigButton } from "./BigButton";
import { Ollie } from "./Ollie";

const SYNC_POLL_MS = 1000;
const SYNC_POLL_TRIES = 10;

// Positives-only recap card (practice levels only — see app/play/page.tsx
// `funOn`). Every field here is something to celebrate; there is no "misses"
// or "score" field on purpose (owner decision #8: never show right/wrong).
export interface PartDoneRecap {
  puzzles: number;
  stars: number;
  bests: { kidTitle: string; d: number }[];
  badges: Badge[];
  nextLine: string;
}

export function PartDone({
  part,
  minutes,
  synced,
  onHome,
  recap,
  pipLine,
}: {
  part: PartConfig;
  minutes: number;
  synced: boolean;
  onHome: () => void;
  recap?: PartDoneRecap | null;
  pipLine?: string | null;
}) {
  // The runner already awaits flushOutbox() before switching to this screen
  // (see app/play/page.tsx endBlock), so `synced` reflects reality on the
  // very first render. This local copy is a belt-and-suspenders fallback for
  // the genuinely-offline case: keep quietly retrying while the screen is up
  // and flip the message the moment the outbox actually drains, instead of
  // leaving a stale "⏳" up for the rest of the visit once she's back online.
  const [saved, setSaved] = useState(synced);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (saved) return;
    let cancelled = false;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      void flushOutbox().then(() => {
        if (cancelled) return;
        if (syncState() === "synced") {
          setSaved(true);
          clearInterval(id);
        } else if (tries >= SYNC_POLL_TRIES) {
          clearInterval(id);
        }
      });
    }, SYNC_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [saved]);

  // QA 2026-08-23: canvas-confetti's default export lazily creates ONE
  // shared full-viewport canvas the first time it's called and never tears
  // it down — it used to stay stuck on top of this recap (covering the "You
  // earned the X sticker" line), then Home, then the Sticker Book, until a
  // hard reload. Owning the canvas ourselves (confetti.create) means React
  // removes it on unmount like any other element, and `.reset()` in the
  // cleanup stops the animation/worker before that happens. Bursts fire from
  // the sides (not dead centre) so the recap text underneath stays readable.
  useEffect(() => {
    let cancelled = false;
    let instance: ConfettiModule.CreateTypes | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // A new sticker (recap.badges) gets a bigger fanfare burst.
    const fanfare = !!recap?.badges?.length;

    // Imported dynamically so SSR (and any non-browser render) never touches
    // canvas-confetti, which reaches for `document` at module load.
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled || !confettiCanvasRef.current) return;
      instance = confetti.create(confettiCanvasRef.current, { resize: true, useWorker: true });
      const burst = () => {
        const shared = { particleCount: fanfare ? 90 : 45, spread: fanfare ? 100 : 70 };
        instance?.({ ...shared, origin: { x: 0.15, y: 0.7 } });
        instance?.({ ...shared, origin: { x: 0.85, y: 0.7 } });
      };
      burst();
      timers.push(setTimeout(burst, 500));
      timers.push(setTimeout(burst, 1000));
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      instance?.reset();
      instance = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount, sized by the recap this instance was given
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center bg-cream text-center">
      {/* Owned by this component (not the library's shared global canvas) so
          it's guaranteed gone the moment PartDone unmounts. z-0, behind the
          recap content below, and pointer-events-none so it never eats taps. */}
      <canvas ref={confettiCanvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />

      {/* The only scrolling region here (min-h-0 caps it to the space Home's
          row below doesn't take, instead of growing past it): the inner
          min-h-full wrapper centers everything as a group when it fits — same
          look as before — and just packs from the top, scrollable, when it's
          taller than the screen (e.g. a big recap card).
          QA 2026-08-23: justify-center-safe (not plain justify-center) —
          unprefixed `center` keeps centering around the midpoint even when
          content overflows, pushing half of it ABOVE the reachable scroll
          top (verified live on SampleScreen); `safe center` falls back to
          start-alignment exactly when that would happen. */}
      <div className="relative z-10 flex w-full min-h-0 flex-1 flex-col overflow-y-auto px-8 pt-8">
        <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center-safe gap-6">
          <div className="text-8xl">{part.sticker}</div>
          <h1 className="font-bubble text-4xl text-ink">All done for today!</h1>
          <p className="font-bubble text-2xl text-teal-600">You earned the {part.sticker} sticker</p>
          <p className="text-base text-ink/60">{minutes} min</p>
          <p className="text-lg text-ink/70">{saved ? "☁️ Saved" : "⏳ Will save when you're back online"}</p>

          {recap && (
            <div className="flex w-full max-w-sm flex-col gap-2 rounded-3xl bg-white p-4 text-left shadow-lg">
              <p className="font-bubble text-lg text-ink">
                Today: {recap.puzzles} puzzles · ⭐ {recap.stars} stars
              </p>
              {recap.bests.map((b, i) => (
                <p key={`best-${i}`} className="text-base text-teal-700">
                  New best: {b.kidTitle} level {b.d}
                </p>
              ))}
              {recap.badges.map((b) => (
                <p key={b.id} className="text-base text-amber-600">
                  NEW sticker: {b.emoji} {b.name}
                </p>
              ))}
              <p className="text-base text-ink/70">{recap.nextLine}</p>
            </div>
          )}

          {pipLine && <Ollie mood="proud" line={pipLine} speak />}
        </div>
      </div>

      {/* A fixed-size sibling right after the scrollable content above (same
          pattern as the genre views' sticky action rows): Home always stays
          visible, never scrolled away. */}
      <div className="relative z-10 flex w-full shrink-0 justify-center bg-cream px-8 pb-8 pt-3">
        <BigButton onClick={onHome} tone="teal">
          Home
        </BigButton>
      </div>
    </div>
  );
}

export default PartDone;
