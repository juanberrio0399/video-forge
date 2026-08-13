// clip_vimeo_short.mjs — CLIPEADOR desde Vimeo (filtro Creative Commons). Busca por tema SOLO CC
// (filter=CC), acepta by/cc0 (rechaza sa/nc/nd), descarga con yt-dlp (Vimeo bloquea menos que
// YouTube) -> SHORT 9:16 con nuestro audio + atribución. Requiere VIMEO_ACCESS_TOKEN (gratis).
//
// Uso: node pipeline/clip_vimeo_short.mjs "<tema>" <categoria> <out.mp4>
// Env: VIMEO_ACCESS_TOKEN, GEMINI_API_KEY(,2). Requiere yt-dlp. music.mp3 opcional.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf, finishClip } from "./clip_frame.mjs";

const [topic, niche = "graciosos", outPath = "short.mp4"] = process.argv.slice(2);
const VT = process.env.VIMEO_ACCESS_TOKEN;
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const W = 1080, H = 1920, CLIP = 35;
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const work = "clipwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();
if (!VT) { console.error("Falta VIMEO_ACCESS_TOKEN (créalo gratis en developer.vimeo.com)."); process.exit(3); }

// 1) Buscar CC en Vimeo (aceptar by / cc0; rechazar sa/nc/nd).
console.log(`Buscando CC en Vimeo: "${topic}"…`);
const s = await (await tf(`https://api.vimeo.com/videos?query=${encodeURIComponent(topic)}&filter=CC&per_page=25&sort=plays&direction=desc`, { headers: { Authorization: `bearer ${VT}`, Accept: "application/vnd.vimeo.*+json;version=3.4" } })).json();
const cands = (s.data || []).map((v) => ({ uri: v.uri || "", link: v.link, name: v.name, user: (v.user || {}).name || "", lic: (v.license || "").toLowerCase(), dur: v.duration || 0 })).filter((v) => (v.lic === "by" || v.lic === "cc0") && v.dur >= 30 && v.dur <= 1200);
if (!cands.length) { console.error("Vimeo: sin candidatos CC (by/cc0) usables"); process.exit(1); }
const src = cands[0];
const licKey = src.lic === "cc0" ? "cc0" : "cc-by";
const attribution = `${src.name} · ${src.user} · ${src.link} · CC ${src.lic.toUpperCase()}`;
console.log(`Elegido: "${src.name}" · ${src.user} · CC-${src.lic}`);

// 2) Descargar. Preferir la API oficial de Vimeo (link mp4 directo si el dueño permite descarga
// o si el token da acceso a los archivos); yt-dlp queda solo como respaldo.
const film = `${work}/film.mp4`;
const vid = (src.uri || "").split("/").pop();
async function apiDirect() {
  if (!vid) return null;
  try {
    const m = await (await tf(`https://api.vimeo.com/videos/${vid}?fields=download,files`, { headers: { Authorization: `bearer ${VT}`, Accept: "application/vnd.vimeo.*+json;version=3.4" } })).json();
    const pool = [...(m.download || []), ...(m.files || [])]
      .filter((f) => f && f.link && !/hls|dash|m3u8/i.test(`${f.quality || ""}${f.type || ""}${f.link}`))
      .map((f) => ({ link: f.link, w: +(f.width || 0), size: +(f.size || 0) }));
    console.log(`API Vimeo: ${pool.length} archivo(s) mp4 directo(s) disponibles.`);
    if (!pool.length) return null;
    const le1080 = pool.filter((f) => f.w && f.w <= 1080).sort((a, b) => b.w - a.w);
    return (le1080[0] || pool.sort((a, b) => (b.w || b.size) - (a.w || a.size))[0]).link;
  } catch (e) { console.log("API Vimeo no dio link directo: " + e.message); return null; }
}
const direct = await apiDirect();
if (direct) {
  const r = await tf(direct, {}, 600000);
  if (r.ok) { fs.writeFileSync(film, Buffer.from(await r.arrayBuffer())); console.log("Descargado por API directa."); }
}
if (!fs.existsSync(film)) {
  console.log("Sin link directo -> intento yt-dlp (respaldo)…");
  try { execSync(`yt-dlp -q --no-warnings -f "best[height<=1080][ext=mp4]/best[ext=mp4]/best" -o "${film}" "${src.link}"`, { stdio: "inherit" }); } catch (e) { console.error("yt-dlp/Vimeo falló: " + e.message); }
}
if (!fs.existsSync(film)) { console.error("no se descargó (ni API ni yt-dlp). El dueño no habilitó descarga y el token no da acceso a archivos."); process.exit(2); }
const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
if (dur < 20) { console.error("video ilegible"); process.exit(1); }

