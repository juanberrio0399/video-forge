// hide_scheduled.mjs — OCULTA todo lo PROGRAMADO de un canal: cada video con publishAt futuro pasa a
// PRIVADO sin programación (reversible, NO borra) y se añade a hidden_videos.json en R2 para que los
// sanadores de backlog no lo re-agenden. Sirve para "vaciar la cola" y que el cerebro vuelva a
// publicar desde cero con lo que produzca a partir de ahora.
// Uso: node pipeline/hide_scheduled.mjs <hidden_r2_key> [--dry-run]
// Env: YT_CLIENT_ID/SECRET/REFRESH_TOKEN del canal (Oddly: el workflow mapea YT2_*), CLOUDFLARE_ACCOUNT_ID/API_TOKEN.
// Escribe hide_result.json (resumen) y hide_text.txt (aviso de Telegram).
import fs from "node:fs";

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
const BUCKET = process.env.BUCKET || "video-forge";
const hiddenKey = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const label = process.env.CHANNEL_LABEL || hiddenKey;
if (!hiddenKey) { console.error("falta hidden_r2_key"); process.exit(1); }
const tf = (u, o = {}, ms = 20000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
if (!tr.access_token) { console.error("token fail"); process.exit(1); }
const H = { Authorization: `Bearer ${tr.access_token}` };

// 1) Inventario: playlist de uploads + search.forMine (los privados subidos directo no siempre están en uploads).
const ids = new Set();
const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
const up = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
if (up) {
  let page = "";
  do {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json();
    (j.items || []).forEach((i) => ids.add(i.contentDetails.videoId));
    page = j.nextPageToken || "";
  } while (page && ids.size < 600);
}
try {
  let sp = "", pages = 0;
  do {
    const s = await (await tf(`https://www.googleapis.com/youtube/v3/search?part=id&forMine=true&type=video&order=date&maxResults=50&pageToken=${sp}`, { headers: H })).json();
    if (s.error) break;
    (s.items || []).forEach((it) => it.id?.videoId && ids.add(it.id.videoId));
    sp = s.nextPageToken || ""; pages++;
  } while (sp && pages < 4);
} catch {}

// 2) Programados = no públicos con publishAt futuro.
const now = Date.now(), all = [...ids], sched = [];
for (let i = 0; i < all.length; i += 50) {
  const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${all.slice(i, i + 50).join(",")}`, { headers: H })).json();
  for (const v of j.items || []) {
    const st = v.status || {};
    if (st.privacyStatus !== "public" && st.publishAt && Date.parse(st.publishAt) > now) sched.push({ id: v.id, publish_at: st.publishAt, title: (v.snippet?.title || "").slice(0, 70) });
  }
}
sched.sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at));
console.log(`${label}: inventario ${all.length} · programados ${sched.length}${dryRun ? " (SIMULACIÓN, no toco nada)" : ""}`);
sched.forEach((s) => console.log(`  📅 ${s.publish_at} ${s.id} — ${s.title}`));

// 3) Desprogramar (privado + publishAt null explícito: omitirlo NO borra la programación).
const done = [], failed = [];
if (!dryRun) {
  for (const s of sched) {
    try {
      const r = await tf("https://www.googleapis.com/youtube/v3/videos?part=status", { method: "PUT", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ id: s.id, status: { privacyStatus: "private", publishAt: null, selfDeclaredMadeForKids: false } }) });
      const j = await r.json();
      const ok = r.ok && j.status?.privacyStatus === "private" && !(j.status?.publishAt && Date.parse(j.status.publishAt) > now);
      (ok ? done : failed).push(s.id);
      if (!ok) console.error(`  ✖ ${s.id}: ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
    } catch (e) { failed.push(s.id); console.error(`  ✖ ${s.id}: ${e.message}`); }
  }
  // 4) Ocultar en R2 (durable: los sanadores y la app los ignoran).
  if (done.length && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(hiddenKey)}`;
    const CF = { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` };
    let hidden = [];
    try { const r = await tf(url, { headers: CF }); if (r.ok) { const j = await r.json(); if (Array.isArray(j)) hidden = j; } } catch {}
    const set = new Set(hidden); done.forEach((id) => set.add(id));
    const put = await tf(url, { method: "PUT", headers: { ...CF, "content-type": "application/json" }, body: JSON.stringify([...set]) });
    console.log(`hidden ${hiddenKey}: ${hidden.length} -> ${set.size} (${put.ok ? "ok" : "FALLO " + put.status})`);
    if (!put.ok) { console.error("no pude guardar hidden_videos.json: el sanador podría re-agendarlos"); process.exitCode = 1; }
  }
}

const res = { at: new Date().toISOString(), channel: label, dry_run: dryRun, scheduled_found: sched.length, hidden: done.length, failed: failed.length, videos: sched };
fs.writeFileSync("hide_result.json", JSON.stringify(res, null, 2));
const text = dryRun
  ? `🔎 ${label}: hay ${sched.length} videos programados (simulación, no toqué nada).`
  : `🙈 ${label}: oculté ${done.length} de ${sched.length} programados (privados, sin programar, no se re-agendan).${failed.length ? ` ⚠️ ${failed.length} fallaron.` : ""} El cerebro publica desde lo que produzca ahora.`;
fs.writeFileSync("hide_text.txt", text);
console.log(text);
if (failed.length) process.exitCode = 1;
