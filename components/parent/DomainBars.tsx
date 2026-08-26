import type { Insights } from "@/lib/engine/insights";

const FLAG_COLOR: Record<string, string> = {
  strength: "bg-teal-400",
  weakness: "bg-rose-400",
  typical: "bg-ink/30",
  "n/a": "bg-ink/10",
};
const FLAG_LABEL: Record<string, string> = {
  strength: "Relative strength",
  weakness: "Relative weakness",
  typical: "Typical for her",
  "n/a": "Not enough data",
};

/** One horizontal bar per WISC-style domain, 0-100%, with a colored flag chip. */
export function DomainBars({ domains }: { domains: Insights["domains"] }) {
  return (
    <div className="flex flex-col gap-4">
      {domains.map((d) => (
        <div key={d.domain} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-ink">{d.label}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${FLAG_COLOR[d.flag] ?? "bg-ink/20"}`}>
              {FLAG_LABEL[d.flag] ?? d.flag}
            </span>
          </div>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-teal-50">
            <div
              className="h-full rounded-full bg-teal-400 transition-all"
              style={{ width: `${d.value === null ? 0 : Math.round(d.value * 100)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-ink/50">{d.value === null ? "No data yet" : `${Math.round(d.value * 100)}%`}</span>
        </div>
      ))}
    </div>
  );
}

export default DomainBars;