// 3) Miniaturas + IA.
const a0 = dur * 0.08, a1 = dur * 0.92, N = 16, step = (a1 - a0) / N, thumbs = [];
for (let i = 0; i < N; i++) { const t = Math.round(a0 + i * step), p = `${work}/th${i}.jpg`; try { execSync(`ffmpeg -y -ss ${t} -i "${film}" -frames:v 1 -vf "scale=320:-1" "${p}"`, { stdio: "ignore" }); if (fs.existsSync(p)) thumbs.push({ t, p }); } catch {} }
async function pick() {
  if (!KEYS.length || !thumbs.length) return null;
  const parts = [{ text: `Editor de SHORTS virales. Miniaturas del video "${src.name}" (tema: ${topic}) con timestamp (s). Elige el momento MÁS impactante/viral. SOLO JSON: {"start": <s, menos 4>, "title": "título EN inglés alto CTR (<=60)", "subject_x": <0.0 a 1.0: posición horizontal del sujeto principal>}.` }];
  thumbs.forEach((th) => { parts.push({ text: `t=${th.t}s` }); parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(th.p).toString("base64") } }); });
  for (let x = 0; x < 2; x++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) { try { const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }) }); if (!res.ok) continue; const jj = await res.json(); const t = (jj?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim(); if (t) return JSON.parse(t); } catch {} }
  return null;
}
let mo = await pick(); if (!mo || !isFinite(+mo.start)) mo = { start: Math.round(dur * 0.4), title: src.name.slice(0, 60) };
const start = Math.max(0, Math.min(+mo.start, dur - CLIP - 2));

// 4) Corte preciso + 9:16 con sujeto centrado (smart crop) + música.
const { w: srcW, h: srcH } = sourceWH(film);
const sx = isFinite(+mo.subject_x) ? +mo.subject_x : 0.5;
const vf = smartCropVf(W, H, srcW, srcH, sx, "eq=contrast=1.06:saturation=1.05");
const pre = Math.max(0, start - 3), fine = (start - pre).toFixed(2), raw = `${work}/raw.mp4`;
// Corte conservando el AUDIO ORIGINAL del video CC (sin -an).
execSync(`ffmpeg -y -ss ${pre} -i "${film}" -ss ${fine} -t ${CLIP} -vf "${vf}" -r 30 -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 160k "${raw}"`, { stdio: "inherit" });
const hadAudio = finishClip(raw, outPath);
console.log("audio original: " + (hadAudio ? "sí" : "no (solo música)"));

fs.mkdirSync("publish", { recursive: true });
const pkg = { title: (mo.title || src.name).slice(0, 92) + " #Shorts", description: `#Shorts\n\n${licKey === "cc-by" ? "Credit: " + attribution + " (edited/clipped)." : "Source: " + src.name + " (Vimeo, CC0)."}`, tags: ["shorts", niche, "creative commons"], language: "en" };
fs.writeFileSync("publish/package.json", JSON.stringify(pkg, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({ niche, format: "9:16", clips: [{ clip_id: "vm1", source: "vimeo_cc", license: licKey, url: src.link, attribution: licKey === "cc-by" ? attribution : "", query: topic }], transform: { narration: false, original_audio: hadAudio, editing: true, original_script: true, sound_design: true } }, null, 2));
console.log(`Short Vimeo listo -> ${outPath} · "${pkg.title}"`);
