// Validity/fairness guard for all six reading genres (same rule as
// aoife-puzzles: a broken or ambiguous item writes a FALSE weakness into her
// profile). Each rule is a named it() describing the real bug it prevents.
import { describe, it, expect } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../engine/types";
import { soundHunt } from "../soundHunt";
import { echoWords } from "../echoWords";
import { wordSnap } from "../wordSnap";
import { storyGap, STORY_GAP_BANK } from "../storyGap";
import { readAndAnswer, READ_ANSWER_BANK } from "../readAndAnswer";
import { spellIt, SPELL_TIERS } from "../spellIt";
import type { ReadingItem } from "../readingItem";

const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);

function sweep(gen: (seed: number, d: Difficulty) => ReadingItem): { seed: number; d: Difficulty; item: ReadingItem }[] {
  const out: { seed: number; d: Difficulty; item: ReadingItem }[] = [];
  for (const d of DIFFICULTIES) for (const seed of SEEDS) out.push({ seed, d, item: gen(seed, d) });
  return out;
}

function checkChoiceInvariants(items: { seed: number; d: Difficulty; item: ReadingItem }[], name: string) {
  it(`${name}: exactly one correct option, answer index points at it, all options distinct (prevents unsolvable or double-keyed items)`, () => {
    for (const { seed, d, item } of items) {
      const correct = item.options.filter((o) => o.correct);
      expect(correct.length, `${name} d${d} seed${seed}`).toBe(1);
      expect(item.options[item.answer].correct, `${name} d${d} seed${seed}`).toBe(true);
      const keys = item.options.map((o) => o.text ?? o.emoji);
      expect(new Set(keys).size, `${name} d${d} seed${seed}`).toBe(keys.length);
    }
  });

  it(`${name}: deterministic — same seed+difficulty always produces the same item`, () => {
    for (const d of DIFFICULTIES) {
      for (const seed of [1, 99, 250]) {
        const gen = name === "soundHunt" ? soundHunt : name === "echoWords" ? echoWords : name === "wordSnap" ? wordSnap : name === "storyGap" ? storyGap : readAndAnswer;
        expect(JSON.stringify(gen.generate(seed, d))).toBe(JSON.stringify(gen.generate(seed, d)));
      }
    }
  });
}

describe("soundHunt fairness", () => {
  const items = sweep((s, d) => soundHunt.generate(s, d));
  checkChoiceInvariants(items, "soundHunt");

  it("always shows a picture and speaks a question, never shows the word's spelling (spelling would give the answer away)", () => {
    for (const { item } of items) {
      expect(item.emoji).toBeTruthy();
      expect(item.speak).toBeTruthy();
      expect(item.bigWord).toBeUndefined();
    }
  });

  it("option counts follow the band: 3 at d1, 4 at d2-8, 5 vowels at d9-10", () => {
    for (const { d, item } of items) {
      const expected = d === 1 ? 3 : d >= 9 ? 5 : 4;
      expect(item.options.length, `d${d}`).toBe(expected);
    }
  });
});

describe("echoWords fairness", () => {
  const items = sweep((s, d) => echoWords.generate(s, d));
  checkChoiceInvariants(items, "echoWords");

  it("the target is spoken, never displayed as a prompt (she must find its spelling, not match text)", () => {
    for (const { item } of items) {
      expect(item.speak).toBeTruthy();
      expect(item.bigWord).toBeUndefined();
    }
  });

  it("every option is a plausible word-like string of 2-9 letters (prevents junk distractors that are dismissible on sight)", () => {
    for (const { d, seed, item } of items) {
      for (const o of item.options) {
        expect(o.text, `d${d} seed${seed}`).toMatch(/^[a-z]{2,9}$/);
      }
    }
  });
});

describe("wordSnap fairness", () => {
  const items = sweep((s, d) => wordSnap.generate(s, d));
  checkChoiceInvariants(items, "wordSnap");

  it("shows the word, speaks nothing (speech would answer the item), options are pictures", () => {
    for (const { item } of items) {
      expect(item.bigWord).toBeTruthy();
      expect(item.speak).toBeNull();
      for (const o of item.options) expect(o.emoji).toBeTruthy();
    }
  });

  it("no two options share an emoji (two identical pictures would make the answer ambiguous)", () => {
    for (const { d, seed, item } of items) {
      const emojis = item.options.map((o) => o.emoji);
      expect(new Set(emojis).size, `d${d} seed${seed}`).toBe(emojis.length);
    }
  });
});

