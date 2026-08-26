import type { QualityFlagCode } from "@/lib/engine/quality";

/** Human-readable labels for measurement-quality flag codes (mirrors the old ParentTable). */
export const FLAG_CODE_LABEL: Record<QualityFlagCode, string> = {
  "format-not-understood": "Format not understood",
  "mass-timeouts": "Mostly timed out",
  "rapid-wrong": "Rapid wrong answers",
  "speed-accuracy": "Low accuracy (speed block)",
  "rule-not-understood": "Rule not understood (answered in spoken order)",
  "not-fun": "She tapped Not fun (her call, not ability)",
  abandoned: "Abandoned",
};
