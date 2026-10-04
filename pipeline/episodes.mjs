// episodes.mjs — Episodic Memory (Fase 2). Construye un episodio por video desde el inventario del
// canal (el que ya vive en R2) + baseline por-video (mediana de vpd), y escribe episodes.json.
// El workflow lo sube a channel/episodes.json (Data Lens) o channel/auto2/episodes.json (Oddly).
// Uso: node pipeline/episodes.mjs <inventarioR2.json> <salida.json> [niche_map.json]
import fs from "node:fs";
import { medianVpd, buildEpisode } from "./lib/episode_calc.mjs";
import { anotarVideos } from "./lib/niche_map.mjs";

const src = process.argv[2];
const out = process.argv[3] || "episodes.json";
let data = {};
try { data = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error("episodes: no pude leer", src, "-", e.message); process.exit(0); }

// Normaliza el inventario, que llega en TRES formas distintas:
//   - cache del bot (channel/inventory_cache.json): { longs, shorts }
//   - estado de Data Lens (channel/state.json):     { published, shorts }  <- stats anidados
//   - estado de Oddly   (channel/auto2/state.json): { list }
//
// La forma de `state.json` hacia falta porque el cache del bot NO es una fuente fiable: lo
// escribe el Worker de Telegram solo cuando alguien abre la app, y SIETE workflows lo borran
// a proposito para forzar refresco. Resultado: `episodes.mjs` leia un archivo ausente, sacaba
// 0 episodios, y el workflow restauraba la copia vieja de R2. Todo el analisis de Data Lens
// (scores, A/B, alertas) llevaba 11 dias congelado, y la alerta "Pipeline parado" medi­a la
// edad del DATO, no la del canal.
function aplanar(v) {
  if (!v) return v;
  const st = v.stats || {};
  return {
    ...v,
    views: v.views != null ? v.views : (st.views || 0),
    likes: v.likes != null ? v.likes : (st.likes || 0),
    comments: v.comments != null ? v.comments : (st.comments || 0),
  };
}

let videos = [];
if (Array.isArray(data.published)) videos = [...(data.published || []), ...(data.shorts || [])];
else if (Array.isArray(data.longs) || Array.isArray(data.shorts)) videos = [...(data.longs || []), ...(data.shorts || [])];
else if (Array.isArray(data.list)) videos = data.list;
videos = videos.map(aplanar).filter((v) => v && v.video_id);
// Un video puede estar en `published` y en `shorts` a la vez: nos quedamos con uno.
const vistos = new Set();
videos = videos.filter((v) => (vistos.has(v.video_id) ? false : (vistos.add(v.video_id), true)));

// Mapa video -> categoria/variante (solo Oddly lo tiene). Sin el, los episodios salen
// igual que antes pero sin variante: el A/B de formato simplemente no mide, no falla.
const mapaF = process.argv[4];
let mapa = {};
if (mapaF) { try { mapa = JSON.parse(fs.readFileSync(mapaF, "utf8")); } catch { mapa = {}; } }
videos = anotarVideos(videos, mapa);

const now = Date.now();
const medVpd = medianVpd(videos, now);
const episodes = videos.map((v) => buildEpisode(v, medVpd, now));
fs.writeFileSync(out, JSON.stringify({ at: new Date(now).toISOString(), median_vpd: medVpd, count: episodes.length, episodes }, null, 2));
console.log(`episodes: ${episodes.length} episodios, mediana vpd ${medVpd} -> ${out}`);
