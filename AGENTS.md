# AGENTS.md — Word Woods (aoife-reads)

> **Read this first. Single source of truth for anyone (human or AI) touching this repo.**
> README.md is Jalal's plain-English doc — leave it alone unless asked. If something here
> is wrong, fix *this* file.

## 1. What this is

A tablet (iPad) web game for Aoife (born 2021-01-11) that TRAINS and approximately MEASURES
the school skills behind the WIAT-4 / WJ **Reading** and **Written Language** achievement
composites — reading (decoding, word reading, comprehension) and spelling. Built 2026-08-26
as a fork of the aoife-puzzles engine, for the "achievement door" to Davidson Young Scholars
(145+ standard score on two composites; see the research digest). Mascot: **Ollie the owl 🦉**
(Pip the fox stays with aoife-puzzles).

Unlike the WISC-prep app there is NO coaching-ethics tension here: achievement tests measure
LEARNED skills, so practicing reading and spelling is simply homeschooling (it also feeds the
RI homeschool progress report). We still never copy WIAT/WJ items — formats are cousins.

Research digest: `docs/research/2026-08-26-reading-app-research.md` (4 Perplexity threads).
Live: **https://aoife-reads.vercel.app** · repo `jalalchowdhury1/aoife-reads` (public).

### The six genres (lib/genres/) — the show-vs-speak split is LOAD-BEARING

| id | kid title | domain | what is SHOWN | what is SPOKEN | cousin of |
|---|---|---|---|---|---|
| soundHunt | Sound Hunt | DEC | picture only (never the spelling) | the word + question | WIAT Word Reading early items |
| echoWords | Echo Words | DEC | 4 written pseudowords | the made-up target word | WIAT Pseudoword Decoding / WJ Word Attack (recognition form — the strongest screen-only decoding proxy per the digest) |
| wordSnap | Word Snap | CMP | the printed word (NEVER spoken) | nothing | WIAT Reading Comprehension word→picture items |
| storyGap | Story Gap | CMP | sentence with a ___ gap | nothing | WJ Passage Comprehension (cloze) |
| readAndAnswer | Read & Answer | CMP | passage + question | nothing | WIAT Reading Comprehension passages |
| spellIt | Spell It | SPL | letter pad only (never the word) | "word… sentence… word" dictation | WIAT/WJ Spelling |

Domains: DEC (decoding), CMP (reading comprehension), SPL (spelling). Bundles in profile.ts:
READING = soundHunt+echoWords+wordSnap+storyGap+readAndAnswer, WRITTEN = spellIt (exported as
EGAI/CPI aliases so the ported parent page keeps working). **Alphabet Writing Fluency (the
other half of the K-1 Written composite) is HANDWRITING — out of app scope, practice on paper.**

Ramps follow the phonics scope-and-sequence and text-complexity ladders in the digest
(d1-10 ≈ late-preK → grade 5). The parent Ages tab maps ceilings to grade/age bands via
`lib/engine/benchmarks.ts` — same honesty rules as aoife-puzzles decision #20: parent-only,
ranges never scores, "still-winning" ceilings render as "≥ N", speed comparisons don't exist.

## 2. Architecture

