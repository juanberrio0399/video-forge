// weekly_stats.mjs — historial SEMANA A SEMANA de un canal, desde YouTube Analytics.
// Uso: node pipeline/weekly_stats.mjs data_lens | oddly
// Lee weekly_stats.json (lo baja el workflow), actualiza la sección del canal con
// vistas/min/subs ganados por semana (ISO, lunes) de los últimos ~63 días, conserva
// las semanas viejas ya guardadas, y reescribe el archivo (el workflow lo sube a R2).
//
// Por qué así: es la ÚNICA fuente que da vistas por día reales (= YouTube Studio).
// Analytics va 2-3 días atrasado -> la semana en curso siempre queda PARCIAL (marcada).
import fs from "node:fs";

const CH = process.argv[2];
if (!["data_lens", "oddly"].includes(CH)) { console.error("uso: weekly_stats.mjs data_lens|oddly"); process.exit(1); }

const P = CH === "oddly"
  ? { id: process.env.YT2_CLIENT_ID, secret: process.env.YT2_CLIENT_SECRET, refresh: process.env.YT2_REFRESH_TOKEN }
  : { id: process.env.YT_CLIENT_ID, secret: process.env.YT_CLIENT_SECRET, refresh: process.env.YT_REFRESH_TOKEN };
if (!P.refresh) { console.error(CH, "sin refresh token en env"); process.exit(1); }

const FILE = "weekly_stats.json";
const tf = (u, o = {}, ms = 15000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const isoDay = (d) => d.toISOString().slice(0, 10);
// lunes de la semana ISO de una fecha 'YYYY-MM-DD' (en UTC)
function mondayUTC(dstr) {
  const dt = new Date(dstr + "T00:00:00Z");
  const back = (dt.getUTCDay() + 6) % 7; // 0=lunes
  dt.setUTCDate(dt.getUTCDate() - back);
  return isoDay(dt);
}

(async () => {
  // 1) access token desde el refresh token
  const tr = await (await tf("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: P.id, client_secret: P.secret, refresh_token: P.refresh, grant_type: "refresh_token" }),
  })).json();
  const token = tr.access_token;
  if (!token) { console.error(CH, "no access_token:", JSON.stringify(tr).slice(0, 200)); process.exit(1); }
  const H = { Authorization: `Bearer ${token}` };

  // 2) serie diaria de Analytics (últimos ~63 días). Métricas: vistas, minutos, likes,
  //    subs ganados y perdidos. Si el permiso no da todas, baja al set que sí funcione.
  const end = isoDay(new Date());
  const start = isoDay(new Date(Date.now() - 63 * 86400 * 1000));
  const base = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${end}&dimensions=day&sort=day`;
  // sets ordenados: se prueban de más completo a más básico; 'cols' dice qué columna es qué.
  const SETS = [
    { m: "views,estimatedMinutesWatched,likes,subscribersGained,subscribersLost", cols: { views: 1, min: 2, likes: 3, sg: 4, sl: 5 } },
    { m: "views,estimatedMinutesWatched,likes", cols: { views: 1, min: 2, likes: 3 } },
    { m: "views,estimatedMinutesWatched", cols: { views: 1, min: 2 } },
  ];
  let rows = [], cols = null;
  for (const s of SETS) {
    const r = await tf(`${base}&metrics=${s.m}`, { headers: H });
    if (r.ok) { rows = (await r.json()).rows || []; cols = s.cols; break; }
    if (s === SETS[SETS.length - 1]) { console.error(CH, "analytics falló", r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  }
  const g = (row, i) => (i == null ? 0 : (+row[i] || 0));

  // 3) agrupar por semana (lunes)
  const wk = {};
  for (const row of rows) {
    const k = mondayUTC(row[0]);
    (wk[k] = wk[k] || { week: k, views: 0, watch_min: 0, likes: 0, subs_gained: 0, subs_lost: 0, days: 0 });
    wk[k].views += g(row, cols.views);
    wk[k].watch_min += Math.round(g(row, cols.min));
    wk[k].likes += g(row, cols.likes);
    wk[k].subs_gained += g(row, cols.sg);
    wk[k].subs_lost += g(row, cols.sl);
    wk[k].days++;
  }
  // subs_net por semana (ganados - perdidos)
  const fresh = Object.values(wk).sort((a, b) => (a.week < b.week ? -1 : 1))
    .map((w) => ({ ...w, subs_net: w.subs_gained - w.subs_lost }));

  // 4) totales actuales del canal (subs + vistas de por vida)
  let subs = 0, total_views = 0, name = "";
  try {
    const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: H })).json();
    const it = ch.items && ch.items[0];
    if (it) { subs = +((it.statistics || {}).subscriberCount) || 0; total_views = +((it.statistics || {}).viewCount) || 0; name = (it.snippet || {}).title || ""; }
  } catch {}

  // 5) merge: conservar semanas viejas (antes de la ventana) + reemplazar las recientes
  let all = {};
  try { all = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
  if (!all.channels) all.channels = {};
  const prev = (all.channels[CH] && all.channels[CH].weeks) || [];
  const minNew = fresh.length ? fresh[0].week : null;
  const kept = minNew ? prev.filter((w) => w.week < minNew) : prev;
  const weeks = [...kept, ...fresh].slice(-26); // ~6 meses

  all.channels[CH] = { name, subs, total_views, lag_days: 3, has_subs: cols.sg != null, has_engagement: cols.likes != null, weeks };
  all.updated = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(all));
  console.log(CH, "OK — semanas:", weeks.length, "| última:", JSON.stringify(fresh[fresh.length - 1] || null));
})().catch((e) => { console.error(CH, "error", e && e.message); process.exit(1); });
