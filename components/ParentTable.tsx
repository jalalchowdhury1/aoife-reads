import type { DomainStat, GenreStats, Profile } from "@/lib/engine/profile";
import type { Domain, GenreId, SessionRecord } from "@/lib/engine/types";
import type { Strength } from "@/lib/engine/adapt";
import { EXCLUDING_CODES } from "@/lib/engine/quality";
import type { QualityFlagCode } from "@/lib/engine/quality";
import { GENRES } from "@/lib/genres";

const DOMAIN_LABELS: Record<Domain, string> = {
  DEC: "Decoding",
  CMP: "Reading Comprehension",
  SPL: "Spelling",
  MTH: "Math",
};
const DOMAIN_ORDER: Domain[] = ["DEC", "CMP", "SPL", "MTH"];

const FLAG_LABEL: Record<DomainStat["flag"], string> = {
  strength: "Relative strength",
  weakness: "Relative weakness",
  typical: "Typical for her",
  "n/a": "Not enough data",
};
const FLAG_COLOR: Record<DomainStat["flag"], string> = {
  strength: "text-teal-600",
  weakness: "text-rose-500",
  typical: "text-ink/70",
  "n/a": "text-ink/40",
};

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

const STRENGTH_LABEL: Record<Strength, string> = { weak: "Weak", typical: "Typical", strong: "Strong" };
const STRENGTH_HINT: Record<Strength, string> = {
  weak: "Level 2 starts this genre lower and gives it more practice, plus a repeat block.",
  typical: "Level 2 starts this genre at its usual spot.",
  strong: "Level 2 starts this genre near her ceiling with fewer reps.",
};
const STRENGTH_COLOR: Record<Strength, string> = {
  weak: "bg-rose-100 text-rose-600",
  typical: "bg-teal-50 text-ink/70",
  strong: "bg-teal-100 text-teal-700",
};

// Measurement-quality flags (AGENTS.md decision #14). format-not-understood
// and mass-timeouts also exclude the block from ceilings/values above; the
// other two codes are shown for awareness only.
const FLAG_CODE_LABEL: Record<QualityFlagCode, string> = {
  "format-not-understood": "Format not understood",
  "mass-timeouts": "Mostly timed out",
  "rapid-wrong": "Rapid wrong answers",
  "speed-accuracy": "Low accuracy (speed block)",
  "rule-not-understood": "Rule not understood (answered in spoken order)",
  "not-fun": "She tapped Not fun (her call, not ability)",
  abandoned: "Abandoned",
};
const EXCLUDING_FLAG_CODES = EXCLUDING_CODES;

/**
 * The domain summary, EGAI/CPI bundle line, and per-genre stats table shown
 * on the parent page. Spec §4.5: no norms, percentiles, or IQ-like numbers —
 * everything here is relative to Aoife's own results. `strengths` (from
 * classifyGenres) shows what a remedial level like Level 2 will actually do
 * with each genre — see AGENTS.md decision #13 / §7.
 */
