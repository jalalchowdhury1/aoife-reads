import { describe, it, expect } from "vitest";
import { lookupBankItem } from "./bankLookup";
import { STORY_GAP_BANK } from "../genres/storyGap";
import { READ_ANSWER_BANK } from "../genres/readAndAnswer";

describe("lookupBankItem", () => {
  it("resolves a known storyGap bank id with its sentence and scored options", () => {
    const b = STORY_GAP_BANK[0];
    const entry = lookupBankItem(b.id)!;
    expect(entry.genre).toBe("storyGap");
    expect(entry.prompt).toBe(b.sentence);
    expect(entry.options.find((o) => o.points === 1)!.text).toBe(b.options[b.answer]);
  });

  it("resolves a known readAndAnswer bank id with passage + question", () => {
    const b = READ_ANSWER_BANK[0];
    const entry = lookupBankItem(b.id)!;
    expect(entry.genre).toBe("readAndAnswer");
    expect(entry.prompt).toContain(b.question);
  });

  it("resolves a spellIt word id", () => {
    const entry = lookupBankItem("sp-cat")!;
    expect(entry.genre).toBe("spellIt");
    expect(entry.prompt).toContain("cat");
  });

  it("returns null for unknown or missing ids (generated items record no bankId)", () => {
    expect(lookupBankItem("nope-123")).toBeNull();
    expect(lookupBankItem(undefined)).toBeNull();
  });
});
