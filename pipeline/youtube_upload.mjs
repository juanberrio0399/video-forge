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

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

// 1) Access token a partir del refresh token — con REINTENTOS (un blip de red no debe tumbar la subida).
async function getAccessToken() {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json();
      if (j.access_token) return j.access_token;
      // 4xx de credenciales (no 429) = permanente -> no reintentar en vano.
      if (r.status >= 400 && r.status < 500 && r.status !== 429) { console.error("Error de token (permanente):", JSON.stringify(j)); process.exit(1); }
      console.error(`token intento ${i + 1}: HTTP ${r.status}`);
    } catch (e) { console.error(`token intento ${i + 1}: ${e.message}`); }
    await sleep(3000 * (i + 1));
  }
  console.error("No pude refrescar el token OAuth tras 4 intentos."); process.exit(1);
}
const token = await getAccessToken();

// 2) Metadatos del video (del paquete SEO)
const snippet = {
  title: (pkg.title || "The Data Lens").slice(0, 100),
  description: (pkg.description || "").slice(0, 4900),
  tags: Array.isArray(pkg.tags) ? pkg.tags.slice(0, 30) : [],
  categoryId: process.env.YT_CATEGORY_ID || "27", // 27=Education (Data Lens) · 24=Entertainment (Oddly Loop)
  defaultLanguage: pkg.language || "en",
};
const status = {
  privacyStatus: "private",          // PRIVADO: Juan lo revisa y lo hace publico cuando quiera
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,      // disclosure: voz IA
};

// 3) Subida "resumable" — con REINTENTOS ante 429/5xx/corte (antes fallaba a la primera).
const size = fs.statSync(videoPath).size;
const body = fs.readFileSync(videoPath);

async function uploadOnce() {
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
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!init.ok) return { retry: init.status === 429 || init.status >= 500, err: `init ${init.status}: ${(await init.text()).slice(0, 300)}` };
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) return { retry: true, err: "no devolvio URL de subida" };
  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4", "content-length": String(size) },
    body,
  });
  let res = {}; try { res = await up.json(); } catch {}
  if (res && res.id) return { id: res.id };
  return { retry: up.status === 429 || up.status >= 500, err: `PUT ${up.status}: ${JSON.stringify(res).slice(0, 300)}` };
}

let videoId = null;
for (let i = 0; i < 3; i++) {
  console.log(`Subiendo ${(size / 1e6).toFixed(1)} MB (intento ${i + 1}/3)...`);
  let out;
  try { out = await uploadOnce(); } catch (e) { out = { retry: true, err: e.message }; }
  if (out.id) { videoId = out.id; break; }
  console.error(out.err);
  if (!out.retry) break;           // error permanente -> no insistir
  await sleep(5000 * (i + 1));
}
if (!videoId) { console.error("Subida a YouTube fallida tras reintentos."); process.exit(1); }

const url = `https://youtu.be/${videoId}`;
console.log("VIDEO_ID=" + videoId);
console.log("VIDEO_URL=" + url);
// Guarda el ID (para actualizar el SEO/metadata luego sin re-subir el video).
fs.writeFileSync("publish/video_id.txt", videoId);
fs.writeFileSync(
  "publish/youtube_result.txt",
  `✅ Subido a YouTube (PRIVADO, para tu revision):\n${url}\n\n🏷️ ${snippet.title}\n\nRevisalo y hazlo Publico cuando estes conforme (Studio → Contenido → Visibilidad).`
);
