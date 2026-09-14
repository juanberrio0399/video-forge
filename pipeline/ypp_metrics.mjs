// ypp_metrics.mjs — Mide los requisitos REALES del YouTube Partner Program por ventana (auditoría BR-01/BR-10).
// Vistas de Shorts de 90 días y horas vistas sin Shorts de 365 días (YouTube Analytics, dimensión
// creatorContentType), subidas públicas de 90 días, suscriptores, y — si la API lo permite — fuentes de
// tráfico e impresiones/CTR de 28 días. Lo que la API no entregue queda en null con su motivo: NUNCA se
// sustituye por el total histórico del canal.
// Uso: node pipeline/ypp_metrics.mjs <data-lens|oddly> <out.json> <history.json>
// Env: YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN del canal.
import fs from "node:fs";

const [label = "canal", outFile = "ypp.json", histFile = "ypp_history.json"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const DAY = 86400000;
const tf = (u, o = {}, ms = 20000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const errors = [];
const availability = {};

const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json().catch(() => ({}));
if (!tr.access_token) { console.error(`${label}: sin access_token`); process.exit(1); }
const H = { Authorization: `Bearer ${tr.access_token}` };

const now = Date.now();
const end = iso(now);
const start90 = iso(now - 89 * DAY);
const start365 = iso(now - 364 * DAY);
const start28 = iso(now - 27 * DAY);

async function analytics(params, tag) {
  const u = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&${params}`;
  try {
    const r = await tf(u, { headers: H });
    if (!r.ok) { const t = (await r.text()).slice(0, 160); errors.push(`${tag}: HTTP ${r.status} ${t}`); availability[tag] = false; return null; }
    const j = await r.json();
    availability[tag] = true;
    return j.rows || [];
  } catch (e) { errors.push(`${tag}: ${e.message}`); availability[tag] = false; return null; }
}
const isShort = (t) => /short/i.test(String(t || ""));

// 1) Vistas de Shorts 90 días.
let shorts_views_90d = null;
const rs = await analytics(`startDate=${start90}&endDate=${end}&dimensions=creatorContentType&metrics=views`, "shorts_views_90d");
if (rs) shorts_views_90d = rs.filter((r) => isShort(r[0])).reduce((a, r) => a + (+r[1] || 0), 0);

// 2) Horas vistas sin Shorts 365 días.
let watch_hours_365d = null;
const rw = await analytics(`startDate=${start365}&endDate=${end}&dimensions=creatorContentType&metrics=estimatedMinutesWatched`, "watch_hours_365d");
if (rw) watch_hours_365d = Math.round(rw.filter((r) => !isShort(r[0])).reduce((a, r) => a + (+r[1] || 0), 0) / 60);

// 2b) Ritmo ACTUAL: últimos 28 días por tipo de contenido (en canal joven el promedio de la ventana lo subestima).
let shorts_views_per_day_28d = null, watch_hours_per_day_28d = null;
const r28 = await analytics(`startDate=${start28}&endDate=${end}&dimensions=creatorContentType&metrics=views,estimatedMinutesWatched`, "pace_28d");
if (r28) {
  shorts_views_per_day_28d = Math.round(r28.filter((r) => isShort(r[0])).reduce((a, r) => a + (+r[1] || 0), 0) / 28);
  watch_hours_per_day_28d = Math.round((r28.filter((r) => !isShort(r[0])).reduce((a, r) => a + (+r[2] || 0), 0) / 60 / 28) * 100) / 100;
}

// 3) Suscriptores + subidas públicas de 90 días (Data API).
let subs = null, uploads_90d = null;
try {
  const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&mine=true", { headers: H })).json();
  const it = (ch.items || [])[0];
  if (it) {
    subs = +((it.statistics || {}).subscriberCount) || 0;
    const up = it.contentDetails && it.contentDetails.relatedPlaylists && it.contentDetails.relatedPlaylists.uploads;
    if (up) {
      const recent = []; let page = "", seen = 0, stop = false;
      do {
        const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json();
        for (const x of j.items || []) {
          seen++;
          const p = Date.parse(x.contentDetails && x.contentDetails.videoPublishedAt);
          if (Number.isFinite(p) && now - p <= 90 * DAY) recent.push(x.contentDetails.videoId);
        }
        page = j.nextPageToken || "";
        if (seen >= 400) stop = true;
      } while (page && !stop);
      let pub = 0;
      for (let i = 0; i < recent.length; i += 50) {
        const v = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${recent.slice(i, i + 50).join(",")}`, { headers: H })).json();
        pub += (v.items || []).filter((x) => x.status && x.status.privacyStatus === "public").length;
      }
      uploads_90d = pub;
    }
  }
  availability.subs = subs !== null;
} catch (e) { errors.push(`data_api: ${e.message}`); availability.subs = false; }

// 4) Diagnóstico (opcional): fuentes de tráfico e impresiones/CTR de 28 días.
let traffic_28d = null;
const rt = await analytics(`startDate=${start28}&endDate=${end}&dimensions=insightTrafficSourceType&metrics=views&sort=-views`, "traffic_28d");
if (rt) traffic_28d = rt.map((r) => ({ source: r[0], views: +r[1] || 0 }));
let impressions_28d = null, ctr_28d = null;
const ri = await analytics(`startDate=${start28}&endDate=${end}&metrics=videoThumbnailImpressions,videoThumbnailImpressionsClickRate`, "impressions_28d");
if (ri && ri[0]) { impressions_28d = +ri[0][0] || 0; ctr_28d = +ri[0][1] || 0; }

const out = {
  at: new Date(now).toISOString(), channel: label,
  windows: { shorts_views: [start90, end], watch_hours: [start365, end], diagnostics: [start28, end] },
  analytics_lag_days: 3,
  subs, shorts_views_90d, watch_hours_365d, uploads_90d,
  shorts_views_per_day_28d, watch_hours_per_day_28d,
  traffic_28d, impressions_28d, ctr_28d,
  availability, errors,
  note: "Métricas por ventana del YouTube Partner Program. null = la API no lo entregó (no se sustituye por totales históricos).",
};
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));

// Historial diario (un snapshot por día, se reemplaza el de hoy).
let hist = [];
try { hist = JSON.parse(fs.readFileSync(histFile, "utf8")); } catch {}
if (!Array.isArray(hist)) hist = [];
const snap = { date: end, subs, shorts_views_90d, watch_hours_365d, uploads_90d, shorts_views_per_day_28d, watch_hours_per_day_28d };
if (hist.length && hist[hist.length - 1].date === end) hist[hist.length - 1] = snap; else hist.push(snap);
fs.writeFileSync(histFile, JSON.stringify(hist.slice(-400)));

const fmt = (x) => (x === null ? "sin dato" : Number(x).toLocaleString("es"));
console.log(`${label}: subs ${fmt(subs)} · Shorts 90d ${fmt(shorts_views_90d)} (ritmo 28d ${fmt(shorts_views_per_day_28d)}/día) · horas 365d ${fmt(watch_hours_365d)} (ritmo 28d ${fmt(watch_hours_per_day_28d)}/día) · subidas 90d ${fmt(uploads_90d)} · impresiones 28d ${fmt(impressions_28d)}`);
if (errors.length) console.log(`${label}: sin dato en -> ${errors.map((e) => e.split(":")[0]).join(", ")}`);
