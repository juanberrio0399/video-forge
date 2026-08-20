// manage_playlists.mjs <data-lens|auto2>
// Crea UNA playlist de YouTube por subcategoria y agrega cada video del canal a la suya.
// - Idempotente: no re-agrega lo ya agregado (lleva registro en playlists.json).
// - Cuota-seguro: tope de inserts por corrida (PLAYLIST_MAX, default 60). Se completa en varias
//   corridas (el cron diario va terminando lo pendiente + lo nuevo). Cada insert cuesta 50 unidades.
// La categoria se infiere del titulo (o se respeta el niche_map de Oddly si ya lo tiene).
// El workflow baja/sube playlists.json (y niche_map.json de Oddly) a R2.
import fs from "node:fs";

const CH = process.argv[2] === "auto2" ? "auto2" : "data-lens";
const A2 = CH === "auto2";
const MAX = Math.max(1, parseInt(process.env.PLAYLIST_MAX || "60", 10) || 60);
const CID = A2 ? process.env.YT2_CLIENT_ID : process.env.YT_CLIENT_ID;
const CSEC = A2 ? process.env.YT2_CLIENT_SECRET : process.env.YT_CLIENT_SECRET;
const RTOK = A2 ? process.env.YT2_REFRESH_TOKEN : process.env.YT_REFRESH_TOKEN;
if (!CID || !CSEC || !RTOK) { console.error("Faltan credenciales YT del canal", CH); process.exit(1); }

// Subcategorias por canal (key -> titulo publico de la playlist)
const CATS = A2
  ? { satisfying: "Satisfying / ASMR", narrativas: "Narrativas", ciencia_humor: "Ciencia + humor", naturaleza_relax: "Naturaleza / Relax", animales_tiernos: "Animales tiernos / ASMR", graciosos: "Graciosos / Fails", remix: "Remix" }
  : { big_tech: "Big Tech · Como ganan dinero las empresas", creator_economy: "Creator Economy · Cuanto pagan las plataformas", costos_ocultos: "Costos ocultos · A donde va tu dinero", dinero_mercados: "Dinero y mercados" };

// Inferencia de nicho por titulo (misma logica que el resto del sistema)
function oddlyNiche(t) { t = (t || "").toLowerCase();
  if (/satisfying|slime|kinetic|hydraulic|soap|paint|resin|\bsand\b|oddly sat|asmr/.test(t)) return "satisfying";
  if (/deep sleep|relax|nature|rain|ocean|forest|\bcalm\b|10 hours|for sleep|sleep/.test(t)) return "naturaleza_relax";
  if (/your brain|your body|\bscience\b|neuron|immune|weirdly|\bfact/.test(t)) return "ciencia_humor";
  if (/\bshe\b|\bhe\b|\bher\b|\bhis\b|story|secret|faked|cheat|affair|\btext\b|ghost|betray|caught|revenge/.test(t)) return "narrativas";
  return "satisfying"; }
function dlNiche(t) { t = (t || "").toLowerCase();
  if (/1 ?million|1,000,000|views? (pay|pays)|per view|creator|youtuber|\breels?\b|tiktok|spotify|roblox|devex|payout|monetiz/.test(t)) return "creator_economy";
  if (/where your|actually goes|hidden|really costs|\bcut\b|dirty|\bscam\b|\btax\b|\$\d/.test(t)) return "costos_ocultos";
  if (/inflation|interest rate|\bfed\b|\bmarket\b|\beconomy\b|every second|money supply|recession/.test(t)) return "dinero_mercados";
  if (/google|netflix|mcdonald|apple|amazon|uber|tesla|microsoft|openai|\bmeta\b|snapchat|instagram|nvidia|disney|costco|how .* makes/.test(t)) return "big_tech";
  return "big_tech"; }
const nicheOf = A2 ? oddlyNiche : dlNiche;

const tf = (u, o = {}) => fetch(u, o);
async function token() {
  const r = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CID, client_secret: CSEC, refresh_token: RTOK, grant_type: "refresh_token" }) })).json();
  if (!r.access_token) { console.error("token fail", JSON.stringify(r).slice(0, 200)); process.exit(1); }
  return r.access_token;
}
const AT = await token();
const H = { Authorization: `Bearer ${AT}`, "content-type": "application/json" };

