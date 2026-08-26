"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BlockRecord, GenreId, GenreViewProps, ItemRecord, LevelConfig, PartConfig, SessionRecord } from "@/lib/engine/types";
import { summarize, genreMaxD } from "@/lib/engine/types";
import { LEVELS, RELEASED_LEVELS } from "@/lib/levels";
import { GENRES, GENRE_LIST } from "@/lib/genres";
import { VIEWS } from "@/components/genres";
import { startStair, stepStair, type StairState } from "@/lib/engine/staircase";
import { randomSeed, makeRng } from "@/lib/engine/rng";
import {
  ulid,
  loadSessions,
  saveSessionLocal,
  enqueue,
  flushOutbox,
  syncState,
  currentPosition,
  fetchServerState,
  mergeSessions,
  profileStart,
} from "@/lib/engine/storage";
import { computeProfile } from "@/lib/engine/profile";
import { adaptPart, type ResolvedBlock } from "@/lib/engine/adapt";
import { speak, warmUpSpeech } from "@/lib/engine/speech";
import { pickPraise, type PraiseKind } from "@/lib/engine/praise";
import { starsForItem, bonusStar, sessionStars, newBests, streakAfter } from "@/lib/engine/rewards";
import { newBadges } from "@/lib/engine/badges";
import { KID_NAME } from "@/lib/engine/kid";
import { SampleScreen } from "@/components/SampleScreen";
import { Countdown } from "@/components/Countdown";
import { PartDone, type PartDoneRecap } from "@/components/PartDone";
import { BigButton } from "@/components/BigButton";
import { Ollie, type OllieMood } from "@/components/Ollie";
import { PraiseScreen } from "@/components/PraiseScreen";
import { StarJar } from "@/components/StarJar";

type Phase = "loading" | "welcome" | "sample" | "item" | "between" | "blockDone" | "done";

interface OllieLine {
  mood: OllieMood;
  line: string;
}

/** Priority order for what a correct, full-score answer gets praised as. */
function correctPraiseKind(d: number, streak: number, isNewBest: boolean, cameFromMiss: boolean): PraiseKind {
  if (d === 10) return "topOfRamp";
  if (isNewBest) return "newBest";
  if (streak >= 5) return "streak5";
  if (streak >= 3) return "streak3";
  if (cameFromMiss) return "comeback";
  return "correct";
}

// How long the "between" transition shows for `none`/`mark` feedback.
// `reveal` (Level 2) has its own two-speed timing handled by feedbackDelay
// below: a quick "Yes!" on a full-score response, a longer answer-reveal
// pause otherwise.
const BETWEEN_MS: Record<"none" | "mark", number> = { none: 600, mark: 1200 };

// `teaching`: this item was a missed teaching item (see ResolvedBlock.teachingItems
// / lib/engine/staircase.ts) — it gets the same 5s answer-reveal pause as
// Level 2's "reveal" feedback even when the level's own feedback is "none".
// `fun`: practice levels' PraiseScreen (see components/PraiseScreen.tsx)
// shows for 1.6s instead of the plain "Yes!" screen's 1.2s.
// QA 2026-08-23: the answer-reveal pause was 4000ms, which sometimes wasn't
// enough time to notice (let alone scroll to) the correct answer before it
// auto-advanced — bumped to 5000ms alongside the reveal-target scrollIntoView
// added to ChoiceView/WhichTwoView.
function feedbackDelay(feedback: LevelConfig["feedback"], fullScore: boolean, teaching: boolean, fun: boolean): number {
  if (feedback === "reveal") return fullScore ? (fun ? 1600 : 1200) : 5000;
  if (teaching) return 5000;
  return BETWEEN_MS[feedback];
}

function minutesBetween(startedAt: string, endedAt?: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt ?? new Date().toISOString()).getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}

function ProgressDots({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="flex gap-2" aria-label={`Puzzle ${Math.min(filled + 1, total)} of about ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full ${i < filled ? "bg-teal-400" : "bg-teal-100"}`}
        />
      ))}
    </div>
  );
}

function BetweenScreen({ feedback, lastCorrect }: { feedback: LevelConfig["feedback"]; lastCorrect: boolean | null }) {
  if (feedback === "mark") {
    return (
      <div className="flex flex-1 items-center justify-center-safe">
        <span className="text-8xl" aria-hidden>
          {lastCorrect ? "✅" : "❌"}
        </span>
      </div>
    );
  }
  // feedback === "none" (the only other value the runner ever passes here;
  // "reveal" is rendered directly by PlayRunner via RevealAnswerScreen /
  // FullScoreScreen below): neutral transition, no ticks/crosses/answers.
  return (
    <div className="flex flex-1 items-center justify-center-safe">
      <span className="font-bubble text-4xl text-ink">Next!</span>
    </div>
  );
}

function hasExplanation(item: unknown): item is { explanation: string } {
  return !!item && typeof (item as { explanation?: unknown }).explanation === "string";
}

