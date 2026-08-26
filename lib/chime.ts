// A tiny, gentle "you got it!" chime — two short sine notes via Web Audio.
// UI-only browser code for the "fun layer" (praise screens); deliberately
// kept outside lib/engine, which stays pure/server-safe. The AudioContext is
// created lazily on first call (always after a real tap — answering an item
// is itself the user gesture browsers require) and every failure is
// swallowed silently: a missing/blocked audio backend must never throw or
// block the UI.
type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null | undefined;

function getContext(): AudioContext | null {
  if (ctx !== undefined) return ctx;
  try {
    const Ctor: AudioContextCtor | undefined =
      typeof window === "undefined"
        ? undefined
        : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    ctx = Ctor ? new Ctor() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(ac: AudioContext, freq: number, startAt: number, duration: number, volume: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

/** Two short, gentle notes (0.15s each, volume 0.2). No-op if Web Audio is unavailable or blocked. */
export function playChime(): void {
  try {
    const ac = getContext();
    if (!ac) return;
    if (ac.state === "suspended") void ac.resume().catch(() => {});
    const now = ac.currentTime;
    tone(ac, 523.25, now, 0.15, 0.2); // C5
    tone(ac, 659.25, now + 0.15, 0.15, 0.2); // E5
  } catch {
    // Audio is a nice-to-have; never let it break the game.
  }
}
