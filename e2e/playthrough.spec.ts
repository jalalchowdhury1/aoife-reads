import { test, expect, type Page, type Locator } from "@playwright/test";
import { GENRES, GENRE_LIST } from "@/lib/genres";
import type { GenreId } from "@/lib/engine/types";

// Automated play-through of every genre, driven through the hidden QA level
// (lib/levels/levelQa.ts, id 99 — unreleased, reachable only via a direct
// link). This is the release gate's evidence for owner decision #14
// (AGENTS.md §3): nothing deploys unless every puzzle demonstrably works.
const QA_URL = "/play?level=99&part=Q&replay=1";
const DONE = { name: /Done/ } as const;

/**
 * Runs before every navigation in a test:
 *  - speechSynthesis.speak() resolves near-instantly instead of waiting on
 *    (or hanging on) a real audio backend, which headless Chromium doesn't have.
 *  - fetch("/api/state") reports { ok: false } so the runner falls back to
 *    resolving the part from local/computed state instead of a real KV round
 *    trip (see lib/engine/storage.ts fetchServerState).
 *  - fetch("/api/sessions") reports { ok: true } so the runner's outbox
 *    flush "succeeds" without ever writing to KV.
 * Everything else passes through to the real fetch/speech implementation.
 */
async function stubBrowser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (typeof window.SpeechSynthesisUtterance === "undefined") {
      class FallbackUtterance {
        text: string;
        onend: ((this: SpeechSynthesisUtterance, ev: Event) => unknown) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FallbackUtterance;
    }
    if (!window.speechSynthesis) {
      (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {};
    }
    window.speechSynthesis.speak = (utterance) => {
      setTimeout(() => {
        utterance.onend?.(new Event("end") as unknown as SpeechSynthesisEvent);
      }, 30);
    };
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.getVoices = () => [];

    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/state")) {
        return new Response(JSON.stringify({ ok: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/sessions")) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;
  });
}

interface GenreTestSpec {
  /** Asserts the item is fully rendered and ready to answer. */
  assertItem: (page: Page) => Promise<void>;
  /** Produces ANY valid (not necessarily correct) response and submits it. */
  answer: (page: Page) => Promise<void>;
}


/**
 * Generic driver (decision #16): every genre declares how it is answered via
 * `genre.e2e` (lib/engine/types.ts E2EPlan); views expose
 * data-testid="answer-option" on tappable answers and a "Done" button.
 * A rule-intro screen ("Ready" button) may precede an item — it is clicked through.
 */
async function clickReadyIfShown(page: Page): Promise<void> {
  const ready = page.getByRole("button", { name: "Ready", exact: true });
  if (await ready.isVisible({ timeout: 1500 }).catch(() => false)) await ready.click();
}
function specFor(id: GenreId): GenreTestSpec {
  const genre = GENRES[id];
  const plan = genre.e2e;
  if (!plan) throw new Error(`genre ${id} has no e2e plan`);
  const options = (page: Page) => page.getByTestId("answer-option");
  const done = (page: Page) => page.getByRole("button", DONE);
  switch (plan.kind) {
    case "options":
      return {
        assertItem: async (page) => { await clickReadyIfShown(page); await expect(options(page).first()).toBeVisible({ timeout: 15_000 }); },
        answer: async (page) => {
          for (let k = 0; k < plan.pick; k++) await options(page).first().click();
          await done(page).click();
        },
      };
    case "tapOnly":
      return {
        assertItem: async (page) => { await expect(options(page).first()).toBeVisible({ timeout: 15_000 }); },
        answer: async (page) => { await options(page).first().click(); },
      };
    case "numpad":
      return {
        assertItem: async (page) => { await expect(page.getByRole("button", { name: "1", exact: true })).toBeVisible({ timeout: 15_000 }); },
        answer: async (page) => { await page.getByRole("button", { name: "1", exact: true }).click(); await done(page).click(); },
      };
    case "buildThenDone":
      return {
        assertItem: async (page) => { await expect(done(page)).toBeVisible({ timeout: 15_000 }); },
        answer: async (page) => { await done(page).click(); },
      };
    case "sequence":
      return {
        // exposure / listening first; answer-options appear only in the tapping phase
        assertItem: async (page) => { await clickReadyIfShown(page); await expect(options(page).first()).toBeVisible({ timeout: 20_000 }); },
        answer: async (page) => {
          for (let k = 0; k < plan.taps; k++) await options(page).nth(k % Math.max(1, await options(page).count())).click();
          await done(page).click();
        },
      };
  }
}
function speedControl(page: Page): Locator {
  return page.getByTestId("answer-option").first();
}

/** The one control to click for a speed-block "answer" — used both to answer
 * and, via its DOM identity, to prove the next item actually mounted (see
 * clickAndExpectRemount). */

/**
 * Clicks `control` and confirms the runner actually advanced to a new item:
 * every item view remounts under a fresh `key` (app/play/page.tsx), so the
 * exact DOM node we clicked is guaranteed to detach once the next item
 * mounts — a deterministic proxy for "item changed" that doesn't depend on
 * two consecutive randomly-generated items happening to differ in content.
 */
async function clickAndExpectRemount(page: Page, control: Locator): Promise<void> {
  const handle = await control.elementHandle();
  if (!handle) throw new Error("clickAndExpectRemount: control not found");
  await handle.click();
  await page.waitForFunction((el) => !el.isConnected, handle, { timeout: 3_000 }).catch(() => {});
  await handle.dispose();
}

test.describe("play-through", () => {
  test("plays every genre block in the hidden QA level and reaches the end", async ({ page }) => {
    // 13 genres, several with multi-second "reveal"/listening/exposure
    // pauses by design (see comments below), plus the fun layer's
    // welcome/blockDone/praise interstitials (level 99 defaults to
    // fun: true — see app/play/page.tsx) — comfortably finishes within the
    // spec's ~3 minute budget, but well past Playwright's 30s per-test default.
    test.setTimeout(180_000);

    await stubBrowser(page);
    await page.goto(QA_URL);

    for (let i = 0; i < GENRE_LIST.length; i++) {
      const id = GENRE_LIST[i];
      const genre = GENRES[id];
      const spec = specFor(id);
      const isLast = i === GENRE_LIST.length - 1;
      const isSpeed = genre.mode === "speedBlock";
      const isTimed = genre.timing.kind !== "none";

      // ---- sample screen: kidTitle + Start ----
      await expect(page.getByRole("heading", { name: genre.kidTitle, exact: true })).toBeVisible({ timeout: 15_000 });
      const startBtn = page.getByRole("button", { name: "Start", exact: true });
      await expect(startBtn).toBeVisible();
      await startBtn.click();

      if (isSpeed) {
        // ---- speed block: one item, several rapid answers, then wait it out ----
        await spec.assertItem(page);
        await expect(page.getByTestId("countdown")).toBeVisible();

        for (let k = 0; k < 3; k++) {
          await clickAndExpectRemount(page, speedControl(page));
        }
      } else {
        // ---- staircase block: maxItems: 2, so exactly two items per block ----
        for (let itemNum = 0; itemNum < 2; itemNum++) {
          await spec.assertItem(page);

          if (isTimed) {
            await expect(page.getByTestId("countdown")).toBeVisible();
          } else {
            await expect(page.getByTestId("countdown")).toHaveCount(0);
          }

          await spec.answer(page);

          // levelQa uses feedback: "reveal", so every answer (right or
          // wrong) is followed by one of FullScoreScreen/PraiseScreen or
          // RevealAnswerScreen before the next item (or the block end)
          // appears — the "item advances" signal. All three carry the same
          // testid regardless of which praise line the fun layer picked
          // (level 99 defaults to fun: true — see AGENTS.md's fun-layer
          // brief), so this doesn't depend on exact text like "Yes!".
          await expect(page.getByTestId("between-feedback")).toBeVisible({ timeout: 6_000 });
        }
      }

      // ---- block end: next block's sample screen, or the finish screen ----
      if (isLast) {
        await expect(page.getByText("All done for today!")).toBeVisible({ timeout: 15_000 });
      } else {
        const nextGenre = GENRES[GENRE_LIST[i + 1]];
        await expect(page.getByRole("heading", { name: nextGenre.kidTitle, exact: true })).toBeVisible({
          timeout: 15_000,
        });
      }
    }
  });
});

test.describe("smoke", () => {
  test("home page renders a Play button", async ({ page }) => {
    await stubBrowser(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test("parent page asks for a parent key", async ({ page }) => {
    await stubBrowser(page);
    await page.goto("/parent");
    await expect(page.getByPlaceholder("Parent key")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Enter", exact: true })).toBeVisible();
  });
});
