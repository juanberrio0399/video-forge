// clip_archive_cc_short.mjs — CLIPEADOR desde Internet Archive (archive.org) en sus colecciones de
// COMUNIDAD con licencia LIBRE: CC0 / CC-BY / dominio público. Archive PERMITE la descarga directa
// (nada de evasión), y aloja mucho material gracioso/viral (animales, bloopers, fails) CON su audio
// original. Busca por popularidad (descargas), VERIFICA la licencia por ítem (rechaza SA/NC/ND),
// la IA elige el mejor momento -> SHORT 9:16 conservando el AUDIO ORIGINAL + atribución (CC-BY).
//
// Uso: node pipeline/clip_archive_cc_short.mjs "<tema>" <categoria> <out.mp4>
// Env: GEMINI_API_KEY(,2). music.mp3 opcional.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf, finishClip } from "./clip_frame.mjs";

const [topic, niche = "graciosos", outPath = "short.mp4"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const W = 1080, H = 1920, CLIP = 32;
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, headers: { "user-agent": "video-forge/1.0 (educational)", ...(o.headers || {}) }, signal: AbortSignal.timeout(ms) });
const work = "clipwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();

// Traducir licenseurl -> clave usable (o null si NO sirve: SA/NC/ND).
function licFromUrl(u) {
  u = (Array.isArray(u) ? u[0] : u || "").toLowerCase();
  if (/publicdomain\/zero|\/cc0/.test(u)) return "cc0";
  if (/\/by-sa|\/by-nc|\/by-nd/.test(u)) return null;         // share-alike / no-comercial / no-derivadas
  if (/\/licenses\/by(\/|$)/.test(u)) return "cc-by";          // CC-BY: atribución obligatoria
  if (/publicdomain\/mark|\/publicdomain(\/|$)/.test(u)) return "public-domain";
  return null;
}

// 1) Buscar en Archive.org SOLO ítems con licencia Creative Commons. Primero por TÍTULO (más
// relevante: evita que un match de texto suelto traiga cine viejo), luego texto amplio de respaldo.
console.log(`Buscando CC en Archive.org: "${topic}"…`);
async function search(qstr) {
  const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(qstr)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=creator&sort[]=downloads+desc&rows=60&output=json`;
  try { const jj = await (await tf(u)).json(); return (jj.response && jj.response.docs) || []; } catch { return []; }
}
// Excluir colecciones de cine viejo/archivo clásico -> nos quedamos con subidas de COMUNIDAD (recientes).
const cc = `mediatype:movies AND licenseurl:(*creativecommons* OR *publicdomain*) AND NOT collection:(feature_films OR classic_tv OR sci-fi_horror OR film_noir OR silent_films OR classic_cartoons OR prelinger OR animationandcartoons OR classic_you_tube)`;
let docs = await search(`title:(${topic}) AND ${cc}`);        // 1º: el tema en el TÍTULO (relevante)
if (docs.length < 5) docs = docs.concat(await search(`(${topic}) AND ${cc}`)); // respaldo: texto amplio
if (!docs.length) { console.error("Archive.org CC: sin resultados para ese tema"); process.exit(1); }

// 2) Elegir el primer ítem con licencia USABLE + un mp4 descargable de tamaño razonable.
let src = null, mp4 = null;
for (const d of docs) {
  const licKey = licFromUrl(d.licenseurl);
  if (!licKey) continue;
  try {
    const meta = await (await tf(`https://archive.org/metadata/${d.identifier}`)).json();
    const files = (meta.files || []).filter((f) => /\.mp4$/i.test(f.name) && +(f.size || 0) > 2e6).sort((a, b) => +a.size - +b.size);
    if (!files.length) continue;
    const f = files[Math.floor(files.length / 2)]; // tamaño medio: suficiente y rápido
    const creator = (Array.isArray(d.creator) ? d.creator[0] : d.creator) || (meta.metadata && meta.metadata.creator) || "Internet Archive";
    src = { id: d.identifier, title: (Array.isArray(d.title) ? d.title[0] : d.title) || topic, creator, licKey };
    mp4 = `https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name)}`;
    break;
  } catch {}
}
if (!mp4) { console.error("Archive.org CC: sin ítem con licencia usable + mp4 descargable"); process.exit(1); }
const credited = src.licKey === "cc-by";
const attribution = `${src.title} · ${src.creator} · https://archive.org/details/${src.id} · ${src.licKey.toUpperCase()}`;
console.log(`Elegido: "${src.title}" · ${src.creator} · ${src.licKey}`);