// Todos los videos del canal (id + titulo) via la playlist de subidas
async function myVideos() {
  const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: H })).json();
  const up = ch.items && ch.items[0] && ch.items[0].contentDetails && ch.items[0].contentDetails.relatedPlaylists && ch.items[0].contentDetails.relatedPlaylists.uploads;
  if (!up) return [];
  const out = []; let page = "";
  do {
    const j = await (await tf(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json();
    (j.items || []).forEach((i) => out.push({ video_id: i.contentDetails.videoId, title: (i.snippet && i.snippet.title) || "" }));
    page = j.nextPageToken || "";
  } while (page && out.length < 500);
  return out;
}

// niche_map de Oddly (si existe local) para respetar la categoria ya asignada por la produccion
let nicheMap = {}; if (A2) { try { nicheMap = JSON.parse(fs.readFileSync("niche_map.json", "utf8")); } catch {} }

// Estado persistente: { map: categoria->playlist_id, added: ["cat|video_id"...] }
let PL = { map: {}, added: [] };
try { const p = JSON.parse(fs.readFileSync("playlists.json", "utf8")); PL.map = p.map || {}; PL.added = p.added || []; } catch {}
const addedSet = new Set(PL.added);

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
PL.titles = PL.titles || {};
async function ensurePlaylist(cat) {
  const want = CATS[cat] || cat;
  if (PL.map[cat]) {
    // Auto-sanacion: si el titulo guardado no coincide (p.ej. una playlist vieja "undefined"), renombrar.
    if (PL.titles[cat] !== want) {
      const r = await tf("https://www.googleapis.com/youtube/v3/playlists?part=snippet", { method: "PUT", headers: H, body: JSON.stringify({ id: PL.map[cat], snippet: { title: want, description: "Playlist por categoria (automatica)." } }) });
      if (r.ok) { PL.titles[cat] = want; console.log(`~ playlist renombrada -> ${want}`); }
    }
    return PL.map[cat];
  }
  const body = { snippet: { title: want, description: "Playlist por categoria (automatica)." }, status: { privacyStatus: "public" } };
  const r = await (await tf("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", { method: "POST", headers: H, body: JSON.stringify(body) })).json();
  if (!r.id) { console.error("no pude crear playlist", cat, JSON.stringify(r).slice(0, 200)); return null; }
  PL.map[cat] = r.id; PL.titles[cat] = want; console.log(`+ playlist creada: ${want} -> ${r.id}`); return r.id;
}
async function addToPlaylist(plid, vid) {
  const body = { snippet: { playlistId: plid, resourceId: { kind: "youtube#video", videoId: vid } } };
  // Reintenta en SERVICE_UNAVAILABLE (503): una playlist recien creada tarda un momento en estar lista.
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await tf("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", { method: "POST", headers: H, body: JSON.stringify(body) });
    if (r.ok) return true;
    const e = await r.json().catch(() => ({}));
    const reason = (e.error && e.error.errors && e.error.errors[0] && e.error.errors[0].reason) || r.status;
    if (reason === "quotaExceeded") return "quota";
    if ((reason === "SERVICE_UNAVAILABLE" || reason === 503 || reason === 500) && attempt < 2) { await sleep(2000); continue; }
    console.error(`  no pude agregar ${vid}: ${reason}`);
    return false;
  }
  return false;
}

const vids = await myVideos();
const catOf = (v) => (A2 && nicheMap[v.video_id]) ? nicheMap[v.video_id] : nicheOf(v.title);
console.log(`${CH}: ${vids.length} videos en el canal · tope de esta corrida: ${MAX} inserts.`);
let inserted = 0, skipped = 0;
for (const v of vids) {
  const cat = catOf(v);
  const key = cat + "|" + v.video_id;
  if (addedSet.has(key)) { skipped++; continue; }
  if (inserted >= MAX) break;
  const plid = await ensurePlaylist(cat); if (!plid) continue;
  const ok = await addToPlaylist(plid, v.video_id);
  if (ok === "quota") { console.log("Cuota agotada; sigo en la proxima corrida."); break; }
  if (ok) { addedSet.add(key); inserted++; }
}
PL.added = [...addedSet];
fs.writeFileSync("playlists.json", JSON.stringify(PL, null, 0));
const pending = vids.filter((v) => !addedSet.has(catOf(v) + "|" + v.video_id)).length;
const dist = {}; vids.forEach((v) => { const c = catOf(v); dist[c] = (dist[c] || 0) + 1; });
console.log(`✓ ${CH}: +${inserted} agregados · ${skipped} ya estaban · playlists: ${Object.keys(PL.map).length} · pendientes: ${pending}`);
console.log(`  distribucion: ${Object.entries(dist).map(([k, n]) => `${CATS[k] || k}=${n}`).join(" · ")}`);
