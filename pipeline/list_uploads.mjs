// list_uploads.mjs — lista TODOS los videos subidos al canal con privacidad, fecha,
// duracion y vistas. Sirve para desenredar duplicados (que quedo publico vs privado).
// Uso: node pipeline/list_uploads.mjs
import fs from "node:fs";

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) { console.error("Faltan secrets YT_*"); process.exit(1); }

async function token() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error("token:", JSON.stringify(j)); process.exit(1); }
  return j.access_token;
}
const T = await token();
const H = { Authorization: `Bearer ${T}` };

const ch = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
if (!uploads) { console.error("sin uploads:", JSON.stringify(ch).slice(0, 300)); process.exit(1); }

let ids = [], page = "";
do {
  const j = await (await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&pageToken=${page}`, { headers: H })).json();
  ids.push(...(j.items || []).map((i) => i.contentDetails.videoId));
  page = j.nextPageToken || "";
} while (page);

const rows = [];
for (let i = 0; i < ids.length; i += 50) {
  const j = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics,contentDetails&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
  for (const v of j.items || []) {
    const dur = v.contentDetails.duration.replace("PT", "").toLowerCase();
    const isShort = /(^|[^0-9])([1-9]|[1-5][0-9])s$/.test(dur) && !/m/.test(dur);
    rows.push({ id: v.id, title: v.snippet.title, privacy: v.status.privacyStatus, date: v.snippet.publishedAt.slice(0, 10), views: v.statistics.viewCount || "0", dur, short: isShort });
  }
}
rows.sort((a, b) => (a.date < b.date ? 1 : -1));
console.log("TOTAL", rows.length);
for (const r of rows) console.log(`${r.short ? "SHORT" : "VIDEO"} | ${r.privacy.padEnd(7)} | ${r.dur.padStart(6)} | ${r.views.padStart(4)}v | ${r.date} | ${r.id} | ${r.title}`);

// Mensaje compacto para Telegram
const line = (r) => `${r.privacy === "public" ? "🟢" : r.privacy === "private" ? "🔒" : "🟡"} ${r.dur} · ${r.views}v · \`${r.id}\` ${r.title}`;
const shorts = rows.filter((r) => r.short), longs = rows.filter((r) => !r.short);
let msg = `📋 *Inventario del canal* (${rows.length} videos)\n\n*Videos largos:*\n` + (longs.map(line).join("\n") || "—");
msg += `\n\n*Shorts:*\n` + (shorts.map(line).join("\n") || "—");
fs.writeFileSync("inventory_msg.txt", msg);
fs.writeFileSync("inventory.json", JSON.stringify(rows, null, 2));
