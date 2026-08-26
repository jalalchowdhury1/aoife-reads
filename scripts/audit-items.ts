// Item audit page generator (validity is sacred — same rule as aoife-puzzles).
//
// Renders 3 seeded items (seeds 1, 2, 3) for every genre x every difficulty
// 1-10 into one self-contained HTML file, so a human can eyeball every
// difficulty of every reading game in one page before a release.
//
// Run with:  npx tsx scripts/audit-items.ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GENRES, GENRE_LIST } from "../lib/genres";
import { DIFFICULTIES, genreMaxD, type Difficulty } from "../lib/engine/types";

const SEEDS = [1, 2, 3];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const STYLE = `
body { font-family: system-ui, sans-serif; margin: 24px; background: #fdf8ef; color: #223; }
h1 { margin-bottom: 4px; }
.subtitle { color: #667; margin-top: 0; }
.toc a { margin-right: 12px; }
section { margin-top: 36px; }
h2 { border-bottom: 2px solid #2bb3a9; padding-bottom: 4px; }
.subtest { font-size: 0.6em; color: #889; font-weight: normal; }
.ramp { color: #556; font-size: 0.9em; max-width: 70em; }
.d-block { margin-top: 14px; }
.d-label { font-weight: bold; color: #2bb3a9; }
.grid { display: flex; gap: 12px; flex-wrap: wrap; }
.card { border: 1px solid #ddd; border-radius: 10px; padding: 10px; background: #fff; max-width: 30em; }
.card-meta { font-size: 0.7em; color: #99a; margin-bottom: 4px; }
.legend { color: #667; font-size: 0.85em; margin: 8px 0; }
.swatch { display: inline-block; width: 12px; height: 12px; background: rgba(111,207,111,0.5); border: 2px solid #6fcf6f; border-radius: 3px; margin-right: 4px; }
`;

function buildPage(): string {
  const toc = GENRE_LIST.map((id) => `<a href="#${id}">${esc(GENRES[id].kidTitle)}</a>`).join("");

  const sections = GENRE_LIST.map((id) => {
    const genre = GENRES[id];
    if (!genre.audit) throw new Error(`no audit renderer for ${id}`);
    const allD: Difficulty[] = genreMaxD(genre) > 10
      ? [...DIFFICULTIES, ...Array.from({ length: genreMaxD(genre) - 10 }, (_, i) => (11 + i) as Difficulty)]
      : DIFFICULTIES;
    const dBlocks = allD.map((d) => {
      const cards = SEEDS.map((seed) => {
        const item = genre.generate(seed, d);
        return `<div class="card"><div class="card-meta">seed ${seed}</div>${genre.audit!(item)}</div>`;
      }).join("");
      return `<div class="d-block"><div class="d-label">d${d}</div><div class="grid">${cards}</div></div>`;
    }).join("");

    return (
      `<section id="${id}">` +
      `<h2>${esc(genre.kidTitle)} <span class="subtest">${esc(genre.subtest)} &middot; ${id}</span></h2>` +
      `<p class="ramp">${esc(genre.instructions)}</p>` +
      dBlocks +
      `</section>`
    );
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Word Woods &mdash; Item Audit</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${STYLE}</style>
</head>
<body>
<h1>Word Woods &mdash; Item Audit</h1>
<p class="subtitle">3 seeded items per difficulty, every genre. Regenerate with <code>npx tsx scripts/audit-items.ts</code> before a release.</p>
<div class="legend"><span><span class="swatch"></span>green border = the credited answer</span></div>
<div class="toc">${toc}</div>
${sections}
</body>
</html>
`;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(scriptDir, "..", "docs", "audit");
const outFile = path.join(outDir, "items.html");

mkdirSync(outDir, { recursive: true });
const html = buildPage();
writeFileSync(outFile, html, "utf8");

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
console.log(`Wrote ${outFile} (${kb} KB)`);