// A remedial level's repeat block (ResolvedBlock.repeat, appended by adaptPart
// for a weak genre — see AGENTS.md §7) is the same genre she just played;
// showing the full SampleScreen again (instructions + a fresh sample item) is
// redundant. This is a short beat instead: her name for the genre, "One more
// round!", and Start — still speaks a short line and still fires the iOS
// audio-unlock gesture on tap.
function RepeatScreen({ kidTitle, onStart }: { kidTitle: string; onStart: () => void }) {
  useEffect(() => {
    void speak(`One more round of ${kidTitle}`);
  }, [kidTitle]);

  const handleStart = () => {
    warmUpSpeech();
    onStart();
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center-safe gap-6 bg-cream p-6 text-center">
      <h1 className="font-bubble text-4xl text-ink">{kidTitle}</h1>
      <p className="font-bubble text-3xl text-teal-600">One more round!</p>
      <BigButton onClick={handleStart} tone="teal">
        Start
      </BigButton>
    </div>
  );
}

// Level 2 ("reveal" feedback), full-score response: the "Yes!" look, shown
// for 1200ms (feedbackDelay) instead of the longer answer-reveal pause.
// Only used when `fun` is off — see PraiseScreen for the fun-layer version.
function FullScoreScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center-safe gap-3" data-testid="between-feedback">
      <span className="text-8xl" aria-hidden>
        ✅
      </span>
      <p className="font-bubble text-3xl text-ink">Yes!</p>
    </div>
  );
}

// A response worth less than full points (or a time-out): re-renders the
// same genre View, disabled, with `reveal` and `lastResponse` set so the
// view can show the correct answer against her own response. Shown for
// 5000ms (feedbackDelay). Used for Level 2's ("reveal" feedback) misses, and
// also for a missed teaching item on any level (see `teachingReveal`).
function RevealAnswerScreen({
  View,
  item,
  lastResponse,
  captionOllie,
  gotIt,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  View: React.ComponentType<GenreViewProps<any, any>>;
  item: unknown;
  lastResponse: unknown;
  // Fun layer only (see app/play/page.tsx `funOn`): Ollie narrates the reveal
  // ("Ooh, a tricky one!...") instead of the plain "Here is the answer"
  // caption. null/undefined keeps today's neutral caption exactly (Level 1's
  // teaching-item misses, and any level with fun off).
  captionOllie?: OllieLine | null;
  // true = ease-in hold: show the "Got it!" continue pill (no auto-advance timer is running).
  gotIt?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-4 text-center" data-testid="between-feedback">
      {captionOllie ? (
        <Ollie mood={captionOllie.mood} line={captionOllie.line} speak />
      ) : (
        <p className="font-bubble text-2xl text-ink">Here is the answer</p>
      )}
      <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-lg">
        <View item={item} disabled reveal lastResponse={lastResponse} onReady={() => {}} onRespond={() => {}} />
      </div>
      {hasExplanation(item) && <p className="max-w-md text-lg text-ink/80">{item.explanation}</p>}
      {gotIt && (
        // Ease-in levels: no timer runs on this screen — this button (or a
        // tap anywhere) is what moves on, so Ollie takes exactly as much time
        // as she wants. The click bubbles to the container's tap-to-advance.
        <button type="button" className="mt-1 min-h-12 shrink-0 rounded-full bg-teal-400 px-8 font-bubble text-xl text-white shadow-md active:scale-95">
          Got it!
        </button>
      )}
    </div>
  );
}

// Fun layer only (funOn): a 2s greeting before the very first sample screen
// of a part. Tap-skippable like every other fun screen (see handleSkipTap).
function WelcomeScreen({ line }: { line: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center-safe gap-6 bg-cream p-6 text-center">
      <Ollie mood="happy" line={line} speak />
    </div>
  );
}

// Fun layer only (funOn): a 2s "you finished a set!" beat between a block
// ending and the next block's sample/repeat screen. Tap-skippable.
function BlockDoneScreen({ line }: { line: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center-safe gap-6 bg-cream p-6 text-center">
      <Ollie mood="proud" line={line} speak />
    </div>
  );
}

function PlayRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initRef = useRef(false);
  const respondedRef = useRef(false);
  const blockEndedRef = useRef(false);
  const usedBankIdsRef = useRef<string[]>([]);

  // ---- Fun layer (Ollie the owl, praise screens, star jar, recap — see
  // AGENTS.md-adjacent brief 2026-08-23). All of it is gated behind
  // `funOn` (levelCfg.fun !== false); Level 1 (the diagnostic) is unaffected.
  const usedLinesRef = useRef<Set<string>>(new Set()); // pickPraise's per-session "don't repeat a line" set
  const bestDByGenreRef = useRef<Partial<Record<GenreId, number | null>>>({}); // this part's starting personal-best ceiling per genre, for "newBest"
  const earlierSessionsRef = useRef<SessionRecord[]>([]); // sessions known before THIS part-session, for newBests/newBadges
  const betweenTimerRef = useRef<number | null>(null); // the pending "advance to next item/phase" timeout
  const pendingAdvanceRef = useRef<(() => void) | null>(null); // what that timeout will run
  const advancedRef = useRef(false); // guards a tap-to-skip racing the timer itself

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [levelCfg, setLevelCfg] = useState<LevelConfig | null>(null);
  const [partCfg, setPartCfg] = useState<PartConfig | null>(null);
  // The part's blocks resolved against her profile once per part-start (see
  // adaptPart) — includes any repeat blocks a remedial level appends for a
  // weak genre. blockIndex indexes into this, not into partCfg.blocks.
  const [resolvedBlocks, setResolvedBlocks] = useState<ResolvedBlock[]>([]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [session, setSession] = useState<SessionRecord | null>(null);

  const [stair, setStair] = useState<StairState | null>(null);
  const [seed, setSeed] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [item, setItem] = useState<any>(null);
  const [itemIdx, setItemIdx] = useState(0);
  // `startedAtMs` (performance.now()) is used to compute each item's elapsed
  // `ms` for its ItemRecord. `startedAtEpoch` (Date.now()) is the *separate*
  // timestamp base Countdown compares itself against internally (it does
  // `Date.now() - startedAt`), so it must never be fed a performance.now()
  // value (that reads as an already-huge elapsed time and fires instantly).
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [startedAtEpoch, setStartedAtEpoch] = useState<number | null>(null);
  const [blockStartMs, setBlockStartMs] = useState<number | null>(null);
  const [blockStartedAtIso, setBlockStartedAtIso] = useState<string | null>(null);
  const [records, setRecords] = useState<ItemRecord[]>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  // "reveal" feedback only: her own response to re-render alongside the
  // answer, and whether it scored full points (picks the "Yes!" vs.
  // answer-reveal screen — see feedbackDelay and the render below).
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [fullScore, setFullScore] = useState(false);
  // True when the item just answered was a missed teaching item (see
  // ResolvedBlock.teachingItems) — forces the answer-reveal screen for this
  // one "between" pause even on a level whose own feedback is "none".
  const [teachingReveal, setTeachingReveal] = useState(false);

  // Fun layer state (see usedLinesRef comment above for the gate).
  const [welcomeLine, setWelcomeLine] = useState<string | null>(null);
  const [blockDoneLine, setBlockDoneLine] = useState<string | null>(null);
  const bailedRef = useRef(false); // she tapped "Not fun" on the current block
  const [praiseLine, setPraiseLine] = useState<OllieLine | null>(null); // correct-answer PraiseScreen
  const [praiseCelebrate, setPraiseCelebrate] = useState(false); // small confetti burst at a 5-streak
  const [missOllie, setMissOllie] = useState<OllieLine | null>(null); // Ollie's caption on the answer-reveal screen
  const [revealHold, setRevealHold] = useState(false); // ease-in: reveal waits for her tap (decision #19)
  const [jarStars, setJarStars] = useState(0); // this sitting's star-jar count
  const [bonusFlash, setBonusFlash] = useState(false); // "✨ Bonus star!" flourish
  const [recap, setRecap] = useState<PartDoneRecap | null>(null);
  const [partDoneLine, setPartDoneLine] = useState<string | null>(null);
  // QA 2026-08-23: true for ~400ms right after ANY interstitial (welcome/
  // blockDone/between-praise/between-reveal) advances — by timer or by
  // tap-skip — so a fast double-tap can't land on the next screen's own
  // controls before she's actually seen it (repro: an Animal Parade animal
  // and a Swap Shop option both got pre-selected this way). See
  // runPendingAdvance below, which is the one place every such advance
  // funnels through.
  const [inputShield, setInputShield] = useState(false);

  // Stable across every render so views whose mount effect lists `onReady`
  // as a dependency (ChoiceView, ArithmeticView, PictureSpanView) never
  // re-fire it just because the parent re-rendered.
  const handleReady = useCallback(() => {
    setStartedAtMs(performance.now());
    setStartedAtEpoch(Date.now());
  }, []);

  // Runs the pending fun-screen transition (blockDone->sample, welcome->sample,
  // or the between-phase item advance) at most once, whether the timer fired
  // naturally or she tapped to skip it (owner brief: "all fun screens are
  // skippable by tap" — never delays a timed item's start since this only
  // ever governs non-timed interstitial screens).
  const runPendingAdvance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    if (betweenTimerRef.current !== null) {
      window.clearTimeout(betweenTimerRef.current);
      betweenTimerRef.current = null;
    }
    const fn = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    setInputShield(true);
    fn?.();
  }, []);

  const scheduleAdvance = useCallback(
    (fn: () => void, delay: number) => {
      advancedRef.current = false;
      pendingAdvanceRef.current = fn;
      betweenTimerRef.current = window.setTimeout(runPendingAdvance, delay);
    },
    [runPendingAdvance]
  );

  useEffect(() => {
    return () => {
      if (betweenTimerRef.current !== null) window.clearTimeout(betweenTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!bonusFlash) return;
    const t = setTimeout(() => setBonusFlash(false), 1200);
    return () => clearTimeout(t);
  }, [bonusFlash]);

  useEffect(() => {
    if (!inputShield) return;
    const t = window.setTimeout(() => setInputShield(false), 400);
    return () => window.clearTimeout(t);
  }, [inputShield]);

  // ---- Resolve where to start: URL params, else currentPosition; ?replay=1
  // starts a fresh session even if the part is already complete. The server
  // (GET /api/state) is the source of truth for position and adaptation —
  // local storage is a mirror/offline fallback (AGENTS.md §2/§5): a wiped
  // iPad or a different device must never re-run the diagnostic just
  // because localStorage forgot what she already completed. ----
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    async function init() {
      // This effect reads browser-only state (localStorage sessions, the URL,
      // navigator/window) that isn't available during SSR and can't be derived
      // during render, plus a network call to the server. Guarded by initRef
      // so it runs exactly once; the several setState calls below are one
      // coherent initialization, not a per-render synchronization (the
      // react-hooks/set-state-in-effect lint rule doesn't flag setState
      // inside this nested async function, unlike the direct-body case
      // elsewhere in this file).
      void flushOutbox();

      const local = loadSessions();
      const replay = searchParams.get("replay") === "1";
      const levelParam = searchParams.get("level");
      const partParam = searchParams.get("part");
      const hasUrlParams = levelParam !== null && partParam !== null;

      let level: number;
      let part: string;
      let state: Awaited<ReturnType<typeof fetchServerState>>;

      if (hasUrlParams) {
        level = Number(levelParam);
        part = partParam as string;
        state = await fetchServerState(level, part);
        if (cancelled) return;
      } else {
        // Position needs server-known completions merged in first (a
        // different device, or lost localStorage, may have finished parts
        // this device has never heard of) before we know which part's
        // adapted plan to ask for next.
        const probe = await fetchServerState();
        if (cancelled) return;
        const mergedForPosition = probe ? mergeSessions(local, probe.completed) : local;
        const pos = currentPosition(RELEASED_LEVELS, mergedForPosition);
        level = pos.level;
        part = pos.part;
        state = probe ? await fetchServerState(level, part) : null;
        if (cancelled) return;
      }

      const sessions = state ? mergeSessions(local, state.completed) : local;

      const levelCfgFound = LEVELS.find((l) => l.id === level);
      const partCfgFound = levelCfgFound?.parts.find((p) => p.id === part);
      if (!levelCfgFound || !partCfgFound) {
        router.replace("/");
        return;
      }

      const partSessions = sessions.filter((s) => s.level === level && s.part === part);
      const hasComplete = partSessions.some((s) => s.complete);
      if (hasComplete && !replay) {
        router.replace("/");
        return;
      }

      // Resolved once per part-start (fresh again on a reload or a replay):
      // her profile drives each block's actual start/reps, and a remedial
      // level can append repeat blocks for a weak genre. Prefer the
      // server's already-resolved plan (it embeds her FULL server-side
      // profile, not just what this device happens to have locally); only
      // fall back to computing it from local sessions when the server
      // didn't answer. See adaptPart.
      const blocksForPart = state?.blocks ?? adaptPart(partCfgFound, levelCfgFound, computeProfile(sessions));

      const device = { ua: navigator.userAgent, w: window.innerWidth, h: window.innerHeight };
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

      let activeSession: SessionRecord;
      let startBlockIndex: number;

      if (replay) {
        activeSession = { id: ulid(), level, part, startedAt: new Date().toISOString(), device, blocks: [], complete: false, appVersion };
        startBlockIndex = 0;
      } else {
        const incomplete = partSessions.filter((s) => !s.complete);
        const latest = incomplete.length ? incomplete.reduce((a, b) => (a.startedAt > b.startedAt ? a : b)) : null;
        if (latest) {
          activeSession = latest;
          startBlockIndex = latest.blocks.length;
        } else {
          activeSession = { id: ulid(), level, part, startedAt: new Date().toISOString(), device, blocks: [], complete: false, appVersion };
          startBlockIndex = 0;
        }
      }

      setLevelCfg(levelCfgFound);
      setPartCfg(partCfgFound);
      setResolvedBlocks(blocksForPart);
      setSession(activeSession);
      setBlockIndex(startBlockIndex);

      // Fun layer setup (no-op cost when levelCfgFound.fun === false): her
      // starting personal-best ceiling per genre (for "newBest" praise) and
      // the session list from BEFORE this part-session (for the PartDone
      // recap's newBests/newBadges — excludes activeSession itself so a
      // resumed, partially-recorded session doesn't count against its own record).
      const bestMap: Partial<Record<GenreId, number | null>> = {};
      for (const g of GENRE_LIST) bestMap[g] = profileStart(g, sessions);
      bestDByGenreRef.current = bestMap;
      earlierSessionsRef.current = sessions.filter((s) => s.id !== activeSession.id);

      if (startBlockIndex >= blocksForPart.length) {
        // Defensive: every block already recorded but the session was never
        // flagged complete (shouldn't normally happen). Finish it now.
        const endedAtIso = activeSession.endedAt ?? new Date().toISOString();
        const doneSession: SessionRecord = { ...activeSession, complete: true, endedAt: endedAtIso };
        saveSessionLocal(doneSession);
        enqueue(doneSession);
        await flushOutbox();   // PartDone's first render reflects the real sync state
        setSession(doneSession);
        setPhase("done");
      } else if (levelCfgFound.fun !== false && startBlockIndex === 0) {
        // Welcome: the first sample of a part gets a 2s Ollie greeting first.
        const rng = makeRng(randomSeed());
        setWelcomeLine(pickPraise({ kind: "welcome", name: KID_NAME }, rng, usedLinesRef.current));
        scheduleAdvance(() => setPhase("sample"), 2000);
        setPhase("welcome");
      } else {
        setPhase("sample");
      }
      setReady(true);
    }

    void init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function beginBlockItems() {
    const cfg = resolvedBlocks[blockIndex];
    if (!cfg) return;
    const genre = GENRES[cfg.genre];

    usedBankIdsRef.current = [];
    respondedRef.current = false;
    blockEndedRef.current = false;
    setRecords([]);
    setLastCorrect(null);
    setLastResponse(null);
    setFullScore(false);
    setTeachingReveal(false);
    setPraiseLine(null);
    setPraiseCelebrate(false);
    setMissOllie(null);
    setBlockStartedAtIso(new Date().toISOString());

    const newSeed = randomSeed();
    setSeed(newSeed);

    if (genre.mode === "staircase") {
      const st = startStair(cfg.start, cfg.maxItems, cfg.teachingItems, cfg.stepUp, genreMaxD(genre), levelCfg?.easeIn ? { knownCeiling: cfg.knownCeiling ?? null } : null);
      setStair(st);
      setItem(genre.generate(newSeed, st.d, { excludeBankIds: [] }));
      setBlockStartMs(null);
    } else {
      setStair(null);
      setItem(genre.generate(newSeed, 1));
      setBlockStartMs(Date.now());
    }
    setStartedAtMs(null);
    setStartedAtEpoch(null);
    setItemIdx((i) => i + 1);
    setPhase("item");
  }

  function generateNextItem(d: number) {
    const cfg = resolvedBlocks[blockIndex];
    if (!cfg) return;
    const genre = GENRES[cfg.genre];
    const newSeed = randomSeed();
    respondedRef.current = false;
    setSeed(newSeed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setItem(genre.generate(newSeed, d as any, { excludeBankIds: usedBankIdsRef.current }));
    setStartedAtMs(null);
    setStartedAtEpoch(null);
    setItemIdx((i) => i + 1);
    setPhase("item");
  }

  /** She tapped "Not fun" (owner, 2026-08-23): end the block warmly, right now.
   * The current item is recorded with `bailed: true` (0 points) — agency, not
   * ability; the server stamps a "not-fun" quality flag from it and the block's
   * earlier answers still count. Never shown as a miss. */
  function bailBlock() {
    const cfg = resolvedBlocks[blockIndex];
    if (blockEndedRef.current || !cfg || !levelCfg) return;
    respondedRef.current = true;
    const genre = GENRES[cfg.genre];
    const ms = startedAtMs !== null ? performance.now() - startedAtMs : 0;
    const bailRecord: ItemRecord = {
      idx: records.length, seed, d: stair ? stair.d : (1 as ItemRecord["d"]),
      points: 0, max: 1, correct: false, ms, timedOut: false, response: null,
      bailed: true, bankId: genre.bankId?.(item),
    };
    bailedRef.current = true;
    void endBlock([...records, bailRecord]);
  }

  async function endBlock(finalRecords: ItemRecord[]) {
    const cfg = resolvedBlocks[blockIndex];
    if (blockEndedRef.current || !cfg || !session) return;
    blockEndedRef.current = true;

    const genre = GENRES[cfg.genre];
    const funOn = levelCfg?.fun !== false;
    const endedAtIso = new Date().toISOString();
    const blockRecord: BlockRecord = {
      genre: cfg.genre,
      mode: genre.mode,
      startedAt: blockStartedAtIso ?? endedAtIso,
      endedAt: endedAtIso,
      items: finalRecords,
      summary: summarize(finalRecords, genre.mode),
    };

    const isLastBlock = blockIndex + 1 >= resolvedBlocks.length;
    const updated: SessionRecord = {
      ...session,
      blocks: [...session.blocks, blockRecord],
      ...(isLastBlock ? { complete: true, endedAt: endedAtIso } : {}),
    };

    setSession(updated);
    saveSessionLocal(updated);
    enqueue(updated);

    if (isLastBlock) {
      // Awaited so PartDone's very first render already reflects the real
      // sync outcome instead of the stale "still pending" state from just
      // after `enqueue` (see AGENTS.md's sync-icon rule and PartDone.tsx).
      await flushOutbox();
      if (funOn && levelCfg && partCfg) {
        const earlier = earlierSessionsRef.current;
        const after = [...earlier, updated];
        const partIdx = levelCfg.parts.findIndex((p) => p.id === partCfg.id);
        const nextPart = levelCfg.parts[partIdx + 1];
        setRecap({
          puzzles: updated.blocks.reduce((n, b) => n + b.summary.attempted, 0),
          stars: sessionStars(updated),
          bests: newBests(updated, earlier).map((b) => ({ kidTitle: GENRES[b.genre].kidTitle, d: b.ceiling })),
          badges: newBadges(earlier, after),
          nextLine: nextPart ? `Tomorrow: ${nextPart.title}` : `You finished ${levelCfg.title}!`,
        });
        const rng = makeRng(randomSeed());
        setPartDoneLine(pickPraise({ kind: "partDone", name: KID_NAME }, rng, usedLinesRef.current));
      }
      setPhase("done");
    } else {
      void flushOutbox();
      setBlockIndex((b) => b + 1);
      if (funOn) {
        const rng = makeRng(randomSeed());
        setBlockDoneLine(pickPraise({ kind: bailedRef.current ? "bail" : "blockDone", name: KID_NAME, kidTitle: genre.kidTitle }, rng, usedLinesRef.current));
        bailedRef.current = false;
        scheduleAdvance(() => setPhase("sample"), 2000);
        setPhase("blockDone");
      } else {
        setPhase("sample");
      }
    }
  }

  function finishItem(response: unknown, timedOut: boolean, meta?: { replayed?: boolean; audioFallback?: boolean }) {
    const cfg = resolvedBlocks[blockIndex];
    if (respondedRef.current || blockEndedRef.current || !cfg || !levelCfg) return;
    respondedRef.current = true;

    const genre = GENRES[cfg.genre];
    const ms = startedAtMs !== null ? performance.now() - startedAtMs : 0;
    const finalScore = genre.score(item, timedOut ? null : response);
    const scoredFull = finalScore.points >= finalScore.max;

    // Ease-in (decision #19): at a personal-record difficulty the clock runs
    // 1.5x long, so a miss there tells us "couldn't do it", not "ran out of
    // time" — the owner's explicit ask. Mirrored in the Countdown render.
    const frontierNow =
      levelCfg.easeIn === true && stair !== null && stair.frontierBase !== null && stair.d > stair.frontierBase;
    let fast: boolean | undefined;
    if (genre.timing.kind === "item") {
      const cap = genre.timing.ms(stair!.d) * (cfg.timeScale ?? 1) * (frontierNow ? 1.5 : 1);
      fast = ms < cap * 0.5;
    } else if (genre.timing.kind === "none" && genre.mode === "staircase") {
      fast = ms < 10_000;   // untimed genres: a quick confident answer counts as fast (fast lane)
    }
    const bankId: string | undefined = genre.bankId?.(item);

    // Teaching items (ResolvedBlock.teachingItems / lib/engine/staircase.ts):
    // the first `cfg.teachingItems` items of a staircase block reveal the
    // answer if missed, like the real test's teaching items — independent of
    // the level's own `feedback` (Level 1 is otherwise "none").
    const isTeachingMiss = genre.mode === "staircase" && records.length < cfg.teachingItems && (timedOut || !scoredFull);

    // Stepped BEFORE the record is finalized so a frontier free miss
    // (StairState.lastMissFree, decision #19) can be stamped on the record —
    // it is a teaching moment, never a counted miss. Speed blocks have no
    // staircase and skip this.
    const newStair =
      genre.mode === "staircase"
        ? stepStair(stair!, finalScore.correct, fast === true && levelCfg?.fastLane !== false)
        : null;
    const isFreeMiss = newStair?.lastMissFree === true;

    const record: ItemRecord = {
      idx: records.length,
      seed,
      d: stair ? stair.d : 1,
      points: finalScore.points,
      max: finalScore.max,
      correct: finalScore.correct,
      ms,
      timedOut,
      response: timedOut ? null : response ?? null,
    };
    if (bankId !== undefined) record.bankId = bankId;
    if (fast !== undefined) record.fast = fast;
    if (meta?.replayed !== undefined) record.replayed = meta.replayed;
    if (meta?.audioFallback !== undefined) record.audioFallback = meta.audioFallback;
    if (isTeachingMiss || isFreeMiss) record.teaching = true;
    if (isFreeMiss) record.frontier = true;

    const funOn = levelCfg.fun !== false;
    if (funOn) {
      const base = starsForItem(record, genre.mode);
      const bonus = base > 0 && bonusStar(seed, record.idx);
      const stars = base + (bonus ? 1 : 0);
      record.stars = stars;
      setJarStars((j) => j + stars);
      setBonusFlash(bonus);
    }

    const newRecords = [...records, record];
    setRecords(newRecords);
    if (bankId) usedBankIdsRef.current = [...usedBankIdsRef.current, bankId];

    if (genre.mode === "speedBlock") {
      generateNextItem(1);
      return;
    }

    setStair(newStair!);
    setLastCorrect(finalScore.correct);
    setLastResponse(timedOut ? null : (response ?? null));
    setFullScore(scoredFull);
    setTeachingReveal(isTeachingMiss || isFreeMiss);
    // "Ollie takes sweet time" (owner, 2026-08-23): on an ease-in level every
    // answer-reveal waits for HER tap — no timer rushes the worked example.
    const holdForTap =
      levelCfg.easeIn === true &&
      !scoredFull &&
      (levelCfg.feedback === "reveal" || isTeachingMiss || isFreeMiss);
    setRevealHold(holdForTap);

    // Fun layer: Ollie's line for the between-phase screen this item leads to.
    // Only computed where that screen will actually show (mirrors exactly
    // where FullScoreScreen/RevealAnswerScreen already render below).
    if (funOn) {
      const willPraise = levelCfg.feedback === "reveal" && scoredFull;
      const willRevealMiss = (levelCfg.feedback === "reveal" && !scoredFull) || isTeachingMiss || isFreeMiss;
      const rng = makeRng(randomSeed());
      if (willPraise) {
        const cameFromMiss = records.length > 0 && !records[records.length - 1].correct;
        const streak = streakAfter(newRecords);
        const prevBest = bestDByGenreRef.current[cfg.genre] ?? null;
        // "New best" praise needs a REAL previous best to beat — the first puzzle of a
        // brand-new game is not a high score, it is a warm-up (QA 2026-08-23).
        const beatsRecord = prevBest !== null && stair!.d > prevBest;
        if (prevBest === null || stair!.d > prevBest) bestDByGenreRef.current[cfg.genre] = stair!.d;
        const kind = correctPraiseKind(stair!.d, streak, beatsRecord, cameFromMiss);
        const line = pickPraise(
          { kind, name: KID_NAME, kidTitle: genre.kidTitle, fast, hard: stair!.d >= 7, streak, stars: record.stars },
          rng,
          usedLinesRef.current
        );
        setPraiseLine({ mood: kind === "newBest" || kind === "topOfRamp" ? "proud" : "excited", line });
        setPraiseCelebrate(kind === "streak5");
        setMissOllie(null);
      } else if (willRevealMiss) {
        const kind = timedOut ? "timeout" : "miss";
        const line = pickPraise({ kind, name: KID_NAME, kidTitle: genre.kidTitle }, rng, usedLinesRef.current);
        setMissOllie({ mood: "thinking", line });
        setPraiseLine(null);
      } else {
        setPraiseLine(null);
        setMissOllie(null);
      }
    }

    setPhase("between");

    const delay = feedbackDelay(levelCfg.feedback, scoredFull, isTeachingMiss || isFreeMiss, funOn);
    // holdForTap: park the timer far away (10 min safety net) — the screen's
    // existing tap-to-advance is how she moves on, at her own pace.
    scheduleAdvance(() => {
      if (newStair!.done) endBlock(newRecords);
      else generateNextItem(newStair!.d);
    }, holdForTap ? 600_000 : delay);
  }

  // Not memoized: none of the views read `onRespond` inside an effect
  // dependency array (only `onReady` needs a stable identity, see above), so
  // a plain closure recreated every render is simplest and always current.
  function handleRespond(r: unknown, meta?: { replayed?: boolean; audioFallback?: boolean }) {
    finishItem(r, false, meta);
  }

  if (!ready || phase === "loading" || !levelCfg || !partCfg) {
    return <div className="flex flex-1 bg-cream" />;
  }

  // QA 2026-08-23 (buttons below the fold at short viewport heights): every
  // phase below renders into `body`, then the single return at the bottom
  // wraps it with the tap shield overlay — so the shield can sit on top no
  // matter which phase it followed (see `inputShield`/runPendingAdvance).
  let body: React.ReactNode;

  if (phase === "done") {
    const minutes = session ? minutesBetween(session.startedAt, session.endedAt) : 0;
    body = (
      <PartDone
        part={partCfg}
        minutes={minutes}
        synced={syncState() === "synced"}
        onHome={() => router.push("/")}
        recap={recap}
        pipLine={partDoneLine}
      />
    );
  } else {
    const funOn = levelCfg.fun !== false;

    if (phase === "welcome") {
      body = (
        <div className="flex flex-1 min-h-0" onClick={runPendingAdvance}>
          <WelcomeScreen line={welcomeLine ?? ""} />
        </div>
      );
    } else if (phase === "blockDone") {
      body = (
        <div className="flex flex-1 min-h-0" onClick={runPendingAdvance}>
          <BlockDoneScreen line={blockDoneLine ?? ""} />
        </div>
      );
    } else {
      const cfg = resolvedBlocks[blockIndex];
      if (!cfg) {
        body = <div className="flex flex-1 bg-cream" />;
      } else {
        const genre = GENRES[cfg.genre];
        const View = VIEWS[cfg.genre];

        if (phase === "sample") {
          // A remedial level's repeat block (see RepeatScreen above) skips
          // the full sample screen — she just played this genre.
          body = cfg.repeat ? (
            <RepeatScreen kidTitle={genre.kidTitle} onStart={beginBlockItems} />
          ) : (
            <SampleScreen genre={genre} View={View} onStart={beginBlockItems} fun={funOn} />
          );
        } else {
          body = (
            <div className="flex min-h-0 flex-1 flex-col bg-cream">
              <div className="flex items-center justify-between gap-4 px-4 pt-4">
                <span className="font-bubble text-lg text-ink/70">{partCfg.title}</span>
                {genre.mode === "staircase" && <ProgressDots total={cfg.maxItems} filled={records.length} />}
                {funOn ? <StarJar stars={jarStars} bonus={bonusFlash} /> : <span aria-hidden className="w-0" />}
              </div>

              {genre.timing.kind === "block" && (
                <div className="px-4 pt-2">
                  {/* cfg.blockMs (BlockConfig.blockMs) overrides the genre's normal
                      120s speed-block window — only set by the hidden QA level
                      (lib/levels/levelQa.ts) so its e2e play-through doesn't have to
                      sit through a real speed block. */}
                  <Countdown totalMs={cfg.blockMs ?? genre.timing.ms} startedAt={blockStartMs} onExpire={() => endBlock(records)} />
                </div>
              )}

              {/* QA 2026-08-23: this is now the ONLY scrolling region on the
                  play screen (header/countdown above stay fixed) — every
                  view's own action row pins itself to the bottom of this
                  container via `sticky bottom-0`, so it's always visible
                  without scrolling even when the stimulus above it is tall
                  enough to need a scroll (see e.g. FireflyBoxesView,
                  ChoiceView, WhichTwoView, PictureSudokuView). */}
              <div
                className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto"
                // Fun screens are tap-skippable (owner brief); the "item" phase is
                // never affected since a timed item's own controls are what respond
                // to a tap, and onClick here is a no-op while phase === "item".
                onClick={phase === "between" && funOn ? runPendingAdvance : undefined}
              >
                {phase === "item" ? (
                  <>
                    {genre.timing.kind === "item" && (
                      <div className="w-full max-w-md px-4 pb-2">
                        <Countdown
                          totalMs={
                            genre.timing.ms(stair!.d) *
                            (cfg.timeScale ?? 1) *
                            (levelCfg.easeIn === true && stair!.frontierBase !== null && stair!.d > stair!.frontierBase ? 1.5 : 1)
                          }
                          startedAt={startedAtEpoch}
                          onExpire={() => finishItem(null, true)}
                        />
                      </div>
                    )}
                    <View
                      key={`${blockIndex}-${itemIdx}`}
                      item={item}
                      disabled={false}
                      display={cfg.display}
                      onReady={handleReady}
                      onRespond={handleRespond}
                    />
                    {funOn && (
                      <button
                        type="button"
                        onClick={bailBlock}
                        className="fixed bottom-3 left-3 z-30 min-h-11 rounded-full border border-rose-400/60 bg-cream/90 px-4 py-2 text-sm text-ink/60 shadow-sm active:scale-95"
                      >
                        😕 Not fun
                      </button>
                    )}
                  </>
                ) : levelCfg.feedback === "reveal" ? (
                  fullScore ? (
                    funOn && praiseLine ? (
                      <PraiseScreen mood={praiseLine.mood} line={praiseLine.line} celebrate={praiseCelebrate} />
                    ) : (
                      <FullScoreScreen />
                    )
                  ) : (
                    <RevealAnswerScreen View={View} item={item} lastResponse={lastResponse} captionOllie={funOn ? missOllie : null} gotIt={revealHold} />
                  )
                ) : teachingReveal ? (
                  // A missed teaching item on a level whose own feedback is "none"
                  // (Level 1): still show the answer, just this once.
                  <RevealAnswerScreen View={View} item={item} lastResponse={lastResponse} captionOllie={funOn ? missOllie : null} gotIt={revealHold} />
                ) : (
                  <BetweenScreen feedback={levelCfg.feedback} lastCorrect={lastCorrect} />
                )}
              </div>
            </div>
          );
        }
      }
    }
  }

  return (
    <>
      {body}
      {/* QA 2026-08-23 (tap-skip landing on the next screen's controls): a
          transparent, input-swallowing shield for ~400ms after ANY
          interstitial advances to the next screen, whether that happened by
          timer or by tap-skip (see runPendingAdvance/inputShield above).
          Purely a pointer-events catcher — it never delays onReady or the
          countdown, which run underneath unaffected. */}
      {inputShield && <div className="fixed inset-0 z-40" aria-hidden="true" />}
    </>
  );
}

export default function PlayPage() {
  // QA 2026-08-23 (buttons below the fold at short viewport heights): a hard
  // h-dvh cap on the whole play screen, instead of relying on the body's
  // min-h-dvh (a minimum, not a cap) — every phase below fills this via
  // flex-1, and the one phase with genuinely tall content (the item/between
  // screen) scrolls internally instead of pushing its action row off the
  // visible viewport. See app/globals.css / app/layout.tsx for the outer shell.
  return (
    <div className="flex h-dvh flex-col bg-cream">
      <Suspense fallback={<div className="flex flex-1 bg-cream" />}>
        <PlayRunner />
      </Suspense>
    </div>
  );
}
