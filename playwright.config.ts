import { defineConfig } from "@playwright/test";

// The release gate's automated play-through (AGENTS.md §3, owner decision
// #14: nothing deploys unless every puzzle demonstrably works). A single
// spec (e2e/playthrough.spec.ts) drives the hidden QA level (lib/levels/levelQa.ts,
// id 99) through every genre, plus quick smoke checks of "/" and "/parent".
export default defineConfig({
  testDir: "./e2e",
  // The play-through test walks all 13 genre blocks end-to-end (two staircase
  // items each, or a short speed block) and legitimately takes over two
  // minutes now that the fun layer's welcome/blockDone/praise interstitials
  // (app/play/page.tsx, level 99 defaults to fun: true) add their own short
  // pauses; give it real headroom instead of Playwright's 30s default.
  timeout: 180_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3210",
    viewport: { width: 1180, height: 713 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  webServer: {
    command: "npm run dev -- -p 3210",
    url: "http://localhost:3210",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
