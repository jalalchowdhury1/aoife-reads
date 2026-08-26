import { describe, it, expect } from "vitest";
import { pickPraise, PRAISE_BANK, type PraiseContext, type PraiseKind } from "./praise";
import { makeRng } from "./rng";

const KID_KINDS: PraiseKind[] = [
  "correct", "miss", "timeout", "streak3", "streak5", "newBest",
  "firstOfGenre", "topOfRamp", "comeback", "blockDone", "partDone",
  "welcome", "neutralNext",
];

const MIN_SIZES: Record<PraiseKind, number> = {
  correct: 60, miss: 20, timeout: 12, streak3: 10, streak5: 10, newBest: 12,
  firstOfGenre: 8, topOfRamp: 8, comeback: 10, blockDone: 12, partDone: 10,
  welcome: 12, neutralNext: 12,
    bail: 8,
};

const BANNED_WORDS = ["wrong", "bad", "fail", "oops", "sorry", "mistake", "incorrect"];
const DASH_CHARS = ["-", "–", "—"]; // hyphen, en dash, em dash

function allBankArrays(): { key: string; lines: string[] }[] {
  const keys = [...KID_KINDS, "correctFast", "correctHard"] as (keyof typeof PRAISE_BANK)[];
  return keys.map((key) => ({ key: String(key), lines: PRAISE_BANK[key] }));
}

describe("PRAISE_BANK sizes", () => {
  for (const kind of KID_KINDS) {
    it(`${kind} has at least ${MIN_SIZES[kind]} lines`, () => {
      expect(PRAISE_BANK[kind].length).toBeGreaterThanOrEqual(MIN_SIZES[kind]);
    });
  }

  it("correctFast and correctHard exist with a handful of flavor lines", () => {
    expect(PRAISE_BANK.correctFast.length).toBeGreaterThanOrEqual(4);
    expect(PRAISE_BANK.correctHard.length).toBeGreaterThanOrEqual(4);
  });

  it("every bank's lines are unique (no duplicate templates within one bank)", () => {
    for (const { key, lines } of allBankArrays()) {
      expect(new Set(lines).size, key).toBe(lines.length);
    }
  });
});

describe("PRAISE_BANK content rules (kid-facing text)", () => {
  it("never contains a dash character (hyphen, en dash, or em dash)", () => {
    for (const { key, lines } of allBankArrays()) {
      for (const line of lines) {
        for (const dash of DASH_CHARS) {
          expect(line.includes(dash), `${key}: "${line}" contains a dash`).toBe(false);
        }
      }
    }
  });

  it("never contains a banned word (wrong, bad, fail, oops, sorry, mistake, incorrect)", () => {
    const pattern = new RegExp(`\\b(${BANNED_WORDS.join("|")})\\b`, "i");
    for (const { key, lines } of allBankArrays()) {
      for (const line of lines) {
        expect(pattern.test(line), `${key}: "${line}" contains a banned word`).toBe(false);
      }
    }
  });

  it("badge/word like 'badge' or 'failing' style substrings are not accidentally flagged (sanity check on the matcher itself)", () => {
    const pattern = new RegExp(`\\b(${BANNED_WORDS.join("|")})\\b`, "i");
    expect(pattern.test("That is a lovely badge.")).toBe(false);
    expect(pattern.test("You are failing to notice.")).toBe(false); // "failing" != "fail"
    expect(pattern.test("that was wrong")).toBe(true); // sanity: matcher does catch the real word
  });
});

