# Achieve 2: the Math composite + Practice tab (2026-08-27, overnight build)

Owner directives (2026-08-26 evening, confirmed by MCQ — do not re-litigate):
1. Add WIAT-style MATH — numerical operations + math problem solving — in BOTH formats
   (solo child games AND examiner genres), so one app covers all three achievement
   composites: Reading, Mathematics, Written Language.
2. Port the practice-missed loop ("make sure we can go back and practice the ones we
   got wrong") with the same validity rules as aoife-puzzles decision #23.
3. Printable timed Alphabet Writing Fluency worksheets (30-second format) to Drive.

## Design calls made solo tonight

- **New domain MTH**, bundle `MATH`. Four genres:
  - `numberCrunch` (solo, numpad): computation ladder d1 counting → d10 three-digit
    add/sub + 2-digit×1-digit. Generated, deterministic, untimed.
  - `storyProblems` (solo, numpad): templated word problems, SHOWN and SPOKEN — the TTS
    removes the reading load exactly the way the real Math Problem Solving examiner
    reads to the child, so this measures math reasoning, not decoding.
  - `mathOnPaper` (examiner): Numerical Operations administration — the easel shows the
    problem, she works it on paper, the grown-up marks it (reuses numberCrunch's ladder).
  - `mathOutLoud` (examiner): Math Problem Solving administration — Ollie reads the story
    aloud, paper allowed, open answer, grown-up marks (reuses storyProblems' ladder).
- **Levels reordered while nothing has been played** (server shows zero completions):
  Level 2 = "Count with Ollie" (solo math diagnostic, same knobs as Level 1), Test Day
  moves to id 3 and gains Part C "Math Day" (mathOnPaper + mathOutLoud). Solo
  diagnostics first, one grown-up day covering all three composites.
- **ExaminerItem gains `childHint`** so the child-facing line under a dictated item is
  per-genre ("Write the word on your paper ✏️" vs "You can use paper to work it out ✏️").
- **Practice tab** ported from aoife-puzzles decision #23 verbatim, plus one rule this
  repo needs: EXAMINER genres are excluded from the solo queue (their response is a
  grown-up's judgement; a solo child can't replay them).
- Benchmarks: grade-anchored bands for the two solo math genres (d1≈preK/K → d10≈gr4-5,
  same honesty rules as the reading bands); examiner math mirrors them.
