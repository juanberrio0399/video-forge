// set_private.mjs — DESPUBLICA/desprograma un video: lo pone en PRIVADO en YouTube (reversible,
// NO borra). Poner privado tambien limpia el publishAt programado. Usa YT_* (para Oddly el
// workflow mapea YT2_* -> YT_*). Uso: node pipeline/set_private.mjs <video_id>
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const vid = (process.argv[2] || "").trim();
if (!vid) { console.error("falta video_id"); process.exit(1); }
const tf = (u, o = {}, ms = 20000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
const token = tr.access_token; if (!token) { console.error("token fail"); process.exit(1); }
const H = { Authorization: `Bearer ${token}` };

// Lee el video (confirmar que existe + su titulo/estado actual).
const g = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(vid)}`, { headers: H })).json();
const it = (g.items || [])[0];
if (!it) { console.error(`video no encontrado: ${vid}`); process.exit(1); }
const title = (it.snippet && it.snippet.title) || "";
const was = (it.status && it.status.privacyStatus) || "?";
if (was === "private") { console.log(`ya estaba PRIVADO: ${vid} — ${title}`); process.exit(0); }

const r = await tf("https://www.googleapis.com/youtube/v3/videos?part=status", {
  method: "PUT", headers: { ...H, "content-type": "application/json" },
  body: JSON.stringify({ id: vid, status: { privacyStatus: "private", selfDeclaredMadeForKids: false } }),
});
const j = await r.json();
if (r.ok && j.status && j.status.privacyStatus === "private") {
  console.log(`DESPUBLICADO (privado): ${vid} — ${title} (antes: ${was})`);
} else {
  console.error(`fallo (${r.status}): ${JSON.stringify(j).slice(0, 300)}`);
  process.exit(1);
}
