// comment_cleanup.mjs — Borra MIS respuestas recientes (última(s) hora(s)) que quedaron en ESPAÑOL
// por el primer test (canal en inglés). Las quita del anti-duplicado para que se re-respondan en inglés.
// Uso: node pipeline/comment_cleanup.mjs <label> [horas]
import fs from "node:fs";

const label = (process.argv[2] || "oddly").trim();
const HOURS = +(process.argv[3] || 4);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
const BUCKET = process.env.BUCKET || "video-forge";
const tf = (u, o = {}, ms = 15000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const R2_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${BUCKET}/objects`;
const R2_KEY = `channel/${label}/replied_comments.json`;

// Marcadores de español (no aparecen en inglés): abre-signos, palabras típicas.
const isSpanish = (t) => /¡|¿|jajaja|gracias|alegra|viste|totalmente|combo de|encanta|qué |está |también/i.test(t || "");

async function ytToken() {
  const r = await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  const j = await r.json(); if (!j.access_token) { console.error("token:", JSON.stringify(j).slice(0, 200)); process.exit(0); } return j.access_token;
}
const token = await ytToken();
const H = { Authorization: `Bearer ${token}` };
const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", { headers: H })).json();
const myId = ch?.items?.[0]?.id; if (!myId) { console.error("no channel"); process.exit(0); }

const res = await tf(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${myId}&order=time&maxResults=80&textFormat=plainText`, { headers: H });
const threads = (await res.json()).items || [];
const cutoff = Date.now() - HOURS * 3600 * 1000;

// anti-duplicado actual
let replied = [];
try { const r = await tf(`${R2_BASE}/${encodeURIComponent(R2_KEY)}`, { headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } }); if (r.ok) replied = await r.json(); } catch {}
const repliedSet = new Set(Array.isArray(replied) ? replied : []);

let del = 0;
for (const th of threads) {
  const parentId = th?.snippet?.topLevelComment?.id;
  for (const c of (th.replies?.comments || [])) {
    const sn = c.snippet || {};
    if (sn.authorChannelId?.value !== myId) continue;         // solo MIS respuestas
    if (Date.parse(sn.publishedAt) < cutoff) continue;         // solo recientes (del test)
    if (!isSpanish(sn.textOriginal)) continue;                 // solo las que quedaron en español
    const d = await tf(`https://www.googleapis.com/youtube/v3/comments?id=${c.id}`, { method: "DELETE", headers: H });
    if (d.ok || d.status === 204) { del++; repliedSet.delete(parentId); console.log(`🗑️ borrada: "${(sn.textOriginal || "").slice(0, 50)}"`); }
    else console.error("no pude borrar", c.id, d.status);
    await new Promise((r) => setTimeout(r, 800));
  }
}
// guardar anti-duplicado sin los padres desmarcados (se re-responden en inglés)
try { await tf(`${R2_BASE}/${encodeURIComponent(R2_KEY)}`, { method: "PUT", headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify([...repliedSet].slice(-2000)) }); } catch {}
console.log(`BORRADAS=${del} (canal ${label})`);
