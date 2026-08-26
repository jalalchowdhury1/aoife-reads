import type { Genre, Difficulty, GenerateOpts } from "../engine/types";
import { clampToBase } from "../engine/types";
import { makeRng } from "../engine/rng";
import { scoreReading, type ReadingItem } from "./readingItem";

/**
 * Read & Answer (silent passage comprehension, domain CMP): she reads a
 * short passage — nothing is spoken — then answers a question about it.
 * Cousin of WIAT-4 Reading Comprehension's sentence/passage items (which
 * allow looking back at the passage; so does this view).
 *
 * Ramp per the text-complexity ladder: d1-2 one short sentence + literal
 * question; d3-4 two sentences, literal; d5-6 three-sentence paragraph with
 * a simple inference; d7-8 grade-3 paragraph, inference/main idea; d9-10
 * grade-4/5 paragraph, inference + vocabulary-in-context.
 */
interface RABankItem { id: string; d: Difficulty; passage: string; question: string; options: string[]; answer: number; explanation: string }

const BANK: RABankItem[] = [
  // d1 — one sentence, literal
  { id: "ra-01", d: 1, passage: "The cat sat on the mat.", question: "Who sat on the mat?", options: ["the cat", "the dog", "the sun"], answer: 0, explanation: "The passage says the CAT sat on the mat." },
  { id: "ra-02", d: 1, passage: "Sam has a red hat.", question: "What color is the hat?", options: ["red", "blue", "green"], answer: 0, explanation: "It says a RED hat." },
  { id: "ra-03", d: 1, passage: "The bug is on the leaf.", question: "Where is the bug?", options: ["on the leaf", "in the bed", "on the bus"], answer: 0, explanation: "The bug is on the LEAF." },
  // d2
  { id: "ra-04", d: 2, passage: "Ben ran to the park. He went down the slide.", question: "What did Ben do at the park?", options: ["went down the slide", "ate his lunch", "read a book"], answer: 0, explanation: "It says he went down the slide." },
  { id: "ra-05", d: 2, passage: "Mia has two pets. She has a fish and a bird.", question: "How many pets does Mia have?", options: ["two", "one", "three"], answer: 0, explanation: "It says two pets — a fish and a bird." },
  { id: "ra-06", d: 2, passage: "It snowed all night. In the morning the yard was white.", question: "Why was the yard white?", options: ["because it snowed", "because it rained", "because it was hot"], answer: 0, explanation: "Snow made the yard white." },
  // d3 — two-three sentences, literal detail
  { id: "ra-07", d: 3, passage: "Ana planted a seed. She watered it every day. A small green shoot came up.", question: "What did Ana do every day?", options: ["watered the seed", "picked flowers", "dug a hole"], answer: 0, explanation: "She watered it every day." },
  { id: "ra-08", d: 3, passage: "The bus was late. Tom waited at the stop and read his book until it came.", question: "What did Tom do while he waited?", options: ["read his book", "played ball", "took a nap"], answer: 0, explanation: "He read his book at the stop." },
  { id: "ra-09", d: 3, passage: "Grandma baked bread. The kitchen smelled warm and sweet. Everyone wanted a slice.", question: "What did Grandma bake?", options: ["bread", "cookies", "a cake"], answer: 0, explanation: "Grandma baked bread." },
  // d4 — first simple inferences
  { id: "ra-10", d: 4, passage: "Leo put on his floaties and jumped in with a splash. His sister was already swimming.", question: "Where is Leo?", options: ["at a pool", "at school", "in the forest"], answer: 0, explanation: "Floaties, splashing, swimming — he must be at a pool. The passage never says the word pool; you worked it out!" },
  { id: "ra-11", d: 4, passage: "Nora packed her bag, hugged her mom, and ran to catch the big yellow bus.", question: "Where is Nora probably going?", options: ["to school", "to the moon", "to bed"], answer: 0, explanation: "A packed bag and a yellow bus in the morning mean school." },
  { id: "ra-12", d: 4, passage: "The floor was covered in crumbs, and the dog licked his lips happily.", question: "What probably happened?", options: ["the dog ate some food", "the dog took a bath", "the dog went to sleep"], answer: 0, explanation: "Crumbs plus a happy dog licking his lips — he ate something." },
  // d5 — grade 2 paragraph, inference
  { id: "ra-13", d: 5, passage: "Owls sleep during the day and hunt at night. Their big eyes see well in the dark, and their soft feathers make almost no sound when they fly.", question: "Why do soft feathers help an owl?", options: ["so prey cannot hear it coming", "so it stays warm in winter", "so it can swim quietly"], answer: 0, explanation: "Quiet flying means the animals it hunts cannot hear it." },
  { id: "ra-14", d: 5, passage: "Maya's plant drooped in the sunny window. She moved it to a shady corner and gave it water. In a week it stood tall again.", question: "What made the plant better?", options: ["shade and water", "more sunshine", "a bigger pot"], answer: 0, explanation: "She moved it to shade and watered it — then it recovered." },
  { id: "ra-15", d: 5, passage: "The tide came in and washed away the sandcastle. Ben shrugged and said tomorrow he would build it farther from the waves.", question: "What did Ben learn?", options: ["to build away from the water", "to stop building castles", "to swim faster"], answer: 0, explanation: "He plans to build farther from the waves next time." },
  // d6
  { id: "ra-16", d: 6, passage: "Honeybees do a waggle dance to tell other bees where flowers grow. The direction of the dance points the way, and its length shows how far to fly.", question: "What is the waggle dance for?", options: ["telling bees where flowers are", "keeping the hive warm", "scaring away wasps"], answer: 0, explanation: "The dance points other bees to flowers." },
  { id: "ra-17", d: 6, passage: "The old bridge creaked with every step. Rosa held the rope tightly and did not look down until she reached the other side.", question: "How did Rosa probably feel on the bridge?", options: ["nervous", "bored", "sleepy"], answer: 0, explanation: "Holding tight and not looking down show she was nervous." },
  { id: "ra-18", d: 6, passage: "First the tadpole grows back legs. Then front legs appear, and its tail slowly shrinks. At last it hops onto land as a young frog.", question: "What happens right before the tadpole becomes a frog?", options: ["its tail shrinks", "it loses its legs", "it grows gills"], answer: 0, explanation: "The tail shrinks last, then it is a frog." },
  // d7 — grade 3, main idea / inference
  { id: "ra-19", d: 7, passage: "In 1903 the Wright brothers flew the first airplane for only twelve seconds. People laughed at how short it was, but that tiny flight changed travel forever.", question: "What is the main idea?", options: ["a short flight became a huge breakthrough", "airplanes are faster than cars", "people in 1903 liked to laugh"], answer: 0, explanation: "The point is that the tiny first flight changed the world." },
  { id: "ra-20", d: 7, passage: "The desert gets burning hot by day and surprisingly cold at night. Many desert animals hide underground until sunset and come out only when the sand cools.", question: "Why do desert animals come out at night?", options: ["because it is cooler", "because it rains at night", "because they fear the dark"], answer: 0, explanation: "They wait for the cool of night to avoid the heat." },
  { id: "ra-21", d: 7, passage: "Elena practiced her violin every morning before school. At the spring concert, her hardest piece sounded easy, and she smiled through every note.", question: "Why did the hard piece sound easy?", options: ["she had practiced every day", "the piece was changed", "the concert was canceled"], answer: 0, explanation: "Daily practice made the hard piece easy." },
  // d8
  { id: "ra-22", d: 8, passage: "A lighthouse keeper once carried oil up two hundred steps every night to keep the lamp burning. Today the light runs on electricity and turns itself on at dusk, but sailors still trust the same steady beam.", question: "What changed about the lighthouse?", options: ["how the lamp is powered", "where the lighthouse stands", "the color of its beam"], answer: 0, explanation: "Oil carried by hand was replaced by electricity — the light itself still guides sailors." },
  { id: "ra-23", d: 8, passage: "When the class hamster escaped, everyone searched the obvious spots. Only Priya thought about warmth — and found him curled behind the sunny window box.", question: "How did Priya find the hamster?", options: ["she thought about what he would want", "she looked in the obvious spots", "she waited for him to come back"], answer: 0, explanation: "She reasoned that a hamster would seek warmth — and looked there." },
  { id: "ra-24", d: 8, passage: "Glass is made by melting sand at very high heat. Long ago only kings could afford glass windows; now the same material lines skyscrapers from top to bottom.", question: "What does the passage suggest about glass today?", options: ["it is far more common than before", "it is still only for kings", "it can no longer be made from sand"], answer: 0, explanation: "From kings-only to entire skyscrapers — glass became common." },
  // d9 — grade 4, vocabulary-in-context + inference
  { id: "ra-25", d: 9, passage: "The explorers rationed their food, eating only small portions each day. When the storm trapped them for an extra week, that caution was what kept them alive.", question: "In this passage, 'rationed' means:", options: ["shared out in limited amounts", "threw away", "cooked slowly"], answer: 0, explanation: "Eating only small portions each day = limiting amounts." },
  { id: "ra-26", d: 9, passage: "Unlike its noisy cousin the crow, the raven often travels alone and can mimic sounds it hears — from dripping water to human voices. Scientists consider it one of the cleverest birds.", question: "What can a raven do that shows cleverness?", options: ["copy sounds it hears", "fly higher than planes", "build underwater nests"], answer: 0, explanation: "Mimicking sounds — even voices — is its clever trick." },
  { id: "ra-27", d: 9, passage: "The volunteers hauled buckets of sand to rebuild the dunes. It was slow, heavy work, but the dunes are the beach town's best defense against winter storms.", question: "Why do the volunteers rebuild the dunes?", options: ["dunes protect the town from storms", "dunes attract more tourists", "sand is valuable to sell"], answer: 0, explanation: "The dunes are called the town's best defense against storms." },
  // d10 — grade 5
  { id: "ra-28", d: 10, passage: "For decades the lake's water level dropped as farms diverted its rivers. When the diversions were finally reduced, recovery was gradual: the shoreline crept back a few feet a year, and fish returned only after the reeds did.", question: "Why did the fish return after the reeds?", options: ["the reeds gave fish shelter and food first", "the fish preferred deeper water", "the farms brought the fish back"], answer: 0, explanation: "Recovery happened in order — reeds first, then the fish that depend on them." },
  { id: "ra-29", d: 10, passage: "The inventor's first designs failed publicly, and newspapers mocked her. She kept her notebooks anyway, and years later those same 'failures' held the key to her greatest success.", question: "What lesson does the passage suggest?", options: ["failed attempts can lead to later success", "newspapers are always right", "notebooks should be thrown away"], answer: 0, explanation: "Her mocked failures became the key to success." },
  { id: "ra-30", d: 10, passage: "Coral reefs cover less than one percent of the ocean floor yet shelter about a quarter of all marine species. When reefs bleach and die, the losses ripple far beyond the reef itself.", question: "Why do losses 'ripple far beyond the reef'?", options: ["so many species depend on reefs", "reefs are larger than they appear", "bleached coral spreads to other rocks"], answer: 0, explanation: "A quarter of marine species shelter there — losing reefs affects them all." },
];

