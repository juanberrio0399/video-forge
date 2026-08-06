// build_compilation.mjs — ENSAMBLADOR del canal automático #2. Arma una COMPILACIÓN
// transformada: baja clips SOLO de fuentes con licencia (Pexels/Pixabay por ahora),
// los une con transiciones + narración IA + música + subtítulos + número de ranking,
// y ESCRIBE compilation_manifest.json (fuente/licencia de cada clip) para que
// compliance_check.mjs valide ANTES de publicar. Modelado en recipe_assemble.mjs.
//
// Uso: node pipeline/build_compilation.mjs <niche> <voicemap.json> <timing.json> <voz.wav> <out.mp4> [format]
//   format: "16:9" (default) o "9:16". Env: PEXELS_API_KEY, PIXABAY_API_KEY. music.mp3 opcional.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const [niche, voicemapPath, timingPath, voicePath, outPath, format = "16:9"] = process.argv.slice(2);
const PEXELS = process.env.PEXELS_API_KEY || "";
const PIXABAY = process.env.PIXABAY_API_KEY || "";

const [W, H] = format === "9:16" ? [1080, 1920] : [1920, 1080];
const FPS = 30, TD = 0.4;
const FONT = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"].find((f) => fs.existsSync(f)) || "";
const GRADE = "eq=brightness=0.02:saturation=1.12:contrast=1.05,unsharp=3:3:0.3";
const COVER = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
const TRANS = ["fade", "dissolve", "smoothup", "wiperight", "circleopen", "slideup", "fadeblack"];

function readJSON(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } }
const sources = readJSON("channel/auto2/sources.seed.json", {});
const nicheCfg = ((sources.niches || {})[niche]) || {};
const queryPool = nicheCfg.queries || ["nature", "city", "abstract"];
const vm = readJSON(voicemapPath, {});
const beats = vm.beats || [];
const timing = readJSON(timingPath, {});
const durOf = (i) => { const b = (timing.beats || []).find((x) => x.index === i) || (timing.beats || [])[i]; return Math.max(1.6, (b && b.dur ? +b.dur : 3.5)); };

const work = "comp"; fs.mkdirSync(work, { recursive: true });
const manifest = { niche, format, clips: [], transform: { narration: true, editing: true, original_script: true } };

async function dl(url, dest) { const r = await fetch(url); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); }

// Fuentes LEGALES (licencia comercial). Cada una devuelve {url, source, license}.
async function pexels(q) {
  if (!PEXELS) return null;
  try {
    const orient = W >= H ? "landscape" : "portrait";
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=${orient}&size=medium&per_page=15`, { headers: { Authorization: PEXELS } });
    if (!r.ok) return null;
    const j = await r.json();
    for (const v of (j.videos || []).sort(() => Math.random() - 0.5)) {
      const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.height).sort((a, b) => b.height - a.height);
      const f = files.find((f) => f.height >= 720 && f.height <= 1920) || files[0];
      if (f) return { url: f.link, source: "pexels", license: "pexels" };
    }
  } catch {}
  return null;
}
async function pixabay(q) {
  if (!PIXABAY) return null;
  try {
    const r = await fetch(`https://pixabay.com/api/videos/?key=${PIXABAY}&q=${encodeURIComponent(q)}&per_page=15`);
    if (!r.ok) return null;
    const j = await r.json();
    for (const h of (j.hits || []).sort(() => Math.random() - 0.5)) {
      const f = (h.videos || {}).large || (h.videos || {}).medium || (h.videos || {}).small;
      if (f && f.url) return { url: f.url, source: "pixabay", license: "pixabay" };
    }
  } catch {}
  return null;
}
async function getClip(q) { return (await pexels(q)) || (await pixabay(q)); }

