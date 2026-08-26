// Server-only: loads every SessionRecord from Upstash KV. Shared by every
// route that needs the full session list (api/sessions, api/profile,
// api/state) so there is exactly one place that knows how the index list
// and per-session keys fit together.
import { kvGet, kvLrange } from "./kv";
import type { SessionRecord } from "./types";

export async function loadAllSessions(): Promise<SessionRecord[]> {
  const ids = (await kvLrange("index")).filter((id): id is string => !!id);
  const sessions = (await Promise.all(ids.map((id) => kvGet<SessionRecord>(`session:${id}`)))).filter(
    (s): s is SessionRecord => !!s
  );
  return sessions;
}
