import type { Genre, Difficulty, GenerateOpts, ScoreResult } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng } from "../engine/rng";

/**
 * Spell It (dictated spelling, domain SPL): Ollie speaks a word and a
 * context sentence — the word is NEVER shown — and she types it on the
 * letter pad. Cousin of the WIAT-4 / WJ Spelling subtests (dictation with a
 * context sentence is exactly how those are administered; typing replaces
 * handwriting for the tablet — the research digest notes handwriting still
 * needs paper practice, which stays outside the app).
 *
 * Ramp follows the spelling-pattern sequence (research digest): CVC →
 * digraphs → blends → silent-e → vowel teams → r-controlled → inflectional
 * endings → two-syllable → common irregulars.
 */
export interface SpellItem { bankId: string; d: Difficulty; word: string; sentence: string }

interface SW { word: string; sentence: string }

const TIERS: Record<number, SW[]> = {
  1: [
    { word: "at", sentence: "We are at home." },
    { word: "in", sentence: "The cat is in the box." },
    { word: "up", sentence: "The balloon went up." },
    { word: "on", sentence: "The book is on the table." },
    { word: "it", sentence: "I like it." },
    { word: "am", sentence: "I am happy." },
  ],
  2: [
    { word: "cat", sentence: "The cat is soft." },
    { word: "dog", sentence: "The dog can run." },
    { word: "sun", sentence: "The sun is hot." },
    { word: "bed", sentence: "I sleep in my bed." },
    { word: "map", sentence: "The map shows the way." },
    { word: "pig", sentence: "The pig is pink." },
    { word: "cup", sentence: "The cup is full." },
    { word: "hat", sentence: "I wear a hat." },
  ],
  3: [
    { word: "ship", sentence: "The ship sails on the sea." },
    { word: "chat", sentence: "We had a nice chat." },
    { word: "thin", sentence: "The paper is thin." },
    { word: "shop", sentence: "We went to the shop." },
    { word: "chip", sentence: "I ate one chip." },
    { word: "wish", sentence: "Make a wish." },
    { word: "much", sentence: "Thank you very much." },
    { word: "bath", sentence: "The baby had a bath." },
  ],
  4: [
    { word: "stop", sentence: "The cars stop at the light." },
    { word: "flag", sentence: "The flag waves in the wind." },
    { word: "jump", sentence: "Frogs jump high." },
    { word: "hand", sentence: "Raise your hand." },
    { word: "swim", sentence: "Fish swim in the lake." },
    { word: "nest", sentence: "The bird built a nest." },
    { word: "drum", sentence: "He plays the drum." },
    { word: "milk", sentence: "I drink milk." },
  ],
  5: [
    { word: "cake", sentence: "We ate birthday cake." },
    { word: "ride", sentence: "I ride my bike." },
    { word: "home", sentence: "We walked home." },
    { word: "kite", sentence: "The kite flew high." },
    { word: "nose", sentence: "Touch your nose." },
    { word: "cute", sentence: "The puppy is cute." },
    { word: "gate", sentence: "Close the gate." },
    { word: "five", sentence: "I have five crayons." },
  ],
  6: [
    { word: "rain", sentence: "The rain fell all day." },
    { word: "boat", sentence: "The boat floats." },
    { word: "keep", sentence: "You can keep it." },
    { word: "play", sentence: "Let's play outside." },
    { word: "team", sentence: "Our team won." },
    { word: "road", sentence: "The road is long." },
    { word: "seat", sentence: "Take a seat." },
    { word: "wait", sentence: "Please wait for me." },
  ],
  7: [
    { word: "bird", sentence: "The bird sings." },
    { word: "farm", sentence: "Cows live on the farm." },
    { word: "corn", sentence: "We grew sweet corn." },
    { word: "girl", sentence: "The girl laughed." },
    { word: "hurt", sentence: "I hurt my knee." },
    { word: "storm", sentence: "The storm passed quickly." },
    { word: "shirt", sentence: "His shirt is blue." },
    { word: "start", sentence: "The race will start soon." },
  ],
  8: [
    { word: "jumping", sentence: "The kids are jumping." },
    { word: "boxes", sentence: "We packed three boxes." },
    { word: "played", sentence: "We played all afternoon." },
    { word: "running", sentence: "She is running fast." },
    { word: "wishes", sentence: "He made two wishes." },
    { word: "helped", sentence: "She helped her brother." },
    { word: "smiling", sentence: "The baby is smiling." },
    { word: "foxes", sentence: "Two foxes crossed the field." },
  ],
  9: [
    { word: "rabbit", sentence: "The rabbit hopped away." },
    { word: "pencil", sentence: "Sharpen your pencil." },
    { word: "sister", sentence: "My sister is kind." },
    { word: "window", sentence: "Open the window." },
    { word: "basket", sentence: "The basket is full of apples." },
    { word: "winter", sentence: "It snows in winter." },
    { word: "garden", sentence: "The garden is blooming." },
    { word: "monster", sentence: "The friendly monster waved." },
  ],
  10: [
    { word: "because", sentence: "We stayed in because it rained." },
    { word: "friend", sentence: "She is my best friend." },
    { word: "school", sentence: "We walk to school." },
    { word: "people", sentence: "Many people came." },
    { word: "little", sentence: "The little bird chirped." },
    { word: "before", sentence: "Wash your hands before dinner." },
    { word: "thought", sentence: "I thought about it." },
    { word: "beautiful", sentence: "What a beautiful day." },
  ],
};

function generate(seed: number, dIn: Difficulty, opts?: GenerateOpts): SpellItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed);
  const exclude = new Set(opts?.excludeBankIds ?? []);
  for (let widen = 0; widen <= 9; widen++) {
    for (const tier of [d - widen, d + widen]) {
      if (tier < 1 || tier > 10) continue;
      const c = TIERS[tier].filter((w) => !exclude.has(`sp-${w.word}`));
      if (c.length) {
        const w = rng.pick(c);
        return { bankId: `sp-${w.word}`, d: tier as Difficulty, word: w.word, sentence: w.sentence };
      }
    }
  }
  const w = rng.pick(TIERS[d]);
  return { bankId: `sp-${w.word}`, d: dIn, word: w.word, sentence: w.sentence };
}

function score(item: SpellItem, response: string | null): ScoreResult {
  const correct = response !== null && response.trim().toLowerCase() === item.word.toLowerCase();
  return { points: correct ? 1 : 0, max: 1, correct };
}

export function audit(item: SpellItem): string {
  return `<div style="font-family:sans-serif"><p>🔊 Spell: <b>${item.word}</b> — "${item.sentence}"</p></div>`;
}

export { TIERS as SPELL_TIERS };

export const spellIt: Genre<SpellItem, string> = {
  id: "spellIt",
  subtest: "Spelling (dictated)",
  domain: "SPL",
  kidTitle: "Spell It",
  instructions: "Ollie says a word and uses it in a sentence. Tap the letters to spell the word, then press Done.",
  sample: () => ({
    item: { bankId: "sp-at", d: 1, word: "at", sentence: "We are at home." },
    explanation: "Ollie said the word at. A, then t, spells at.",
  }),
  generate,
  score,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
