// report_auto2.mjs — trae el estado REAL del 2do canal (Oddly Loop, YT2) y lo guarda en
// auto2_state.json (el workflow lo sube a channel/auto2/state.json; la app lo muestra).
// Correcciones de la auditoría:
//  - BR-12: trae la DURACIÓN de cada video (contentDetails) -> los Shorts dejan de clasificarse como largos.
//  - BR-09: marca niche_inferred cuando la categoría se adivinó por el título (el ranking la excluye).
//  - BR-07: niche_rank = mediana de la cohorte de 5-30 días (lib/niche_rank.mjs), no media acumulada.
//  - BR-08: mejores horas por MEDIANA de vistas/día por hora con mínimo de videos, no suma.
//  - Registra las vistas de cada video al día 3 y al día 7 (views_at_age.json) para comparar cohortes
//    a la MISMA edad (regla de escalado).
// Uso: node pipeline/report_auto2.mjs   (lee niche_map.json y views_at_age.json si existen)
import fs from "node:fs";
import { rankNiches, median } from "./lib/niche_rank.mjs";

const { YT2_CLIENT_ID, YT2_CLIENT_SECRET, YT2_REFRESH_TOKEN } = process.env;
const tf = (u, o = {}, ms = 12000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
if (!YT2_REFRESH_TOKEN) { console.error("sin YT2_*"); process.exit(1); }
const DAY = 86400000;

// ISO 8601 (PT1M5S) -> segundos
function isoSeconds(d) {
  const m = String(d || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

try {
  const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT2_CLIENT_ID, client_secret: YT2_CLIENT_SECRET, refresh_token: YT2_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
  const token = tr.access_token; if (!token) { console.error("no token"); process.exit(1); }
  const H = { Authorization: `Bearer ${token}` };
  const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true", { headers: H })).json();
  const item = (ch.items || [])[0] || {};
  const subs = +((item.statistics || {}).subscriberCount || 0), total_views = +((item.statistics || {}).viewCount || 0);
  const up = item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
  let ids = [], page = "";
  if (up) { do { const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json(); ids.push(...(j.items || []).map((i) => i.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page && ids.length < 200); }
  let nicheMap = {};
  try { nicheMap = JSON.parse(fs.readFileSync("niche_map.json", "utf8")); } catch {}
  // Videos OCULTOS (despublicados o sacados de la cola): no existen para la app ni para el cerebro.
  let hidden = new Set();
  try { const h = JSON.parse(fs.readFileSync("hidden_videos.json", "utf8")); if (Array.isArray(h)) hidden = new Set(h); } catch {}
  let hiddenSkipped = 0;
  const NICHE_LABEL = { satisfying: "Satisfying / ASMR", narrativas: "Narrativas", ciencia_humor: "Ciencia + humor", naturaleza_relax: "Naturaleza / relax", animales_tiernos: "Animales tiernos / ASMR", remix: "Remix", graciosos: "Graciosos", space: "Espacio" };
  // Si un video no está en el niche_map se INFIERE por el título para mostrarlo, pero queda marcado
  // niche_inferred y NO cuenta para decidir el reparto.
  function inferNiche(title) {
    const t = (title || "").toLowerCase();
    if (/puppy|kitten|\bcat\b|\bdog\b|\bpet\b|bunny|rabbit|hamster|panda|otter|corgi|kitty|cute animal|baby animal/.test(t)) return "animales_tiernos";
    if (/satisfying|slime|kinetic|hydraulic|soap|paint|resin|\bsand\b|oddly sat|asmr/.test(t)) return "satisfying";
    if (/deep sleep|relax|nature|rain|ocean|forest|\bcalm\b|10 hours|for sleep|sleep/.test(t)) return "naturaleza_relax";
    if (/your brain|your body|\bscience\b|neuron|immune|weirdly|\bfact/.test(t)) return "ciencia_humor";
    if (/\bshe\b|\bhe\b|\bher\b|\bhis\b|story|secret|faked|cheat|affair|\btext\b|ghost|betray|caught|revenge/.test(t)) return "narrativas";
    return "satisfying";
  }
  const list = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics,contentDetails&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
    for (const v of j.items || []) {
      if (hidden.has(v.id)) { hiddenSkipped++; continue; }
      const mapped = nicheMap[v.id];
      const nk = mapped || inferNiche(v.snippet.title);
      list.push({
        video_id: v.id, title: v.snippet.title, privacy: v.status.privacyStatus, publish_at: (v.status || {}).publishAt || null,
        views: +((v.statistics || {}).viewCount || 0), likes: +((v.statistics || {}).likeCount || 0), comments: +((v.statistics || {}).commentCount || 0),
        seconds: isoSeconds((v.contentDetails || {}).duration),
        published_at: v.snippet.publishedAt.slice(0, 10), pub_iso: v.snippet.publishedAt,
        niche: nk, niche_label: NICHE_LABEL[nk] || null, niche_inferred: !mapped, manual: false,
      });
    }
  }
  let watch_min = 0;
  try { const a = await tf("https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=2035-01-01&metrics=estimatedMinutesWatched", { headers: H }); if (a.ok) { const aj = await a.json(); watch_min = Math.round((aj.rows && aj.rows[0] && aj.rows[0][0]) || 0); } } catch {}

  const now = Date.now();
  const etHour = (iso) => { try { return +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(new Date(iso)); } catch { return null; } };
  const pubs = list.filter((v) => v.privacy === "public" && v.pub_iso);
  for (const v of pubs) { const days = Math.max(0.5, (now - Date.parse(v.pub_iso)) / DAY); v.vpd = +(v.views / days).toFixed(1); v._h = etHour(v.pub_iso); }
  const top = [...pubs].sort((a, b) => (b.vpd || 0) - (a.vpd || 0)).slice(0, 5).map((v) => ({ video_id: v.video_id, title: v.title, views: v.views, vpd: v.vpd, niche_label: v.niche_label }));

  // Ranking legado (media, todos los videos) — solo para compatibilidad de lectura. NO decide.
  const byNiche = {}; for (const v of pubs) { const k = v.niche_label || "Satisfying / ASMR"; (byNiche[k] = byNiche[k] || { vpd: 0, n: 0 }); byNiche[k].vpd += v.vpd || 0; byNiche[k].n++; }
  const niche_ranking = Object.entries(byNiche).map(([label, d]) => ({ label, avg_vpd: +(d.vpd / d.n).toFixed(1), videos: d.n })).sort((a, b) => b.avg_vpd - a.avg_vpd);
  // Ranking que DECIDE: mediana de la cohorte comparable, sin inferidos.
  const niche_rank = rankNiches(list, { nowMs: now });

  // Mejores horas: mediana de vistas/día por hora ET, cohorte de 5-60 días, mínimo 3 videos por hora.
  let best_hours = null;
  const hourCohort = pubs.filter((v) => { const a = (now - Date.parse(v.pub_iso)) / DAY; return a >= 5 && a <= 60 && v._h != null; });
  const byHour = {}; for (const v of hourCohort) (byHour[v._h] = byHour[v._h] || []).push(v.vpd || 0);
  const hourRows = Object.entries(byHour).filter(([, vals]) => vals.length >= 3).map(([h, vals]) => ({ h: +h, med: median(vals), n: vals.length })).sort((a, b) => b.med - a.med);
  if (hourRows.length >= 3) best_hours = { hours: hourRows.slice(0, 4).map((r) => r.h).sort((a, b) => a - b), data_driven: true, method: "mediana por hora, cohorte 5-60 días, n≥3", based_on: hourCohort.length, detail: hourRows.slice(0, 6) };

  // Vistas a la MISMA edad (día 3 y día 7): se registran una sola vez, cuando el video cruza esa edad.
  let atAge = {};
  try { atAge = JSON.parse(fs.readFileSync("views_at_age.json", "utf8")) || {}; } catch {}
  for (const v of pubs) {
    const age = (now - Date.parse(v.pub_iso)) / DAY;
    const rec = atAge[v.video_id] || { published_at: v.pub_iso, niche: v.niche, niche_inferred: v.niche_inferred };
    if (rec.d3 == null && age >= 3 && age < 4.5) rec.d3 = v.views;
    if (rec.d7 == null && age >= 7 && age < 8.5) rec.d7 = v.views;
    if (rec.d3 != null || rec.d7 != null) atAge[v.video_id] = rec;
  }
  for (const [id, rec] of Object.entries(atAge)) { if (now - Date.parse(rec.published_at) > 90 * DAY) delete atAge[id]; }
  fs.writeFileSync("views_at_age.json", JSON.stringify(atAge));

  list.forEach((v) => { delete v._h; }); // pub_iso se conserva: el plan reconcilia por hora exacta de publicación
  const shorts = list.filter((v) => v.seconds > 0 && v.seconds <= 180).length;
  const state = { name: (item.snippet || {}).title || "Oddly Loop", handle: "@oddlyloophq", subs, total_views, videos: list.length, shorts, watch_min, top, niche_ranking, niche_rank, best_hours, list: list.sort((a, b) => (a.published_at < b.published_at ? 1 : -1)), at: new Date().toISOString() };
  fs.writeFileSync("auto2_state.json", JSON.stringify(state, null, 2));
  fs.writeFileSync("best_hours.json", JSON.stringify(best_hours || {}, null, 2));
  console.log(`Auto2 (${state.name}): ${state.videos} videos (${shorts} Shorts) · ${subs} subs · ${total_views} vistas totales · ${watch_min} min · ocultos excluidos: ${hiddenSkipped}.`);
  if (niche_rank.rows.length) console.log(`  🏆 Nichos (mediana vistas/día, cohorte 5-30d, sin inferidos): ${niche_rank.rows.map((r) => `${r.label}=${r.median_vpd} (n${r.n}${r.sufficient ? "" : ", poca muestra"})`).join(" · ")} · inferidos excluidos: ${niche_rank.excluded_inferred}`);
  if (best_hours) console.log(`  🕐 Mejores horas (mediana, n≥3): ${best_hours.hours.join("h, ")}h ET`); else console.log("  🕐 Mejores horas: sin muestra suficiente -> research por defecto");
  console.log(`  📏 Vistas a la misma edad registradas: ${Object.values(atAge).filter((r) => r.d7 != null).length} con día 7 · ${Object.values(atAge).filter((r) => r.d3 != null).length} con día 3`);
} catch (e) { console.error("report_auto2 error:", e.message); process.exit(1); }
