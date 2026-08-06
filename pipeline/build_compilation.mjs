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

// PERFIL POR NICHO — cada categoria tiene sus caracteristicas. Lo importante en
// ASMR/satisfying es el SONIDO (audio original del clip mandando, musica casi nula);
// en narrativas/ciencia la NARRACION manda (voz alta, musica de apoyo). Esto define
// como se mezcla el audio y el ritmo. Se puede sobre-escribir por nicho en sources.seed.json ("profile").
const PROFILES = {
  //                 sonido-clip     ambVol  musicVol  voiceVol  grade                                                        clip-min
  satisfying:      { keepAudio: true,  amb: 1.0,  music: 0.05, voice: 0.55, grade: "eq=brightness=0.02:saturation=1.18:contrast=1.06,unsharp=3:3:0.35", minClip: 2.2 },
  naturaleza_relax:{ keepAudio: true,  amb: 0.85, music: 0.10, voice: 0.70, grade: "eq=brightness=0.01:saturation=1.10:contrast=1.03",                  minClip: 2.4 },
  narrativas:      { keepAudio: false, amb: 0,    music: 0.14, voice: 1.0,  grade: "eq=brightness=-0.02:saturation=0.92:contrast=1.10",                 minClip: 1.8 },
  ciencia_humor:   { keepAudio: false, amb: 0,    music: 0.12, voice: 1.0,  grade: GRADE,                                                              minClip: 1.6 },
};
const profile = { ...(PROFILES[niche] || { keepAudio: false, amb: 0, music: 0.12, voice: 1.0, grade: GRADE, minClip: 1.6 }), ...(nicheCfg.profile || {}) };
const NGRADE = profile.grade || GRADE;
console.log(`Perfil de "${niche}": sonido-clip=${profile.keepAudio ? "SÍ (ASMR/relax)" : "no"} · voz=${profile.voice} · música=${profile.music}${profile.keepAudio ? " · ambiente=" + profile.amb : ""}`);
const vm = readJSON(voicemapPath, {});
const beats = vm.beats || [];
const timing = readJSON(timingPath, {});
const isShort = vm.kind === "short"; // Short 9:16: duración por categoría (ASMR más largo, ciencia corto)
const SHORT = nicheCfg.short || { clip_sec: 6 };
const SHORT_CAP = 178; // tope duro de YouTube Shorts (<3 min); no lo pasamos
// Duración de cada clip: la narración (timing) si existe; si no (ASMR puro), el clip_sec del nicho.
const durOf = (i) => { const b = (timing.beats || []).find((x) => x.index === i) || (timing.beats || [])[i]; const base = (b && b.dur ? +b.dur : (isShort ? (SHORT.clip_sec || 6) : 3.5)); return Math.max(profile.minClip, base); };
function hasAudio(p) { try { return execSync(`ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${p}"`).toString().trim().length > 0; } catch { return false; } }

// ¿Hay voz? (ASMR PURO no lleva narración -> voice.wav no existe). Define si la pieza es
// narrada o de puro sonido, y qué transformación declaramos para la puerta de compliance.
const hasVoice = (() => { try { return !!voicePath && fs.existsSync(voicePath) && fs.statSync(voicePath).size > 2000 && profile.voice > 0; } catch { return false; } })();
const work = "comp"; fs.mkdirSync(work, { recursive: true });
const manifest = { niche, format, clips: [], transform: { narration: hasVoice, editing: true, original_script: true, sound_design: !!profile.keepAudio } };

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

