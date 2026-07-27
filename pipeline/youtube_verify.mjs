// youtube_verify.mjs — confirma DONDE quedo un video (canal + privacidad).
// Consulta la YouTube Data API con el refresh token y compara el canal contra el
// esperado (The Data Lens). Imprime lineas VERIFY_* que el workflow manda al chat.
//
// Uso: node pipeline/youtube_verify.mjs <VIDEO_ID>
import fs from "node:fs";

const VIDEO_ID = process.argv[2];
const EXPECTED_CHANNEL = "UC9GknJ4bZpgJc6lMmySoQEw"; // The Data Lens
const EXPECTED_NAME = "The Data Lens";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;

if (!VIDEO_ID) { console.error("Falta el VIDEO_ID"); process.exit(1); }
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  console.error("Faltan secrets YT_*"); process.exit(1);
}

async function getAccessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
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
const r = await fetch(
  `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${VIDEO_ID}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const j = await r.json();
const v = (j.items || [])[0];
if (!v) { console.error("No encontre el video (¿ID malo o de otra cuenta?):", JSON.stringify(j).slice(0, 300)); process.exit(1); }

const channelId = v.snippet.channelId;
const channelTitle = v.snippet.channelTitle;
const privacy = v.status.privacyStatus;
const title = v.snippet.title;
const ok = channelId === EXPECTED_CHANNEL;

console.log("VERIFY_CHANNEL_ID=" + channelId);
console.log("VERIFY_CHANNEL_TITLE=" + channelTitle);
console.log("VERIFY_PRIVACY=" + privacy);
console.log("VERIFY_TITLE=" + title);
console.log("VERIFY_OK=" + (ok ? "1" : "0"));

const msg = ok
  ? `✅ Verificado: el video quedó en el canal correcto — *${channelTitle}* (${EXPECTED_NAME}).\n🔒 Privacidad: ${privacy}.\n🏷️ ${title}\n🔗 https://youtu.be/${VIDEO_ID}`
  : `⚠️ OJO: el video quedó en *${channelTitle}* (${channelId}), NO en ${EXPECTED_NAME} (${EXPECTED_CHANNEL}). Privacidad: ${privacy}. Revisa qué cuenta autorizó el OAuth.`;
fs.writeFileSync("verify_msg.txt", msg);
console.log("---\n" + msg);
