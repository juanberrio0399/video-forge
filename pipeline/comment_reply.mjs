// comment_reply.mjs — Responde comentarios NUEVOS del canal, natural y corto, con Gemini (cadena gratis).
// Sube la respuesta como reply del creador. Anti-duplicado en R2. Tope por corrida (no spamear).
// Uso: node pipeline/comment_reply.mjs <label>    (label = data-lens | oddly ; define el archivo de R2)
// Env: YT_CLIENT_ID/SECRET/REFRESH_TOKEN (el canal), GEMINI_API_KEY(2), CLOUDFLARE_ACCOUNT_ID/API_TOKEN, BUCKET
import { genText } from "./llm.mjs";

const label = (process.argv[2] || "data-lens").trim();
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
const BUCKET = process.env.BUCKET || "video-forge";
const MAX_REPLIES = 8;          // tope por corrida (evita que YouTube lo marque como spam)
const MAX_AGE_DAYS = 7;         // solo comentarios recientes
const tf = (u, o = {}, ms = 15000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

// ---- R2 (anti-duplicado) via API de Cloudflare ----
const R2_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${BUCKET}/objects`;
const R2_KEY = `channel/${label}/replied_comments.json`;
async function r2get() {
  try { const r = await tf(`${R2_BASE}/${encodeURIComponent(R2_KEY)}`, { headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } }); if (!r.ok) return []; const j = await r.json(); return Array.isArray(j) ? j : []; } catch { return []; }
}
async function r2put(arr) {
  try { await tf(`${R2_BASE}/${encodeURIComponent(R2_KEY)}`, { method: "PUT", headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(arr.slice(-2000)) }); } catch {}
}

async function ytToken() {
  const r = await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  const j = await r.json(); if (!j.access_token) { console.error("token:", JSON.stringify(j).slice(0, 200)); process.exit(0); } return j.access_token;
}

const token = await ytToken();
const H = { Authorization: `Bearer ${token}` };
// Canal propio (para saber cuál reply es nuestro).
const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", { headers: H })).json();
const myId = ch?.items?.[0]?.id;
if (!myId) { console.error("no pude leer el canal"); process.exit(0); }

// Comentarios recientes de TODO el canal.
const api = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${myId}&order=time&maxResults=60&textFormat=plainText`;
const res = await tf(api, { headers: H });
if (!res.ok) { console.error("commentThreads:", res.status, (await res.text()).slice(0, 200)); process.exit(0); }
const threads = (await res.json()).items || [];

const replied = new Set(await r2get());
const cutoff = Date.now() - MAX_AGE_DAYS * 86400 * 1000;
let done = 0;

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
function looksSpam(t) { return /https?:\/\/|www\.|t\.me\/|whatsapp|telegram|sub4sub|check my channel/i.test(t); }

async function reply(parentId, text) {
  const r = await tf("https://www.googleapis.com/youtube/v3/comments?part=snippet", { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ snippet: { parentId, textOriginal: text } }) });
  if (r.ok) return true;
  const b = await r.text();
  if (/insufficient|forbidden|403/i.test(b) || r.status === 403) { console.error("SCOPE: el token no puede comentar (falta youtube.force-ssl). Re-autorizar."); throw new Error("scope"); }
  console.error("reply falló:", r.status, b.slice(0, 160)); return false;
}

for (const th of threads) {
  if (done >= MAX_REPLIES) break;
  const top = th?.snippet?.topLevelComment; const sn = top?.snippet; if (!top || !sn) continue;
  const cid = top.id;
  if (replied.has(cid)) continue;
  if (!th.snippet.canReply) { replied.add(cid); continue; }
  if (Date.parse(sn.publishedAt) < cutoff) continue;
  if (sn.authorChannelId?.value === myId) { replied.add(cid); continue; }   // no responder mis propios comentarios
  // ¿Ya respondimos en el hilo?
  const hasMine = (th.replies?.comments || []).some((c) => c.snippet?.authorChannelId?.value === myId);
  if (hasMine) { replied.add(cid); continue; }
  const text = clean(sn.textOriginal);
  if (!text || text.length < 2) { replied.add(cid); continue; }
  if (looksSpam(text)) { replied.add(cid); continue; }   // no responder spam/links

  const prompt = `Eres el CREADOR de un canal de YouTube respondiendo un comentario. Responde MUY natural y humano, CORTO (una sola frase, máximo ~12 palabras), casual y genuino, en el MISMO idioma del comentario. Sin hashtags; máximo 1 emoji y solo si encaja de verdad. Si el comentario es negativo o troll, responde con ligereza y sin discutir, o simplemente agradece. Nunca prometas nada ni inventes datos. Devuelve SOLO el texto de la respuesta.

Comentario: "${text.slice(0, 400)}"`;
  let ans = "";
  try { ans = clean(await genText(prompt, { json: false })); } catch (e) { console.error("LLM:", e.message); continue; }
  ans = ans.replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 180);
  if (!ans || ans.length < 2) { continue; }

  try {
    if (await reply(cid, ans)) { replied.add(cid); done++; console.log(`✓ "${text.slice(0, 40)}" -> "${ans}"`); }
  } catch (e) { if (e.message === "scope") break; }
  await new Promise((r) => setTimeout(r, 1500)); // ritmo humano
}

await r2put([...replied]);
console.log(`RESPONDIDOS=${done} (canal ${label})`);
