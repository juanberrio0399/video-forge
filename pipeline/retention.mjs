// retention.mjs — RetentionNeuron (Fase 4). Baja la curva de audienceRetention de los N videos
// recientes MADUROS y PÚBLICOS del canal (YouTube Analytics API) y la analiza -> retention.json.
// El workflow lo sube a channel/retention.json (YT1) o channel/auto2/retention.json (YT2).
// Uso: node pipeline/retention.mjs <yt1|yt2> <inventarioR2.json> <salida.json>
import fs from "node:fs";
import { analyzeRetention } from "./lib/retention_calc.mjs";

const CH = process.argv[2];               // yt1 | yt2
const invFile = process.argv[3];
const out = process.argv[4] || "retention.json";
const P = CH === "yt2"
  ? { id: process.env.YT2_CLIENT_ID, secret: process.env.YT2_CLIENT_SECRET, refresh: process.env.YT2_REFRESH_TOKEN }
  : { id: process.env.YT_CLIENT_ID, secret: process.env.YT_CLIENT_SECRET, refresh: process.env.YT_REFRESH_TOKEN };
if (!P.refresh) { console.error("retention: sin refresh token en env"); process.exit(0); }

const tf = (u, o = {}, ms = 15000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const MAX_VIDEOS = 15, MATURE_DAYS = 5, DAY = 86400000;

(async () => {
  const tr = await (await tf("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: P.id, client_secret: P.secret, refresh_token: P.refresh, grant_type: "refresh_token" }),
  })).json();
  const token = tr.access_token;
  if (!token) { console.error("retention: no access_token:", JSON.stringify(tr).slice(0, 150)); process.exit(0); }
  const H = { Authorization: `Bearer ${token}` };

  // Inventario -> videos recientes, MADUROS y PÚBLICOS (los privados no tienen retención pública).
  let inv = {};
  try { inv = JSON.parse(fs.readFileSync(invFile, "utf8")); } catch {}
  let vids = [];
  if (Array.isArray(inv.longs) || Array.isArray(inv.shorts)) vids = [...(inv.longs || []), ...(inv.shorts || [])];
  else if (Array.isArray(inv.list)) vids = inv.list;
  const now = Date.now();
  vids = vids
    .filter((v) => v && v.video_id && v.privacy === "public" && v.published_at && (now - Date.parse(v.published_at)) / DAY >= MATURE_DAYS)
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    .slice(0, MAX_VIDEOS);

  const end = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const v of vids) {
    try {
      const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=${end}&dimensions=elapsedVideoTimeRatio&metrics=audienceWatchRatio&filters=video==${v.video_id}&sort=elapsedVideoTimeRatio`;
      const r = await tf(url, { headers: H });
      if (!r.ok) continue;
      const rows = (await r.json()).rows || [];
      const curve = rows.map((row) => ({ ratio: +row[0], watch: +row[1] }));
      if (curve.length < 2) continue;
      results.push({ video_id: v.video_id, title: v.title || "", ...analyzeRetention(curve) });
    } catch {}
  }
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), count: results.length, videos: results }, null, 2));
  console.log(`retention ${CH}: ${results.length} de ${vids.length} videos con curva -> ${out}`);
})().catch((e) => { console.error("retention error:", e && e.message); process.exit(0); });
