import type { Difficulty } from "./types";

export const itemMs = (table: [maxD: number, ms: number][]) => (d: Difficulty) => table.find(([m]) => d <= m)![1];
export const SPEED_BLOCK_MS = 120_000;
