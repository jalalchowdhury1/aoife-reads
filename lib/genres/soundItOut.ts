import type { Genre, Difficulty } from "../engine/types";
import { scoreExaminer, type ExaminerItem } from "./examinerItem";
import { pseudoTarget } from "./echoWords";

/**
 * Sound It Out (ACTUAL Pseudoword Decoding format, domain DEC): a made-up
 * word appears big; she sounds it out ALOUD; the grown-up taps got-it /
 * not-yet — the administration shape of WIAT-4 Pseudoword Decoding and WJ
 * Word Attack (read nonsense words aloud, examiner scores). The grown-up
 * strip shows a rhyme hint ("rhymes with slide") so the parent knows the
 * intended pronunciation without a pronunciation guide.
 */
const RHYME_HINT: Record<string, string> = {
  ip: "zip", op: "top", ab: "grab", ud: "mud", eg: "leg", im: "swim", ot: "hot", un: "sun",
  ad: "dad", ib: "crib", iv: "give", ash: "splash", ick: "stick", osh: "squash", amp: "lamp",
  est: "nest", ond: "pond", ilt: "quilt", usk: "dusk", ake: "cake", ide: "slide", oke: "joke",
  ute: "flute", ane: "plane", ain: "train", eet: "feet", oad: "road", eep: "sleep", ail: "snail",
  arn: "barn", irt: "shirt", erd: "herd",
};

function generate(seed: number, d: Difficulty): ExaminerItem {
  const { word, rime } = pseudoTarget(seed, d);
  const hint = rime && RHYME_HINT[rime] ? `rhymes with "${RHYME_HINT[rime]}"` : "any honest sounding-out counts";
  return {
    bankId: undefined, d, stimulus: word, expected: `${word} (${hint})`,
    parentPrompt: "It is a made-up word — she sounds it out loud. Count it if the sounds are right.",
  };
}

export function audit(item: ExaminerItem): string {
  return `<div style="font-family:sans-serif"><div style="font-size:34px;font-weight:bold">${item.stimulus}</div><p style="color:#889;font-size:12px">grown-up: ${item.expected}</p></div>`;
}

export const soundItOut: Genre<ExaminerItem, boolean> = {
  id: "soundItOut",
  subtest: "Pseudoword Decoding (read aloud, parent-scored)",
  domain: "DEC",
  kidTitle: "Sound It Out",
  instructions: "Grown-up: these are silly made-up words on purpose. Aoife sounds each one out loud; tap the check if her sounds are right. The hint under each word shows what it should rhyme with.",
  sample: () => ({
    item: { d: 1, stimulus: "mip", expected: 'mip (rhymes with "zip")', parentPrompt: "She sounds it out loud." },
    explanation: "These words are pretend words! Nobody has ever read them before — you sound them out like a word scientist.",
  }),
  generate,
  score: scoreExaminer,
  timing: { kind: "none" },
  mode: "staircase",
};
