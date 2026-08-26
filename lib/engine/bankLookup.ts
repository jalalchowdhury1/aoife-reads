// Pure bankId -> fixed-text lookup across the authored banks. Used by the
// parent dashboard to show what a bank-backed item actually said, given only
// the `bankId` recorded on an ItemRecord. Generator genres (soundHunt,
// echoWords, wordSnap) record no bankId and always resolve to null here.
import type { GenreId } from "./types";
import { STORY_GAP_BANK } from "../genres/storyGap";
import { READ_ANSWER_BANK } from "../genres/readAndAnswer";
import { SPELL_TIERS } from "../genres/spellIt";

export interface BankEntry {
  genre: GenreId;
  prompt: string;
  emoji?: string;
  options: { text: string; points: number }[];
  explanation: string;
}

const INDEX = new Map<string, BankEntry>();
for (const b of STORY_GAP_BANK) {
  INDEX.set(b.id, {
    genre: "storyGap", prompt: b.sentence,
    options: b.options.map((text, i) => ({ text, points: i === b.answer ? 1 : 0 })),
    explanation: b.explanation,
  });
}
for (const b of READ_ANSWER_BANK) {
  INDEX.set(b.id, {
    genre: "readAndAnswer", prompt: `${b.passage} — ${b.question}`,
    options: b.options.map((text, i) => ({ text, points: i === b.answer ? 1 : 0 })),
    explanation: b.explanation,
  });
}
for (const tier of Object.values(SPELL_TIERS)) {
  for (const w of tier) {
    INDEX.set(`sp-${w.word}`, {
      genre: "spellIt", prompt: `Spell: ${w.word} ("${w.sentence}")`,
      options: [{ text: w.word, points: 1 }],
      explanation: `${w.word} is spelled ${w.word.split("").join("-")}.`,
    });
  }
}

/** The authored text behind a recorded bankId, or null for generated/unknown items. */
export function lookupBankItem(bankId: string | undefined): BankEntry | null {
  if (!bankId) return null;
  return INDEX.get(bankId) ?? null;
}
