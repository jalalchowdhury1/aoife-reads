"use client";

import { useState } from "react";
import type { ItemDetail } from "@/lib/engine/insights";
import { fmtDate } from "./format";

const SHOW_COUNT = 100;

function glyph(it: ItemDetail): string {
  if (it.bailed) return "😕";
  if (it.timedOut) return "⏱";
  if (it.teaching) return "T";
  return it.correct ? "✓" : "✗";
}
function glyphTitle(it: ItemDetail): string {
  if (it.bailed) return "Not fun";
  if (it.timedOut) return "Timed out";
  if (it.teaching) return "Teaching item";
  return it.correct ? "Correct" : "Wrong";
}

/** Full item-log table: latest 100 rows by default, with a "show all" toggle. Excluded-block rows are dimmed. */
export function ItemLog({ items }: { items: ItemDetail[] }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const shown = showAll ? sorted : sorted.slice(0, SHOW_COUNT);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-2xl border border-teal-100">
        <table className="w-full min-w-[420px] text-left text-sm text-ink">
          <thead>
            <tr className="border-b border-teal-100 bg-teal-50/60">
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Level · Part</th>
              <th className="px-3 py-2 font-semibold">d</th>
              <th className="px-3 py-2 font-semibold">Result</th>
              <th className="px-3 py-2 font-semibold">Seconds</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-ink/50" colSpan={5}>
                  No items yet.
                </td>
              </tr>
            )}
            {shown.map((it, i) => (
              <tr
                key={i}
                title={it.excludedBlock ? "Excluded from her profile — see Flags." : undefined}
                className={`border-b border-teal-50 ${it.excludedBlock ? "opacity-40" : ""}`}
              >
                <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtDate(it.date)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {it.level} · {it.part}
                </td>
                <td className="px-3 py-1.5 tabular-nums">{it.d}</td>
                <td className="px-3 py-1.5" title={glyphTitle(it)}>
                  {glyph(it)}
                </td>
                <td className="px-3 py-1.5 tabular-nums">{it.seconds.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > SHOW_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="min-h-[40px] self-start rounded-full bg-teal-100 px-4 text-xs font-semibold text-ink"
        >
          {showAll ? "Show latest 100" : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}

export default ItemLog;
