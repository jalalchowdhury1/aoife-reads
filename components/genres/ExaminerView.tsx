"use client";

import { useEffect, useState } from "react";
import type { GenreViewProps } from "@/lib/engine/types";
import type { ExaminerItem } from "@/lib/genres/examinerItem";
import { speak, speechAvailable } from "@/lib/engine/speech";

/**
 * The examiner's easel + record form for the actual-format, parent-scored
 * subtests: the child-facing stimulus fills the screen (or is dictated by
 * Ollie); a muted grown-up strip along the bottom shows what counts as
 * correct and two scoring buttons. Deliberately calm — no colors that read
 * as right/wrong to the child, no per-item feedback (the diagnostic rule).
 */
export function ExaminerView({
  item,
  disabled,
  onReady,
  onRespond,
  reveal = false,
  lastResponse = null,
}: GenreViewProps<ExaminerItem, boolean>) {
  const [shownItem, setShownItem] = useState(item);
  if (item !== shownItem) setShownItem(item);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (item.speak && speechAvailable()) await speak(item.speak);
      if (!cancelled) onReady();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const replay = () => { if (item.speak && speechAvailable()) void speak(item.speak); };
  const isPassage = (item.stimulus ?? "").length > 24;

  return (
    <div className="flex min-h-full w-full flex-col items-center">
      <div className="flex w-full flex-1 min-h-0 flex-col items-center justify-center-safe gap-6 overflow-y-auto p-6 pb-2">
        {item.speak && (
          <>
            <div aria-hidden style={{ fontSize: 64 }}>🦉</div>
            <button
              type="button"
              onClick={replay}
              disabled={disabled && !reveal}
              className="rounded-2xl bg-teal-100 px-5 py-3 text-xl text-ink"
            >
              🔊 Hear it again
            </button>
            <p className="text-lg text-ink/50">Write the word on your paper ✏️</p>
          </>
        )}
        {item.stimulus && (
          isPassage ? (
            <p className="max-w-xl rounded-2xl bg-white p-6 text-2xl leading-relaxed text-ink shadow-sm">{item.stimulus}</p>
          ) : (
            <p className="font-bubble text-7xl tracking-wide text-ink" data-testid="big-word">{item.stimulus}</p>
          )
        )}
        {item.question && (
          <p className="max-w-xl rounded-2xl bg-amber-100/70 px-5 py-3 text-xl text-ink">
            <span className="font-semibold text-ink/60">Grown-up asks: </span>{item.question}
          </p>
        )}
        {reveal && lastResponse === false && (
          <p className="text-lg text-ink/60">The answer was: <span className="font-semibold">{item.expected}</span></p>
        )}
      </div>

      {/* grown-up strip: muted, factual, never celebratory */}
      <div className="flex w-full shrink-0 flex-col gap-2 border-t border-ink/10 bg-white/80 px-6 pb-4 pt-3">
        <p className="text-center text-xs text-ink/45">
          Grown-up: {item.parentPrompt}
          {" · "}
          <span className="font-medium">counts as correct: {item.expected}</span>
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            data-testid="answer-option"
            aria-label="got it"
            disabled={disabled}
            onClick={() => onRespond(true)}
            className="min-h-[64px] min-w-[160px] rounded-2xl bg-teal-500/90 px-6 text-xl font-semibold text-white disabled:opacity-40"
          >
            ✓ Got it
          </button>
          <button
            type="button"
            data-testid="answer-option"
            aria-label="not yet"
            disabled={disabled}
            onClick={() => onRespond(false)}
            className="min-h-[64px] min-w-[160px] rounded-2xl bg-ink/20 px-6 text-xl font-semibold text-ink disabled:opacity-40"
          >
            ✗ Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
