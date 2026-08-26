// Server-only Upstash Redis REST client. Mirrors the planner project's env fallbacks
// (KV_REST_API_URL/TOKEN from the Vercel KV integration, or the raw Upstash names).
//
// HARD RULE: every key MUST go through PREFIX. This DB is shared with other
// projects (the homeschool planner) — never read or write "aoifes_schedule",
// "aoife_plan", or "aoife_plan_prev".

const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvReady = () => !!(url() && token());

async function cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
  const res = await fetch(url()!, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result as T;
}

export const PREFIX = "aoife_reads:";

export const kvGet = <T>(k: string) => cmd<string | null>("GET", PREFIX + k).then((v) => (v ? (JSON.parse(v) as T) : null));
export const kvSet = (k: string, v: unknown) => cmd("SET", PREFIX + k, JSON.stringify(v));
export const kvDel = (k: string) => cmd("DEL", PREFIX + k);
export const kvExists = (k: string) => cmd<number>("EXISTS", PREFIX + k).then((n) => n === 1);
export const kvLpush = (k: string, v: string) => cmd("LPUSH", PREFIX + k, v);
export const kvLrange = (k: string) => cmd<string[]>("LRANGE", PREFIX + k, 0, -1);
export const kvSetNx = (k: string, v: string) => cmd<number>("SETNX", PREFIX + k, v).then((n) => n === 1);
