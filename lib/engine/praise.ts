// Praise lines: the pure "fun engine" heart of the owner brief (2026-08-23):
// "At every point let her know that she is awesome (in different ways every
// time)." Every line here is warm, short, and correction free — never
// wrong/bad/failed/oops/sorry/mistake/incorrect, never a dash character.
// "miss"/"timeout" lines reframe a tricky puzzle as a fun secret to learn,
// never as an error. Pure and deterministic: pickPraise only consumes the
// Rng and `used` Set it is given.
import type { Rng } from "./rng";

export type PraiseKind =
  | "correct" | "miss" | "timeout" | "streak3" | "streak5" | "newBest"
  | "firstOfGenre" | "topOfRamp" | "comeback" | "blockDone" | "partDone"
  | "welcome" | "neutralNext"
  | "bail";

export type PraiseContext = {
  kind: PraiseKind;
  name: string;
  kidTitle?: string;
  fast?: boolean;
  hard?: boolean;
  streak?: number;
  stars?: number;
  level?: number;
};

// PRAISE_BANK carries one array per PraiseKind, plus two extra "flavor" pools
// (correctFast/correctHard) that pickPraise blends into the "correct" pool
// when ctx.fast/ctx.hard is set. Every array's entries are unique templates
// (no two identical strings in the same array) so `used`-based dedup never
// silently collapses two slots into one.
export const PRAISE_BANK: Record<PraiseKind, string[]> & { correctFast: string[]; correctHard: string[] } = {
  // --- correct: 60 lines, five styles x twelve lines -----------------------
  correct: [
    // specific
    "You spotted that in a flash.",
    "You worked that out all by yourself.",
    "You found the answer so fast.",
    "That took sharp eyes to see.",
    "You matched every single piece.",
    "You worked that out perfectly.",
    "You saw the pattern right away.",
    "That was a tricky shape and you got it.",
    "You listened so carefully.",
    "You remembered every part of that.",
    "{name}, you figured that whole thing out.",
    "You noticed the one that fits.",
    // silly
    "Your brain just did a backflip.",
    "Ding! Your brain rang the bell.",
    "Somewhere a tiny trumpet is playing for you.",
    "Boom! Puzzle solved.",
    "Your thinking cap is on fire, the good kind.",
    "Zoom, your brain went straight to the answer.",
    "That answer popped out like magic.",
    "Your brain just did a happy little dance.",
    "Pow! Right answer.",
    "Your brain is basically a superhero today.",
    "That was so smooth it should have sound effects.",
    "Your brain just leveled up.",
    // proud
    "Ollie is doing a happy dance.",
    "Ollie cannot stop smiling right now.",
    "Ollie is so proud of you.",
    "{name}, Ollie thinks you are amazing.",
    "Ollie is cheering so loudly.",
    "Ollie gives you a huge high five.",
    "Everyone is proud of you right now.",
    "Ollie is telling all the other foxes about you.",
    "{name}, that made Ollie's whole day.",
    "Ollie is jumping up and down for you.",
    "Ollie thinks you might be part genius.",
    "Ollie just did a little victory spin.",
    // growth
    "Your puzzle muscles are getting stronger.",
    "You are getting better every single time.",
    "Look how much you have grown at this.",
    "{name}, you are turning into a puzzle master.",
    "Every round you play makes your brain stronger.",
    "You just got a little bit smarter.",
    "You are building real skill right there.",
    "{name}, you keep getting sharper.",
    "You are climbing higher every time you play.",
    "Your thinking is growing bigger every day.",
    "That is a brand new level of skill for you.",
    "You are turning into a true expert.",
    // sensory
    "Ding ding ding!",
    "Ta da!",
    "Whoosh, straight to the answer.",
    "Sparkle sparkle, you got it.",
    "Bling! Correct answer.",
    "Pop! There it is.",
    "Kaching, another one solved.",
    "Zing! You nailed that.",
    "Whoop whoop!",
    "Tada, another win for {name}.",
    "Bloop, brain points collected.",
    "Sparkles everywhere, {name}!",
  ],
  correctFast: [
    "Wow, that was fast!",
    "Lightning quick, {name}!",
    "You barely even had to think about that one.",
    "Speedy and correct, my favorite combo.",
    "That was quick as a blink.",
    "Zoom! You answered before Ollie could even cheer.",
    "Fast fingers, fast brain.",
    "You are quick as a fox today.",
  ],
  correctHard: [
    "That one was tough and you still got it.",
    "That was one of the hardest ones and you solved it.",
    "Big kids find that one tricky and you did it.",
    "That is grown up level thinking right there.",
    "You just solved a really hard one, {name}.",
    "That puzzle was built for much older kids and you beat it.",
    "Whoa, that was a big one and you nailed it.",
    "That took real brain power and you had plenty.",
  ],
  // --- miss / timeout: reframe, never mention being wrong ------------------
  miss: [
    "Ooh, a tricky one! Let me show you how it works.",
    "That one is made for much older kids. Watch this.",
    "No problem at all. Here is the secret.",
    "That is a sneaky puzzle. Let me show you the trick.",
    "Here is a fun secret about that one.",
    "Watch closely, here is how this one works.",
    "That is a tough format. Let Ollie show you.",
    "Let me show you a clever trick for that one.",
    "Puzzles like that take practice. Here is how.",
    "That one has a secret rule. Let me show you.",
    "Some puzzles need a peek behind the curtain. Here it is.",
    "Let us look at this one together.",
    "That is a big kid puzzle. Here is the trick to it.",
    "Watch how this one works, {name}.",
    "Here comes a helpful clue for next time.",
    "That format is new. Let Ollie show you the trick.",
    "This one is sneaky. Here is how it really works.",
    "Let us peek at how that puzzle works.",
    "That was a clever trap. Here is how to spot it.",
    "Every puzzle master learns this trick eventually.",
  ],
  timeout: [
    "Time raced ahead of us that time. Here is the answer.",
    "The clock won that round. Let me show you.",
    "That one needed a bit more time. Here it is.",
    "Quick, before the clock catches us again, here is the trick.",
    "The timer beat us there. Watch this.",
    "That clock is speedy! Here is how it works.",
    "We will catch the timer next time. Here is the answer.",
    "The seconds ran out just before you finished. Here it is.",
    "That timer is a fast little thing. Let me show you.",
    "Next time we will beat that clock together.",
    "The clock zoomed by. Here is the secret.",
    "Almost! The timer just edged us out. Watch this.",
  ],
  // --- streaks --------------------------------------------------------------
  streak3: [
    "Three in a row! You are on fire.",
    "Three correct answers in a row, {name}!",
    "You are on a roll, three straight!",
    "Hat trick! Three in a row.",
    "Three wins in a row, keep going!",
    "You have a little streak going, {name}.",
    "Three for three! Amazing.",
    "That is three in a row, superstar.",
    "Your streak is heating up, three straight!",
    "Three in a row, Ollie is impressed.",
  ],
  streak5: [
    "Five in a row! Incredible streak.",
    "You are unstoppable, five straight!",
    "Five for five, {name}! Wow.",
    "That streak is officially amazing, five in a row.",
    "Five correct in a row, you are on fire.",
    "Ollie has never seen a streak like this, five straight!",
    "Five wins in a row, you are a puzzle champion.",
    "That is a five streak, superstar {name}.",
    "Five in a row and still going strong.",
    "Your streak just hit five, incredible work.",
  ],
  // --- milestones -------------------------------------------------------------
  newBest: [
    "That is your best ever on this one!",
    "New personal best, {name}!",
    "You just beat your own record.",
    "You have never gone this far before, amazing.",
    "That is the farthest you have ever gotten!",
    "You just topped your own high score.",
    "Brand new best for {name}!",
    "You just outdid yourself.",
    "That is your highest level yet.",
    "You broke your own record just now.",
    "Look at you, beating your best score.",
    "That is a shiny new best for you, {name}.",
  ],
  firstOfGenre: [
    "Your very first {title} puzzle, welcome!",
    "Welcome to {title}, {name}!",
    "This is your first try at {title}. Here we go!",
    "You are starting {title} for the very first time.",
    "First {title} puzzle ever, exciting!",
    "Welcome to a brand new kind of puzzle, {title}!",
    "You are about to try {title} for the first time.",
    "Here is your very first {title} adventure.",
  ],
  topOfRamp: [
    "You made it all the way to the top!",
    "You reached the very hardest level, {name}!",
    "Top of the mountain, you climbed it all.",
    "You just reached the highest level there is.",
    "That is the top of the ramp, incredible climbing.",
    "You made it to the very top level!",
    "Highest level reached, amazing work {name}.",
    "You climbed all the way to the top today.",
  ],
  comeback: [
    "Right back on track, {name}!",
    "You bounced right back.",
    "Look at you, right back in the game.",
    "That is how you turn things around.",
    "Back on your feet and going strong.",
    "You shook that off and got the next one.",
    "That is a great comeback, {name}.",
    "You picked yourself right back up.",
    "Straight back to your best, nice work.",
    "You found your groove again.",
  ],
  // --- session milestones -------------------------------------------------
  blockDone: [
    "You finished the whole set!",
    "Block complete, great work {name}!",
    "You made it through the whole round.",
    "That whole set is done, nice job.",
    "You finished every puzzle in that set.",
    "Round complete! Ollie is clapping.",
    "You made it all the way through that block.",
    "That set is officially finished, {name}.",
    "You crushed that whole round.",
    "Set complete, on to the next adventure.",
    "You finished the whole thing, awesome.",
    "That round is done, and you did great.",
  ],
  partDone: [
    "You finished the whole part, {name}!",
    "That is a whole part complete, amazing.",
    "You did it, the entire part is done!",
    "Part finished! Time to celebrate.",
    "You made it through the whole part today.",
    "That is a huge finish, {name}.",
    "Whole part complete, Ollie is throwing confetti.",
    "You just finished a big chunk of puzzles.",
    "Part done! You should be so proud.",
    "You made it all the way to the end of this part.",
  ],
  welcome: [
    "Hi {name}, ready for some puzzles?",
    "Welcome back, {name}! Ollie missed you.",
    "Let us have some fun today, {name}.",
    "Ready to play, {name}? Ollie is excited.",
    "Hello there, puzzle star!",
    "Welcome back to puzzle time!",
    "Ollie has been waiting for you, {name}.",
    "Let us jump into some fun puzzles.",
    "Great to see you, {name}!",
    "Time for some puzzle fun with Ollie.",
    "Welcome, {name}! Let us get started.",
    "Ollie is so happy you are here today.",
  ],
  // --- diagnostic (Level 1, fun: false): correctness free ------------------
  neutralNext: [
    "Here comes another one.",
    "Ready for the next?",
    "Let us try the next puzzle.",
    "On to the next one.",
    "Here is the next puzzle for you.",
    "Next puzzle coming up.",
    "Let us keep going.",
    "Here is another one for you.",
    "Onward to the next puzzle.",
    "Next up, another puzzle.",
    "Let us see what is next.",
    "Here comes the next one, {name}.",
  ],
  bail: [
    "No problem at all. That one can wait for another day.",
    "Good call, {name}. Let us find a puzzle you like more.",
    "That one is for another day. On to something new!",
    "Ollie did not love that one either. Next puzzle!",
    "Thanks for telling me! Let us play a different one.",
    "Some puzzles are like that. Off we go to the next!",
    "Okay! Saving that one for later. Here comes a new game.",
    "You are the boss of playtime. New puzzle coming up!",
  ],
};

