// add_to_playlist.mjs — agrega un video a una playlist (la CREA si no existe) del canal
// cuyos tokens esten en YT_* (para Oddly, el workflow mapea YT2_* -> YT_*).
// Uso: node pipeline/add_to_playlist.mjs <VIDEO_ID> "<Titulo de la playlist>"
const [videoId, playlistTitle = "Mis Clips"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!videoId) { console.error("falta VIDEO_ID"); process.exit(1); }
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) { console.error("faltan credenciales YT (YT_CLIENT_ID/SECRET/REFRESH_TOKEN)"); process.exit(1); }

async function getToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error("token:", JSON.stringify(j)); process.exit(1); }
  return j.access_token;
}
const T = await getToken();
const H = { Authorization: `Bearer ${T}`, "content-type": "application/json" };
const want = playlistTitle.trim().toLowerCase();

async function findPlaylist() {
  let pageToken = "";
  do {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50${pageToken ? "&pageToken=" + pageToken : ""}`, { headers: H });
    const j = await r.json();
    const hit = (j.items || []).find((p) => (p.snippet.title || "").trim().toLowerCase() === want);
    if (hit) return hit.id;
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return null;
}

async function createPlaylist() {
  const r = await fetch("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", {
    method: "POST", headers: H,
    body: JSON.stringify({ snippet: { title: playlistTitle, description: "Clips subidos manualmente desde el bot de Telegram." }, status: { privacyStatus: "public" } }),
  });
  const j = await r.json();
  if (!j.id) { console.error("crear playlist:", JSON.stringify(j).slice(0, 300)); process.exit(1); }
  console.log("playlist creada:", j.id);
  return j.id;
}

let plId = await findPlaylist();
if (!plId) plId = await createPlaylist();

const ins = await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
  method: "POST", headers: H,
  body: JSON.stringify({ snippet: { playlistId: plId, resourceId: { kind: "youtube#video", videoId } } }),
});
const ij = await ins.json();
if (ij.id) console.log(`agregado a "${playlistTitle}" (${plId})`);
else { console.error("insert:", JSON.stringify(ij).slice(0, 300)); process.exit(1); }
