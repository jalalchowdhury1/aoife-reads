"use client";
import { useEffect, useRef } from "react";
import type ConfettiModule from "canvas-confetti";
import { Ollie, type OllieMood } from "./Ollie";
import { playChime } from "@/lib/chime";

/**
 * The "fun layer" replacement for the plain "Yes!" screen: Ollie celebrates a
 * correct answer with a line from lib/engine/praise.ts plus a gentle chime,
 * and (for a 5-streak) a small confetti burst. Shown for ~1.6s by the runner
 * (app/play/page.tsx) and tap-skippable like every other fun screen.
 */
export function PraiseScreen({ mood, line, celebrate }: { mood: OllieMood; line: string; celebrate?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    playChime();
    if (!celebrate) return;
    let cancelled = false;
    let instance: ConfettiModule.CreateTypes | null = null;
    // QA 2026-08-23: own canvas instead of canvas-confetti's shared global
    // one (which never gets torn down and was found stuck over Home/Sticker
    // Book after a 5-streak). React removes this canvas on unmount; reset()
    // in the cleanup stops the animation/worker first.
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled || !canvasRef.current) return;
      instance = confetti.create(canvasRef.current, { resize: true, useWorker: true });
      instance({ particleCount: 50, spread: 65, origin: { y: 0.6 } });
    });
    return () => {
      cancelled = true;
      instance?.reset();
      instance = null;
    };
    // Fire once per shown line, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3" data-testid="between-feedback">
      {celebrate && <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <Ollie mood={mood} line={line} speak />
      </div>
    </div>
  );
}

export default PraiseScreen;
