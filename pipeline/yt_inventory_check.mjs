// yt_inventory_check.mjs — Diagnóstico: compara cuántos videos ve el canal por la playlist "uploads"
// vs por search.list?forMine=true. Confirma el bug (los privados subidos directo NO están en uploads)
// y que el fix (search.forMine) SÍ los trae. Uso: node pipeline/yt_inventory_check.mjs
// Env: YT_CLIENT_ID/SECRET/REFRESH_TOKEN (Data Lens).
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const tok = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
const token = tok.access_token;
if (!token) { console.error("sin token:", JSON.stringify(tok)); process.exit(1); }
const H = { Authorization: `Bearer ${token}` };

// 1) Playlist de uploads
const ch = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
const up = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
const upIds = new Set();
let page = "";
do { const j = await (await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json(); (j.items || []).forEach((i) => upIds.add(i.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page && upIds.size < 200);

// 2) search.list?forMine=true (incluye privados)
const searchIds = new Set();
let sp = "", got = 0;
try { do { const s = await (await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&forMine=true&type=video&order=date&maxResults=50&pageToken=${sp}`, { headers: H })).json(); if (s.error) { console.error("search error:", JSON.stringify(s.error).slice(0, 200)); break; } (s.items || []).forEach((it) => it.id?.videoId && searchIds.add(it.id.videoId)); sp = s.nextPageToken || ""; got += (s.items || []).length; } while (sp && got < 150); } catch (e) { console.error("search excepción:", e.message); }

// 3) Los que SOLO están en search (privados que la playlist se pierde)
const onlySearch = [...searchIds].filter((id) => !upIds.has(id));
// Hidratar estado de los "solo search" para ver su privacy
let privados = 0, detalles = [];
for (let i = 0; i < onlySearch.length; i += 50) {
  const j = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${onlySearch.slice(i, i + 50).join(",")}`, { headers: H })).json();
  for (const v of j.items || []) { const pv = v.status?.privacyStatus; if (pv === "private") privados++; detalles.push(`${v.id} ${pv} ${(v.snippet.title || "").slice(0, 40)}`); }
}
console.log(`Playlist uploads: ${upIds.size} videos`);
console.log(`search.forMine:   ${searchIds.size} videos`);
console.log(`SOLO en search (los que la app se perdía): ${onlySearch.length} — de esos, PRIVADOS: ${privados}`);
console.log(detalles.slice(0, 20).map((d) => "  • " + d).join("\n"));
