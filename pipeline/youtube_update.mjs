// youtube_update.mjs — actualiza el SEO/metadata de un video YA subido (sin re-subirlo).
// Usa videos.update de la API con el refresh token. Toma titulo/descripcion/tags del
// paquete SEO nuevo. Sirve para "Regenerar SEO": se rehace el paquete y se aplica al
// video que ya esta en YouTube (privado).
//
// Uso: node pipeline/youtube_update.mjs <VIDEO_ID> [package.json]
import fs from "node:fs";

const [videoId, pkgPath = "publish/package.json"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;

if (!videoId) { console.error("Falta VIDEO_ID"); process.exit(1); }
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) { console.error("Faltan secrets YT_*"); process.exit(1); }
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, "utf8")) : {};

async function getAccessToken() {
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
const token = await getAccessToken();

const snippet = {
  title: (pkg.title || "The Data Lens").slice(0, 100),
  description: (pkg.description || "").slice(0, 4900),
  tags: Array.isArray(pkg.tags) ? pkg.tags.slice(0, 30) : [],
  categoryId: "27",
  defaultLanguage: pkg.language || "en",
};

const r = await fetch(
  "https://www.googleapis.com/youtube/v3/videos?part=snippet",
  {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ id: videoId, snippet }),
  }
);
const j = await r.json();
if (!r.ok || !j.id) { console.error("Error al actualizar:", r.status, JSON.stringify(j).slice(0, 400)); process.exit(1); }
console.log("ACTUALIZADO=" + j.id + " -> " + snippet.title);
