import type { Genre, GenreId, E2EPlan } from "../engine/types";
import { soundHunt, audit as auditSoundHunt } from "./soundHunt";
import { echoWords, audit as auditEchoWords } from "./echoWords";
import { wordSnap, audit as auditWordSnap } from "./wordSnap";
import { storyGap, audit as auditStoryGap } from "./storyGap";
import { readAndAnswer, audit as auditReadAndAnswer } from "./readAndAnswer";
import { spellIt, audit as auditSpellIt } from "./spellIt";
import { readAloud, audit as auditReadAloud } from "./readAloud";
import { soundItOut, audit as auditSoundItOut } from "./soundItOut";
import { readToMe, audit as auditReadToMe } from "./readToMe";
import { spellOnPaper, audit as auditSpellOnPaper } from "./spellOnPaper";
import { numberCrunch, audit as auditNumberCrunch } from "./numberCrunch";
import { storyProblems, audit as auditStoryProblems } from "./storyProblems";
import { mathOnPaper, audit as auditMathOnPaper } from "./mathOnPaper";
import { mathOutLoud, audit as auditMathOutLoud } from "./mathOutLoud";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGenre = Genre<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withHooks = (g: AnyGenre, e2e: E2EPlan, audit?: (item: any) => string): AnyGenre => ({ ...g, e2e, audit: audit ?? g.audit });

export const GENRES: Record<GenreId, AnyGenre> = {
  soundHunt: withHooks(soundHunt, { kind: "options", pick: 1 }, auditSoundHunt),
  echoWords: withHooks(echoWords, { kind: "options", pick: 1 }, auditEchoWords),
  wordSnap: withHooks(wordSnap, { kind: "options", pick: 1 }, auditWordSnap),
  storyGap: withHooks(storyGap, { kind: "options", pick: 1 }, auditStoryGap),
  readAndAnswer: withHooks(readAndAnswer, { kind: "options", pick: 1 }, auditReadAndAnswer),
  // spellIt's letter pad reuses the sequence recipe: tap one letter, then Done.
  spellIt: withHooks(spellIt, { kind: "sequence", taps: 1 }, auditSpellIt),
  // Actual-format, parent-scored subtests: one tap on the grown-up strip
  // answers the item, so the tapOnly recipe drives them in e2e.
  readAloud: withHooks(readAloud, { kind: "tapOnly" }, auditReadAloud),
  soundItOut: withHooks(soundItOut, { kind: "tapOnly" }, auditSoundItOut),
  readToMe: withHooks(readToMe, { kind: "tapOnly" }, auditReadToMe),
  spellOnPaper: withHooks(spellOnPaper, { kind: "tapOnly" }, auditSpellOnPaper),
  // Mathematics composite (2026-08-27): two solo numpad games, two
  // actual-format parent-scored administrations.
  numberCrunch: withHooks(numberCrunch, { kind: "numpad" }, auditNumberCrunch),
  storyProblems: withHooks(storyProblems, { kind: "numpad" }, auditStoryProblems),
  mathOnPaper: withHooks(mathOnPaper, { kind: "tapOnly" }, auditMathOnPaper),
  mathOutLoud: withHooks(mathOutLoud, { kind: "tapOnly" }, auditMathOutLoud),
};

/** Spec order — the order genres appear in Level 1 and on the parent page. */
export const GENRE_LIST: GenreId[] = [
  "soundHunt", "echoWords", "wordSnap", "storyGap", "readAndAnswer", "spellIt",
  "numberCrunch", "storyProblems",
  "readAloud", "soundItOut", "readToMe", "spellOnPaper", "mathOnPaper", "mathOutLoud",
];

/** Parent-scored administrations: the response is a grown-up's judgement, so
 * the solo Practice tab can never replay them (lib/engine/practice.ts). */
export const EXAMINER_GENRES: GenreId[] = [
  "readAloud", "soundItOut", "readToMe", "spellOnPaper", "mathOnPaper", "mathOutLoud",
];
