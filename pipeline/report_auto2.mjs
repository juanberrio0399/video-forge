// report_auto2.mjs — trae el estado REAL del 2do canal (Oddly Loop, YT2) y lo guarda en
// auto2_state.json (el workflow lo sube a channel/auto2/state.json; la app lo muestra).
// Uso: node pipeline/report_auto2.mjs
import fs from "node:fs";
const { YT2_CLIENT_ID, YT2_CLIENT_SECRET, YT2_REFRESH_TOKEN } = process.env;
const tf = (u, o = {}, ms = 12000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
if (!YT2_REFRESH_TOKEN) { console.error("sin YT2_*"); process.exit(1); }

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
  // Mapa video->nicho (lo escribe la produccion) para mostrar DE QUE trata cada video.
  let nicheMap = {};
  try { nicheMap = JSON.parse(fs.readFileSync("niche_map.json", "utf8")); } catch {}
  const NICHE_LABEL = { satisfying: "Satisfying / ASMR", narrativas: "Narrativas", ciencia_humor: "Ciencia + humor", naturaleza_relax: "Naturaleza / relax" };
  // Si un video no quedo en el niche_map (produccion vieja), INFERIMOS su categoria por el titulo,
  // para que TODO tenga subcategoria (nunca "Sin categoria"). Default = satisfying (el nucleo del canal).
  function inferNiche(title) {
    const t = (title || "").toLowerCase();
    if (/satisfying|slime|kinetic|hydraulic|soap|paint|resin|\bsand\b|oddly sat|asmr/.test(t)) return "satisfying";
    if (/deep sleep|relax|nature|rain|ocean|forest|\bcalm\b|10 hours|for sleep|sleep/.test(t)) return "naturaleza_relax";
    if (/your brain|your body|\bscience\b|neuron|immune|weirdly|\bfact/.test(t)) return "ciencia_humor";
    if (/\bshe\b|\bhe\b|\bher\b|\bhis\b|story|secret|faked|cheat|affair|\btext\b|ghost|betray|caught|revenge/.test(t)) return "narrativas";
    return "satisfying";
  }
  const list = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
    for (const v of j.items || []) {
      const nk = nicheMap[v.id] || inferNiche(v.snippet.title); // SIEMPRE hay categoria
      list.push({ video_id: v.id, title: v.snippet.title, privacy: v.status.privacyStatus, publish_at: (v.status || {}).publishAt || null, views: +((v.statistics || {}).viewCount || 0), published_at: v.snippet.publishedAt.slice(0, 10), pub_iso: v.snippet.publishedAt, niche: nk, niche_label: NICHE_LABEL[nk] || null, manual: false });
    }
  }
  let watch_min = 0;
  try { const a = await tf("https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=2035-01-01&metrics=estimatedMinutesWatched", { headers: H }); if (a.ok) { const aj = await a.json(); watch_min = Math.round((aj.rows && aj.rows[0] && aj.rows[0][0]) || 0); } } catch {}
  // --- APRENDER DE LOS DATOS: qué RINDE, para replicar y para programar donde da resultado ---
  const now = Date.now();
  const etHour = (iso) => { try { return +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(new Date(iso)); } catch { return null; } };
  const pubs = list.filter((v) => v.privacy === "public" && v.pub_iso);
  for (const v of pubs) { const days = Math.max(0.5, (now - Date.parse(v.pub_iso)) / 86400000); v.vpd = +(v.views / days).toFixed(1); v._h = etHour(v.pub_iso); }
  // TOP: los que más rinden por VELOCIDAD (vistas/día, justo para videos de distinta edad).
  const top = [...pubs].sort((a, b) => (b.vpd || 0) - (a.vpd || 0)).slice(0, 5).map((v) => ({ video_id: v.video_id, title: v.title, views: v.views, vpd: v.vpd, niche_label: v.niche_label }));
  // NICHO ganador: qué categoría acumula más vistas/día (para producir más de eso).
  const byNiche = {}; for (const v of pubs) { const k = v.niche_label || "Satisfying / ASMR"; (byNiche[k] = byNiche[k] || { vpd: 0, n: 0 }); byNiche[k].vpd += v.vpd || 0; byNiche[k].n++; }
  const niche_ranking = Object.entries(byNiche).map(([label, d]) => ({ label, avg_vpd: +(d.vpd / d.n).toFixed(1), videos: d.n })).sort((a, b) => b.avg_vpd - a.avg_vpd);
  // MEJORES HORAS por DATOS: horas ET con más vistas/día acumuladas. Solo si hay señal suficiente
  // (>=6 públicos); si no, null -> el agendado usa las horas investigadas (research) por defecto.
  let best_hours = null;
  if (pubs.length >= 6) {
    const byHour = {}; for (const v of pubs) { if (v._h == null) continue; byHour[v._h] = (byHour[v._h] || 0) + (v.vpd || 0); }
    const ranked = Object.entries(byHour).map(([h, s]) => [+h, s]).sort((a, b) => b[1] - a[1]);
    if (ranked.length >= 3) best_hours = { hours: ranked.slice(0, 4).map((r) => r[0]).sort((a, b) => a - b), data_driven: true, based_on: pubs.length };
  }
  list.forEach((v) => { delete v.pub_iso; delete v._h; }); // no ensuciar el estado
  const state = { name: (item.snippet || {}).title || "Oddly Loop", handle: "@oddlyloophq", subs, total_views, videos: list.length, watch_min, top, niche_ranking, best_hours, list: list.sort((a, b) => (a.published_at < b.published_at ? 1 : -1)), at: new Date().toISOString() };
  fs.writeFileSync("auto2_state.json", JSON.stringify(state, null, 2));
  // best_hours.json para el agendado (best_slot lo lee si existe). Vacío = usar research.
  fs.writeFileSync("best_hours.json", JSON.stringify(best_hours || {}, null, 2));
  console.log(`Auto2 (${state.name}): ${state.videos} videos · ${subs} subs · ${total_views} vistas · ${watch_min} min.`);
  if (top.length) console.log(`  🔥 Top: ${top.map((t) => (t.title || "").slice(0, 20) + " (" + t.vpd + "/día)").join(" · ")}`);
  if (niche_ranking.length) console.log(`  🏆 Nichos por vistas/día (promedio): ${niche_ranking.map((r) => `${r.label}=${r.avg_vpd} (${r.videos} vids)`).join(" · ")}`);
  if (best_hours) console.log(`  🕐 Mejores horas (datos): ${best_hours.hours.join("h, ")}h ET`); else console.log("  🕐 Mejores horas: research (aún sin datos suficientes)");
} catch (e) { console.error("report_auto2 error:", e.message); process.exit(1); }
