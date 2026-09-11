// episodes.mjs — Episodic Memory (Fase 2). Construye un episodio por video desde el inventario del
// canal (el que ya vive en R2) + baseline por-video (mediana de vpd), y escribe episodes.json.
// El workflow lo sube a channel/episodes.json (Data Lens) o channel/auto2/episodes.json (Oddly).
// Uso: node pipeline/episodes.mjs <inventarioR2.json> <salida.json>
import fs from "node:fs";
import { medianVpd, buildEpisode } from "./lib/episode_calc.mjs";

const src = process.argv[2];
const out = process.argv[3] || "episodes.json";
let data = {};
try { data = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error("episodes: no pude leer", src, "-", e.message); process.exit(0); }

// Normaliza el inventario: Data Lens = { longs, shorts }; Oddly = { list }.
let videos = [];
if (Array.isArray(data.longs) || Array.isArray(data.shorts)) videos = [...(data.longs || []), ...(data.shorts || [])];
else if (Array.isArray(data.list)) videos = data.list;
videos = videos.filter((v) => v && v.video_id);

const now = Date.now();
const medVpd = medianVpd(videos, now);
const episodes = videos.map((v) => buildEpisode(v, medVpd, now));
fs.writeFileSync(out, JSON.stringify({ at: new Date(now).toISOString(), median_vpd: medVpd, count: episodes.length, episodes }, null, 2));
console.log(`episodes: ${episodes.length} episodios, mediana vpd ${medVpd} -> ${out}`);
