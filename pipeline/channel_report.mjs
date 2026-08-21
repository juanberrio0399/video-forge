// channel_report.mjs — jala metricas REALES del canal + cada video publicado y arma el
// reporte de direccion: subs, vistas, likes, comentarios, progreso de monetizacion (YPP)
// y la programacion de proximos videos. Usa el refresh token (OAuth). Actualiza el estado.
//
// Uso: node pipeline/channel_report.mjs <state.json> <out_state.json> <report.txt>
import fs from "node:fs";

const [statePath, outStatePath, reportPath] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

async function getToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("token: " + JSON.stringify(j));
  return j.access_token;
}
const token = await getToken();
const api = async (url) => {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
};

// 1) Estadisticas del canal
const ch = await api("https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true");
const c = (ch.json.items || [])[0] || {};
const cs = c.statistics || {};
const subs = +cs.subscriberCount || 0;
const totalViews = +cs.viewCount || 0;
const vids = +cs.videoCount || 0;

// 2) Horas de reproduccion (Analytics API) — puede faltar el permiso yt-analytics.
let watchHours = null;
try {
  const a = await api("https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=2035-01-01&metrics=estimatedMinutesWatched");
  if (a.ok) {
    const mins = a.json.rows && a.json.rows[0] && a.json.rows[0][0];
    if (mins != null) watchHours = Math.round((mins / 60) * 10) / 10;
  }
} catch {}

// 3) Estadisticas por video publicado
for (const v of state.published || []) {
  const r = await api(`https://www.googleapis.com/youtube/v3/videos?part=statistics,status,snippet&id=${v.video_id}`);
  const it = (r.json.items || [])[0];
  if (it) {
    v.privacy = it.status?.privacyStatus || v.privacy;
    v.title = it.snippet?.title || v.title;
    v.published_at = it.snippet?.publishedAt || v.published_at;
    v.stats = {
      views: +it.statistics?.viewCount || 0,
      likes: +it.statistics?.likeCount || 0,
      comments: +it.statistics?.commentCount || 0,
    };
  }
}

// 4) Progreso de monetizacion (YPP)
const subsPct = Math.min(100, Math.round((subs / 1000) * 100));
const hoursPct = watchHours != null ? Math.min(100, Math.round((watchHours / 4000) * 100)) : null;
state.monetization = state.monetization || {};
state.monetization.subs = subs;
state.monetization.watch_hours = watchHours;
state.monetization.subs_pct = subsPct;
state.monetization.hours_pct = hoursPct;
state.monetization.elegible = subs >= 1000 && watchHours != null && watchHours >= 4000;

// Conteo de Shorts (del plan en R2, si el workflow lo bajo a shorts_plan.json).
let shortsInfo = { total: 0, uploaded: 0, public: 0 };
try {
  if (fs.existsSync("shorts_plan.json")) {
    const sp = JSON.parse(fs.readFileSync("shorts_plan.json", "utf8"));
    const arr = sp.shorts || [];
    shortsInfo.total = arr.length;
    const withId = arr.filter((x) => x.video_id);
    shortsInfo.uploaded = withId.length;
    // Verifica privacidad de cada short subido.
    for (const s of withId) {
      const rr = await api(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${s.video_id}`);
      const st = (rr.json.items || [])[0];
      if (st && st.status?.privacyStatus === "public") shortsInfo.public++;
    }
  }
} catch {}
state.shorts = shortsInfo;

// APRENDER de los datos: velocidad (vistas/día), TOP videos y MEJORES HORAS por datos del canal
// (para replicar lo que jala y programar donde rinde). Sin señal suficiente -> horas research.
const nowMs = Date.now();
const etHour = (iso) => { try { return +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(new Date(iso)); } catch { return null; } };
const pubv = (state.published || []).filter((v) => v.privacy === "public" && v.published_at && v.stats);
for (const v of pubv) { const days = Math.max(0.5, (nowMs - Date.parse(v.published_at)) / 86400000); v.vpd = +((v.stats.views || 0) / days).toFixed(1); }
state.top = [...pubv].sort((a, b) => (b.vpd || 0) - (a.vpd || 0)).slice(0, 5).map((v) => ({ video_id: v.video_id, title: v.title, views: v.stats.views, vpd: v.vpd }));
let bestHours = null;
if (pubv.length >= 6) {
  const byH = {}; for (const v of pubv) { const h = etHour(v.published_at); if (h == null) continue; byH[h] = (byH[h] || 0) + (v.vpd || 0); }
  const ranked = Object.entries(byH).map(([h, s]) => [+h, s]).sort((a, b) => b[1] - a[1]);
  if (ranked.length >= 3) bestHours = { hours: ranked.slice(0, 4).map((r) => r[0]).sort((a, b) => a - b), data_driven: true, based_on: pubv.length };
}
state.best_hours = bestHours;
try { fs.writeFileSync("best_hours.json", JSON.stringify(bestHours || {}, null, 2)); } catch {}

state.channel_stats = { subs, total_views: totalViews, videos: vids };
state.updated_at = new Date().toISOString();
fs.writeFileSync(outStatePath, JSON.stringify(state, null, 2));

// 5) Reporte para el chat
const anyPublic = (state.published || []).some((v) => v.privacy === "public");
const L = [];
L.push(`📊 *Reporte del canal — ${state.channel?.name || "The Data Lens"}*`);
L.push(`Actualizado: ${state.updated_at.slice(0, 16).replace("T", " ")} UTC`);
L.push(``);
L.push(`👥 Suscriptores: ${subs}`);
L.push(`👁️ Vistas totales: ${totalViews}`);
L.push(`🎬 Videos: ${vids}`);
L.push(``);
L.push(`*Videos publicados:*`);
for (const v of state.published || []) {
  const s = v.stats || {};
  L.push(`• ${v.title || v.video_id} — ${v.privacy}${v.privacy === "public" ? ` · ${s.views || 0} vistas, ${s.likes || 0} likes, ${s.comments || 0} coment.` : " (sin vistas publicas hasta hacerlo Publico)"}`);
}
L.push(``);
L.push(`🎬 Shorts: ${shortsInfo.uploaded} subidos (${shortsInfo.public} públicos)`);
L.push(``);
L.push(`*Monetizacion (YPP):*`);
L.push(`• Subs: ${subs}/1,000 (${subsPct}%)`);
L.push(`• Horas: ${watchHours != null ? `${watchHours}/4,000 (${hoursPct}%)` : "no disponible (falta permiso yt-analytics; reautorizar OAuth con ese scope)"}`);
L.push(`• Elegible: ${state.monetization.elegible ? "✅ SI" : "❌ todavia no"}`);
L.push(``);
L.push(`*Proximos videos (programacion):*`);
for (const u of (state.upcoming || []).slice(0, 6)) {
  L.push(`• #${u.n}${u.target_date ? ` · ${u.target_date}` : ""} — ${u.topic}`);
}
L.push(``);
if (!anyPublic) {
  L.push(`⚠️ *Nota de director:* el video #1 esta PRIVADO — no suma vistas ni horas. Para arrancar el crecimiento hay que hacerlo Publico. Sin videos publicos, la monetizacion no avanza.`);
} else {
  L.push(`💡 Escribe /reporte cuando quieras la version fresca, o pideme analisis de director para decidir que ajustar (titulos, miniaturas, horarios, temas).`);
}
fs.writeFileSync(reportPath, L.join("\n"));
console.log(L.join("\n"));
