// scripts/kv-del.mjs <sessionId> — removes one aoife_puzzles session (and its index/notified entries).
// Reads KV_REST_API_URL / KV_REST_API_TOKEN from the environment (e.g. after `vercel env pull .env.local`
// then `set -a; . ./.env.local; set +a`). Never touches any key outside the aoife_puzzles: prefix.
const [id] = process.argv.slice(2);
if (!id) { console.error("usage: node scripts/kv-del.mjs <sessionId>"); process.exit(1); }
const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
if (!url || !token) { console.error("KV env missing"); process.exit(1); }
const P = "aoife_puzzles:";
const cmd = async (...args) => (await (await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(args) })).json());
console.log(await cmd("DEL", `${P}session:${id}`), await cmd("LREM", `${P}index`, 0, id), await cmd("DEL", `${P}notified:${id}`));
