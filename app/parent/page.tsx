"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { GenreId, SessionRecord } from "@/lib/engine/types";
import { GENRES } from "@/lib/genres";
import { computeInsights, type Insights, type SkillDetail } from "@/lib/engine/insights";
import { lookupBankItem } from "@/lib/engine/bankLookup";
import { loadSessions } from "@/lib/engine/storage";
import { EGAI, CPI } from "@/lib/engine/profile";
import { dayStreak } from "@/lib/engine/rewards";
import { EXCLUDING_CODES, type QualityFlagCode } from "@/lib/engine/quality";
import { LEVELS } from "@/lib/levels";
import { Tabs, type TabDef } from "@/components/parent/Tabs";
import { DomainBars } from "@/components/parent/DomainBars";
import { EngagementChart } from "@/components/parent/EngagementChart";
import { SkillCard } from "@/components/parent/SkillCard";
import { MatrixGrid, MatrixLegend } from "@/components/parent/MatrixGrid";
import { ItemLog } from "@/components/parent/ItemLog";
import { LineChart } from "@/components/parent/LineChart";
import {fmtDate, fmtPct, fmtNum, plural } from "@/components/parent/format";
import { FLAG_CODE_LABEL } from "@/components/parent/stats";
import {
  BENCHMARKS, cumulativeBenchmark, benchmarkAt, ageYearsAt, measureStatus, ageVerdict,
  type MeasureStatus,
} from "@/lib/engine/benchmarks";

const KEY_STORAGE = "aoife-puzzles:parent-key";
const TABS: TabDef[] = [
  { id: "overview", label: "Overview", emoji: "🏠" },
  { id: "skills", label: "Skills", emoji: "🧩" },
  { id: "detail", label: "Skill detail", emoji: "🔎" },
  { id: "matrix", label: "Matrix", emoji: "⊞" },
  { id: "timeline", label: "Timeline", emoji: "🗓" },
  { id: "wisc", label: "WISC lens", emoji: "🧠" },
  { id: "ages", label: "Ages", emoji: "📏" },
];

const NY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
function todayNY(): string {
  return NY_FMT.format(new Date());
}

// Decision #20 (2026-08-26): the Ages tab may show approximate, research-anchored
// typical-age RANGES per skill — still never percentiles or IQ scores, and only here
// on the parent page. All other numbers stay relative to her own results.
const NO_NORMS = "These numbers are relative to Aoife's own results only — never percentiles or IQ scores. (The Ages tab adds approximate research-anchored age ranges; read its caveats.)";

