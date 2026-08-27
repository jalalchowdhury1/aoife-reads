"use client";

import { useEffect, useState } from "react";
import type { GenreViewProps } from "@/lib/engine/types";
import type { MathItem } from "@/lib/genres/mathItem";
import { speak, speechAvailable } from "@/lib/engine/speech";

/**
 * Number pad answer view for the two solo MTH genres. Number Crunch shows a
 * computation (or an emoji row to count); Story Problems also speaks the
 * story via Ollie's TTS (the show-and-speak is deliberate — see the genre
 * header). Digits are plain buttons named "0"–"9" so the shared e2e numpad
 * recipe drives it. Reveal mode shows the correct answer beside hers.
 */
export function NumPadView({
  item,
  disabled,
  onReady,
  onRespond,
  reveal = false,
  lastResponse = null,
}: GenreViewProps<MathItem, number>) {
  const [entry, setEntry] = useState("");
  const [shownItem, setShownItem] = useState(item);
  if (item !== shownItem) {
    // adjust-state-during-render on item change (repo lint convention)
    setShownItem(item);
    setEntry("");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (item.speak && speechAvailable()) await speak(item.speak);
      if (!cancelled) onReady();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const push = (digit: string) => {
    if (disabled || entry.length >= 3) return;
    setEntry((e) => (e === "0" ? digit : e + digit));
  };
  const backspace = () => { if (!disabled) setEntry((e) => e.slice(0, -1)); };
  const submit = () => {
    if (disabled || entry.length === 0) return;
    onRespond(Number(entry));
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return (
    <div className="flex min-h-full w-full flex-col items-center">
      <div className="flex w-full flex-1 min-h-0 flex-col items-center justify-center gap-5 overflow-y-auto p-6 pb-2">
        {item.speak && (
          <button
            type="button"
            onClick={() => { if (speechAvailable()) void speak(item.speak!); }}
            disabled={disabled && !reveal}
            className="rounded-2xl bg-teal-100 px-5 py-2 text-lg text-ink"
          >
            🔊 Hear it again
          </button>
        )}
        {item.emoji && (
          <p className="text-5xl tracking-widest" aria-label="pictures to count">{item.emoji}</p>
        )}
        <p className={`text-ink ${item.problem.length > 24 ? "max-w-xl rounded-2xl bg-white p-6 text-2xl leading-relaxed shadow-sm" : "font-bubble text-6xl tracking-wide"}`}>
          {item.problem}
        </p>

        <div className="flex h-16 min-w-40 items-center justify-center rounded-2xl border-2 border-ink/20 bg-white px-6 font-bubble text-4xl tabular-nums text-ink" aria-label="your answer">
          {reveal ? String(lastResponse ?? "") : entry}
        </div>
        {reveal && (
          <p className="text-lg text-ink/60">The answer is <span className="font-semibold">{item.answer}</span></p>
        )}
      </div>

      <div className="w-full max-w-sm p-4 pt-0">
        <div className="grid grid-cols-5 gap-2">
          {digits.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => push(digit)}
              disabled={disabled}
              className="rounded-2xl bg-white py-3 font-bubble text-2xl text-ink shadow disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={backspace}
            disabled={disabled}
            aria-label="Delete last digit"
            className="flex-1 rounded-2xl bg-amber-100 py-3 text-2xl text-ink shadow disabled:opacity-50"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={disabled || entry.length === 0}
            className="flex-[2] rounded-2xl bg-teal-500 py-3 font-bubble text-2xl text-white shadow disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default NumPadView;
