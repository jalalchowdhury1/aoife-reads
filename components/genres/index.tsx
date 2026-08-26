import type { ComponentType } from "react";
import type { GenreId, GenreViewProps } from "@/lib/engine/types";
import { ReadingChoiceView } from "./ReadingChoiceView";
import { SpellItView } from "./SpellItView";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VIEWS: Record<GenreId, ComponentType<GenreViewProps<any, any>>> = {
  soundHunt: ReadingChoiceView,
  echoWords: ReadingChoiceView,
  wordSnap: ReadingChoiceView,
  storyGap: ReadingChoiceView,
  readAndAnswer: ReadingChoiceView,
  spellIt: SpellItView,
};