/** The candidate pool for a given context: for "correct", blends in the
 * fast/hard flavor pool (hard takes priority over fast when both are set)
 * ahead of the general correct pool. */
function poolFor(ctx: PraiseContext): string[] {
  if (ctx.kind === "correct") {
    if (ctx.hard) return [...PRAISE_BANK.correctHard, ...PRAISE_BANK.correct];
    if (ctx.fast) return [...PRAISE_BANK.correctFast, ...PRAISE_BANK.correct];
    return PRAISE_BANK.correct;
  }
  return PRAISE_BANK[ctx.kind];
}

// Fallback used only if a template needs {title} but the caller didn't pass
// a kidTitle (should not normally happen for kinds that use {title}, but
// this keeps pickPraise from ever emitting a literal "{title}" or crashing).
const TITLE_FALLBACK = "this puzzle";

function fill(template: string, ctx: PraiseContext): string {
  return template.replace(/\{name\}/g, ctx.name).replace(/\{title\}/g, ctx.kidTitle ?? TITLE_FALLBACK);
}

/**
 * Picks one praise line for `ctx`, filling {name}/{title}. Never repeats a
 * line already in `used` until every usable line for this call's pool has
 * been used at least once, at which point `used` is cleared (mutated in
 * place) and the cycle restarts. Deterministic for a given seed: callers
 * pass an `Rng` (see lib/engine/rng.ts) and get the same result every time
 * for the same (ctx, rng state, used state).
 */
export function pickPraise(ctx: PraiseContext, rng: Rng, used: Set<string>): string {
  const pool = poolFor(ctx);
  let available = pool.filter((t) => !used.has(t));
  if (available.length === 0) {
    used.clear();
    available = pool;
  }
  const chosen = rng.pick(available);
  used.add(chosen);
  return fill(chosen, ctx);
}
