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
  const list = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
    for (const v of j.items || []) {
      const nk = nicheMap[v.id];
      list.push({ video_id: v.id, title: v.snippet.title, privacy: v.status.privacyStatus, publish_at: (v.status || {}).publishAt || null, views: +((v.statistics || {}).viewCount || 0), published_at: v.snippet.publishedAt.slice(0, 10), niche: nk || null, niche_label: NICHE_LABEL[nk] || null, manual: !nk });
    }
  }
  let watch_min = 0;
  try { const a = await tf("https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=2035-01-01&metrics=estimatedMinutesWatched", { headers: H }); if (a.ok) { const aj = await a.json(); watch_min = Math.round((aj.rows && aj.rows[0] && aj.rows[0][0]) || 0); } } catch {}
  const state = { name: (item.snippet || {}).title || "Oddly Loop", handle: "@oddlyloophq", subs, total_views, videos: list.length, watch_min, list: list.sort((a, b) => (a.published_at < b.published_at ? 1 : -1)), at: new Date().toISOString() };
  fs.writeFileSync("auto2_state.json", JSON.stringify(state, null, 2));
  console.log(`Auto2 (${state.name}): ${state.videos} videos · ${subs} subs · ${total_views} vistas · ${watch_min} min.`);
} catch (e) { console.error("report_auto2 error:", e.message); process.exit(1); }
