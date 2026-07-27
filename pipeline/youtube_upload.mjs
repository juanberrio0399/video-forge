// youtube_upload.mjs — sube el video a YouTube usando el refresh token (OAuth).
// Lee el paquete SEO (package.json) para titulo/descripcion/tags. Sube como PRIVADO
// (Juan lo revisa en YouTube antes de hacerlo publico), marca "NO para ninos" y el
// disclosure de contenido sintetico (voz IA). Deja el link en publish/youtube_result.txt.
//
// Uso: node pipeline/youtube_upload.mjs <video.mp4> [package.json]
import fs from "node:fs";

const [videoPath, pkgPath = "publish/package.json"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;

if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  console.error("Faltan secrets: YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN");
  process.exit(1);
}
if (!fs.existsSync(videoPath)) { console.error("No existe el video: " + videoPath); process.exit(1); }
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, "utf8")) : {};
fs.mkdirSync("publish", { recursive: true });

// 1) Access token a partir del refresh token
async function getAccessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID,
      client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error("Error al refrescar token:", JSON.stringify(j)); process.exit(1); }
  return j.access_token;
}
const token = await getAccessToken();

// 2) Metadatos del video (del paquete SEO)
const snippet = {
  title: (pkg.title || "The Data Lens").slice(0, 100),
  description: (pkg.description || "").slice(0, 4900),
  tags: Array.isArray(pkg.tags) ? pkg.tags.slice(0, 30) : [],
  categoryId: "27", // Education
  defaultLanguage: pkg.language || "en",
};
const status = {
  privacyStatus: "private",          // PRIVADO: Juan lo revisa y lo hace publico cuando quiera
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,      // disclosure: voz IA
};

// 3) Subida "resumable" en un solo PUT
const size = fs.statSync(videoPath).size;
const init = await fetch(
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify({ snippet, status }),
  }
);
if (!init.ok) { console.error("Error init upload:", init.status, (await init.text()).slice(0, 400)); process.exit(1); }
const uploadUrl = init.headers.get("location");
if (!uploadUrl) { console.error("No devolvio URL de subida."); process.exit(1); }

console.log(`Subiendo ${(size / 1e6).toFixed(1)} MB...`);
const up = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "content-type": "video/mp4", "content-length": String(size) },
  body: fs.readFileSync(videoPath),
});
const res = await up.json();
if (!res.id) { console.error("Error en la subida:", JSON.stringify(res).slice(0, 500)); process.exit(1); }

const url = `https://youtu.be/${res.id}`;
console.log("VIDEO_ID=" + res.id);
console.log("VIDEO_URL=" + url);
// Guarda el ID (para actualizar el SEO/metadata luego sin re-subir el video).
fs.writeFileSync("publish/video_id.txt", res.id);
fs.writeFileSync(
  "publish/youtube_result.txt",
  `✅ Subido a YouTube (PRIVADO, para tu revision):\n${url}\n\n🏷️ ${snippet.title}\n\nRevisalo y hazlo Publico cuando estes conforme (Studio → Contenido → Visibilidad).`
);
