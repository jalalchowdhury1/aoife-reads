import type { SkillDetail } from "@/lib/engine/insights";
import { Sparkline } from "./Sparkline";
import { plural } from "./format";

/** One card per skill on the Skills tab. Tapping it focuses the Skill detail tab. */
export function SkillCard({ skill, onSelect }: { skill: SkillDetail; onSelect: () => void }) {
  const sparkPoints = skill.ceilingDates.map((c) => ({ y: c.ceiling, excluded: c.excluded }));
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[64px] flex-col gap-2 rounded-2xl border border-teal-100 bg-white/70 p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bubble text-lg leading-tight text-ink">{skill.kidTitle}</h3>
        {skill.retired && <span className="shrink-0 text-xs font-semibold text-ink/40">retired</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-bubble text-3xl text-teal-600">{skill.ceiling ?? "—"}</span>
        <span className="text-xs text-ink/50">of {skill.maxD}</span>
      </div>
      <Sparkline points={sparkPoints} maxY={skill.maxD} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/60">
        <span>{skill.fastRate === null ? "fast —" : `fast ${Math.round(skill.fastRate * 100)}%`}</span>
        <span>{skill.bails} not-fun</span>
        <span className={skill.flags.length > 0 ? "font-semibold text-rose-500" : ""}>{plural(skill.flags.length, "flag")}</span>
      </div>
    </button>
  );
}

export default SkillCard;
