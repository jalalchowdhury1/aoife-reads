"use client";
import { useEffect, useRef, useState } from "react";

export interface CountdownProps {
  totalMs: number;
  startedAt: number | null; // Date.now() when the item was fully shown; null = not running yet
  onExpire: () => void;
}

/** A calm shrinking bar + seconds readout. Renders nothing until startedAt is set. */
export function Countdown({ totalMs, startedAt, onExpire }: CountdownProps) {
  // Keep the latest onExpire without re-running the RAF loop when the parent
  // hands in a fresh function identity on every render (updated in an effect,
  // never mutated during render).
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // "Adjusting state when a prop changes" pattern: reset remaining during
  // render (not via a setState-in-effect) whenever a new attempt starts.
  const [attemptKey, setAttemptKey] = useState(startedAt);
  const [remaining, setRemaining] = useState(totalMs);
  if (startedAt !== attemptKey) {
    setAttemptKey(startedAt);
    setRemaining(totalMs);
  }

  useEffect(() => {
    if (typeof window === "undefined" || startedAt === null) return;

    let expired = false; // guards onExpire firing more than once for this attempt
    let frame = 0;

    const tick = () => {
      const left = Math.max(0, totalMs - (Date.now() - startedAt));
      setRemaining(left);
      if (left <= 0) {
        if (!expired) {
          expired = true;
          onExpireRef.current();
        }
        return; // stop the loop; nothing left to animate
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [startedAt, totalMs]);

  if (startedAt === null) return null;

  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (remaining / totalMs) * 100)) : 0;
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const barColor = remaining < 10_000 ? "bg-amber-400" : "bg-teal-400";

  return (
    <div className="flex w-full items-center gap-3" data-testid="countdown">
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-teal-100">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-bubble text-xl tabular-nums">{seconds}</span>
    </div>
  );
}

export default Countdown;
