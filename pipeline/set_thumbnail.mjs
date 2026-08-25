// set_thumbnail.mjs — pone una miniatura personalizada en un video de YouTube (thumbnails.set).
// Usa el mismo OAuth que los uploaders (YT_* — para Oddly se mapea YT2_->YT_ en el workflow).
// NO rompe el flujo si falla (p. ej. canal sin verificar para miniaturas -> 403): solo avisa.
//
// Uso: node pipeline/set_thumbnail.mjs <videoId> [thumbnail.jpg]
import fs from "node:fs";

const [videoId, imgPath = "thumbnail.jpg"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!videoId || !fs.existsSync(imgPath)) { console.error("falta videoId o la imagen"); process.exit(0); }
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) { console.error("faltan credenciales YT"); process.exit(0); }

async function accessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  return (await r.json()).access_token;
}

try {
  const access = await accessToken();
  if (!access) { console.error("no obtuve access token"); process.exit(0); }
  const img = fs.readFileSync(imgPath);
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
    method: "POST", headers: { Authorization: `Bearer ${access}`, "content-type": "image/jpeg" }, body: img,
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 220);
    console.error(`thumbnails.set falló (${r.status}): ${t}`);
    if (r.status === 403) console.error("Posible: el canal Oddly necesita VERIFICACIÓN (teléfono) para miniaturas personalizadas.");
    process.exit(0); // best-effort: no tumbar el pipeline
  }
  console.log("✅ miniatura personalizada puesta en", videoId);
} catch (e) {
  console.error("set_thumbnail error:", e.message); process.exit(0);
}