export default function ParentPage() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<string>("overview");
  const [focusedGenre, setFocusedGenre] = useState<GenreId | null>(null);

  // First visit: read whatever key was already entered, if any. localStorage
  // isn't available during SSR, so this can only happen after mount.
  useEffect(() => {
    const stored = localStorage.getItem(KEY_STORAGE);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setKey(stored);
  }, []);

  // Fetches every session once the key is known, computing Insights
  // client-side. Falls back to the local storage mirror ("offline data")
  // when /api/sessions fails, is unreachable, or returns something that
  // isn't a session array.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    (async () => {
      try {
        const res = await fetch("/api/sessions", { headers: { "x-parent-key": key } });
        if (res.status === 401) {
          if (cancelled) return;
          localStorage.removeItem(KEY_STORAGE);
          setKey(null);
          setSessions([]);
          setError("That key did not work. Try again.");
          setLoading(false);
          return;
        }
        const json: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        if (Array.isArray(json)) {
          setSessions(json as SessionRecord[]);
          setOffline(false);
        } else {
          const local = loadSessions();
          setSessions(local);
          setOffline(true);
          if (local.length === 0) setError("No data available yet.");
        }
        setLoading(false);
      } catch {
        if (cancelled) return;
        const local = loadSessions();
        setSessions(local);
        setOffline(true);
        if (local.length === 0) setError("Could not reach the server, and there is no local data on this device.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  const insights = useMemo(() => computeInsights(sessions), [sessions]);
  const streak = useMemo(() => dayStreak(sessions, todayNY()), [sessions]);

  function submitKey(e: FormEvent) {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(KEY_STORAGE, trimmed);
    setKeyInput("");
    setKey(trimmed);
  }

  function copyJson() {
    void navigator.clipboard.writeText(JSON.stringify(insights, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function focusSkill(g: GenreId) {
    setFocusedGenre(g);
    setTab("detail");
  }

  if (!key) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-cream p-8 text-center">
        <h1 className="font-bubble text-3xl text-ink">Parent Page</h1>
        {error && <p className="text-rose-500">{error}</p>}
        <form onSubmit={submitKey} className="flex flex-col items-center gap-4">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Parent key"
            autoFocus
            className="min-h-[64px] w-64 rounded-2xl border-4 border-teal-100 px-4 text-lg text-ink"
          />
          <button
            type="submit"
            className="min-h-[64px] rounded-full bg-teal-400 px-10 text-xl font-bubble text-white disabled:opacity-40"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-cream">
        <p className="text-ink">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 bg-cream p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bubble text-2xl text-ink sm:text-3xl">Aoife&apos;s Skills</h1>
          <p className="text-xs text-ink/50">{NO_NORMS}</p>
        </div>
        <button
          type="button"
          onClick={copyJson}
          className="min-h-[44px] shrink-0 rounded-full bg-teal-100 px-4 text-sm font-semibold text-ink"
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>

      {offline && (
        <p className="rounded-xl bg-amber-400/20 p-3 text-sm font-semibold text-ink">
          Offline data — showing this device&apos;s local records; the server didn&apos;t answer.
        </p>
      )}
      {error && <p className="text-rose-500">{error}</p>}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {sessions.length === 0 ? (
        <p className="p-6 text-center text-ink/60">No sessions yet — play a part first.</p>
      ) : (
        <div className="flex flex-col gap-6 py-2">
          {tab === "overview" && <OverviewTab insights={insights} streak={streak} />}
          {tab === "skills" && <SkillsTab insights={insights} onSelect={focusSkill} />}
          {tab === "detail" && (
            <DetailTab insights={insights} focusedGenre={focusedGenre} onFocus={setFocusedGenre} />
          )}
          {tab === "matrix" && <MatrixTab insights={insights} />}
          {tab === "timeline" && <TimelineTab insights={insights} />}
          {tab === "wisc" && <WiscTab insights={insights} />}
          {tab === "ages" && <AgesTab insights={insights} />}
        </div>
      )}

      <details className="mt-4 rounded-2xl border border-teal-100 bg-white/40 p-3 text-sm text-ink/70">
        <summary className="cursor-pointer font-semibold text-ink">Replay a part</summary>
        <div className="mt-3 flex flex-wrap gap-3">
          {LEVELS.flatMap((level) =>
            level.parts.map((part) => (
              <a
                key={`${level.id}-${part.id}`}
                href={`/play?level=${level.id}&part=${part.id}&replay=1`}
                className="min-h-[44px] rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-ink"
              >
                {part.sticker} Level {level.id} · {part.title}
              </a>
            ))
          )}
        </div>
      </details>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[84px] flex-1 flex-col items-center gap-0.5 rounded-2xl bg-white/60 px-3 py-2 text-center">
      <span className="font-bubble text-xl text-teal-600">{value}</span>
      <span className="text-[11px] leading-tight text-ink/60">{label}</span>
    </div>
  );
}

function SkillMiniBar({ skill }: { skill: SkillDetail }) {
  const pct = skill.ceiling === null ? 0 : Math.round((skill.ceiling / skill.maxD) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className={skill.retired ? "text-ink/40" : "text-ink"}>
          {skill.kidTitle}
          {skill.retired && <span className="ml-1 text-xs">(retired)</span>}
        </span>
        <span className="tabular-nums text-ink/50">{skill.ceiling === null ? "—" : `${skill.ceiling} / ${skill.maxD}`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-teal-50">
        <div className={`h-full rounded-full ${skill.retired ? "bg-ink/20" : "bg-teal-400"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Overview
// ---------------------------------------------------------------------------

function OverviewTab({ insights, streak }: { insights: Insights; streak: number }) {
  const flags = insights.skills
    .flatMap((s) => s.flags.map((f) => ({ ...f, kidTitle: s.kidTitle })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-2xl bg-sky-300/30 p-4 text-base leading-relaxed text-ink">{NO_NORMS}</p>

      <div className="flex flex-wrap gap-2">
        <StatTile label="Sessions" value={String(insights.totals.sessions)} />
        <StatTile label="Minutes" value={String(Math.round(insights.totals.minutes))} />
        <StatTile label="Puzzles" value={String(insights.totals.items)} />
        <StatTile label="⭐ Stars" value={String(insights.totals.stars)} />
        <StatTile label="🔥 Day streak" value={String(streak)} />
      </div>

      <section>
        <h2 className="mb-2 font-bubble text-xl text-ink">Domains</h2>
        <DomainBars domains={insights.domains} />
      </section>

      <section className="flex flex-wrap gap-3 text-sm text-ink/80">
        <span className="rounded-full bg-teal-50 px-3 py-1.5">
          <span className="font-semibold">EGAI-style bundle:</span> {fmtPct(insights.bundles.egai)}
        </span>
        <span className="rounded-full bg-teal-50 px-3 py-1.5">
          <span className="font-semibold">CPI-style bundle:</span> {fmtPct(insights.bundles.cpi)}
        </span>
      </section>

      <section>
        <h2 className="mb-2 font-bubble text-xl text-ink">Recent movement</h2>
        {insights.deltas.filter((d) => d.from !== null).length === 0 ? (
          <p className="text-sm text-ink/50">Not enough repeated measurements yet to show movement.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm text-ink">
            {insights.deltas.filter((d) => d.from !== null).map((d, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2">
                <span>
                  <span className="font-semibold">{d.kidTitle}</span> {d.from ?? "—"} → {d.to ?? "—"}
                </span>
                <span className="text-xs text-ink/50">{fmtDate(d.when)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bubble text-xl text-ink">Engagement</h2>
        <EngagementChart byDate={insights.engagement.byDate} />
      </section>

      <section>
        <h2 className="mb-2 font-bubble text-xl text-ink">Flags</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-ink/50">No measurement-quality flags — nothing looked broken or misunderstood.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {flags.map((f, i) => {
              const excludes = (EXCLUDING_CODES as ReadonlySet<string>).has(f.code);
              return (
                <li key={i} className="rounded-xl bg-white/50 px-3 py-2">
                  <span className="text-xs text-ink/50">{fmtDate(f.date)}</span> ·{" "}
                  <span className="font-semibold">{f.kidTitle}</span> —{" "}
                  <span className={excludes ? "font-semibold text-rose-500" : "text-ink/70"}>
                    {FLAG_CODE_LABEL[f.code as QualityFlagCode] ?? f.code}
                  </span>
                  {" — "}
                  {f.detail}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Skills
// ---------------------------------------------------------------------------

function SkillsTab({ insights, onSelect }: { insights: Insights; onSelect: (g: GenreId) => void }) {
  const active = insights.skills.filter((s) => !s.retired);
  const retired = insights.skills.filter((s) => s.retired);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((s) => (
          <SkillCard key={s.genre} skill={s} onSelect={() => onSelect(s.genre)} />
        ))}
      </div>
      {retired.length > 0 && (
        <section>
          <h2 className="mb-2 font-bubble text-xl text-ink/60">Retired formats (history)</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {retired.map((s) => (
              <SkillCard key={s.genre} skill={s} onSelect={() => onSelect(s.genre)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Skill detail
// ---------------------------------------------------------------------------

function DetailTab({
  insights,
  focusedGenre,
  onFocus,
}: {
  insights: Insights;
  focusedGenre: GenreId | null;
  onFocus: (g: GenreId) => void;
}) {
  const genre = focusedGenre ?? insights.skills[0]?.genre ?? null;
  const skill = insights.skills.find((s) => s.genre === genre) ?? null;
  const active = insights.skills.filter((s) => !s.retired);
  const retired = insights.skills.filter((s) => s.retired);

  if (!skill) return <p className="text-ink/60">No skill data yet.</p>;

  const ceilingPoints = skill.ceilingDates.map((c) => ({ x: fmtDate(c.date), y: c.ceiling, excluded: c.excluded }));

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm text-ink/70">
        Skill
        <select
          value={skill.genre}
          onChange={(e) => onFocus(e.target.value as GenreId)}
          className="min-h-[48px] rounded-xl border-2 border-teal-100 bg-white px-3 text-base text-ink"
        >
          <optgroup label="Active">
            {active.map((s) => (
              <option key={s.genre} value={s.genre}>
                {s.kidTitle}
              </option>
            ))}
          </optgroup>
          <optgroup label="Retired formats (history)">
            {retired.map((s) => (
              <option key={s.genre} value={s.genre}>
                {s.kidTitle}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <h2 className="font-bubble text-2xl text-ink">{skill.kidTitle}</h2>

      {/* a. ceiling over time */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink/70">Ceiling over time</h3>
        {ceilingPoints.length === 0 ? (
          <p className="text-sm text-ink/50">No measurements yet.</p>
        ) : (
          <>
            <LineChart points={ceilingPoints} yMax={skill.maxD} valueLabel={(v) => String(v)} />
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/50">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-teal-400 bg-cream" /> hollow = excluded from her
              profile
            </p>
          </>
        )}
      </section>

      {/* b. per-difficulty table + heat bar */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink/70">Per difficulty</h3>
        <div className="overflow-x-auto rounded-2xl border border-teal-100">
          <table className="w-full min-w-[520px] text-left text-sm text-ink">
            <thead>
              <tr className="border-b border-teal-100 bg-teal-50/60">
                <th className="px-3 py-2 font-semibold">d</th>
                <th className="px-3 py-2 font-semibold">Attempts</th>
                <th className="px-3 py-2 font-semibold">Correct</th>
                <th className="px-3 py-2 font-semibold">Time-outs</th>
                <th className="px-3 py-2 font-semibold">Median s</th>
                <th className="px-3 py-2 font-semibold">Mastered</th>
              </tr>
            </thead>
            <tbody>
              {skill.perDifficulty.map((pd) => {
                const acc = pd.attempts > 0 ? pd.correct / pd.attempts : null;
                const bg =
                  acc === null
                    ? undefined
                    : acc === 0
                      ? "rgba(240,107,122,0.25)"
                      : `rgba(43,179,169,${Math.max(0.12, acc * 0.55)})`;
                return (
                  <tr key={pd.d} className="border-b border-teal-50" style={{ background: bg }}>
                    <td className="px-3 py-1.5 font-semibold tabular-nums">{pd.d}</td>
                    <td className="px-3 py-1.5 tabular-nums">{pd.attempts}</td>
                    <td className="px-3 py-1.5 tabular-nums">{pd.correct}</td>
                    <td className="px-3 py-1.5 tabular-nums">{pd.timeouts}</td>
                    <td className="px-3 py-1.5 tabular-nums">{pd.medianSeconds === null ? "—" : fmtNum(pd.medianSeconds)}</td>
                    <td className="px-3 py-1.5">{pd.mastered ? "✓" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* c. speed panel */}
      {skill.speed && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink/70">Speed</h3>
          <p className="mb-2 text-sm text-ink">
            Best: <span className="font-semibold">{fmtNum(skill.speed.bestPerMinute)}/min</span>
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div>
              <p className="mb-1 text-xs font-semibold text-ink/60">Per minute</p>
              <LineChart
                points={skill.speed.runs.map((r) => ({ x: fmtDate(r.date), y: r.perMinute }))}
                yMax={Math.max(1, ...skill.speed.runs.map((r) => r.perMinute)) * 1.15}
                color="var(--color-teal-400)"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-ink/60">Accuracy</p>
              <LineChart
                points={skill.speed.runs.map((r) => ({ x: fmtDate(r.date), y: r.accuracy * 100 }))}
                yMax={100}
                color="var(--color-amber-400)"
                unit="%"
                valueLabel={(v) => Math.round(v).toString()}
              />
            </div>
          </div>
        </section>
      )}

      {/* d. counters */}
      <section className="flex flex-wrap gap-2">
        <StatTile label="Fast rate" value={fmtPct(skill.fastRate)} />
        <StatTile label="Teaching misses" value={String(skill.teachingMisses)} />
        <StatTile label="Not-fun taps" value={String(skill.bails)} />
        <StatTile label="Excluded blocks" value={String(skill.excludedBlocks)} />
      </section>

      {/* e. missed questions */}
      {skill.missedBankItems.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink/70">Missed questions</h3>
          <div className="flex flex-col gap-3">
            {skill.missedBankItems.map((m, i) => {
              const bank = lookupBankItem(m.bankId);
              if (!bank) {
                return (
                  <div key={i} className="rounded-2xl bg-white/50 p-3 text-sm text-ink/60">
                    {fmtDate(m.date)} · d{m.d} — item {m.bankId} not found in the bank.
                  </div>
                );
              }
              const best = bank.options.reduce<{ text: string; points: number } | null>(
                (acc, o) => (acc === null || o.points > acc.points ? o : acc),
                null
              );
              return (
                <div key={i} className="flex flex-col gap-1 rounded-2xl bg-white/60 p-3 text-sm text-ink">
                  <div className="flex items-center justify-between text-xs text-ink/50">
                    <span>
                      {fmtDate(m.date)} · d{m.d}
                    </span>
                  </div>
                  <p className="font-semibold">
                    {bank.emoji ? `${bank.emoji} ` : ""}
                    {bank.prompt}
                  </p>
                  <p>
                    Her pick: <span className="font-semibold text-rose-500">{m.herPick ?? "—"}</span>
                  </p>
                  {best && (
                    <p>
                      Best answer: <span className="font-semibold text-teal-600">{best.text}</span>
                    </p>
                  )}
                  <p className="text-ink/70">{bank.explanation}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* f. full item log */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink/70">Item log</h3>
        <ItemLog items={skill.items} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Matrix
// ---------------------------------------------------------------------------

function MatrixTab({ insights }: { insights: Insights }) {
  return (
    <div className="flex flex-col gap-3">
      <MatrixLegend />
      <MatrixGrid rows={insights.matrix} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Timeline
// ---------------------------------------------------------------------------

function TimelineTab({ insights }: { insights: Insights }) {
  return (
    <div className="flex flex-col gap-3">
      {[...insights.timeline].reverse().map((s) => (
        <details key={s.sessionId} className="rounded-2xl border border-teal-100 bg-white/50 p-3">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm text-ink">
            <span className="font-semibold">
              {fmtDate(s.date)} · Level {s.level} · {s.part}
            </span>
            <span className="flex items-center gap-3 text-xs text-ink/60">
              <span>{s.complete ? "✓ Complete" : "⏳ In progress"}</span>
              <span>{fmtNum(s.minutes)} min</span>
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {s.blocks.map((b, i) => (
              <details key={i} className="rounded-xl bg-cream/60 p-2">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm text-ink">
                  <span>
                    {b.kidTitle}
                    {b.excluded && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-600">excluded</span>}
                  </span>
                  <span className="text-xs text-ink/60">
                    {b.summary.correct}/{b.summary.attempted}
                    {b.summary.ceiling !== null ? ` · ceiling ${b.summary.ceiling}` : ""}
                    {b.summary.timeouts > 0 ? ` · ${plural(b.summary.timeouts, "time-out")}` : ""}
                  </span>
                </summary>
                {b.flags.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-rose-500">
                    {b.flags.map((f, fi) => (
                      <li key={fi}>
                        ⚠ {FLAG_CODE_LABEL[f.code as QualityFlagCode] ?? f.code} — {f.detail}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.items.map((it, ii) => (
                    <span
                      key={ii}
                      title={`d${it.d} · ${it.seconds.toFixed(1)}s`}
                      className="rounded bg-white/70 px-1.5 py-0.5 text-xs tabular-nums text-ink/70"
                    >
                      d{it.d} {it.bailed ? "😕" : it.timedOut ? "⏱" : it.correct ? "✓" : "✗"}
                    </span>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. WISC lens
// ---------------------------------------------------------------------------

function WiscTab({ insights }: { insights: Insights }) {
  const skillByGenre = new Map(insights.skills.map((s) => [s.genre, s]));
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink/70">
        This groups her skills the way the real WISC-V groups subtests into index scores. Every number below is still only
        relative to Aoife&apos;s own results — never norms, percentiles, or IQ scores.
      </p>

      {insights.domains.map((d) => (
        <section key={d.domain}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bubble text-xl text-ink">{d.label}</h2>
            <span className="text-sm text-ink/50">{fmtPct(d.value)}</span>
          </div>
          <div className="flex flex-col gap-2">
            {d.genres.map((g) => {
              const skill = skillByGenre.get(g);
              return skill ? <SkillMiniBar key={g} skill={skill} /> : null;
            })}
          </div>
        </section>
      ))}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bubble text-xl text-ink">EGAI-style bundle</h2>
          <span className="text-sm text-ink/50">{fmtPct(insights.bundles.egai)}</span>
        </div>
        <div className="flex flex-col gap-2">
          {EGAI.map((g) => {
            const skill = skillByGenre.get(g);
            return skill ? <SkillMiniBar key={g} skill={skill} /> : null;
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bubble text-xl text-ink">CPI-style bundle</h2>
          <span className="text-sm text-ink/50">{fmtPct(insights.bundles.cpi)}</span>
        </div>
        <div className="flex flex-col gap-2">
          {CPI.map((g) => {
            const skill = skillByGenre.get(g);
            return skill ? <SkillMiniBar key={g} skill={skill} /> : null;
          })}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Ages (owner decision #20, 2026-08-26): approximate research-anchored
//    typical-age bands for the skill each recorded ceiling demands. Bands and
//    their anchors live in lib/engine/benchmarks.ts; the research digest is
//    docs/research/2026-08-26-reading-app-research.md. Never percentiles,
//    never IQ numbers, never visible to Aoife.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<MeasureStatus, string> = {
  "still-winning": "still winning when the items ran out — her real level is HIGHER than shown",
  "at-top": "reached the top of this game's ladder",
  bailed: "she chose to stop (Not fun) — a comfort line, not a measured wall",
  measured: "measured — real misses ended the last round",
};

const VERDICT_CHIP: Record<string, { label: string; cls: string }> = {
  ahead: { label: "ahead of age", cls: "bg-[#6fcf6f]/20 text-[#2e7d32]" },
  "age-typical": { label: "age-typical", cls: "bg-sky-300/25 text-sky-900" },
  "below-band": { label: "below this band", cls: "bg-amber-300/30 text-amber-900" },
  "no-anchor": { label: "no published norm", cls: "bg-ink/10 text-ink/60" },
};

function fmtBand(band: { lo: number; hi: number | null } | null): string {
  if (!band) return "—";
  return band.hi === null ? `${band.lo}+` : `${band.lo}–${band.hi}`;
}

function AgeRow({ insights, genre, age }: { insights: Insights; genre: GenreId; age: number }) {
  const gb = BENCHMARKS[genre];
  if (!gb) return null;
  const genreDef = GENRES[genre];
  const skill = insights.skills.find((s) => s.genre === genre);
  const speed = gb.bands.length === 0;

  if (speed) {
    return (
      <div className="flex flex-col gap-0.5 rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-ink">{genreDef.kidTitle}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${VERDICT_CHIP["no-anchor"].cls}`}>
            {VERDICT_CHIP["no-anchor"].label}
          </span>
        </div>
        <p className="text-xs text-ink/60">{gb.caveat} Her trend lives in the Skills tab.</p>
      </div>
    );
  }

  if (!skill || skill.ceiling === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <span className="font-semibold text-ink">{genreDef.kidTitle}{genreDef.retired ? " (older format)" : ""}</span>
        <span className="text-xs text-ink/50">not measured yet</span>
      </div>
    );
  }

  const status = measureStatus(insights, genre);
  const band = cumulativeBenchmark(genre, skill.ceiling);
  const at = benchmarkAt(genre, skill.ceiling);
  const verdict = ageVerdict(band?.typicalAge ?? null, age);
  // A censored or bailed ceiling is a FLOOR — "below band" would be a false
  // reading, so it softens to age-typical-so-far in those cases.
  const softened = verdict === "below-band" && status !== "measured" ? "age-typical" : verdict;
  const chip = VERDICT_CHIP[softened];
  const prefix = status === "still-winning" ? "≥ " : "";

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">
          {genreDef.kidTitle}
          {genreDef.retired ? <span className="text-xs text-ink/40"> (older format)</span> : null}
        </span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-sm text-ink/60">
            level {prefix}{skill.ceiling}{status === "at-top" ? " (top)" : ""} / {skill.maxD}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${chip.cls}`}>{chip.label}</span>
        </div>
      </div>
      <p className="text-sm text-ink/80">
        Strongest shown: <span className="font-medium">{band?.skill ?? at?.skill ?? "—"}</span>
        {" · "}typical ages <span className="font-medium tabular-nums">{fmtBand(band?.typicalAge ?? null)}</span>
      </p>
      {status && status !== "measured" && (
        <p className="text-xs text-ink/55">{STATUS_LABEL[status]}</p>
      )}
      {gb.caveat && <p className="text-xs text-ink/45">{gb.caveat}</p>}
    </div>
  );
}

function AgesTab({ insights }: { insights: Insights }) {
  const age = ageYearsAt(insights.generatedAt);
  const ageLabel = `${Math.floor(age)}y ${Math.round((age % 1) * 12)}m`;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-sky-300/30 p-4 text-sm leading-relaxed text-ink">
        <p className="font-semibold">Aoife is {ageLabel}. Each row shows the hardest skill she has demonstrated and the age range at which that skill is typical.</p>
        <p className="mt-1 text-ink/70">
          These are approximate bands from developmental research (digest:
          docs/research/2026-08-26-reading-app-research.md) — this game is not a standardized
          test, and a real WIAT-4/WJ achievement test is the real ruler. Rows marked &ldquo;≥&rdquo; ran out of
          items while she was still winning, so her true level there is unknown upward.
        </p>
      </div>

      {insights.domains.map((d) => {
        const rows = d.genres.filter((g) => BENCHMARKS[g]);
        if (!rows.length) return null;
        return (
          <section key={d.domain}>
            <h2 className="mb-2 font-bubble text-xl text-ink">{d.label}</h2>
            <div className="flex flex-col gap-2">
              {rows.map((g) => (
                <AgeRow key={g} insights={insights} genre={g} age={age} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-ink/50">
        Never percentiles, never IQ numbers, never shown to Aoife. A &ldquo;below this band&rdquo;
        chip appears only when real misses ended her last round; comfort stops and item caps are
        labeled instead of counted against her.
      </p>
    </div>
  );
}