export function ParentTable({
  profile,
  strengths,
  sessions,
}: {
  profile: Profile;
  strengths: Record<GenreId, Strength>;
  sessions: SessionRecord[];
}) {
  const genreIds = Object.keys(profile.genres) as GenreId[];
  const sessionDate = new Map(sessions.map((s) => [s.id, s.startedAt]));
  const excludingGenres = new Set(profile.flags.filter((f) => EXCLUDING_FLAG_CODES.has(f.code)).map((f) => f.genre));
  const sortedFlags = [...profile.flags].sort((a, b) =>
    (sessionDate.get(b.sessionId) ?? "").localeCompare(sessionDate.get(a.sessionId) ?? "")
  );

  return (
    <div className="flex flex-col gap-8">
      <p className="rounded-2xl bg-sky-300/30 p-4 text-base leading-relaxed text-ink">
        These are relative strengths and weaknesses within Aoife&apos;s own results. They are not norms,
        percentiles, or IQ scores.
      </p>

      {profile.flags.length > 0 && (
        <section>
          <h2 className="mb-2 font-bubble text-2xl text-ink">Flags</h2>
          <p className="mb-2 text-sm text-ink/60">
            Blocks that may not measure what they look like — a format she hadn&apos;t learned yet, a broken
            run, or fast guessing. &quot;Format not understood&quot; and &quot;Mostly timed out&quot; blocks are
            already excluded from her ceilings and values above; the rest are shown for awareness only.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm text-ink">
              <thead>
                <tr className="border-b border-teal-100">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Part</th>
                  <th className="py-2 pr-4 font-semibold">Puzzle</th>
                  <th className="py-2 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {sortedFlags.map((f, i) => {
                  const date = sessionDate.get(f.sessionId);
                  const excludes = EXCLUDING_FLAG_CODES.has(f.code);
                  return (
                    <tr key={`${f.sessionId}-${i}`} className="border-b border-teal-50">
                      <td className="py-2 pr-4">{date ? new Date(date).toLocaleDateString() : "—"}</td>
                      <td className="py-2 pr-4">{f.part}</td>
                      <td className="py-2 pr-4">{GENRES[f.genre]?.kidTitle ?? f.genre}</td>
                      <td className="py-2">
                        <span className={excludes ? "font-semibold text-rose-500" : "text-ink/70"}>
                          {FLAG_CODE_LABEL[f.code]}
                        </span>
                        {" — "}
                        {f.detail}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bubble text-2xl text-ink">Domains</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm text-ink">
            <thead>
              <tr className="border-b border-teal-100">
                <th className="py-2 pr-4 font-semibold">Domain</th>
                <th className="py-2 pr-4 font-semibold">Value</th>
                <th className="py-2 font-semibold">Flag</th>
              </tr>
            </thead>
            <tbody>
              {DOMAIN_ORDER.map((d) => {
                const stat = profile.domains[d];
                return (
                  <tr key={d} className="border-b border-teal-50">
                    <td className="py-2 pr-4">{DOMAIN_LABELS[d]}</td>
                    <td className="py-2 pr-4 tabular-nums">{pct(stat.value)}</td>
                    <td className={`py-2 font-semibold ${FLAG_COLOR[stat.flag]}`}>{FLAG_LABEL[stat.flag]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="text-sm text-ink/80">
        <span className="font-semibold">EGAI-relevant bundle (SI VC IN CO BD MR FW AR):</span>{" "}
        {pct(profile.bundles.egai)}
        <span className="mx-3 text-ink/30">·</span>
        <span className="font-semibold">CPI bundle (DS PS CD SS):</span> {pct(profile.bundles.cpi)}
      </section>

      <section>
        <h2 className="mb-2 font-bubble text-2xl text-ink">Per-genre</h2>
        <p className="mb-2 text-sm text-ink/60">
          &quot;Level 2 plan&quot; is what a remedial level does with this genre: weak starts lower with more
          reps (plus a repeat block), strong starts near her ceiling with fewer reps.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm text-ink">
            <thead>
              <tr className="border-b border-teal-100">
                <th className="py-2 pr-4 font-semibold">Genre</th>
                <th className="py-2 pr-4 font-semibold">Attempted</th>
                <th className="py-2 pr-4 font-semibold">Correct</th>
                <th className="py-2 pr-4 font-semibold">Points / max</th>
                <th className="py-2 pr-4 font-semibold">Ceiling</th>
                <th className="py-2 pr-4 font-semibold">Median s</th>
                <th className="py-2 pr-4 font-semibold">Time-outs</th>
                <th className="py-2 pr-4 font-semibold">Per minute</th>
                <th className="py-2 font-semibold">Level 2 plan</th>
              </tr>
            </thead>
            <tbody>
              {genreIds.length === 0 && (
                <tr>
                  <td className="py-3 text-ink/60" colSpan={9}>
                    No genres played yet.
                  </td>
                </tr>
              )}
              {genreIds.map((g) => {
                const gs: GenreStats = profile.genres[g]!;
                const genre = GENRES[g];
                const strength = strengths[g];
                return (
                  <tr key={g} className="border-b border-teal-50">
                    <td className="py-2 pr-4">
                      {genre?.kidTitle ?? g}
                      {excludingGenres.has(g) && (
                        <span
                          title="Some results for this puzzle were excluded from her profile — see Flags above."
                          className="ml-2 whitespace-nowrap text-xs font-semibold text-rose-500"
                        >
                          ⚠️ some results excluded
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{gs.attempted}</td>
                    <td className="py-2 pr-4 tabular-nums">{gs.correct}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {gs.points} / {gs.max}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{gs.ceiling ?? "—"}</td>
                    <td className="py-2 pr-4 tabular-nums">{(gs.medianMs / 1000).toFixed(1)}</td>
                    <td className="py-2 pr-4 tabular-nums">{gs.timeouts}</td>
                    <td className="py-2 pr-4 tabular-nums">{gs.perMinute !== undefined ? gs.perMinute.toFixed(1) : "—"}</td>
                    <td className="py-2">
                      <span
                        title={STRENGTH_HINT[strength]}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${STRENGTH_COLOR[strength]}`}
                      >
                        {STRENGTH_LABEL[strength]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default ParentTable;
