// youtube_delete.mjs — BORRA (permanente) los video_id indicados del canal.
// Solo borra los IDs que se le pasan; nunca hace un barrido masivo.
// Uso: node pipeline/youtube_delete.mjs <id1> <id2> ...
import fs from "node:fs";

const IDS = process.argv.slice(2).filter(Boolean);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!IDS.length) { console.error("No hay IDs para borrar"); process.exit(1); }
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

const done = [], failed = [];
for (const id of IDS) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${T}` } });
  if (r.status === 204) { console.log("BORRADO", id); done.push(id); }
  else { const t = await r.text(); console.error("FALLO", id, r.status, t.slice(0, 200)); failed.push(id); }
}
fs.writeFileSync("delete_result.txt", `borrados=${done.length} fallidos=${failed.length}\nOK: ${done.join(", ") || "-"}\nFALLO: ${failed.join(", ") || "-"}`);
console.log(`\nResumen: ${done.length} borrados, ${failed.length} fallidos.`);
