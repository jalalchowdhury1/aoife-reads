import type { LevelConfig } from "./../engine/types";
import { level1 } from "./level1";
import { levelQa } from "./levelQa";

// levelQa (id 99) is hidden (`released: false`) — it exists only so the
// automated e2e play-through (e2e/playthrough.spec.ts) has a direct,
// reachable link (`/play?level=99&part=Q&replay=1`) that exercises every
// genre in one short part. See lib/levels/levelQa.ts.
export const LEVELS: LevelConfig[] = [level1, levelQa];

/** Levels the child can reach from Play/home. Unreleased levels stay hidden until reviewed against her data. */
export const RELEASED_LEVELS: LevelConfig[] = LEVELS.filter((l) => l.released !== false);
