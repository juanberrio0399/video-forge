// fetch_ai_images.mjs — genera MUCHAS imagenes IA (una cada ~5s, un plano nuevo por
// tramo) con Pollinations.ai (GRATIS, sin key), para un flujo cinematografico tipo
// pelicula. Cada plano se relaciona con lo que dice la voz en ese momento.
//
// Uso: node pipeline/fetch_ai_images.mjs <timing.json> [outDir=aiimg] [maxSeconds]
import fs from "node:fs";

const [timingPath, outDir = "aiimg", maxSecondsArg] = process.argv.slice(2);
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const maxSeconds = maxSecondsArg && parseFloat(maxSecondsArg) > 0 ? parseFloat(maxSecondsArg) : timing.total;
const total = Math.min(timing.total, maxSeconds);
fs.mkdirSync(outDir, { recursive: true });

const SEG = 5.0; // segundos por plano (ritmo de pelicula)
const STYLE = "cinematic film still, 35mm, dramatic volumetric lighting, highly detailed, shallow depth of field, teal and emerald and warm gold color grade, moody atmosphere, photorealistic, 8k, no text, no watermark, no words, no letters";

// Deriva el SUJETO del plano segun lo que dice la voz en ese tramo.
function subject(text) {
  const t = text.toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (has("netflix", "hollywood", "movies", "streaming empire")) return "empty grand cinema movie theater with red velvet seats, projector beam";
  if (has("youtube tv", "television", "cable", "live tv", "channels")) return "dark cozy living room with a large glowing television screen at night";
  if (has("ads", "advertising", "advertiser", "election", "political", "campaign")) return "close up of a glowing smartphone showing a video ad, dark reflections";
  if (has("creator", "filming", "camera", "bedroom", "teenager", "youtuber", "mrbeast")) return "young content creator filming in a home studio with camera and ring light, bokeh";
  if (has("subscription", "premium", "pay every month", "eighty-three")) return "hand holding phone with a glowing subscribe button, dark cinematic";
  if (has("second", "minute", "clock", "time", "tick", "counting")) return "extreme macro of a luxury watch mechanism and falling coins, motion";
  if (has("hundred billion", "paid", "paycheck", "rent", "wealth", "rich", "richer", "eighty-five million", "millionaire", "empire")) return "towering stacks of cash and gold coins with glowing particles, wealth";
  if (has("netflix", "passed")) return "two glowing skyscrapers side by side at night, competition";
  if (has("money", "dollars", "cash", "billion", "million", "revenue", "earn", "spend", "sixty")) return "flowing river of dollar bills and coins, cinematic macro, glowing";
  if (has("attention", "watch", "video", "views", "scroll")) return "abstract glowing network of screens and light streams, data";
  if (has("google", "machine", "engine", "internet", "platform")) return "vast dark server room with glowing data lights, cinematic";
  return "abstract cinematic visualization of money and data, glowing particles, dark";
}

// Agrupa beats en segmentos de ~SEG segundos (un plano por segmento).
const beats = timing.beats.filter((b) => b.start < total);
const segs = [];
let cur = null;
for (const b of beats) {
  if (!cur) cur = { start: b.start, end: b.end, text: b.text };
  else { cur.end = b.end; cur.text += " " + b.text; }
  if (cur.end - cur.start >= SEG) { segs.push(cur); cur = null; }
}
if (cur) segs.push(cur);
segs.forEach((s) => { s.end = Math.min(s.end, total); });

async function genImage(prompt, dest, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1920&height=1080&nologo=true&model=flux&seed=${seed}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

const CONC = 6; // imagenes en paralelo (mas rapido)
const slots = new Array(segs.length).fill(null);
let next = 0, done = 0;
console.log(`Generando ${segs.length} planos IA (~${SEG}s c/u, ${CONC} en paralelo)...`);

async function worker() {
  while (true) {
    const i = next++;
    if (i >= segs.length) break;
    const s = segs[i];
    const dur = Math.max(1, +(s.end - s.start).toFixed(2));
    const prompt = `${subject(s.text)}, ${STYLE}`;
    const dest = `${outDir}/img${i}.jpg`;
    for (let intento = 1; intento <= 2; intento++) {
      try {
        await genImage(prompt, dest, 1000 + i);
        slots[i] = { start: +s.start.toFixed(2), dur, file: dest };
        break;
      } catch (e) {
        if (intento === 2) console.log(`  error plano ${i}: ${e.message}`);
      }
    }
    if (++done % 10 === 0) console.log(`  ...${done}/${segs.length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

const manifest = slots.filter(Boolean);
fs.writeFileSync(`${outDir}/bg.json`, JSON.stringify(manifest, null, 2));
console.log(`bg.json: ${manifest.length}/${segs.length} planos IA`);
