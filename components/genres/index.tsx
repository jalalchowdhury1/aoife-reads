import type { ComponentType } from "react";
import type { GenreId, GenreViewProps } from "@/lib/engine/types";
import { ReadingChoiceView } from "./ReadingChoiceView";
import { SpellItView } from "./SpellItView";
import { ExaminerView } from "./ExaminerView";
import { NumPadView } from "./NumPadView";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VIEWS: Record<GenreId, ComponentType<GenreViewProps<any, any>>> = {
  soundHunt: ReadingChoiceView,
  echoWords: ReadingChoiceView,
  wordSnap: ReadingChoiceView,
  storyGap: ReadingChoiceView,
  readAndAnswer: ReadingChoiceView,
  spellIt: SpellItView,
  readAloud: ExaminerView,
  soundItOut: ExaminerView,
  readToMe: ExaminerView,
  spellOnPaper: ExaminerView,
  numberCrunch: NumPadView,
  storyProblems: NumPadView,
  mathOnPaper: ExaminerView,
  mathOutLoud: ExaminerView,
};
