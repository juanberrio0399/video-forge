// idle_check.mjs — para el video diario del canal principal (The Data Lens). Imprime "IDLE PEND":
//   IDLE = horas desde el ULTIMO video subido al canal (cualquier privacidad; manual o de la fabrica).
//   PEND = cuantos videos hay PRIVADOS sin programar (esperando que Juan los apruebe).
// El cron produce solo si IDLE > 18h Y PEND < tope -> trabaja solo cuando Juan no ha producido en
// 18h, acumula un par para aprobar, y NO produce 'a lo loco'. Ante error, imprime "999 0" (deja producir).
import fs from "node:fs";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const tf = (u, o = {}, ms = 12000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
// Videos OCULTOS (retirados) NO cuentan como "pendientes por aprobar" -> no bloquean la produccion.
let hidden = new Set();
try { hidden = new Set(JSON.parse(fs.readFileSync("hidden.json", "utf8"))); } catch {}
if (!YT_REFRESH_TOKEN) { process.stdout.write("999 0"); process.exit(0); }
try {
  const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
  const token = tr.access_token; if (!token) { process.stdout.write("999 0"); process.exit(0); }
  const H = { Authorization: `Bearer ${token}` };
  const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
  const item = (ch.items || [])[0] || {};
  const up = item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
  let ids = [], page = "";
  if (up) { do { const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json(); ids.push(...(j.items || []).map((i) => i.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page && ids.length < 200); }
  const now = Date.now(); let newest = 0, pending = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
    for (const v of j.items || []) {
      const t = Date.parse(v.snippet.publishedAt) || 0; if (t > newest) newest = t;
      const st = v.status || {}; if (st.privacyStatus === "private" && !st.publishAt && !hidden.has(v.id)) pending++;
    }
  }
  const idleH = newest ? Math.round((now - newest) / 3600000) : 999;
  process.stdout.write(idleH + " " + pending);
} catch { process.stdout.write("999 0"); }
