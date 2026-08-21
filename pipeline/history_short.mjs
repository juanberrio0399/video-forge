// history_short.mjs — Ensambla un SHORT 9:16 de "Historia que cambio el mundo":
// footage REAL de archivo (dominio publico / CC en Archive.org) por cada beat del guion,
// bajo la NARRACION de historiador (voz Gemini TTS), con subtitulos KARAOKE + musica cinematica
// con ducking. Solo fuentes con descarga permitida y licencia libre (sin evasion).
//
// Uso: node pipeline/history_short.mjs <script.json> <narration.mp3> <out.mp4>
// Requiere en cwd: words.json (Whisper, opcional), music.mp3 (opcional). Env: -.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf } from "./clip_frame.mjs";

const [scriptPath = "script.json", narrPath = "narration.mp3", outPath = "short.mp4"] = process.argv.slice(2);
const W = 1080, H = 1920, FPS = 30;
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const beats = (script.beats || []).filter((b) => b && b.query);
const work = "histwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, headers: { "user-agent": "video-forge/1.0 (educational)", ...(o.headers || {}) }, signal: AbortSignal.timeout(ms) });

const narrDur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${narrPath}"`).trim()) || 45;
console.log(`Narracion: ${narrDur.toFixed(1)}s · beats: ${beats.length}`);

// Colecciones de Archive.org que son DOMINIO PUBLICO (footage historico) -> se aceptan aunque no traigan licenseurl.
const PD_COLLECTIONS = ["prelinger", "universal_newsreels", "newsandpublicaffairs", "academic_films", "AENN", "nasa", "nasaimages", "computerchronicles", "usnationalarchives", "FedFlix"];
function licUsable(licenseurl, collections) {
  const u = (Array.isArray(licenseurl) ? licenseurl[0] : licenseurl || "").toLowerCase();
  if (/\/by-sa|\/by-nc|\/by-nd/.test(u)) return null;                 // no permitidas (SA/NC/ND)
  if (/publicdomain\/zero|\/cc0/.test(u)) return "cc0";
  if (/\/licenses\/by(\/|$)/.test(u)) return "cc-by";
  if (/publicdomain/.test(u)) return "public-domain";
  const cols = (Array.isArray(collections) ? collections : [collections]).map((c) => String(c || "").toLowerCase());
  if (cols.some((c) => PD_COLLECTIONS.map((p) => p.toLowerCase()).includes(c))) return "public-domain";
  return null;
}

// Busca en Archive.org un item con footage historico del tema, licencia libre + mp4 descargable.
async function findFootage(query) {
  const q = `(${query}) AND mediatype:movies AND (licenseurl:(*publicdomain* OR *creativecommons*) OR collection:(${PD_COLLECTIONS.join(" OR ")}))`;
  const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=creator&fl[]=collection&sort[]=downloads+desc&rows=40&output=json`;
  let docs = [];
  try { docs = ((await (await tf(u)).json()).response || {}).docs || []; } catch {}
  for (const d of docs) {
    const lic = licUsable(d.licenseurl, d.collection);
    if (!lic) continue;
    try {
      const meta = await (await tf(`https://archive.org/metadata/${d.identifier}`)).json();
      const files = (meta.files || []).filter((f) => /\.(mp4|m4v|ogv)$/i.test(f.name) && +(f.size || 0) > 1.2e6).sort((a, b) => +a.size - +b.size);
      if (!files.length) continue;
      const f = files[0]; // el mas liviano usable -> descarga rapida y confiable en CI
      const creator = (Array.isArray(d.creator) ? d.creator[0] : d.creator) || "Internet Archive";
      const title = (Array.isArray(d.title) ? d.title[0] : d.title) || query;
      return { id: d.identifier, title, creator, lic, url: `https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name)}`, page: `https://archive.org/details/${d.identifier}` };
    } catch {}
  }
  return null;
}

