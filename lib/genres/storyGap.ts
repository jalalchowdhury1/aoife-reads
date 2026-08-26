import type { Genre, Difficulty, GenerateOpts } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng } from "../engine/rng";
import { scoreReading, type ReadingItem } from "./readingItem";

/**
 * Story Gap (silent cloze, domain CMP): she reads a sentence with a missing
 * word — nothing is spoken — and taps the word that belongs in the gap.
 * Cousin of WJ Passage Comprehension, which is exactly a cloze task. Per the
 * research digest, cloze belongs once a child reads short connected text, so
 * d1 already assumes basic decoding; the earlier rungs of decoding live in
 * Sound Hunt / Echo Words.
 *
 * Ramp: sentence length, vocabulary grade, and inference demand rise
 * together — d1-2 ≈ late-K three-to-five-word sentences with picture-common
 * words; d5-6 ≈ grade 2 (two clauses, world knowledge); d9-10 ≈ grade 4-5
 * (inferential, academic vocabulary).
 */
interface GapBankItem { id: string; d: Difficulty; sentence: string; options: string[]; answer: number; explanation: string }

// The gap is "___". Exactly one option fits; distractors are grammatical
// near-misses that fail on MEANING, so guessing from syntax alone fails.
const BANK: GapBankItem[] = [
  // d1 — 3-5 words, K vocabulary
  { id: "sg-01", d: 1, sentence: "The dog can ___.", options: ["run", "cup", "red"], answer: 0, explanation: "A dog can run. 'Cup' and 'red' are not things a dog does." },
  { id: "sg-02", d: 1, sentence: "I see the ___.", options: ["sun", "hot", "up"], answer: 0, explanation: "You can see the sun. 'Hot' and 'up' are not things." },
  { id: "sg-03", d: 1, sentence: "The cat is ___.", options: ["big", "run", "cup"], answer: 0, explanation: "A cat can be big. 'Run' and 'cup' do not fit after 'is'." },
  { id: "sg-04", d: 1, sentence: "We go on the ___.", options: ["bus", "wet", "sit"], answer: 0, explanation: "You go on a bus." },
  // d2
  { id: "sg-05", d: 2, sentence: "The frog can hop and ___.", options: ["swim", "milk", "green"], answer: 0, explanation: "A frog can hop and swim — both are actions." },
  { id: "sg-06", d: 2, sentence: "At night I sleep in my ___.", options: ["bed", "hat", "cup"], answer: 0, explanation: "You sleep in a bed at night." },
  { id: "sg-07", d: 2, sentence: "The fish swims in the ___.", options: ["water", "chair", "shoe"], answer: 0, explanation: "Fish swim in water." },
  { id: "sg-08", d: 2, sentence: "I put on my hat and my ___.", options: ["coat", "door", "rain"], answer: 0, explanation: "You put on a coat — you cannot put on a door or the rain." },
  // d3 — grade 1: two ideas, common connectives
  { id: "sg-09", d: 3, sentence: "It was raining, so we played ___.", options: ["inside", "outside", "yesterday"], answer: 0, explanation: "Rain means you play inside." },
  { id: "sg-10", d: 3, sentence: "The baby was tired, so she went to ___.", options: ["sleep", "school", "jump"], answer: 0, explanation: "Tired means it is time to sleep." },
  { id: "sg-11", d: 3, sentence: "I was thirsty, so I drank some ___.", options: ["water", "bread", "paper"], answer: 0, explanation: "You drink water when you are thirsty." },
  { id: "sg-12", d: 3, sentence: "The ice was cold, and it made my hands ___.", options: ["cold", "loud", "tall"], answer: 0, explanation: "Ice makes your hands cold." },
  // d4
  { id: "sg-13", d: 4, sentence: "Birds build nests so their eggs stay ___.", options: ["safe", "loud", "empty"], answer: 0, explanation: "A nest keeps eggs safe." },
  { id: "sg-14", d: 4, sentence: "We use an umbrella when it ___.", options: ["rains", "sleeps", "sings"], answer: 0, explanation: "An umbrella is for rain." },
  { id: "sg-15", d: 4, sentence: "The opposite of full is ___.", options: ["empty", "heavy", "round"], answer: 0, explanation: "Empty is the opposite of full." },
  { id: "sg-16", d: 4, sentence: "A baby dog is called a ___.", options: ["puppy", "kitten", "calf"], answer: 0, explanation: "A baby dog is a puppy; a kitten is a baby cat." },
  // d5 — grade 2: world knowledge, longer sentences
  { id: "sg-17", d: 5, sentence: "The farmer planted seeds in spring and picked the corn in ___.", options: ["fall", "morning", "minutes"], answer: 0, explanation: "Crops planted in spring are picked in fall." },
  { id: "sg-18", d: 5, sentence: "Maya whispered in the library so she would not ___ anyone.", options: ["disturb", "answer", "follow"], answer: 0, explanation: "Whispering keeps you from disturbing people." },
  { id: "sg-19", d: 5, sentence: "The bridge was too weak to hold the heavy ___.", options: ["truck", "feather", "shadow"], answer: 0, explanation: "A weak bridge cannot hold something heavy like a truck." },
  { id: "sg-20", d: 5, sentence: "Bears eat a lot in autumn because they will ___ all winter.", options: ["sleep", "swim", "plant"], answer: 0, explanation: "Bears sleep through winter, so they eat a lot first." },
  // d6
  { id: "sg-21", d: 6, sentence: "The detective looked for clues to ___ the mystery.", options: ["solve", "forget", "paint"], answer: 0, explanation: "Detectives use clues to solve mysteries." },
  { id: "sg-22", d: 6, sentence: "Wear a helmet to ___ your head when you ride a bike.", options: ["protect", "measure", "decorate"], answer: 0, explanation: "A helmet protects your head." },
  { id: "sg-23", d: 6, sentence: "The seed cannot grow without sunlight and ___.", options: ["water", "music", "shoes"], answer: 0, explanation: "Seeds need sunlight and water to grow." },
  { id: "sg-24", d: 6, sentence: "The two teams were tied, so they played one more round to ___ the winner.", options: ["decide", "erase", "invite"], answer: 0, explanation: "An extra round decides the winner." },
  // d7 — grade 3: inference required
  { id: "sg-25", d: 7, sentence: "Leo grabbed his boots and raincoat before opening the door, because the sky looked ___.", options: ["stormy", "sunny", "invisible"], answer: 0, explanation: "Boots and a raincoat mean he expects a storm." },
  { id: "sg-26", d: 7, sentence: "The bread was so ___ that we could not cut it with a knife.", options: ["stale", "fresh", "delicious"], answer: 0, explanation: "Stale bread gets too hard to cut." },
  { id: "sg-27", d: 7, sentence: "Ants seem tiny and weak, but they can carry loads many times their own ___.", options: ["weight", "color", "name"], answer: 0, explanation: "Ants carry many times their own weight." },
  { id: "sg-28", d: 7, sentence: "The library book was ___, so Sam had to pay a small fine.", options: ["overdue", "brand-new", "heavy"], answer: 0, explanation: "You pay a fine when a book is overdue." },
  // d8
  { id: "sg-29", d: 8, sentence: "The mountain trail grew steeper, and the hikers had to stop often to catch their ___.", options: ["breath", "tickets", "shadows"], answer: 0, explanation: "Climbing something steep makes you stop to catch your breath." },
  { id: "sg-30", d: 8, sentence: "Because the recipe ___ two eggs, Maya checked the fridge before starting.", options: ["required", "avoided", "painted"], answer: 0, explanation: "A recipe requires ingredients — that is why she checked." },
  { id: "sg-31", d: 8, sentence: "The lighthouse beam ___ every few seconds, warning ships away from the rocks.", options: ["flashed", "melted", "whispered"], answer: 0, explanation: "A lighthouse beam flashes to warn ships." },
  { id: "sg-32", d: 8, sentence: "The audience grew ___ as the magician reached the trick's final step.", options: ["silent", "purple", "backwards"], answer: 0, explanation: "An audience goes silent at the tense moment." },
  // d9 — grade 4: academic vocabulary, inference across the sentence
  { id: "sg-33", d: 9, sentence: "The scientist repeated the experiment three times so the results would be more ___.", options: ["reliable", "colorful", "expensive"], answer: 0, explanation: "Repeating an experiment makes results reliable." },
  { id: "sg-34", d: 9, sentence: "Camels are well ___ to desert life, storing fat in their humps for long journeys.", options: ["adapted", "opposed", "attached"], answer: 0, explanation: "Camels are adapted to the desert." },
  { id: "sg-35", d: 9, sentence: "The ancient map was so ___ that the explorers could barely read its faded markings.", options: ["worn", "modern", "enormous"], answer: 0, explanation: "Faded markings mean the map is worn with age." },
  { id: "sg-36", d: 9, sentence: "Recycling helps ___ natural resources so future generations can use them.", options: ["conserve", "consume", "conceal"], answer: 0, explanation: "Recycling conserves resources — the other words nearly look right but mean the opposite or hiding." },
  // d10 — grade 5: subtle distinctions
  { id: "sg-37", d: 10, sentence: "The lawyer's evidence was intended to ___ the claim, not merely repeat it.", options: ["support", "shorten", "misplace"], answer: 0, explanation: "Evidence supports a claim." },
  { id: "sg-38", d: 10, sentence: "Although the twins look identical, their personalities are entirely ___.", options: ["different", "similar", "invisible"], answer: 0, explanation: "'Although' signals a contrast: same looks, different personalities." },
  { id: "sg-39", d: 10, sentence: "The drought forced the town to ___ water, limiting each family to a few buckets a day.", options: ["ration", "waste", "flavor"], answer: 0, explanation: "In a drought, water is rationed." },
  { id: "sg-40", d: 10, sentence: "Her argument was so ___ that even the doubters changed their minds.", options: ["convincing", "confusing", "quiet"], answer: 0, explanation: "An argument that changes minds is convincing." },
];