// 3) Descargar directo (Archive permite la descarga; sin yt-dlp, sin evasión).
const film = `${work}/film.mp4`;
const r = await tf(mp4, {}, 600000);
if (!r.ok) { console.error("descarga Archive falló " + r.status); process.exit(1); }
fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
if (dur < 5) { console.error("clip muy corto/ilegible"); process.exit(1); }

// 4) Miniaturas + IA elige el mejor momento (adaptativo a la duración).
const a0 = dur * 0.06, a1 = Math.max(a0 + 1, dur * 0.92), N = Math.min(16, Math.max(3, Math.floor(dur / 4))), step = (a1 - a0) / N, thumbs = [];
for (let i = 0; i < N; i++) { const t = Math.round(a0 + i * step), p = `${work}/th${i}.jpg`; try { execSync(`ffmpeg -y -ss ${t} -i "${film}" -frames:v 1 -vf "scale=320:-1" "${p}"`, { stdio: "ignore" }); if (fs.existsSync(p)) thumbs.push({ t, p }); } catch {} }
async function pick() {
  if (!KEYS.length || !thumbs.length) return null;
  const parts = [{ text: `Editor de SHORTS virales. Miniaturas del video "${src.title}" (tema: ${topic}) con timestamp (s). Elige el momento MÁS impactante/gracioso/viral (lo que la gente compartiría hoy). Devuelve SOLO JSON: {"start": <s, del elegido menos 3>, "title": "título EN inglés de alto CTR (<=60)", "subject_x": <0.0 a 1.0: posición horizontal del sujeto principal>}.` }];
  thumbs.forEach((th) => { parts.push({ text: `t=${th.t}s` }); parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(th.p).toString("base64") } }); });
  for (let x = 0; x < 2; x++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) { try { const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }) }); if (!res.ok) continue; const jj = await res.json(); const t = (jj?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim(); if (t) { try { const p = JSON.parse(t); if (p && isFinite(+p.start)) return p; } catch {} } } catch {} }
  return null;
}
let mo = await pick(); if (!mo || !isFinite(+mo.start)) mo = { start: Math.round(dur * 0.35), title: src.title.slice(0, 60) };
const clipLen = Math.min(CLIP, Math.max(5, dur - 0.5));
const start = Math.max(0, Math.min(+mo.start, dur - clipLen));

// 5) Corte PRECISO + 9:16 con sujeto centrado (smart crop), conservando el AUDIO ORIGINAL.
const { w: srcW, h: srcH } = sourceWH(film);
const sx = isFinite(+mo.subject_x) ? +mo.subject_x : 0.5;
const vf = smartCropVf(W, H, srcW, srcH, sx, "eq=contrast=1.06:saturation=1.06");
const pre = Math.max(0, start - 3), fine = (start - pre).toFixed(2), raw = `${work}/raw.mp4`;
execSync(`ffmpeg -y -ss ${pre} -i "${film}" -ss ${fine} -t ${clipLen} -vf "${vf}" -r 30 -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 160k "${raw}"`, { stdio: "inherit" });
const hadAudio = finishClip(raw, outPath);
console.log("audio original: " + (hadAudio ? "sí" : "no (solo música)"));

// 6) Paquete + manifiesto (CC-BY exige atribución; la puerta de compliance lo valida).
fs.mkdirSync("publish", { recursive: true });
const pkg = { title: (mo.title || src.title).slice(0, 92) + " #Shorts", description: `#Shorts\n\n${credited ? "Credit: " + attribution + " (edited/clipped)." : "Source: " + src.title + " — Internet Archive (" + src.licKey + ")."}`, tags: ["shorts", niche, "creative commons"], language: "en" };
fs.writeFileSync("publish/package.json", JSON.stringify(pkg, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({ niche, format: "9:16", clips: [{ clip_id: "ac1", source: "archive_cc", license: src.licKey, url: `https://archive.org/details/${src.id}`, attribution: credited ? attribution : "", query: topic }], transform: { narration: false, original_audio: hadAudio, editing: true, original_script: true, sound_design: true } }, null, 2));
console.log(`Short Archive CC listo -> ${outPath} · "${pkg.title}"`);
