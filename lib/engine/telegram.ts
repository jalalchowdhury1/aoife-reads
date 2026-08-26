import { GENRES } from "@/lib/genres";
import type { LevelConfig, SessionRecord } from "./types";

const API = (token: string) => `https://api.telegram.org/bot${token}/sendMessage`;

/** Sends one HTML-formatted Telegram message. Never throws; returns false on any failure. */
export async function sendTelegram(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(API(token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function minutesBetween(startedAt: string, endedAt?: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt ?? new Date().toISOString()).getTime();
  return Math.max(0, Math.round((end - start) / 60_000));
}

/** Builds the spec §4.6 part-completion summary. */
export function formatPartSummary(s: SessionRecord, level: LevelConfig): string {
  const minutes = minutesBetween(s.startedAt, s.endedAt);
  const sticker = level.parts.find((p) => p.id === s.part)?.sticker ?? "🧩";
  const header = `${sticker} Word Woods — Level ${s.level} Part ${s.part} done (${minutes} min)`;

  const titles = s.blocks.map((b) => GENRES[b.genre]?.kidTitle ?? b.genre);
  const maxLen = titles.reduce((m, t) => Math.max(m, t.length), 0);

  const lines = s.blocks.map((b, i) => {
    const { summary } = b;
    const parts = [`${summary.correct}/${summary.attempted}`];
    if (summary.ceiling !== null) parts.push(`ceiling ${summary.ceiling}`);
    if (summary.timeouts > 0) parts.push(`${summary.timeouts} time-out${summary.timeouts > 1 ? "s" : ""}`);
    return `${titles[i].padEnd(maxLen)}  ${parts.join(" · ")}`;
  });

  // Measurement-quality flags (AGENTS.md decision #14): one line per
  // flagged block so a broken/misunderstood puzzle is visible to the owner
  // instead of quietly reading as a weakness on the parent page.
  const flagLines = s.blocks.flatMap((b, i) => {
    const blockFlags = b.flags ?? [];
    if (blockFlags.length === 0) return [];
    const detail = blockFlags.map((f) => f.detail).join(" ");
    return [`⚠️ check: ${titles[i]} — ${detail}`];
  });

  const messageLines = [header, ...lines, ...flagLines];
  if (flagLines.length > 0) messageLines.push("Flagged blocks are not counted in her profile.");
  messageLines.push("Parent page: https://aoife-reads.vercel.app/parent");

  return messageLines.join("\n");
}
