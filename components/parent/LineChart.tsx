export interface LineChartPoint {
  x: string;
  y: number | null;
  excluded?: boolean;
}

/**
 * A full(ish)-width inline-SVG line chart with a y-axis, gridlines and x
 * labels — used for the ceiling-over-time chart and the speed panel. No
 * chart library; scrolls inside its own container on a phone.
 */
export function LineChart({
  points,
  yMax,
  yMin = 0,
  height = 160,
  color = "var(--color-teal-400)",
  yTicks = 4,
  valueLabel = (v: number) => v.toFixed(1),
  unit = "",
}: {
  points: LineChartPoint[];
  yMax: number;
  yMin?: number;
  height?: number;
  color?: string;
  yTicks?: number;
  valueLabel?: (v: number) => string;
  unit?: string;
}) {
  const width = Math.max(280, points.length * 40);
  const padL = 30;
  const padB = 20;
  const padT = 8;
  const padR = 10;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const span = yMax - yMin || 1;
  const scaleY = (y: number) => padT + innerH - ((y - yMin) / span) * innerH;

  const coords = points.map((p, i) => ({
    ...p,
    cx: padL + i * stepX,
    cy: p.y === null ? null : scaleY(p.y),
  }));
  const line = coords
    .filter((c): c is typeof c & { cy: number } => c.cy !== null)
    .map((c) => `${c.cx},${c.cy}`)
    .join(" ");
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i * span) / yTicks);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={scaleY(t)} y2={scaleY(t)} stroke="var(--color-teal-100)" strokeWidth={1} />
            <text x={0} y={scaleY(t) + 3} fontSize={9} fill="var(--color-ink)" opacity={0.55}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} />
        {coords.map((c, i) =>
          c.cy === null ? null : (
            <circle
              key={i}
              cx={c.cx}
              cy={c.cy}
              r={c.excluded ? 4 : 3}
              fill={c.excluded ? "var(--color-cream)" : color}
              stroke={color}
              strokeWidth={c.excluded ? 1.5 : 0}
            >
              <title>
                {c.x}: {c.y === null ? "—" : `${valueLabel(c.y)}${unit}`}
                {c.excluded ? " (excluded)" : ""}
              </title>
            </circle>
          )
        )}
        {coords.map((c, i) =>
          i % labelEvery === 0 ? (
            <text key={`x${i}`} x={c.cx} y={height - 4} fontSize={9} textAnchor="middle" fill="var(--color-ink)" opacity={0.6}>
              {c.x}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export default LineChart;