// Construye un segmento 9:16 (silencioso) de duracion `dur` a partir del footage de una query.
async function buildSegment(query, dur, idx) {
  // Intenta la query; si falla, una version simplificada; si falla, null (se rellenara).
  const tries = [query, query.replace(/\b(19|20)\d\d\b/g, "").replace(/\s+/g, " ").trim(), (query.split(" ").slice(0, 2).join(" "))];
  let src = null;
  for (const q of tries) { if (!q) continue; src = await findFootage(q); if (src) break; }
  if (!src) { console.error(`  beat ${idx}: sin footage para "${query}"`); return null; }
  console.log(`  beat ${idx}: "${src.title}" (${src.lic})`);
  const film = `${work}/film${idx}.mp4`;
  try {
    const r = await tf(src.url, {}, 300000);
    if (!r.ok) throw new Error("dl " + r.status);
    fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(`  beat ${idx}: descarga fallo (${e.message})`); return null; }
  const fdur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
  if (fdur < 2) { console.error(`  beat ${idx}: clip ilegible`); return null; }
  const start = fdur > dur + 1 ? Math.min(fdur * 0.25, fdur - dur - 0.3) : 0;
  const { w: sw, h: sh2 } = sourceWH(film);
  const vf = smartCropVf(W, H, sw, sh2, 0.5, "eq=contrast=1.08:saturation=1.06:brightness=0.01,curves=preset=increase_contrast");
  const seg = `${work}/seg${idx}.mp4`;
  try {
    // -stream_loop por si el clip es mas corto que `dur` (lo repite para llenar).
    execSync(`ffmpeg -y -stream_loop -1 -ss ${start.toFixed(2)} -i "${film}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  } catch (e) { console.error(`  beat ${idx}: encode fallo`); return null; }
  return { seg, dur, src };
}

// 1) Un segmento por beat (duracion repartida sobre la narracion, con solape para transiciones).
const TD = 0.4; // transicion xfade
const segDur = +((narrDur + TD * (beats.length - 1)) / Math.max(1, beats.length) + 0.2).toFixed(2);
const built = [];
for (let i = 0; i < beats.length; i++) {
  const s = await buildSegment(beats[i].query, segDur, i);
  if (s) built.push(s);
}
if (!built.length) { console.error("No conseguí NINGÚN footage historico -> no puedo armar el short"); process.exit(1); }
// Si algunos beats fallaron, reusar los que si salieron (loop) hasta cubrir el # de beats.
while (built.length < beats.length) built.push(built[built.length % built.length]);

// 2) Concatenar con xfade -> fondo del largo de la narracion.
const bg = `${work}/bg.mp4`;
if (built.length === 1) {
  execSync(`ffmpeg -y -stream_loop -1 -i "${built[0].seg}" -t ${narrDur.toFixed(2)} -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
} else {
  const inputs = built.map((p) => `-i "${p.seg}"`).join(" ");
  const TR = ["fade", "fadeblack", "wipeleft", "fade"];
  let filter = "", acc = "[0:v]", accLen = built[0].dur;
  for (let i = 1; i < built.length; i++) {
    const off = +(accLen - TD).toFixed(3);
    filter += `${acc}[${i}:v]xfade=transition=${TR[(i - 1) % TR.length]}:duration=${TD}:offset=${off}[v${i}];`;
    acc = `[v${i}]`; accLen = +(accLen + built[i].dur - TD).toFixed(3);
  }
  filter = filter.replace(/;$/, "");
  execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -t ${narrDur.toFixed(2)} -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
}

// 3) Subtitulos KARAOKE desde words.json (Whisper). Fallback: frases de los beats.
function assTime(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${h}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`; }
const asc = (s) => String(s).replace(/[{}\\]/g, "").replace(/[\r\n]+/g, " ");
const dia = [];
if (fs.existsSync("words.json")) {
  const words = JSON.parse(fs.readFileSync("words.json", "utf8")).filter((w) => w && w.word);
  const LINE = 3;
  for (let i = 0; i < words.length; i += LINE) {
    const line = words.slice(i, i + LINE), last = line.length - 1;
    const start = +line[0].start, end = +line[last].end;
    if (!(end > start)) continue;
    const parts = line.map((w, k) => { const nextT = k < last ? +line[k + 1].start : +w.end; const kdur = Math.max(1, Math.round((nextT - +w.start) * 100)); return `{\\k${kdur}}${asc(w.word)}`; });
    dia.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Kar,,0,0,0,,${parts.join(" ")}`);
  }
} else {
  const per = narrDur / Math.max(1, beats.length);
  beats.forEach((b, i) => { dia.push(`Dialogue: 0,${assTime(i * per)},${assTime((i + 1) * per)},Kar,,0,0,0,,${asc(b.text || "")}`); });
}
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kar,Liberation Sans,104,&H0022D3EE,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,8,5,2,80,80,520,1
`;
fs.writeFileSync("captions.ass", ass + `\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${dia.join("\n")}\n`);
console.log(`captions.ass: ${dia.length} lineas`);

// 4) Mezcla final: fondo + subtitulos quemados + narracion + musica con ducking.
const hasMusic = fs.existsSync("music.mp3");
if (hasMusic) {
  execSync(`ffmpeg -y -i "${bg}" -i "${narrPath}" -stream_loop -1 -i music.mp3 ` +
    `-filter_complex "[0:v]subtitles=captions.ass[v];` +
    `[2:a]volume=0.30,afade=t=in:st=0:d=0.8[mus];` +
    `[1:a]loudnorm=I=-15:TP=-1.5,asplit=2[nar1][nar2];` +
    `[mus][nar1]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=300[mduck];` +
    `[nar2][mduck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]" ` +
    `-map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
} else {
  execSync(`ffmpeg -y -i "${bg}" -i "${narrPath}" -filter_complex "[0:v]subtitles=captions.ass[v];[1:a]loudnorm=I=-15:TP=-1.5[a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
}

// 5) Paquete SEO + manifiesto de compliance (footage con licencia/atribucion).
const creditLines = [...new Map(built.map((b) => [b.src.id, b.src])).values()]
  .map((s) => `${s.title} — ${s.creator} · ${s.page} · ${s.lic.toUpperCase()}`);
const musicCredit = "Music: Kevin MacLeod (incompetech.com), licensed under CC BY 4.0";
const title = ((script.title || script.topic || "History").slice(0, 92) + " #Shorts").slice(0, 100);
const desc = [
  script.hook || script.topic || "",
  "",
  ((script.hashtags || ["#History", "#Shorts"]).join(" ") + " #Shorts #history").trim(),
  "",
  "Archival footage (public domain / Creative Commons):",
  ...creditLines,
  "",
  musicCredit,
  "",
  "This short uses an AI-generated narration voice. Historical content for educational purposes.",
].join("\n");
fs.mkdirSync("publish", { recursive: true });
fs.writeFileSync("publish/package.json", JSON.stringify({ title, description: desc, tags: ["shorts", "history", "documentary"], language: "en" }, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({
  niche: "history", format: "9:16",
  clips: built.map((b, i) => ({ clip_id: "h" + i, source: "archive_pd", license: b.src.lic, url: b.src.page, attribution: creditLines[i] || "", query: beats[i]?.query || "" })),
  transform: { narration: true, original_audio: false, editing: true, original_script: true, sound_design: true },
}, null, 2));
console.log(`Short de HISTORIA listo -> ${outPath} · "${title}"`);