describe("pickPraise", () => {
  const ctx: PraiseContext = { kind: "correct", name: "Aoife" };

  it("fills {name} and {title} placeholders, never leaving braces in the output", () => {
    const rng = makeRng(1);
    const used = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const line = pickPraise({ kind: "firstOfGenre", name: "Aoife", kidTitle: "Block Builder" }, rng, used);
      expect(line).not.toMatch(/\{name\}|\{title\}/);
    }
  });

  it("without a kidTitle, still fills {title} with a sensible fallback (never crashes, never leaves a brace)", () => {
    const rng = makeRng(2);
    const used = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const line = pickPraise({ kind: "firstOfGenre", name: "Aoife" }, rng, used);
      expect(line).not.toMatch(/\{name\}|\{title\}/);
    }
  });

  it("never repeats a line until the bank is exhausted, then resets", () => {
    const rng = makeRng(42);
    const used = new Set<string>();
    const bankSize = PRAISE_BANK.welcome.length;
    const firstCycle = new Set<string>();
    for (let i = 0; i < bankSize; i++) {
      const line = pickPraise({ kind: "welcome", name: "Aoife" }, rng, used);
      expect(firstCycle.has(line), `repeated within first cycle: ${line}`).toBe(false);
      firstCycle.add(line);
    }
    expect(firstCycle.size).toBe(bankSize);
    // The (bankSize+1)th pick starts a fresh cycle: it may repeat something
    // from the first cycle, but the next `bankSize` picks are unique again.
    const secondCycle = new Set<string>();
    for (let i = 0; i < bankSize; i++) {
      const line = pickPraise({ kind: "welcome", name: "Aoife" }, rng, used);
      expect(secondCycle.has(line), `repeated within second cycle: ${line}`).toBe(false);
      secondCycle.add(line);
    }
    expect(secondCycle.size).toBe(bankSize);
  });

  it("is deterministic for a given seed", () => {
    const a = pickPraise(ctx, makeRng(7), new Set());
    const b = pickPraise(ctx, makeRng(7), new Set());
    expect(a).toBe(b);

    // A longer deterministic sequence also matches run to run.
    const runOnce = () => {
      const rng = makeRng(99);
      const used = new Set<string>();
      const out: string[] = [];
      for (let i = 0; i < 30; i++) out.push(pickPraise({ kind: "correct", name: "Aoife" }, rng, used));
      return out;
    };
    expect(runOnce()).toEqual(runOnce());
  });

  const fillName = (t: string) => t.replace(/\{name\}/g, "Aoife");

  it("blends correctFast lines in ahead of the general pool when fast is set", () => {
    const rng = makeRng(5);
    const used = new Set<string>();
    const seen = new Set<string>();
    const total = PRAISE_BANK.correctFast.length + PRAISE_BANK.correct.length;
    for (let i = 0; i < total; i++) {
      seen.add(pickPraise({ kind: "correct", name: "Aoife", fast: true }, rng, used));
    }
    for (const fastLine of PRAISE_BANK.correctFast) {
      expect(seen.has(fillName(fastLine))).toBe(true);
    }
  });

  it("blends correctHard lines in when hard is set", () => {
    const rng = makeRng(6);
    const used = new Set<string>();
    const seen = new Set<string>();
    const total = PRAISE_BANK.correctHard.length + PRAISE_BANK.correct.length;
    for (let i = 0; i < total; i++) {
      seen.add(pickPraise({ kind: "correct", name: "Aoife", hard: true }, rng, used));
    }
    for (const hardLine of PRAISE_BANK.correctHard) {
      expect(seen.has(fillName(hardLine))).toBe(true);
    }
  });

  it("plain correct (no fast/hard) never returns a correctFast/correctHard-only line", () => {
    const rng = makeRng(8);
    const used = new Set<string>();
    const plainSet = new Set(PRAISE_BANK.correct.map(fillName));
    for (let i = 0; i < 200; i++) {
      const line = pickPraise({ kind: "correct", name: "Aoife" }, rng, used);
      expect(plainSet.has(line)).toBe(true);
    }
  });

  it("neutralNext lines never assert correctness (used by the ungraded diagnostic)", () => {
    for (const line of PRAISE_BANK.neutralNext) {
      expect(line.toLowerCase()).not.toMatch(/correct|right answer|great job/);
    }
  });
});
