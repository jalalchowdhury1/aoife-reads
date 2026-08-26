/** Shared formatting helpers for the parent dashboard: one decimal max, seconds not ms, "Aug 23" dates. */

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtNum(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace(/\.0$/, "");
}

export function fmtPct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export function fmtSeconds(s: number): string {
  return `${fmtNum(s, 1)}s`;
}

/** "1 flag" / "3 flags" — count + unit with a plain-s plural. */
export function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
