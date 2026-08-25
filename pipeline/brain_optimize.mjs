// brain_optimize.mjs — EL CEREBRO 2.0: bucle de aprendizaje GRATIS (medir -> reflexionar -> ajustar).
// Lee la "tabla de aprendizaje" (channel/brain/learning.json: los "genes" de cada video), trae las
// vistas REALES de YouTube (API gratis), calcula qué gen rinde (vistas/día por categoría, gancho, hora),
// y con un LLM GRATIS (Gemini->Cloudflare) redacta una ESTRATEGIA accionable. Escribe strategy.json
// (lo leen los productores) + brain2.txt (resumen a Telegram). Sin entrenar redes: aprende de datos reales.
//
// Uso: node pipeline/brain_optimize.mjs
// Env: YT_* (Data Lens) y/o YT2_* (Oddly), GEMINI/CLOUDFLARE (para llm.mjs).
// Lee en cwd: learning.json (de R2), history_map.json (de R2, opcional). Escribe: strategy.json, brain2.txt.
import fs from "node:fs";
import { genText } from "./llm.mjs";

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const now = Date.now();
const MATURE_DAYS = 3;            // un video necesita días para medir de verdad
const hourOf = (iso) => { try { return new Date(iso).getUTCHours(); } catch { return null; } };
const ageDays = (iso) => Math.max(0.5, (now - Date.parse(iso)) / 86400000);

// Canales y sus credenciales (cada uno con su token OAuth).
const CHANNELS = [
  { key: "oddly", label: "Oddly Loop", cid: process.env.YT2_CLIENT_ID, sec: process.env.YT2_CLIENT_SECRET, ref: process.env.YT2_REFRESH_TOKEN },
  { key: "datalens", label: "The Data Lens", cid: process.env.YT_CLIENT_ID, sec: process.env.YT_CLIENT_SECRET, ref: process.env.YT_REFRESH_TOKEN },
].filter((c) => c.cid && c.sec && c.ref);

