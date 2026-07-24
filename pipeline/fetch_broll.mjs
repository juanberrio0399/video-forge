// fetch_broll.mjs — baja footage real (b-roll) de Pexels segun el tema de cada
// tramo del video, lo recorta/loopea al largo exacto y lo deja listo para el fondo.
// Requiere env PEXELS_API_KEY. Sin key -> no hace nada (el video sale sin b-roll).
//
// Uso: node pipeline/fetch_broll.mjs <timing.json> [outDir=broll] [maxSeconds]
import fs from "node:fs";
import { execSync } from "node:child_process";

const [timingPath, outDir = "broll", maxSecondsArg] = process.argv.slice(2);
const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.log("Sin PEXELS_API_KEY -> sin b-roll."); process.exit(0); }

const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const maxSeconds = maxSecondsArg && parseFloat(maxSecondsArg) > 0 ? parseFloat(maxSecondsArg) : timing.total;
const total = Math.min(timing.total, maxSeconds);
fs.mkdirSync(outDir, { recursive: true });

// Anclas: frase de la narracion -> tema de footage. Cada clip cubre hasta la siguiente.
const ANCHORS = [
  { at: 0, kw: "counting cash money" },
  { m: "sixty billion dollars in a single year", kw: "money falling bills" },
  { m: "first and biggest bucket is ads", kw: "person using smartphone" },
  { m: "quiet giant, youtube tv", kw: "watching television at home" },
  { m: "quietly passed netflix", kw: "movie theater cinema" },
  { m: "twist i promised you", kw: "content creator filming camera" },
  { m: "insanely rich", kw: "luxury success city night" },
];

const cues = [];
for (const a of ANCHORS) {
  let start = a.at != null ? a.at : null;
  if (a.m) { const b = timing.beats.find((x) => x.text.toLowerCase().includes(a.m)); if (b) start = b.start; }
  if (start == null || start >= total) continue;
  cues.push({ start, kw: a.kw });
}
cues.sort((x, y) => x.start - y.start);
cues.forEach((c, i) => { c.end = Math.min(i + 1 < cues.length ? cues[i + 1].start : total, total); });

async function pickLink(kw) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(kw)}&orientation=landscape&size=medium&per_page=10`;
  const r = await fetch(url, { headers: { Authorization: KEY } });
  if (!r.ok) { console.log("  search fail", kw, r.status); return null; }
  const j = await r.json();
  for (const v of j.videos || []) {
    const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.width);
    files.sort((a, b) => b.width - a.width);
    const f = files.find((f) => f.width >= 1280 && f.width <= 1920) || files[0];
    if (f) return f.link;
  }
  return null;
}

async function download(url, dest) {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

const manifest = [];
for (let i = 0; i < cues.length; i++) {
  const c = cues[i];
  const dur = Math.max(1, +(c.end - c.start).toFixed(2));
  try {
    const link = await pickLink(c.kw);
    if (!link) { console.log(`  sin clip para "${c.kw}"`); continue; }
    const raw = `${outDir}/raw${i}.mp4`;
    await download(link, raw);
    const out = `${outDir}/clip${i}.mp4`;
    // loop/recorta al largo exacto, escala+crop a 1920x1080, baja brillo/saturacion, sin audio
    execSync(
      `ffmpeg -y -stream_loop -1 -i "${raw}" -t ${dur} ` +
      `-vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=brightness=-0.18:saturation=0.85,gblur=sigma=1.2" ` +
      `-an -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`,
      { stdio: "ignore" }
    );
    fs.rmSync(raw, { force: true });
    manifest.push({ start: +c.start.toFixed(2), dur, file: out, kw: c.kw });
    console.log(`  b-roll ${i}: "${c.kw}" [${c.start.toFixed(1)}s +${dur}s]`);
  } catch (e) {
    console.log(`  error "${c.kw}": ${e.message}`);
  }
}

fs.writeFileSync(`${outDir}/broll.json`, JSON.stringify(manifest, null, 2));
console.log(`broll.json: ${manifest.length} clips`);