function toItem(b: GapBankItem, seed: number): ReadingItem {
  const rng = makeRng(seed);
  const entries = rng.shuffle(b.options.map((text, i) => ({ text, correct: i === b.answer })));
  return {
    bankId: b.id, d: b.d, passage: b.sentence, speak: null,
    options: entries, answer: entries.findIndex((e) => e.correct), explanation: b.explanation,
  };
}

function generate(seed: number, dIn: Difficulty, opts?: GenerateOpts): ReadingItem {
  const d = clampToBase(dIn);
  const rng = makeRng(seed);
  const exclude = new Set(opts?.excludeBankIds ?? []);
  for (let widen = 0; widen <= 9; widen++) {
    const c = BANK.filter((b) => Math.abs(b.d - d) === widen && !exclude.has(b.id));
    if (c.length) return toItem(rng.pick(c), seed);
  }
  return toItem(rng.pick(BANK), seed);
}

export { BANK as STORY_GAP_BANK };

export function audit(item: ReadingItem): string {
  return (
    `<div style="font-family:sans-serif"><p style="font-size:20px">${item.passage}</p>` +
    item.options.map((o, i) => `<span style="border:3px solid ${i === item.answer ? "#6fcf6f" : "#ccc"};border-radius:8px;padding:4px 10px;margin:3px;display:inline-block">${o.text}</span>`).join("") +
    `</div>`
  );
}

export const storyGap: Genre<ReadingItem, number> = {
  id: "storyGap",
  subtest: "Cloze Reading",
  domain: "CMP",
  kidTitle: "Story Gap",
  instructions: "Read the sentence quietly in your head. One word is missing. Tap the word that belongs in the gap.",
  sample: () => ({
    item: toItem(BANK[0], 1),
    explanation: "The dog can run. Run is the word that fits the gap.",
  }),
  generate,
  score: scoreReading,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