async function token(c) {
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.cid, client_secret: c.sec, refresh_token: c.ref, grant_type: "refresh_token" }) });
    return (await r.json()).access_token;
  } catch { return null; }
}
async function stats(access, ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const j = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,status&id=${ids.slice(i, i + 50).join(",")}`, { headers: { Authorization: `Bearer ${access}` } })).json();
      for (const v of j.items || []) out[v.id] = { views: +((v.statistics || {}).viewCount) || 0, pub: (v.snippet || {}).publishedAt, title: (v.snippet || {}).title, priv: (v.status || {}).privacyStatus };
    } catch {}
  }
  return out;
}

// ---- Tabla de aprendizaje: genes por video. Si falta learning.json, siembra desde history_map.json (Data Lens).
let learning = rj("learning.json", []);
if (!Array.isArray(learning)) learning = [];
const seen = new Set(learning.map((r) => r.video_id));
for (const m of rj("history_map.json", [])) {
  if (m.video_id && !seen.has(m.video_id)) { learning.push({ video_id: m.video_id, channel: "datalens", subject: m.direction || m.topic || "", published_at: m.at || null, hook: "", source: "history_map" }); seen.add(m.video_id); }
}
console.log(`Tabla de aprendizaje: ${learning.length} videos`);

// ---- Traer vistas reales por canal y anexar rendimiento a cada gen.
const rows = [];
for (const c of CHANNELS) {
  const ids = [...new Set(learning.filter((r) => r.channel === c.key && r.video_id).map((r) => r.video_id))];
  if (!ids.length) continue;
  const access = await token(c); if (!access) { console.error("sin token", c.key); continue; }
  const st = await stats(access, ids);
  for (const r of learning.filter((r) => r.channel === c.key)) {
    const s = st[r.video_id]; if (!s || s.priv !== "public" || !s.pub) continue;
    const age = ageDays(s.pub);
    rows.push({ ...r, channel_label: c.label, views: s.views, age, vpd: +(s.views / age).toFixed(1), pub_hour: hourOf(s.pub), mature: age >= MATURE_DAYS });
  }
}
const mature = rows.filter((r) => r.mature);
console.log(`Con vistas: ${rows.length} · maduros (>=${MATURE_DAYS}d): ${mature.length}`);

// ---- Agregar por gen (por canal): categoría/subject, hora de publicación, largo del gancho.
function agg(list, keyFn) {
  const m = {};
  for (const r of list) { const k = keyFn(r); if (k == null || k === "") continue; (m[k] = m[k] || { n: 0, vpd: 0, views: 0 }); m[k].n++; m[k].vpd += r.vpd; m[k].views += r.views; }
  return Object.entries(m).map(([k, v]) => ({ k, n: v.n, avg_vpd: +(v.vpd / v.n).toFixed(1), views: v.views })).sort((a, b) => b.avg_vpd - a.avg_vpd);
}
const byChannel = {};
for (const c of CHANNELS) {
  const list = mature.filter((r) => r.channel === c.key);
  if (!list.length) continue;
  byChannel[c.key] = {
    label: c.label,
    n: list.length,
    subject: agg(list, (r) => r.subject).slice(0, 8),
    hour: agg(list, (r) => (r.pub_hour != null ? r.pub_hour + ":00 UTC" : null)).slice(0, 6),
    hook_len: agg(list, (r) => { const w = (r.hook || "").split(/\s+/).filter(Boolean).length; return w ? (w <= 8 ? "gancho corto (<=8p)" : w <= 14 ? "gancho medio" : "gancho largo") : null; }),
    top: list.slice().sort((a, b) => b.vpd - a.vpd).slice(0, 5).map((r) => ({ vpd: r.vpd, subject: r.subject, title: (r.title || "").slice(0, 50) })),
  };
}

// ---- Reflexión con LLM GRATIS -> estrategia accionable en JSON.
let strategy = { at: new Date().toISOString(), note: "sin datos maduros aún", per_channel: {} };
if (mature.length >= 3) {
  const PROMPT = `You are the growth optimizer for faceless YouTube channels. Below is REAL performance data (views/day = vpd) grouped by "genes" per channel. Decide what to DO MORE and what to EXPLORE next, per channel. Be concrete and data-driven; if a channel has few data points, say "keep gathering data" and suggest small explorations.

DATA:
${JSON.stringify(byChannel, null, 1)}

Return ONLY JSON:
{"per_channel":{"<channelKey>":{"focus":"the winning subject/category to make MORE of","best_hour":"best publish hour (UTC) if clear, else null","hook_advice":"1 line on hook length/style that wins","explore":"1 small new thing to test (exploration)","verdict":"one short sentence"}},"summary":"2-3 sentence overall takeaway in Spanish"}`;
  const raw = await genText(PROMPT, { json: true });
  if (raw) { try { strategy = { at: new Date().toISOString(), ...JSON.parse(raw) }; } catch (e) { console.error("estrategia JSON inválida:", e.message); } }
}

fs.writeFileSync("strategy.json", JSON.stringify(strategy, null, 2));

// ---- Resumen humano para Telegram.
const lines = ["🧠 CEREBRO 2.0 — aprendizaje semanal", ""];
for (const [k, d] of Object.entries(byChannel)) {
  const s = (strategy.per_channel || {})[k] || {};
  lines.push(`📺 ${d.label} (${d.n} maduros)`);
  if (d.subject[0]) lines.push(`   gana: ${d.subject[0].k} (${d.subject[0].avg_vpd}/d)`);
  if (s.focus) lines.push(`   → más de: ${s.focus}`);
  if (s.best_hour) lines.push(`   → mejor hora: ${s.best_hour}`);
  if (s.explore) lines.push(`   → probar: ${s.explore}`);
  lines.push("");
}
if (strategy.summary) lines.push("💡 " + strategy.summary);
if (mature.length < 3) lines.push("(Aún juntando datos maduros — el cerebro aprende cuando haya más videos públicos con vistas.)");
fs.writeFileSync("brain2.txt", lines.join("\n"));
console.log(lines.join("\n"));
