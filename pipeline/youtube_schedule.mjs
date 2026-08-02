// youtube_schedule.mjs — PROGRAMA la publicación de un video: lo deja PRIVADO con publishAt, y
// YouTube lo hace PÚBLICO solo cuando llega esa hora. Uso para publicar en las mejores horas.
// Uso: node pipeline/youtube_schedule.mjs <VIDEO_ID> <PUBLISH_AT_ISO_UTC>
import fs from "node:fs";

const [videoId, publishAt] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!videoId || !publishAt) { console.error("Falta VIDEO_ID o PUBLISH_AT"); process.exit(1); }
if (isNaN(Date.parse(publishAt))) { console.error("PUBLISH_AT inválido:", publishAt); process.exit(1); }

async function getToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error("token:", JSON.stringify(j)); process.exit(1); }
  return j.access_token;
}
const token = await getToken();

// Para programar, el video debe quedar PRIVADO con publishAt (YouTube lo publica solo a esa hora).
const r = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ id: videoId, status: { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false } }),
});
const j = await r.json();
if (!r.ok || !j.id) { console.error("Error:", r.status, JSON.stringify(j).slice(0, 400)); process.exit(1); }
console.log(`SCHEDULED VIDEO=${j.id} AT=${j.status?.publishAt}`);
fs.writeFileSync("schedule_result.txt", `📅 Video PROGRAMADO: https://youtu.be/${j.id}\nSe publicará solo el ${publishAt} (UTC).`);