function toItem(b: RABankItem, seed: number): ReadingItem {
  const rng = makeRng(seed);
  const entries = rng.shuffle(b.options.map((text, i) => ({ text, correct: i === b.answer })));
  return {
    bankId: b.id, d: b.d, passage: b.passage, question: b.question, speak: null,
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

export { BANK as READ_ANSWER_BANK };

export function audit(item: ReadingItem): string {
  return (
    `<div style="font-family:sans-serif"><p style="font-size:16px">${item.passage}</p><p><b>${item.question}</b></p>` +
    item.options.map((o, i) => `<span style="border:3px solid ${i === item.answer ? "#6fcf6f" : "#ccc"};border-radius:8px;padding:4px 10px;margin:3px;display:inline-block">${o.text}</span>`).join("") +
    `</div>`
  );
}

export const readAndAnswer: Genre<ReadingItem, number> = {
  id: "readAndAnswer",
  subtest: "Passage Comprehension",
  domain: "CMP",
  kidTitle: "Read & Answer",
  instructions: "Read the little story quietly in your head. Then read the question and tap the best answer. You can look back at the story any time.",
  sample: () => ({
    item: toItem(BANK[0], 1),
    explanation: "The story says the cat sat on the mat. So the answer is the cat.",
  }),
  generate,
  score: scoreReading,
  timing: { kind: "none" },
  mode: "staircase",
  bankId: (item) => item.bankId,
};