describe("storyGap fairness (bank)", () => {
  it("bank ids are unique and every difficulty 1-10 has at least 3 items (prevents a thin tier repeating items within a block)", () => {
    const ids = STORY_GAP_BANK.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DIFFICULTIES) {
      expect(STORY_GAP_BANK.filter((b) => b.d === d).length, `d${d}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("every sentence contains exactly one gap and the answer index is valid", () => {
    for (const b of STORY_GAP_BANK) {
      expect((b.sentence.match(/___/g) ?? []).length, b.id).toBe(1);
      expect(b.answer).toBeGreaterThanOrEqual(0);
      expect(b.answer).toBeLessThan(b.options.length);
      expect(new Set(b.options).size, b.id).toBe(b.options.length);
    }
  });

  const items = sweep((s, d) => storyGap.generate(s, d));
  checkChoiceInvariants(items, "storyGap");

  it("the sentence is shown, never spoken (this measures READING, not listening)", () => {
    for (const { item } of items) {
      expect(item.passage).toBeTruthy();
      expect(item.speak).toBeNull();
    }
  });

  it("generate honours excludeBankIds so a block never repeats an item she just saw", () => {
    const first = storyGap.generate(1, 3, undefined) as ReadingItem;
    const second = storyGap.generate(1, 3, { excludeBankIds: [first.bankId!] }) as ReadingItem;
    expect(second.bankId).not.toBe(first.bankId);
  });
});

describe("readAndAnswer fairness (bank)", () => {
  it("bank ids unique; every difficulty has at least 3 items", () => {
    const ids = READ_ANSWER_BANK.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DIFFICULTIES) {
      expect(READ_ANSWER_BANK.filter((b) => b.d === d).length, `d${d}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("every item has a passage, a question, a valid answer index, and distinct options", () => {
    for (const b of READ_ANSWER_BANK) {
      expect(b.passage.length, b.id).toBeGreaterThan(10);
      expect(b.question.length, b.id).toBeGreaterThan(5);
      expect(b.answer).toBeGreaterThanOrEqual(0);
      expect(b.answer).toBeLessThan(b.options.length);
      expect(new Set(b.options).size, b.id).toBe(b.options.length);
    }
  });

  const items = sweep((s, d) => readAndAnswer.generate(s, d));
  checkChoiceInvariants(items, "readAndAnswer");

  it("passage and question are shown, never spoken", () => {
    for (const { item } of items) {
      expect(item.passage).toBeTruthy();
      expect(item.question).toBeTruthy();
      expect(item.speak).toBeNull();
    }
  });
});

describe("spellIt fairness", () => {
  it("every tier 1-10 has at least 5 words, all lowercase letters only, unique across the whole bank", () => {
    const all: string[] = [];
    for (const d of DIFFICULTIES) {
      const tier = SPELL_TIERS[d];
      expect(tier.length, `d${d}`).toBeGreaterThanOrEqual(5);
      for (const w of tier) {
        expect(w.word).toMatch(/^[a-z]+$/);
        all.push(w.word);
      }
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it("every context sentence actually contains its word (the dictation formula depends on it)", () => {
    for (const d of DIFFICULTIES) {
      for (const w of SPELL_TIERS[d]) {
        expect(w.sentence.toLowerCase(), w.word).toContain(w.word);
      }
    }
  });

  it("scores an exact match case-insensitively, rejects anything else, never crashes on null (timeout)", () => {
    const item = spellIt.generate(1, 2, undefined) as import("../spellIt").SpellItem;
    expect(spellIt.score(item, item.word.toUpperCase()).correct).toBe(true);
    expect(spellIt.score(item, item.word + "x").correct).toBe(false);
    expect(spellIt.score(item, null).correct).toBe(false);
  });

  it("generate honours excludeBankIds (no repeats within a block)", () => {
    const first = spellIt.generate(1, 2, undefined) as { bankId: string };
    const second = spellIt.generate(1, 2, { excludeBankIds: [first.bankId] }) as { bankId: string };
    expect(second.bankId).not.toBe(first.bankId);
  });

  it("is deterministic", () => {
    for (const d of DIFFICULTIES) {
      expect(JSON.stringify(spellIt.generate(7, d))).toBe(JSON.stringify(spellIt.generate(7, d)));
    }
  });
});
