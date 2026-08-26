"use client";

import { useEffect, useState } from "react";
import type { GenreViewProps } from "@/lib/engine/types";
import type { SpellItem } from "@/lib/genres/spellIt";
import { speak, speechAvailable } from "@/lib/engine/speech";

const ROWS = [
  ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
  ["j", "k", "l", "m", "n", "o", "p", "q", "r"],
  ["s", "t", "u", "v", "w", "x", "y", "z"],
];

/** Speaks the word, the context sentence, then the word again — the WIAT/WJ
 * dictation shape ("word... word in a sentence... word"). */
function dictation(item: SpellItem): string {
  return `Spell the word ${item.word}. ${item.sentence} ${item.word}.`;
}

/**
 * Spell It: dictated word → tap letters on an alphabet pad. The word is
 * NEVER shown until reveal. Letters appear in the tray as she taps; ⌫
 * removes the last one; Done submits. Alphabetical rows (not QWERTY) — she
 * is 5 and knows the alphabet song, not the keyboard layout.
 */
export function SpellItView({
  item,
  disabled,
  onReady,
  onRespond,
  reveal = false,
  lastResponse = null,
}: GenreViewProps<SpellItem, string>) {
  const [typed, setTyped] = useState("");
  const [shownItem, setShownItem] = useState(item);

  if (item !== shownItem) {
    setShownItem(item);
    setTyped("");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (speechAvailable()) await speak(dictation(item));
      if (!cancelled) onReady();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const replay = () => { if (speechAvailable()) void speak(dictation(item)); };

  if (reveal) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 p-6">
        <p className="text-lg text-ink/60">The word was</p>
        <p className="rounded-2xl border-4 border-[#6fcf6f] bg-[#6fcf6f]/15 px-8 py-4 font-bubble text-5xl tracking-widest text-ink">
          {item.word}
        </p>
        {lastResponse !== null && lastResponse.toLowerCase() !== item.word.toLowerCase() && (
          <p className="text-xl text-ink/60">
            You spelled: <span className="font-bubble tracking-widest text-rose-500">{lastResponse || "(nothing)"}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col items-center">
      <div className="flex w-full flex-1 min-h-0 flex-col items-center justify-center-safe gap-5 overflow-y-auto p-4 pb-2">
        <button
          type="button"
          onClick={replay}
          disabled={disabled}
          className="rounded-2xl bg-teal-100 px-4 py-2 text-lg text-ink"
        >
          🔊 Hear it again
        </button>

        <div className="flex min-h-16 min-w-[260px] items-center justify-center gap-1 rounded-2xl bg-white px-6 py-3 shadow-sm">
          {typed.length === 0 ? (
            <span className="text-xl text-ink/40">Tap the letters</span>
          ) : (
            typed.split("").map((ch, i) => (
              <span key={i} className="font-bubble text-4xl tracking-widest text-ink">{ch}</span>
            ))
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          {ROWS.map((row, r) => (
            <div key={r} className="flex gap-2">
              {row.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  data-testid="answer-option"
                  aria-label={`letter ${ch}`}
                  disabled={disabled || typed.length >= 12}
                  onClick={() => setTyped((t) => t + ch)}
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-white font-bubble text-2xl text-ink shadow-sm active:bg-teal-100 disabled:opacity-40"
                >
                  {ch}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center justify-center gap-3 bg-cream px-6 pb-4 pt-3 shadow-[0_-8px_16px_-10px_rgba(0,0,0,0.15)]">
        <button
          type="button"
          onClick={() => setTyped((t) => t.slice(0, -1))}
          disabled={disabled || typed.length === 0}
          className="min-h-[72px] min-w-[72px] rounded-2xl bg-rose-400 px-4 text-2xl font-bold text-white disabled:opacity-40"
        >
          ⌫
        </button>
        <button
          type="button"
          data-testid="done"
          onClick={() => { if (typed.length > 0) onRespond(typed); }}
          disabled={disabled || typed.length === 0}
          className="min-h-[72px] min-w-[200px] rounded-2xl bg-teal-500 px-8 font-bubble text-2xl text-white disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}