// Subtitulo quemado (caja legible abajo).
function wrap(t, per) { const w = (t || "").split(/\s+/).filter(Boolean); const L = []; let c = ""; for (const x of w) { if ((c + " " + x).trim().length > per && c) { L.push(c); c = x; } else c = (c + " " + x).trim(); } if (c) L.push(c); return L.slice(0, 2).join("\n"); }
function subFilter(i, text) {
  if (!FONT || !text) return "";
  const tf = path.resolve(`${work}/sub${i}.txt`).replace(/\\/g, "/");
  fs.writeFileSync(tf, wrap(text, W >= H ? 40 : 22));
  const fs2 = W >= H ? 40 : 52, y = W >= H ? "h-180" : "h-460";
  return `,drawtext=fontfile='${FONT}':textfile='${tf}':fontcolor=white:fontsize=${fs2}:line_spacing=8:box=1:boxcolor=black@0.55:boxborderw=22:x=(w-text_w)/2:y=${y}`;
}
// Número de ranking (transformación + engagement): "#N" arriba-izquierda.
function rankFilter(n) {
  if (!FONT) return "";
  return `,drawtext=fontfile='${FONT}':text='#${n}':fontcolor=white:fontsize=${W >= H ? 72 : 96}:box=1:boxcolor=black@0.4:boxborderw=18:x=40:y=40`;
}

async function makeClip(i) {
  const dur = +(durOf(i) + TD).toFixed(2);
  const out = `${work}/clip${String(i).padStart(3, "0")}.mp4`;
  const q = (beats[i].query || queryPool[i % queryPool.length]);
  const got = await getClip(q);
  if (!got) return null;
  const raw = `${work}/raw${i}.mp4`;
  await dl(got.url, raw);
  const vf = `${COVER},${GRADE}${rankFilter(beats.length - i)}${subFilter(i, beats[i].text || beats[i].subtitle)}`;
  execSync(`ffmpeg -y -stream_loop -1 -i "${raw}" -t ${dur} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
  fs.rmSync(raw, { force: true });
  manifest.clips.push({ clip_id: `clip${i}`, source: got.source, license: got.license, url: got.url, query: q });
  return { out, dur };
}

const parts = [], durs = [];
for (let i = 0; i < beats.length; i++) {
  try { const r = await makeClip(i); if (r) { parts.push(path.resolve(r.out).replace(/\\/g, "/")); durs.push(r.dur); console.log(`  clip ${i} (${manifest.clips[manifest.clips.length - 1].source}) ${r.dur}s`); } }
  catch (e) { console.log(`  error clip ${i}: ${e.message}`); }
}
fs.writeFileSync("compilation_manifest.json", JSON.stringify(manifest, null, 2));
if (!parts.length) { console.error("Sin clips (¿faltan API keys de stock?) -> no armo la compilación."); process.exit(1); }

// Unir con transiciones (xfade).
const silent = `${work}/silent.mp4`;
if (parts.length === 1) {
  execSync(`ffmpeg -y -i "${parts[0]}" -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${silent}"`, { stdio: "inherit" });
} else {
  const inputs = parts.map((p) => `-i "${p}"`).join(" ");
  let filter = "", acc = "[0:v]", accLen = durs[0];
  for (let i = 1; i < parts.length; i++) {
    const offset = +(accLen - TD).toFixed(3), tr = TRANS[(i - 1) % TRANS.length];
    filter += `${acc}[${i}:v]xfade=transition=${tr}:duration=${TD}:offset=${offset}[v${i}];`;
    acc = `[v${i}]`; accLen = +(accLen + durs[i] - TD).toFixed(3);
  }
  filter = filter.replace(/;$/, "");
  execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${silent}"`, { stdio: "inherit" });
}

// Mezclar narración + música (ducking) si hay music.mp3.
if (fs.existsSync("music.mp3")) {
  execSync(`ffmpeg -y -i "${silent}" -i "${voicePath}" -stream_loop -1 -i music.mp3 -filter_complex "[2:a]volume=0.12[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]" -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
} else {
  execSync(`ffmpeg -y -i "${silent}" -i "${voicePath}" -map 0:v -map 1:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
}
console.log(`Compilación lista -> ${outPath} (${parts.length} clips ${format}, nicho ${niche}). Manifiesto: compilation_manifest.json`);