// --- EFECTOS ASMR curados (Freesound, solo CC0 = uso comercial libre, sin atribución) ---
// Garantiza los "sonidos de ASMR que se ven en redes" sin depender de que el clip de stock
// traiga audio. Mapea el término del clip al sonido correcto. Inactivo si no hay FREESOUND_API_KEY.
const FREESOUND = process.env.FREESOUND_API_KEY || "";
// Mapa trigger->sonido: el del nicho (sources.seed.json) manda; estos son respaldo general.
const SFX_MAP = {
  "forest waterfall": "waterfall", "ocean waves sunset": "ocean waves", "mountain aerial": "wind mountain",
  "rain forest": "rain", "river flowing": "river stream", "snowfall calm": "soft wind", "clouds timelapse": "soft wind",
  ...(nicheCfg.sfx_map || {}),
};
async function fetchSfx(q, dest) {
  if (!FREESOUND) return null;
  try {
    const term = SFX_MAP[q] || (q + " asmr");
    const params = new URLSearchParams({ query: term, filter: 'license:"Creative Commons 0" duration:[1 TO 40]', sort: "score", fields: "id,name,previews,username", page_size: "12", token: FREESOUND });
    const r = await fetch(`https://freesound.org/apiv2/search/text/?${params}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const j = await r.json();
    const hit = (j.results || []).find((x) => x.previews && x.previews["preview-hq-mp3"]);
    if (!hit) return null;
    const pr = await fetch(hit.previews["preview-hq-mp3"], { signal: AbortSignal.timeout(20000) });
    if (!pr.ok) return null;
    fs.writeFileSync(dest, Buffer.from(await pr.arrayBuffer()));
    return { id: hit.id, name: hit.name, user: hit.username };
  } catch { return null; }
}

// 🎧 MEZCLA ASMR PROFESIONAL — NO reusa clips ajenos ni amontona sonidos. Elige UNA PALETA
// curada (sonidos que combinan para relajar) y la mezcla como un profesional: una CAMA de
// fondo continua y dominante + 1-2 ACENTOS suaves encima, con niveles controlados. Todo
// Freesound CC0. Devuelve la pista o null (para caer al audio del clip).
async function buildAsmrRelaxMix(totalDur) {
  if (!FREESOUND) return null;
  const palettes = nicheCfg.palettes || [];
  if (!palettes.length) return null;
  const pal = palettes[Math.floor(Math.random() * palettes.length)]; // una paleta por video
  const bedFile = `${work}/pal_bed.mp3`;
  const bedMeta = await fetchSfx(pal.bed, bedFile);
  if (!bedMeta) return null;
  manifest.clips.push({ clip_id: "sfx_bed", source: "freesound", license: "cc0", url: `https://freesound.org/s/${bedMeta.id}/`, query: pal.bed });
  const accents = [];
  for (const a of (pal.accents || []).slice(0, 2)) {
    const af = `${work}/pal_acc${accents.length}.mp3`;
    const m = await fetchSfx(a, af);
    if (m) { accents.push(af); manifest.clips.push({ clip_id: `sfx_acc${accents.length}`, source: "freesound", license: "cc0", url: `https://freesound.org/s/${m.id}/`, query: a }); }
  }
  const out = `${work}/relax_mix.m4a`;
  // Cama dominante y calmada (0.6) + acentos suaves (0.3/0.24). normalize=0 respeta los niveles.
  const ins = [`-stream_loop -1 -i "${bedFile}"`];
  let fc = `[0:a]dynaudnorm=f=250:g=4,volume=0.6[bed];`; const mix = ["[bed]"]; let idx = 1;
  for (const af of accents) { ins.push(`-stream_loop -1 -i "${af}"`); fc += `[${idx}:a]dynaudnorm=f=250:g=4,volume=${idx === 1 ? 0.3 : 0.24}[a${idx}];`; mix.push(`[a${idx}]`); idx++; }
  fc += `${mix.join("")}amix=inputs=${mix.length}:duration=first:dropout_transition=0:normalize=0,dynaudnorm=f=200:g=5[mx]`;
  execSync(`ffmpeg -y ${ins.join(" ")} -filter_complex "${fc}" -map "[mx]" -t ${totalDur} -c:a aac -b:a 160k "${out}"`, { stdio: "ignore" });
  console.log(`  🎧 Mezcla ASMR pro "${pal.name}": cama=${pal.bed} + ${accents.length} acento(s), ${Math.round(totalDur)}s.`);
  return out;
}

// Subtitulo quemado (caja legible abajo).
function wrap(t, per) { const w = (t || "").split(/\s+/).filter(Boolean); const L = []; let c = ""; for (const x of w) { if ((c + " " + x).trim().length > per && c) { L.push(c); c = x; } else c = (c + " " + x).trim(); } if (c) L.push(c); return L.slice(0, 2).join("\n"); }
function subFilter(i, text) {
  if (!FONT || !text) return "";
  const tf = path.resolve(`${work}/sub${i}.txt`).replace(/\\/g, "/");
  fs.writeFileSync(tf, wrap(text, W >= H ? 40 : 22));
  const fs2 = W >= H ? 40 : 52, y = W >= H ? "h-180" : "h-460";
  return `,drawtext=fontfile='${FONT}':textfile='${tf}':fontcolor=white:fontsize=${fs2}:line_spacing=8:box=1:boxcolor=black@0.55:boxborderw=22:x=(w-text_w)/2:y=${y}`;
}
async function makeClip(i) {
  const dur = +(durOf(i) + TD).toFixed(2);
  const out = `${work}/clip${String(i).padStart(3, "0")}.mp4`;
  const q = (beats[i].query || queryPool[i % queryPool.length]);
  const got = await getClip(q);
  if (!got) return null;
  const raw = `${work}/raw${i}.mp4`;
  await dl(got.url, raw);
  const vf = `${COVER},${NGRADE}${subFilter(i, beats[i].text || beats[i].subtitle)}`;
  if (profile.keepAudio) {
    // Nichos de SONIDO (ASMR/relax): conservamos el audio original del clip. Si el clip no
    // trae audio, le ponemos silencio para que todos los clips tengan pista (join uniforme).
    if (hasAudio(raw)) {
      execSync(`ffmpeg -y -stream_loop -1 -i "${raw}" -t ${dur} -vf "${vf}" -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -ar 44100 -ac 2 "${out}"`, { stdio: "ignore" });
    } else {
      execSync(`ffmpeg -y -stream_loop -1 -i "${raw}" -f lavfi -i anullsrc=r=44100:cl=stereo -t ${dur} -vf "${vf}" -map 0:v -map 1:a -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac "${out}"`, { stdio: "ignore" });
    }
  } else {
    execSync(`ffmpeg -y -stream_loop -1 -i "${raw}" -t ${dur} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
  }
  fs.rmSync(raw, { force: true });
  manifest.clips.push({ clip_id: `clip${i}`, source: got.source, license: got.license, url: got.url, query: q });
  return { out, dur };
}

const parts = [], durs = [];
for (let i = 0; i < beats.length; i++) {
  if (isShort && durs.reduce((a, b) => a + b, 0) > SHORT_CAP) { console.log(`  (short) tope de ${SHORT_CAP}s alcanzado, corto en ${durs.length} clips`); break; }
  try { const r = await makeClip(i); if (r) { parts.push(path.resolve(r.out).replace(/\\/g, "/")); durs.push(r.dur); console.log(`  clip ${i} ${r.dur}s`); } }
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

// Ambiente = audio ORIGINAL de los clips (solo nichos de sonido: ASMR/relax). Lo unimos
// con acrossfade (misma duración TD que el xfade de video) para que quede en sync.
// Best-effort: si algo falla, seguimos con narración+música y no rompemos la producción.
let ambient = null;
if (profile.keepAudio) {
  const totalDur = Math.max(4, durs.reduce((a, b) => a + b, 0) - Math.max(0, durs.length - 1) * TD);
  // 1) LO PRINCIPAL: mezcla ASMR profesional por paleta (cama + acentos que combinan).
  try { if (FREESOUND) ambient = await buildAsmrRelaxMix(totalDur); }
  catch (e) { console.log("  (aviso) mezcla ASMR falló: " + e.message); ambient = null; }
  // 2) Respaldo (sin key o si falla): el audio ORIGINAL de los clips, nivelado.
  if (!ambient) {
    try {
      ambient = `${work}/amb.m4a`;
      const NORM = "dynaudnorm=f=200:g=6:p=0.9";
      const segs = [];
      for (let i = 0; i < parts.length; i++) {
        const seg = `${work}/seg${i}.m4a`;
        execSync(`ffmpeg -y -i "${parts[i]}" -t ${durs[i]} -vn -af "${NORM}" -ac 2 -ar 44100 -c:a aac -b:a 160k "${seg}"`, { stdio: "ignore" });
        segs.push(seg);
      }
      if (segs.length === 1) { fs.copyFileSync(segs[0], ambient); }
      else {
        const inputs = segs.map((p) => `-i "${p}"`).join(" ");
        let f = "", acc = "[0:a]";
        for (let i = 1; i < segs.length; i++) { f += `${acc}[${i}:a]acrossfade=d=${TD}[a${i}];`; acc = `[a${i}]`; }
        f = f.replace(/;$/, "");
        execSync(`ffmpeg -y ${inputs} -filter_complex "${f}" -map "${acc}" -c:a aac -b:a 160k "${ambient}"`, { stdio: "ignore" });
      }
      console.log("  (sin key Freesound) uso el audio original de los clips, realzado.");
    } catch (e) { console.log("  (aviso) ambiente falló: " + e.message); ambient = null; }
  }
}

// Mezcla: voz (si hay) + música (si hay) + ambiente (si el nicho lo pide). normalize=0
// respeta los volúmenes por nicho (en ASMR el ambiente/sonido manda; en ASMR PURO no hay voz).
const ins = [`-i "${silent}"`]; const mix = []; let fc = ""; let idx = 1;
if (hasVoice) { ins.push(`-i "${voicePath}"`); fc += `[${idx}:a]volume=${profile.voice}[vo];`; mix.push("[vo]"); idx++; }
if (fs.existsSync("music.mp3")) { ins.push(`-stream_loop -1 -i music.mp3`); fc += `[${idx}:a]volume=${profile.music}[mu];`; mix.push("[mu]"); idx++; }
if (ambient) { ins.push(`-i "${ambient}"`); fc += `[${idx}:a]volume=${profile.amb}[am];`; mix.push("[am]"); idx++; }
if (!mix.length) {
  execSync(`ffmpeg -y ${ins.join(" ")} -map 0:v -an -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "${outPath}"`, { stdio: "inherit" });
} else if (mix.length === 1) {
  execSync(`ffmpeg -y ${ins.join(" ")} -filter_complex "${fc.replace(/;$/, "")}" -map 0:v -map "${mix[0]}" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
} else {
  fc += `${mix.join("")}amix=inputs=${mix.length}:duration=first:dropout_transition=0:normalize=0[a]`;
  execSync(`ffmpeg -y ${ins.join(" ")} -filter_complex "${fc}" -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
}
console.log(`Compilación lista -> ${outPath} (${parts.length} clips ${format}, nicho ${niche}, ${hasVoice ? "narrado" : "SIN voz / ASMR puro"}). Manifiesto: compilation_manifest.json`);
