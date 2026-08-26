"use client";

import { fmtDate } from "./format";

interface DayRow {
  date: string;
  minutes: number;
  items: number;
  stars: number;
  bails: number;
}

/**
 * Engagement over time: one bar per calendar day she played (bar height =
 * minutes), with puzzles/stars in the tooltip line and a rose dot under any
 * day that had a "Not fun" tap. Pure inline SVG, no deps.
 */
export function EngagementChart({ byDate }: { byDate: DayRow[] }) {
  if (byDate.length === 0) {
    return <p className="text-sm text-ink/50">No play days recorded yet.</p>;
  }
  const days = byDate.slice(-30).map((d) => ({ ...d, minutes: Math.round(d.minutes) })); // most recent 30 play days
  const maxMin = Math.max(1, ...days.map((d) => d.minutes));
  const barW = 18;
  const gap = 6;
  const chartH = 96;
  const labelH = 30;
  const width = days.length * (barW + gap) + gap;
  const height = chartH + labelH;

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Minutes played per day"
        className="block"
      >
        {days.map((d, i) => {
          const h = Math.max(3, Math.round((d.minutes / maxMin) * (chartH - 8)));
          const x = gap + i * (barW + gap);
          const y = chartH - h;
          return (
            <g key={d.date}>
              <title>{`${fmtDate(d.date)} · ${d.minutes} min · ${d.items} puzzles · ${d.stars} ⭐${d.bails > 0 ? ` · ${d.bails} not-fun` : ""}`}</title>
              <rect x={x} y={y} width={barW} height={h} rx={4} fill="#2a9d8f" opacity={0.85} />
              <text
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fill="#264653"
                opacity={0.7}
              >
                {d.minutes}
              </text>
              {d.bails > 0 ? (
                <circle cx={x + barW / 2} cy={chartH + 6} r={3} fill="#f06b7a" />
              ) : null}
              <text
                x={x + barW / 2}
                y={chartH + labelH - 8}
                textAnchor="middle"
                fontSize={8.5}
                fill="#264653"
                opacity={0.55}
                transform={`rotate(-38 ${x + barW / 2} ${chartH + labelH - 8})`}
              >
                {fmtDate(d.date)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-ink/50">
        Bar = minutes played that day (number on top). <span className="text-rose-500">●</span> = a day
        with a “Not fun” tap.
      </p>
    </div>
  );
}
