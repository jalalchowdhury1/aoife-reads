import type { BlockConfig, LevelConfig } from "../engine/types";
import { GENRES, GENRE_LIST } from "../genres";

// Hidden QA level (id 99): every genre in GENRE_LIST exactly once, capped at
// maxItems: 2, so the automated Playwright play-through (e2e/playthrough.spec.ts)
// can exercise every genre's view end-to-end in one short part instead of the
// ~35-minute real diagnostic. `released: false` keeps it out of Play/home and
// RELEASED_LEVELS entirely — it is reachable ONLY via a direct link:
// `/play?level=99&part=Q&replay=1`. See AGENTS.md §3 and owner decision #14
// (nothing deploys unless every puzzle demonstrably works).
//
// The two speed genres (coding, symbolSearch) normally run a real 120s
// (SPEED_BLOCK_MS) countdown; `blockMs: 4000` here shortens ONLY this level's
// speed blocks so the e2e run stays fast (see BlockConfig.blockMs / the
// runner's `cfg.blockMs ?? genre.timing.ms` in app/play/page.tsx).
const SPEED_GENRES = new Set(GENRE_LIST.filter((g) => GENRES[g].mode === "speedBlock"));

const blocks: BlockConfig[] = GENRE_LIST.map((genre) => ({
  genre,
  maxItems: 2,
  ...(SPEED_GENRES.has(genre) ? { blockMs: 4000 } : {}),
}));

export const levelQa: LevelConfig = {
  id: 99,
  title: "QA",
  feedback: "reveal",
  released: false,
  teachingItems: 0,
  parts: [
    {
      id: "Q",
      title: "QA",
      sticker: "🧪",
      blocks,
    },
  ],
};

export default levelQa;
