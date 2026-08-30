// list_private.mjs — imprime (CSV) los video_ids PRIVADOS SIN programar del canal (backlog por publicar).
// Excluye los que ya tienen publishAt futuro (programados) y los ocultos (channel/<hidden>.json si se pasa).
// Uso: node pipeline/list_private.mjs [hidden_r2_key]   (usa YT_* del canal; para Oddly el workflow mapea YT2_*)
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
const BUCKET = process.env.BUCKET || "video-forge";
const hiddenKey = process.argv[2] || "";
const tf = (u, o = {}, ms = 20000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

async function token() {
  const r = await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  const j = await r.json(); if (!j.access_token) { process.stderr.write("token fail\n"); process.exit(0); } return j.access_token;
}
const tok = await token(); const H = { Authorization: `Bearer ${tok}` };

let hidden = new Set();
if (hiddenKey && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN) {
  try { const r = await tf(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(hiddenKey)}`, { headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } }); if (r.ok) { const j = await r.json(); if (Array.isArray(j)) hidden = new Set(j); } } catch {}
}

const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
const up = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
if (!up) { process.stderr.write("no uploads playlist\n"); process.exit(0); }
let ids = [], page = "";
do { const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json(); ids.push(...(j.items || []).map((i) => i.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page && ids.length < 300);

const now = Date.now(); const out = [];
for (let i = 0; i < ids.length; i += 50) {
  const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
  for (const v of j.items || []) {
    const st = v.status || {};
    const sched = st.publishAt && Date.parse(st.publishAt) > now;
    if (st.privacyStatus !== "public" && !sched && !hidden.has(v.id)) out.push(v.id);
  }
}
process.stdout.write(out.join(","));
process.stderr.write(`\nprivados sin programar: ${out.length}\n`);
