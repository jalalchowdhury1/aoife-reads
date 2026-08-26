"use client";

import { useEffect, useRef, useState } from "react";
import type { GenreViewProps } from "@/lib/engine/types";
import type { ReadingItem } from "@/lib/genres/readingItem";
import { speak, speechAvailable } from "@/lib/engine/speech";

/**
 * One view for all five choice-based reading genres. The item itself says
 * what is shown (bigWord / passage / question / emoji) and what is spoken
 * (`speak`), so the show-vs-speak split lives in the GENRE, not here —
 * what she must READ is never spoken, and what tests LISTENING is never
 * shown (see lib/genres/readingItem.ts).
 *
 * QA conventions carried over from the puzzles app: the stimulus scrolls in
 * its own region so the action row never leaves the fold; answers carry
 * data-testid="answer-option"; Done enables only after a pick; onReady fires
 * once the stimulus is fully presented (after speech, when there is speech).
 */
export function ReadingChoiceView({
  item,
  disabled,
  onReady,
  onRespond,
  reveal = false,
  lastResponse = null,
}: GenreViewProps<ReadingItem, number>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [shownItem, setShownItem] = useState(item);
  const spokeRef = useRef(false);

  if (item !== shownItem) {
    setShownItem(item);
    setSelected(null);
  }

  useEffect(() => {
    spokeRef.current = false;
    let cancelled = false;
    (async () => {
      if (item.speak && speechAvailable()) {
        await speak(item.speak);
      }
      if (!cancelled) onReady();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const replay = () => {
    if (item.speak && speechAvailable()) void speak(item.speak);
  };

  const emojiOptions = item.options.some((o) => o.emoji !== undefined);

  return (
    <div className="flex min-h-full w-full flex-col items-center">
      <div className="flex w-full flex-1 min-h-0 flex-col items-center justify-center-safe gap-6 overflow-y-auto p-6 pb-2">
        {item.emoji && (
          <div aria-hidden style={{ fontSize: 72 }}>{item.emoji}</div>
        )}
        {item.speak && (
          <button
            type="button"
            onClick={replay}
            disabled={disabled && !reveal}
            className="rounded-2xl bg-teal-100 px-4 py-2 text-lg text-ink"
          >
            🔊 Hear it again
          </button>
        )}
        {item.bigWord && (
          <p className="font-bubble text-6xl tracking-wide text-ink" data-testid="big-word">{item.bigWord}</p>
        )}
        {item.passage && (
          <p className="max-w-xl rounded-2xl bg-white p-5 text-2xl leading-relaxed text-ink shadow-sm">{item.passage}</p>
        )}
        {item.question && (
          <p className="max-w-xl text-2xl font-semibold text-ink">{item.question}</p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4">
          {item.options.map((opt, i) => {
            const content = opt.emoji
              ? <span style={{ fontSize: 56 }} aria-hidden>{opt.emoji}</span>
              : <span className={`font-bubble text-ink ${(opt.text ?? "").length > 12 ? "text-xl" : "text-3xl"}`}>{opt.text}</span>;
            if (reveal) {
              const isCorrect = i === item.answer;
              const isWrongPick = !isCorrect && lastResponse === i;
              const cls = isCorrect
                ? "border-[#6fcf6f] bg-[#6fcf6f]/15"
                : isWrongPick
                  ? "border-rose-400 bg-white"
                  : "border-teal-100 bg-white opacity-40";
              return (
                <div key={i} className={`flex min-h-20 min-w-20 items-center justify-center rounded-2xl border-4 p-3 ${cls}`}>
                  {content}
                </div>
              );
            }
            return (
              <button
                key={i}
                type="button"
                data-testid="answer-option"
                disabled={disabled}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                aria-label={opt.text ?? opt.emoji}
                className={`flex min-h-20 min-w-20 items-center justify-center rounded-2xl border-4 bg-white p-3 ${
                  selected === i ? "border-teal-400" : "border-teal-100"
                }`}
              >
                {content}
              </button>
            );
          })}
        </div>

        {emojiOptions && !reveal && (
          <p className="text-sm text-ink/40">Tap the picture, then press Done.</p>
        )}
      </div>

      <div className="flex w-full shrink-0 items-center justify-center bg-cream px-6 pb-4 pt-3 shadow-[0_-8px_16px_-10px_rgba(0,0,0,0.15)]">
        <button
          type="button"
          data-testid="done"
          onClick={() => { if (selected !== null) onRespond(selected); }}
          disabled={disabled || selected === null}
          className="min-h-[72px] min-w-[200px] rounded-2xl bg-teal-500 px-8 font-bubble text-2xl text-white disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}
