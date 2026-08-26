# Reading-app research digest — 2026-08-26

Gathered via Perplexity Pro (4 threads, saved in the account). Source for the genre designs,
the difficulty ramps, and `lib/engine/benchmarks.ts`. Purpose: train and approximately measure
the skills behind the WIAT-4 / WJ **Reading** and **Written Language** composites — the
"achievement door" to Davidson Young Scholars (145+ on two composites) — without ever copying
test items.

## What the real tests do at ages 5-7 (thread 1)
- **WIAT-4 K-1 composites:** Reading = Word Reading + Reading Comprehension; Written
  Expression = Spelling + Alphabet Writing Fluency; Total Achievement = those + the two math
  subtests.
- **Word Reading** starts with letter identification and letter-sound matching, then reading
  a graded word list ALOUD. **Reading Comprehension's earliest items are printed-word →
  picture matching** (exactly the Word Snap format), then sentence + literal question, then
  passages with look-back allowed (Read & Answer's format).
- **WJ Passage Comprehension is a cloze task** — read a sentence/passage, supply the missing
  word (Story Gap's format). WJ Letter-Word Identification / Word Attack = graded real-word
  and PSEUDOWORD reading aloud.
- **Spelling is dictated with a context sentence** ("word … sentence … word") — Spell It
  copies that administration shape with typing.
- A 145 needs broad performance across the composite's subtests, not one high grade level;
  grade equivalents are unstable at the top. **Alphabet Writing Fluency is handwriting speed
  — an app cannot train it; paper practice needed** (flagged to Jalal).

## Screen-only assessment validity (thread 4)
- Word→picture matching alone is a WEAK-to-moderate decoding proxy (first-letter cues, word
  shape, memorized words) → Word Snap forces same-first-letter distractors from d3 up.
- **Untimed pseudoword choice is the strongest no-read-aloud decoding proxy** (made-up words
  cannot be memorized) → Echo Words is the anchor decoding genre.
- Cloze/maze is moderate and belongs once the child reads connected text → Story Gap assumes
  basic decoding even at d1.
- Silent comprehension questions do not isolate decoding → the app separates DEC (soundHunt,
  echoWords) from CMP (wordSnap, storyGap, readAndAnswer) domains.

## Phonics scope-and-sequence (thread 2) — drives every DEC/SPL ramp
Phonological awareness PreK-K → phonemic awareness end-K/early-1 → letter-sounds end-K →
CVC end-K/early-1 → digraphs (sh/ch/th/wh/ck) gr1 → blends gr1 → silent-e end-gr1 →
vowel teams (ai/ay/ee/ea/oa/igh) end-gr2 → r-controlled (ar/or/er/ir/ur) end-gr2 →
multisyllabic/morphology gr2-3+.

## Spelling stages (thread 3) — drives Spell It's ramp
Precommunicative 3-5 → semiphonetic 4-6 → phonetic 5-7 → transitional 6-8 → conventional 8+.
Pattern sequence mirrors phonics: CVC (K) → digraphs/blends (gr1) → silent-e/vowel teams
(gr1-2) → inflectional endings (gr2) → multisyllabic + common irregulars (gr2-3).

## Grade → age conversion used by the Ages tab
K = 5-6 · gr1 = 6-7 · gr2 = 7-8 · gr3 = 8-9 · gr4 = 9-10 · gr5 = 10-11 (bands widened ±1 in
benchmarks.ts to stay honest about instruction variance).
