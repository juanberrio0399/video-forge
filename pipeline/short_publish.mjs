// short_publish.mjs — sube UN short a YouTube como PRIVADO (para revisar). Titulo +
// descripcion (con hashtags + credito de musica) desde archivos. Marca contenido sintetico.
//
// Uso: node pipeline/short_publish.mjs <video.mp4> <title.txt> <description.txt>
import fs from "node:fs";

const [videoPath, titlePath, descPath] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!fs.existsSync(videoPath)) { console.error("no existe el video: " + videoPath); process.exit(1); }
const title = fs.readFileSync(titlePath, "utf8").trim().slice(0, 100);
const description = (fs.existsSync(descPath) ? fs.readFileSync(descPath, "utf8") : "").slice(0, 4900);

async function getToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error("token:", JSON.stringify(j)); process.exit(1); }
  return j.access_token;
}
const token = await getToken();

const size = fs.statSync(videoPath).size;
const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8",
    "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/mp4",
  },
  body: JSON.stringify({
    snippet: { title, description, categoryId: "27", defaultLanguage: "en" },
    status: { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
  }),
});
if (!init.ok) { console.error("init:", init.status, (await init.text()).slice(0, 300)); process.exit(1); }
const up = await fetch(init.headers.get("location"), {
  method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) },
  body: fs.readFileSync(videoPath),
});
const res = await up.json();
if (!res.id) { console.error("upload:", JSON.stringify(res).slice(0, 300)); process.exit(1); }
console.log("VIDEO_ID=" + res.id);
fs.writeFileSync("short_id.txt", res.id);
