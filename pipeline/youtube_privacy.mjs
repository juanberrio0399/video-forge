// youtube_privacy.mjs — cambia la privacidad de un video (private/unlisted/public).
// Uso: node pipeline/youtube_privacy.mjs <VIDEO_ID> <public|private|unlisted>
import fs from "node:fs";

const [videoId, privacy = "public"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!videoId) { console.error("Falta VIDEO_ID"); process.exit(1); }

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

const r = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({
    id: videoId,
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  }),
});
const j = await r.json();
if (!r.ok || !j.id) { console.error("Error:", r.status, JSON.stringify(j).slice(0, 400)); process.exit(1); }
console.log(`PRIVACY_SET=${j.status?.privacyStatus} VIDEO=${j.id}`);
fs.writeFileSync("privacy_result.txt", `✅ Video ahora ${j.status?.privacyStatus?.toUpperCase()}: https://youtu.be/${j.id}`);
