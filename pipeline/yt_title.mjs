// yt_title.mjs — imprime el titulo de un video de YouTube (para armar su miniatura).
// Uso: node pipeline/yt_title.mjs <VIDEO_ID>
const id = process.argv[2];
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!id) process.exit(0);
try {
  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const token = (await tr.json()).access_token;
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  process.stdout.write((j.items?.[0]?.snippet?.title || "").replace(/ #Shorts$/i, ""));
} catch { process.stdout.write(""); }
