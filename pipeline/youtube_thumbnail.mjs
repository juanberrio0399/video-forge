// youtube_thumbnail.mjs — fija la miniatura de un video ya subido (thumbnails.set).
// Requiere scope youtube (el token ya lo tiene). Si el canal no permite miniaturas
// personalizadas (sin verificar), lo reporta pero NO rompe el flujo (exit 0).
// Uso: node pipeline/youtube_thumbnail.mjs <VIDEO_ID> <imagen.jpg>
import fs from "node:fs";

const [videoId, img] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!videoId || !img || !fs.existsSync(img)) { console.error("Falta VIDEO_ID o imagen"); process.exit(0); }

const tr = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
});
const token = (await tr.json()).access_token;
if (!token) { console.error("Sin access_token"); process.exit(0); }

const body = fs.readFileSync(img);
const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, body,
});
const j = await r.json().catch(() => ({}));
if (r.ok) { console.log("THUMB_OK: miniatura fijada en", videoId); }
else { console.error("THUMB_FAIL", r.status, JSON.stringify(j).slice(0, 300)); process.exit(0); }
