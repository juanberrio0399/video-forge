// fetch_ai_images.mjs — genera imagenes de fondo con IA (Pollinations.ai, GRATIS,
// sin key) segun el tema de cada tramo, para animarlas como b-roll (ken burns).
//
// Uso: node pipeline/fetch_ai_images.mjs <timing.json> [outDir=aiimg] [maxSeconds]
import fs from "node:fs";

const [timingPath, outDir = "aiimg", maxSecondsArg] = process.argv.slice(2);
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const maxSeconds = maxSecondsArg && parseFloat(maxSecondsArg) > 0 ? parseFloat(maxSecondsArg) : timing.total;
const total = Math.min(timing.total, maxSeconds);
fs.mkdirSync(outDir, { recursive: true });

// Estilo comun para que todas se vean del mismo canal (cinematografico, marca).
const STYLE = "cinematic dark moody, teal and emerald palette, dramatic rim lighting, shallow depth of field, subtle film grain, high detail, no text, no watermark, no words";

// Anclas: frase de la narracion -> prompt de la imagen.
const ANCHORS = [
  { at: 0, p: "close up of cash money bills and coins, glowing" },
  { m: "sixty billion dollars in a single year", p: "abstract towering stacks of money and glowing golden particles, wealth" },
  { m: "first and biggest bucket is ads", p: "person scrolling a glowing smartphone at night, reflections" },
  { m: "quiet giant, youtube tv", p: "cozy dark living room with a large glowing tv screen at night" },
  { m: "quietly passed netflix", p: "empty modern cinema movie theater with red seats, dramatic light" },
  { m: "twist i promised you", p: "young content creator filming with a camera and softbox light, bokeh" },
  { m: "insanely rich", p: "luxury futuristic city skyline at night, neon, aerial view, wealth" },
];

const cues = [];
for (const a of ANCHORS) {
  let start = a.at != null ? a.at : null;
  if (a.m) { const b = timing.beats.find((x) => x.text.toLowerCase().includes(a.m)); if (b) start = b.start; }
  if (start == null || start >= total) continue;
  cues.push({ start, p: a.p });
}
cues.sort((x, y) => x.start - y.start);
cues.forEach((c, i) => { c.end = Math.min(i + 1 < cues.length ? cues[i + 1].start : total, total); });

async function genImage(prompt, dest, seed) {
  const full = `${prompt}, ${STYLE}`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=1920&height=1080&nologo=true&model=flux&seed=${seed}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

const manifest = [];
for (let i = 0; i < cues.length; i++) {
  const c = cues[i];
  const dur = Math.max(1, +(c.end - c.start).toFixed(2));
  const dest = `${outDir}/img${i}.jpg`;
  try {
    await genImage(c.p, dest, 1000 + i);
    manifest.push({ start: +c.start.toFixed(2), dur, file: dest, kw: c.p });
    console.log(`  IA img ${i}: "${c.p.slice(0, 40)}..." [${c.start.toFixed(1)}s +${dur}s]`);
  } catch (e) {
    console.log(`  error img "${c.p.slice(0, 30)}": ${e.message}`);
  }
}

fs.writeFileSync(`${outDir}/bg.json`, JSON.stringify(manifest, null, 2));
console.log(`bg.json: ${manifest.length} imagenes IA`);
