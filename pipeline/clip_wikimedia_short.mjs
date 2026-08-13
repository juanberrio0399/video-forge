// clip_wikimedia_short.mjs — CLIPEADOR desde Wikimedia Commons (biblioteca ENORME, CC/PD, con
// descarga DIRECTA confiable). Busca videos, VERIFICA la licencia (solo CC0 / CC-BY / dominio
// público; rechaza SA/NC/ND), descarga, la IA elige el mejor momento -> SHORT 9:16 + atribución.
//
// Uso: node pipeline/clip_wikimedia_short.mjs "<tema>" <categoria> <out.mp4>
// Env: GEMINI_API_KEY(,2). music.mp3 opcional.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf } from "./clip_frame.mjs";

const [topic, niche = "graciosos", outPath = "short.mp4"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const W = 1080, H = 1920, CLIP = 32;
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, headers: { "user-agent": "video-forge/1.0 (educational)", ...(o.headers || {}) }, signal: AbortSignal.timeout(ms) });
const work = "clipwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const strip = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// 1) Buscar videos + su licencia/atribución.
console.log(`Buscando en Wikimedia Commons: "${topic}"…`);
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&generator=search&gsrsearch=${encodeURIComponent(topic + " filetype:video")}&gsrnamespace=6&gsrlimit=25&iiprop=url|size|extmetadata`;
const j = await (await tf(api)).json();
const pages = Object.values((j.query && j.query.pages) || {});
let src = null;
for (const p of pages) {
  const ii = (p.imageinfo || [])[0]; if (!ii) continue;
  const em = ii.extmetadata || {};
  const lic = (em.LicenseShortName && em.LicenseShortName.value || "").toLowerCase();
  const ok = /cc0|public domain/.test(lic) || (/cc.?by/.test(lic) && !/sa|nc|nd/.test(lic));
  if (!ok) continue;
  if (+(ii.size || 0) < 1e6) continue; // saltar miniaturas/archivos triviales
  const author = strip(em.Artist && em.Artist.value) || "Wikimedia Commons";
  const licKey = /cc0/.test(lic) ? "cc0" : (/public domain/.test(lic) ? "public-domain" : "cc-by");
  src = { url: ii.url, title: (p.title || "").replace(/^File:/, ""), author, licKey, licName: em.LicenseShortName && em.LicenseShortName.value || lic };
  break;
}
if (!src) { console.error("Wikimedia: sin video con licencia usable (CC0/CC-BY/PD)"); process.exit(1); }
console.log(`Elegido: "${src.title}" · ${src.author} · ${src.licName}`);
const attribution = `${src.title} · ${src.author} · Wikimedia Commons · ${src.licName}`;

// 2) Descargar (directo, confiable). Puede ser .webm/.ogv/.mp4 -> ffmpeg lo maneja.
const film = `${work}/film`;
const r = await tf(src.url, {}, 600000);
if (!r.ok) { console.error("descarga falló " + r.status); process.exit(1); }
fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
if (dur < 6) { console.error("video muy corto"); process.exit(1); }

// 3) Miniaturas + IA (adaptativo a la duración).
const a0 = dur * 0.06, a1 = Math.max(a0 + 1, dur * 0.9), N = Math.min(14, Math.max(3, Math.floor(dur / 4))), step = (a1 - a0) / N, thumbs = [];
for (let i = 0; i < N; i++) { const t = Math.round(a0 + i * step), p = `${work}/th${i}.jpg`; try { execSync(`ffmpeg -y -ss ${t} -i "${film}" -frames:v 1 -vf "scale=320:-1" "${p}"`, { stdio: "ignore" }); if (fs.existsSync(p)) thumbs.push({ t, p }); } catch {} }
async function pick() {
  if (!KEYS.length || !thumbs.length) return null;
  const parts = [{ text: `Editor de SHORTS virales. Miniaturas del video "${src.title}" (tema: ${topic}) con timestamp (s). Elige el momento MÁS impactante/viral. Devuelve SOLO JSON: {"start": <s, menos 3>, "title": "título EN inglés de alto CTR (<=60)", "subject_x": <0.0 a 1.0: posición horizontal del sujeto principal>}.` }];
  thumbs.forEach((th) => { parts.push({ text: `t=${th.t}s` }); parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(th.p).toString("base64") } }); });
  for (let x = 0; x < 2; x++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) { try { const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }) }); if (!res.ok) continue; const jj = await res.json(); const t = (jj?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim(); if (t) return JSON.parse(t); } catch {} }
  return null;
}
let mo = await pick(); if (!mo || !isFinite(+mo.start)) mo = { start: Math.round(dur * 0.35), title: src.title.slice(0, 60) };
const clipLen = Math.min(CLIP, Math.max(6, dur - 1));
const start = Math.max(0, Math.min(+mo.start, dur - clipLen));

// 4) Corte PRECISO + 9:16 profesional con sujeto centrado (smart crop) + música.
const { w: srcW, h: srcH } = sourceWH(film);
const sx = isFinite(+mo.subject_x) ? +mo.subject_x : 0.5;
const vf = smartCropVf(W, H, srcW, srcH, sx, "eq=contrast=1.06:saturation=1.06");
const pre = Math.max(0, start - 3), fine = (start - pre).toFixed(2), silent = `${work}/silent.mp4`;
execSync(`ffmpeg -y -ss ${pre} -i "${film}" -ss ${fine} -t ${clipLen} -vf "${vf}" -an -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p "${silent}"`, { stdio: "inherit" });
if (fs.existsSync("music.mp3")) execSync(`ffmpeg -y -i "${silent}" -stream_loop -1 -i music.mp3 -filter_complex "[1:a]volume=0.5,afade=t=in:st=0:d=1[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
else execSync(`ffmpeg -y -i "${silent}" -map 0:v -an -c:v copy "${outPath}"`, { stdio: "inherit" });

fs.mkdirSync("publish", { recursive: true });
const credited = src.licKey === "cc-by";
const pkg = { title: (mo.title || src.title).slice(0, 92) + " #Shorts", description: `#Shorts\n\n${credited ? "Credit: " + attribution + " (edited/clipped)." : "Source: " + src.title + " — Wikimedia Commons (" + src.licName + ")."}`, tags: ["shorts", niche, "creative commons"], language: "en" };
fs.writeFileSync("publish/package.json", JSON.stringify(pkg, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({ niche, format: "9:16", clips: [{ clip_id: "wm1", source: "wikimedia", license: src.licKey, url: src.url, attribution: credited ? attribution : "", query: topic }], transform: { narration: false, editing: true, original_script: true, sound_design: true } }, null, 2));
console.log(`Short Wikimedia listo -> ${outPath} · "${pkg.title}"`);
