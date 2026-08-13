// clip_pexels_short.mjs — CLIPEADOR desde Pexels (API oficial, descarga DIRECTA de mp4, sin yt-dlp
// ni bloqueo). Pexels License: libre, comercial, SIN atribución. Busca por tema, la IA elige el
// mejor momento -> SHORT 9:16 conservando el AUDIO ORIGINAL del clip (o música si es mudo).
//
// Uso: node pipeline/clip_pexels_short.mjs "<tema>" <categoria> <out.mp4>
// Env: PEXELS_API_KEY, GEMINI_API_KEY(,2). music.mp3 opcional.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf, finishClip } from "./clip_frame.mjs";

const [topic, niche = "graciosos", outPath = "short.mp4"] = process.argv.slice(2);
const KEY = process.env.PEXELS_API_KEY;
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const W = 1080, H = 1920, CLIP = 30;
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const work = "clipwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();
if (!KEY) { console.error("Falta PEXELS_API_KEY (gratis en pexels.com/api)."); process.exit(3); }

// 1) Buscar en Pexels (populares). Elegir un video con duración usable + mp4 <=1080.
console.log(`Buscando en Pexels: "${topic}"…`);
const api = `https://api.pexels.com/videos/search?query=${encodeURIComponent(topic)}&per_page=40&orientation=landscape`;
const j = await (await tf(api, { headers: { Authorization: KEY } })).json();
const vids = (j.videos || []).filter((v) => (v.duration || 0) >= 4 && (v.duration || 0) <= 300);
if (!vids.length) { console.error("Pexels: sin resultados usables"); process.exit(1); }
let src = null, mp4 = null;
for (const v of vids) {
  const files = (v.video_files || []).filter((f) => f.link && /mp4/i.test(f.file_type || f.link));
  const le1080 = files.filter((f) => (f.width || 0) <= 1080 && (f.width || 0) > 0).sort((a, b) => b.width - a.width);
  const pick = le1080[0] || files.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  if (pick) { src = v; mp4 = pick.link; break; }
}
if (!mp4) { console.error("Pexels: sin mp4 directo"); process.exit(1); }
const vtitle = ((src.url || "").split("/").filter(Boolean).pop() || topic).replace(/-\d+$/, "").replace(/-/g, " ").trim() || topic;
const author = (src.user || {}).name || "Pexels";
console.log(`Elegido: "${vtitle}" · ${author} · Pexels #${src.id} · ${src.duration}s`);

// 2) Descargar directo (mp4, sin yt-dlp).
const film = `${work}/film.mp4`;
const r = await tf(mp4, {}, 600000);
if (!r.ok) { console.error("descarga Pexels falló " + r.status); process.exit(1); }
fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
if (dur < 4) { console.error("clip muy corto"); process.exit(1); }

// 3) Miniaturas + IA elige el mejor momento.
const a0 = dur * 0.05, a1 = Math.max(a0 + 1, dur * 0.92), N = Math.min(12, Math.max(3, Math.floor(dur / 3))), step = (a1 - a0) / N, thumbs = [];
for (let i = 0; i < N; i++) { const t = Math.round(a0 + i * step), p = `${work}/th${i}.jpg`; try { execSync(`ffmpeg -y -ss ${t} -i "${film}" -frames:v 1 -vf "scale=320:-1" "${p}"`, { stdio: "ignore" }); if (fs.existsSync(p)) thumbs.push({ t, p }); } catch {} }
async function pick() {
  if (!KEYS.length || !thumbs.length) return null;
  const parts = [{ text: `Editor de SHORTS virales. Miniaturas del video "${vtitle}" (tema: ${topic}) con timestamp (s). Elige el momento MÁS impactante/gracioso/satisfactorio. Devuelve SOLO JSON: {"start": <s, menos 2>, "title": "título EN inglés de alto CTR (<=60)", "subject_x": <0.0 a 1.0: posición horizontal del sujeto principal>}.` }];
  thumbs.forEach((th) => { parts.push({ text: `t=${th.t}s` }); parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(th.p).toString("base64") } }); });
  for (let x = 0; x < 2; x++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) { try { const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }) }); if (!res.ok) continue; const jj = await res.json(); const t = (jj?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim(); if (t) return JSON.parse(t); } catch {} }
  return null;
}
let mo = await pick(); if (!mo || !isFinite(+mo.start)) mo = { start: Math.round(dur * 0.3), title: vtitle.slice(0, 60) };
const clipLen = Math.min(CLIP, Math.max(4, dur - 0.5));
const start = Math.max(0, Math.min(+mo.start, dur - clipLen));

// 4) Corte PRECISO + 9:16 con sujeto centrado (smart crop), conservando el AUDIO ORIGINAL.
const { w: srcW, h: srcH } = sourceWH(film);
const sx = isFinite(+mo.subject_x) ? +mo.subject_x : 0.5;
const vf = smartCropVf(W, H, srcW, srcH, sx, "eq=contrast=1.06:saturation=1.06");
const pre = Math.max(0, start - 3), fine = (start - pre).toFixed(2), raw = `${work}/raw.mp4`;
execSync(`ffmpeg -y -ss ${pre} -i "${film}" -ss ${fine} -t ${clipLen} -vf "${vf}" -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 160k "${raw}"`, { stdio: "inherit" });
const hadAudio = finishClip(raw, outPath);
console.log("audio original: " + (hadAudio ? "sí" : "no (solo música)"));

// 5) Paquete + manifiesto (licencia Pexels: sin atribución obligatoria; crédito discreto).
fs.mkdirSync("publish", { recursive: true });
const pkg = { title: (mo.title || vtitle).slice(0, 92) + " #Shorts", description: `#Shorts\n\nSource: Pexels — ${author} (Pexels License). Edited/clipped.`, tags: ["shorts", niche, "funny"], language: "en" };
fs.writeFileSync("publish/package.json", JSON.stringify(pkg, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({ niche, format: "9:16", clips: [{ clip_id: "pe1", source: "pexels", license: "pexels", url: src.url || `https://www.pexels.com/video/${src.id}/`, query: topic }], transform: { narration: false, original_audio: hadAudio, editing: true, original_script: true, sound_design: true } }, null, 2));
console.log(`Short Pexels listo -> ${outPath} · "${pkg.title}"`);