Forked 2026-08-26 from aoife-puzzles (engine, runner, parent dashboard, fun layer, release
gate all inherited — see that repo's AGENTS.md §2 for the deep description). Differences:
- `lib/genres/` = the six reading genres above + `readingItem.ts` (shared item shape);
  two views: `components/genres/ReadingChoiceView.tsx` (all five choice genres) and
  `SpellItView.tsx` (alphabet-row letter pad, tray, ⌫).
- `lib/engine/kv.ts` PREFIX = **`aoife_reads:`** (same shared Upstash DB as the planner and
  puzzles — NEVER touch `aoifes_schedule*` or `aoife_puzzles:*` keys).
- localStorage keys = `aoife-reads:*`.
- No speed-block genres (SPEED_GENRES empty; speed badges retired).
- `lib/engine/scale.ts` SCALE_CHANGES starts empty (original ramps).
- Levels: 1 = "Find Your Reading Powers" diagnostic (Part A Sounds and Words: soundHunt,
  echoWords, wordSnap · Part B Stories and Spelling: storyGap, readAndAnswer, spellIt;
  teaching 2, feedback none, fun off, everything starts d1) · 99 = hidden QA level.

## 3. Run / test / deploy

- `npm install --cache ./.npm-cache` (global npm cache corrupted on this Mac).
- `npm run dev` · `npm test` (Vitest — fairness sweeps 500 seeds × 10 difficulties per genre
  in `lib/genres/fairness/reading.test.ts`) · `npm run lint` · `npm run typecheck` ·
  `npm run build` · `npm run e2e` (Playwright plays every genre via `/play?level=99&part=Q&replay=1`).
- **Deploy: ALWAYS `npm run release`** (lint → tsc → unit → build → e2e → `vercel --prod`).
  GitHub auto-deploy is NOT connected. Regenerate + eyeball `docs/audit/items.html`
  (`npx tsx scripts/audit-items.ts`) when items change.
- Definition of done: release green + a real walkthrough (speech needs real Safari/Chrome).

## 4. Secrets & env (Vercel project `aoife-reads`)

| Var | Where it came from |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | same shared Upstash DB `upstash-kv-alizarin-helmet` as aoifes-schedule/aoife-puzzles |
| `PARENT_KEY` | generated 2026-08-26; local copy `~/PycharmProjects/.secrets/aoife-reads.env` (mode 600) |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | `~/PycharmProjects/.secrets/telegram.env` (@ZingerJC_bot → Jalal's DM) |

No secrets in the repo. Never print them to a transcript. The aoife-puzzles gotcha applies
here too: `vercel env add` via stdin can mark vars sensitive → `vercel env pull` blanks.

## 5. Gotchas / hard rules

- **Validity is sacred** (inherited): a broken/ambiguous item writes a FALSE weakness. Every
  new band or genre needs fairness rules in `lib/genres/fairness/reading.test.ts`; deploy only
  through the gate; self-play new content with speech ON before telling Jalal it's ready.
- **The show-vs-speak split** (table above) is what makes each genre measure what it claims.
  Never "helpfully" add TTS to wordSnap/storyGap/readAndAnswer (it would answer the item for
  her) and never display echoWords' target or spellIt's word (same).
- **echoWords pseudowords come from curated onset+rime tables ONLY** (never free letter
  combinations) so browser TTS pronounces them cleanly, plus a REAL-words blocklist. If TTS
  mangles a rime in self-play, remove that rime from `B` in echoWords.ts — don't fight the
  synthesizer.
- **wordSnap emoji must unambiguously depict their word.** Several were already replaced for
  this (moth→🦋 read as butterfly, gate→🚪 read as door). When adding words, ask "what would
  a 5-year-old CALL this picture?" — if it isn't the word, don't use it.
- SpellItView's pad is ALPHABETICAL rows, not QWERTY — she knows the alphabet song, not
  keyboards. Do not "improve" it to QWERTY.
- The child never sees scores; the Ages tab exists on `/parent` only. No norms, no
  percentiles, no IQ-like numbers anywhere — grade/age RANGES with a stated basis.
- Reload/replay, offline outbox, server-position rules are inherited from aoife-puzzles
  verbatim (see its AGENTS.md §5) — including: `/api/state` public but resultless, gated
  `/api/profile`, flags excluded from the profile, views fire onReady in a mount effect.

## 6. State / TODO

- 2026-08-26: v0.1.0 built — 6 genres, Level 1 diagnostic, parent dashboard w/ grade-anchored
  Ages tab, 246 unit tests + 28-rule fairness sweep + e2e green. First release pending
  self-play TTS check (echoWords pronunciation, spellIt dictation pacing) on prod.
- Not yet played by Aoife. Level 1's first run is the record; Level 2 gets designed from it
  (same playbook as the puzzles app: read `/api/profile` first).
- Parked ideas: sentence-building genre (writing proxy); maze-style timed reading fluency;
  hear-a-passage listening-comprehension genre (separates language from decoding); bank
  expansion past ~4 items/difficulty; a paper Alphabet-Writing-Fluency practice sheet.

## 7. Playbooks

**"Add a level"** / **"How is she doing"** — identical to aoife-puzzles §7 (adaptPart,
`weighting: "remedial"`, `curl -H "x-parent-key: ..." https://aoife-reads.vercel.app/api/profile`).
**"Add words/passages"** — extend the tier table or bank in the genre file; fairness tests
enforce id uniqueness/coverage; regen the audit page and EYEBALL it; check the emoji rule.
