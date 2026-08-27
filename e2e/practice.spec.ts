import { test, expect, type Page } from "@playwright/test";

// e2e for the Practice tab (ported decision #23, 2026-08-27): rematches of
// her actual missed items, fully stubbed (no KV). Refs cover both a reading
// choice genre and the new numpad math genre.
const PENDING = [
  { genre: "storyGap", seed: 7, d: 3 },
  { genre: "numberCrunch", seed: 9, d: 4 },
];

async function stubBrowser(page: Page): Promise<void> {
  await page.addInitScript((pending) => {
    if (typeof window.SpeechSynthesisUtterance === "undefined") {
      class FallbackUtterance {
        text: string;
        onend: ((this: SpeechSynthesisUtterance, ev: Event) => unknown) | null = null;
        constructor(text: string) { this.text = text; }
      }
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FallbackUtterance;
    }
    if (!window.speechSynthesis) {
      (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {};
    }
    window.speechSynthesis.speak = (utterance) => {
      setTimeout(() => { utterance.onend?.(new Event("end") as unknown as SpeechSynthesisEvent); }, 30);
    };
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.getVoices = () => [];

    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/api/practice")) return json({ ok: true, pending });
      if (url.includes("/api/state")) return json({ ok: false });
      if (url.includes("/api/sessions")) return json({ ok: true });
      return originalFetch(input, init);
    }) as typeof window.fetch;
  }, PENDING);
}

test.describe("Practice tab (ported decision #23)", () => {
  test("plays a reading rematch and a numpad math rematch to the done screen", async ({ page }) => {
    test.setTimeout(90_000);
    await stubBrowser(page);
    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Rematch Time!" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Start", exact: true }).click();

    // Rematch 1: storyGap — a choice view; tap the first option, then Done.
    const options = page.getByTestId("answer-option");
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    await options.first().click();
    await page.getByRole("button", { name: /Done/ }).click();
    const gotIt1 = page.getByRole("button", { name: "Got it!" });
    if (await gotIt1.isVisible({ timeout: 2_500 }).catch(() => false)) await gotIt1.click();

    // Rematch 2: numberCrunch — the numpad; tap a digit, then Done.
    await expect(page.getByRole("button", { name: "1", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: /Done/ }).click();
    const gotIt2 = page.getByRole("button", { name: "Got it!" });
    if (await gotIt2.isVisible({ timeout: 2_500 }).catch(() => false)) await gotIt2.click();

    await expect(page.getByRole("heading", { name: "Rematch done!" })).toBeVisible({ timeout: 15_000 });
  });
});
