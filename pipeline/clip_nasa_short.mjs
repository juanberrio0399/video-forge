// clip_nasa_short.mjs — CLIPEADOR de shorts desde el catálogo de NASA (dominio público, RECIENTE:
// lanzamientos, ISS, planetas, telescopios). API oficial images-api.nasa.gov -> descarga DIRECTA
// (más confiable que YouTube). La IA elige el mejor momento y arma un SHORT 9:16 con nuestro audio.
//
// Uso: node pipeline/clip_nasa_short.mjs "<tema>" <categoria> <out.mp4>
// Env: GEMINI_API_KEY(,2). music.mp3 opcional.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf, finishClip } from "./clip_frame.mjs";

const [topic, niche = "ciencia_humor", outPath = "short.mp4"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const W = 1080, H = 1920, CLIP = 32;
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const work = "clipwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();

// 1) Buscar video en NASA + resolver el .mp4 grande.
console.log(`Buscando en NASA: "${topic}"…`);
const s = await (await tf(`https://images-api.nasa.gov/search?q=${encodeURIComponent(topic)}&media_type=video&page_size=25`)).json();
const items = (s.collection && s.collection.items) || [];
let mp4 = null, nasaId = null, title = topic;
for (const it of items) {
  try {
    const col = await (await tf(it.href)).json();
    const urls = (Array.isArray(col) ? col : []).filter((u) => /\.mp4$/i.test(u));
    const pick = urls.find((u) => /~orig\.mp4$/i.test(u)) || urls.find((u) => /~large\.mp4$/i.test(u)) || urls[0];
    if (pick) { mp4 = pick.replace(/^http:/, "https:"); nasaId = (it.data && it.data[0] && it.data[0].nasa_id) || ""; title = (it.data && it.data[0] && it.data[0].title) || topic; break; }
  } catch {}
}
if (!mp4) { console.error("NASA: sin video mp4 usable"); process.exit(1); }
console.log(`NASA: "${title}"`);

const film = `${work}/film.mp4`;
const r = await tf(mp4, {}, 600000);
if (!r.ok) { console.error("descarga NASA falló " + r.status); process.exit(1); }
fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
if (dur < 8) { console.error("clip NASA muy corto"); process.exit(1); }

// 2) Miniaturas + IA (si el video es corto, igual elige un buen inicio).
const a0 = dur * 0.05, a1 = Math.max(a0 + 1, dur * 0.9), N = Math.min(12, Math.max(3, Math.floor(dur / 4))), step = (a1 - a0) / N, thumbs = [];
for (let i = 0; i < N; i++) { const t = Math.round(a0 + i * step), p = `${work}/th${i}.jpg`; try { execSync(`ffmpeg -y -ss ${t} -i "${film}" -frames:v 1 -vf "scale=320:-1" "${p}"`, { stdio: "ignore" }); if (fs.existsSync(p)) thumbs.push({ t, p }); } catch {} }
async function pick() {
  if (!KEYS.length || !thumbs.length) return null;
  const parts = [{ text: `Editor de SHORTS. Miniaturas del video de NASA "${title}" con timestamp (s). Elige el momento MÁS espectacular/impactante (lanzamiento, planeta, fenómeno). Devuelve SOLO JSON: {"start": <s, menos 2>, "title": "título EN inglés de alto CTR (<=60)", "subject_x": <0.0 a 1.0: posición horizontal del sujeto principal>}.` }];
  thumbs.forEach((th) => { parts.push({ text: `t=${th.t}s` }); parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(th.p).toString("base64") } }); });
  for (let x = 0; x < 2; x++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) { try { const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }) }); if (!res.ok) continue; const j = await res.json(); const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim(); if (t) { try { const p = JSON.parse(t); if (p && isFinite(+p.start)) return p; } catch {} } } catch {} }
  return null;
}
let mo = await pick(); if (!mo || !isFinite(+mo.start)) mo = { start: Math.round(dur * 0.2), title: title.slice(0, 60) };
const clipLen = Math.min(CLIP, Math.max(6, dur - 1));
const start = Math.max(0, Math.min(+mo.start, dur - clipLen));

// 3) 9:16 profesional con sujeto centrado (smart crop) + música.
const { w: srcW, h: srcH } = sourceWH(film);
const sx = isFinite(+mo.subject_x) ? +mo.subject_x : 0.5;
const vf = smartCropVf(W, H, srcW, srcH, sx, "eq=contrast=1.05:saturation=1.08");
const pre = Math.max(0, start - 3), fine = (start - pre).toFixed(2);
const raw = `${work}/raw.mp4`;
// Corte conservando el AUDIO ORIGINAL de NASA (sin -an).
execSync(`ffmpeg -y -ss ${pre} -i "${film}" -ss ${fine} -t ${clipLen} -vf "${vf}" -r 30 -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 160k "${raw}"`, { stdio: "inherit" });
const hadAudio = finishClip(raw, outPath);
console.log("audio original: " + (hadAudio ? "sí" : "no (solo música)"));

fs.mkdirSync("publish", { recursive: true });
const pkg = { title: (mo.title || title).slice(0, 92) + " #Shorts", description: `#Shorts #space #nasa\n\nCredit: NASA (public domain) — ${title}.`, tags: ["shorts", "space", "nasa", "science", niche], language: "en" };
fs.writeFileSync("publish/package.json", JSON.stringify(pkg, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({ niche, format: "9:16", clips: [{ clip_id: "nasa1", source: "nasa", license: "nasa", url: `https://images.nasa.gov/details-${nasaId}`, query: topic }], transform: { narration: false, original_audio: hadAudio, editing: true, original_script: true, sound_design: true } }, null, 2));
console.log(`Short NASA listo -> ${outPath} · "${pkg.title}"`);
