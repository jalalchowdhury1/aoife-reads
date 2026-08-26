import type { Insights, MatrixCell } from "@/lib/engine/insights";

export const STATUS_COLOR: Record<MatrixCell["status"], string> = {
  mastered: "bg-teal-400",
  passed: "bg-teal-200",
  seen: "border border-teal-300 bg-cream",
  struggled: "bg-rose-400",
  unreached: "border border-teal-50 bg-transparent",
};
export const STATUS_LABEL: Record<MatrixCell["status"], string> = {
  mastered: "Mastered",
  passed: "Passed",
  seen: "Seen",
  struggled: "Struggled",
  unreached: "Unreached",
};

/**
 * The smallest-detail single view: every skill x every difficulty she has
 * (or hasn't) reached, one small square per cell. Skill-name column stays
 * sticky-left so the grid can scroll horizontally on a phone.
 */
export function MatrixGrid({ rows, maxCols = 15 }: { rows: Insights["matrix"]; maxCols?: number }) {
  const cols = Array.from({ length: maxCols }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto rounded-2xl border border-teal-100 bg-white/40">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-cream px-3 py-2 text-left font-semibold text-ink">Skill</th>
            {cols.map((d) => (
              <th key={d} className="px-1 py-2 text-center font-normal text-ink/50">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.genre} className="border-t border-teal-50">
              <td
                className={`sticky left-0 z-10 whitespace-nowrap bg-cream px-3 py-1.5 text-left font-semibold ${
                  r.retired ? "text-ink/40" : "text-ink"
                }`}
              >
                {r.kidTitle}
                {r.retired && <span className="ml-1 font-normal">(retired)</span>}
              </td>
              {cols.map((d) => {
                const cell = d <= r.maxD ? r.cells[d - 1] : null;
                return (
                  <td key={d} className="px-1 py-1.5">
                    {cell ? (
                      <div
                        title={`d${d} · ${cell.attempts} attempt${cell.attempts === 1 ? "" : "s"} · ${cell.correct} correct — ${STATUS_LABEL[cell.status]}`}
                        className={`h-4 w-4 rounded-sm ${STATUS_COLOR[cell.status]}`}
                      />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MatrixLegend() {
  const order: MatrixCell["status"][] = ["mastered", "passed", "seen", "struggled", "unreached"];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-ink/70">
      {order.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={`inline-block h-3.5 w-3.5 rounded-sm ${STATUS_COLOR[s]}`} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

export default MatrixGrid;
