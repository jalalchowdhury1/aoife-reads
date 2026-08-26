"use client";
import { useEffect, useMemo } from "react";
import type { Genre, GenreViewProps } from "@/lib/engine/types";
import { speak, warmUpSpeech } from "@/lib/engine/speech";
import { BigButton } from "./BigButton";
import { Ollie } from "./Ollie";

export function SampleScreen({
  genre,
  View,
  onStart,
  fun = true,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  genre: Genre<any, any>;
  // The caller passes the genre's own view component so this file never
  // depends on a genre -> view registry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  View: React.ComponentType<GenreViewProps<any, any>>;
  onStart: () => void;
  // "Fun layer" (Ollie the owl) on/off — false on Level 1, the ungraded
  // diagnostic, which keeps today's neutral behaviour exactly.
  fun?: boolean;
}) {
  const sample = useMemo(() => genre.sample(), [genre]);

  // The child hears the general instructions, then the sample's own
  // explanation, back to back (not simultaneously) so both register.
  useEffect(() => {
    void speak(genre.instructions).then(() => speak(sample.explanation));
  }, [genre, sample]);

  const handleStart = () => {
    warmUpSpeech(); // the iOS/Safari audio-unlock gesture
    onStart();
  };

  return (
    // Portrait stays a single centered column (plenty of vertical room there).
    // Landscape/wide (iPad 1180x713 counts as both `landscape:` and `lg:`):
    // two columns side by side, vertically centred, so the Start button is
    // never below the fold — see AGENTS.md §6 TODO this closes out.
    //
    // QA 2026-08-23: at a short viewport (1180x536 — the effective iPad
    // landscape height once browser chrome is subtracted) the text+preview
    // together can be taller than the screen. `overflow-hidden` here used to
    // just clip Start off entirely; now the whole row is bounded to the
    // available height (min-h-0) and each column scrolls *itself* — see the
    // inner scrollable wrapper below — while Start (and the preview) stay
    // put, never scrolled away.
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 bg-cream p-3 text-center landscape:flex-row landscape:items-center landscape:justify-center landscape:gap-8 landscape:text-left lg:flex-row lg:items-center lg:text-left">
      <div className="flex min-h-0 flex-col items-center gap-3 landscape:max-w-[34rem] landscape:items-start lg:max-w-[34rem] lg:items-start">
        {/* min-h-full (not just gap-3 centering) so this still centers the
            text as a group when it fits the available height — same look as
            before — but, once it doesn't fit, packs from the top and lets
            the wrapping overflow-y-auto scroll to the rest instead of
            silently overflowing past Start below it.
            QA 2026-08-23 correction: plain `justify-center` is NOT safe once
            content overflows its box — unprefixed `center` keeps centering
            around the midpoint even when that pushes half the overflow
            ABOVE the scrollport's reachable top (verified live: the heading
            rendered pre-clipped at scrollTop 0, unrecoverable by scrolling
            since you can't scroll negative). `justify-center-safe` (CSS
            `safe center`) falls back to start-alignment exactly when
            centering would do that, so short content still centers as a
            group and tall content always keeps its start reachable. */}
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
          <div className="flex min-h-full w-full flex-col items-center justify-center-safe gap-3 landscape:items-start lg:items-start">
            <h1 className="font-bubble text-3xl text-ink landscape:text-4xl lg:text-4xl">{genre.kidTitle}</h1>
            {fun ? (
              // Ollie delivers the instructions in its speech bubble instead of a
              // plain paragraph. `speak` is left off here: the effect above
              // already reads genre.instructions aloud, then the sample's own
              // explanation — Ollie speaking too would double it up.
              <Ollie mood="happy" line={genre.instructions} />
            ) : (
              <p className="max-w-xl text-lg text-ink">{genre.instructions}</p>
            )}

            <div className="max-w-xl rounded-3xl bg-sky-300/40 p-3 text-base text-ink">{sample.explanation}</div>

            <p className="max-w-xl text-base text-ink/80">
              Some puzzles are easy and some are for much older kids. If you are not sure, take your best guess!
            </p>
          </div>
        </div>

        {/* Never inside the scrolling wrapper above, and a fixed-size sibling
            right after it: Start stays visible at every viewport height
            without her needing to scroll for it. */}
        <div className="sticky bottom-0 w-full shrink-0 bg-cream pt-2 landscape:flex landscape:justify-start lg:flex lg:justify-start">
          <BigButton onClick={handleStart} tone="teal">
            Start
          </BigButton>
        </div>
      </div>

      {/* Every genre view supports reveal mode: correct answer highlighted,
          inputs inert. Showing the sample this way (instead of an
          unanswered, undecorated item) is the whole point of this change —
          she sees what a correct answer to this format looks like before
          she ever has to produce one herself.
          QA 2026-08-23: `-safe` alignment (not plain items-center/justify-
          center) — verified live that some views (e.g. Story Sums'
          numpad+text) render taller than this card gets on a short
          viewport, and plain `center` centered-and-clipped the top of the
          view instead of keeping it reachable via the card's own scroll. */}
      <div className="flex min-h-0 max-h-full w-fit max-w-full min-w-0 items-center-safe justify-center-safe overflow-auto rounded-3xl bg-white p-3 shadow-lg landscape:shrink lg:shrink">
        <View item={sample.item} disabled reveal lastResponse={null} onReady={() => {}} onRespond={() => {}} />
      </div>
    </div>
  );
}

export default SampleScreen;
