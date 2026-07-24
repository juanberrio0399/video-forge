// build_background.mjs — arma UN fondo tipo pelicula: muchos planos que se MUEVEN,
// cortados cada ~5s. Por cada tramo baja footage real de Pexels (se mueve de verdad);
// si no hay, genera una imagen IA y la anima con zoompan (movimiento real). Luego
// concatena todo en bg/bg.mp4 (cortes rapidos) para overlay de graficos encima.
//
// Uso: node pipeline/build_background.mjs <timing.json> [outDir=bg] [maxSeconds]
// Env: PEXELS_API_KEY (opcional; sin ella, todo con imagenes IA animadas).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const [timingPath, outDir = "bg", maxSecondsArg] = process.argv.slice(2);
const KEY = process.env.PEXELS_API_KEY || "";
const PIXABAY = process.env.PIXABAY_API_KEY || "";
const GEMINI = process.env.GEMINI_API_KEY || "";
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const maxSeconds = maxSecondsArg && parseFloat(maxSecondsArg) > 0 ? parseFloat(maxSecondsArg) : timing.total;
const total = Math.min(timing.total, maxSeconds);
fs.mkdirSync(outDir, { recursive: true });

const SEG = 5.0;
const TD = 0.6; // duracion de la transicion (solape entre planos)
const VF = "eq=brightness=-0.04:saturation=1.02:contrast=1.05"; // menos oscuro, mas punch
// Temas de relleno para VARIAR cuando dos planos seguidos caerian en el mismo tema.
const FILLERS = [
  { kw: "money cash counting", ai: "close up of cash money bills, cinematic" },
  { kw: "city skyline night aerial", ai: "futuristic city skyline at night, neon, aerial" },
  { kw: "stock market screen data", ai: "glowing stock market data screen, dark" },
  { kw: "server room data lights", ai: "dark server room with glowing data lights" },
  { kw: "person working laptop night", ai: "person working on a laptop at night, glow" },
  { kw: "gold coins wealth", ai: "gold coins and stacks of money, glowing particles" },
];
// Transiciones profesionales de ffmpeg (se van rotando).
const TRANS = ["fade", "dissolve", "smoothleft", "smoothup", "wiperight", "circleopen", "slideup", "radial", "diagtl", "fadegrays"];

// Tema de cada plano segun lo que dice la voz (footage y prompt IA).
function theme(text) {
  const t = text.toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (has("netflix", "hollywood", "movies", "streaming empire")) return { kw: "cinema movie theater", ai: "empty grand cinema movie theater, red seats, projector beam" };
  if (has("youtube tv", "television", "cable", "channels")) return { kw: "living room television night", ai: "dark cozy living room with a glowing tv at night" };
  if (has("ads", "advertising", "election", "campaign")) return { kw: "person using smartphone night", ai: "close up of a glowing smartphone showing a video, dark" };
  if (has("creator", "filming", "camera", "youtuber", "mrbeast", "teenager", "bedroom")) return { kw: "content creator filming camera", ai: "young creator filming in a home studio with ring light, bokeh" };
  if (has("subscription", "premium", "eighty-three")) return { kw: "streaming app phone", ai: "hand holding phone with glowing subscribe button, cinematic" };
  if (has("second", "minute", "clock", "time", "counting")) return { kw: "clock time macro", ai: "extreme macro of a watch mechanism and falling coins" };
  if (has("hundred billion", "rich", "richer", "wealth", "millionaire", "empire", "eighty-five")) return { kw: "stacks of money wealth", ai: "towering stacks of cash and gold coins, glowing particles" };
  if (has("money", "dollars", "cash", "billion", "million", "revenue", "earn", "sixty")) return { kw: "money cash falling", ai: "flowing river of dollar bills and coins, cinematic macro" };
  if (has("google", "machine", "internet", "platform", "data")) return { kw: "server room data center", ai: "vast dark server room with glowing data lights" };
  return { kw: "abstract technology money", ai: "abstract cinematic money and data, glowing particles, dark" };
}

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

async function pexelsLink(kw) {
  if (!KEY) return null;
  try {
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(kw)}&orientation=landscape&size=medium&per_page=12`, { headers: { Authorization: KEY } });
    if (!r.ok) return null;
    const j = await r.json();
    const vids = (j.videos || []).sort(() => Math.random() - 0.5); // variedad
    for (const v of vids) {
      const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.width);
      files.sort((a, b) => b.width - a.width);
      const f = files.find((f) => f.width >= 1280 && f.width <= 1920) || files[0];
      if (f) return f.link;
    }
  } catch {}
  return null;
}
async function pixabayLink(kw) {
  if (!PIXABAY) return null;
  try {
    const r = await fetch(`https://pixabay.com/api/videos/?key=${PIXABAY}&q=${encodeURIComponent(kw)}&per_page=12`);
    if (!r.ok) return null;
    const j = await r.json();
    const hits = (j.hits || []).sort(() => Math.random() - 0.5);
    for (const h of hits) {
      const v = h.videos || {};
      const f = v.large || v.medium || v.small;
      if (f && f.url) return f.url;
    }
  } catch {}
  return null;
}

// Gemini como "director de fotografia": elige el mejor plano por segmento (1 sola llamada).
async function geminiPlan(list) {
  if (!GEMINI) return null;
  const seg = list.map((s, i) => `${i + 1}) ${s.text}`).join("\n");
  const prompt = `Eres director de fotografia de un video faceless cinematografico de datos/dinero (YouTube, ingles). Para CADA segmento de narracion da el mejor plano de fondo. Devuelve SOLO un array JSON, un objeto por segmento en el MISMO orden, con: "q" = query corta (2-4 palabras en INGLES) para buscar b-roll de stock relevante y cinematografico, y "ai" = prompt de imagen IA cinematografica de respaldo. Segmentos:\n${seg}`;
  for (const m of ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-2.0-flash"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      });
      if (!r.ok) { console.error(`gemini ${m}: ${r.status}`); continue; }
      const j = await r.json();
      let t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      const arr = JSON.parse(t);
      if (Array.isArray(arr) && arr.length) { console.log(`Gemini (${m}) planeo ${arr.length} planos.`); return arr; }
    } catch (e) { console.error(`gemini ${m}: ${e.message}`); }
  }
  return null;
}

async function dl(url, dest) { const r = await fetch(url); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); }
async function aiImage(prompt, dest, seed) {
  const style = "cinematic film still, dramatic lighting, teal and gold grade, highly detailed, no text";
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ", " + style)}?width=1920&height=1080&nologo=true&model=flux&seed=${seed}`;
  await dl(url, dest);
}

// Genera cada plano como clip de video del largo exacto (con movimiento real).
async function makeSeg(i, s, th) {
  // +TD de "cola" para que el plano tenga con que solapar en la transicion.
  const dur = Math.max(1.2, +(s.end - s.start + TD).toFixed(2));
  const out = `${outDir}/seg${String(i).padStart(3, "0")}.mp4`;
  let link = await pexelsLink(th.kw);
  let src = "pexels";
  if (!link) { link = await pixabayLink(th.kw); if (link) src = "pixabay"; }
  if (link) {
    const raw = `${outDir}/raw${i}.mp4`;
    await dl(link, raw);
    execSync(`ffmpeg -y -stream_loop -1 -i "${raw}" -t ${dur} -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,${VF}" -an -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
    fs.rmSync(raw, { force: true });
    return { out, dur, src };
  }
  // fallback: imagen IA animada con zoompan (movimiento real sobre la imagen)
  const img = `${outDir}/img${i}.jpg`;
  await aiImage(th.ai, img, 1000 + i);
  const frames = Math.round(dur * 30);
  const zin = i % 2 === 0; // alterna zoom in/out
  const z = zin ? "min(zoom+0.0012,1.3)" : "if(lte(zoom,1.0),1.3,max(1.001,zoom-0.0012))";
  execSync(`ffmpeg -y -loop 1 -i "${img}" -t ${dur} -vf "scale=2600:1463,zoompan=z='${z}':d=${frames}:s=1920x1080:fps=30,${VF}" -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
  return { out, dur, src: "ai" };
}

const plan = await geminiPlan(segs);
console.log(`Fondo tipo pelicula: ${segs.length} planos (~${SEG}s c/u) con transiciones · director: ${plan ? "Gemini" : "heuristica"}`);
const parts = [];
const durs = [];
let prevKw = null, fillerIdx = 0;
const kwCount = {};
for (let i = 0; i < segs.length; i++) {
  // Tema del plano: Gemini si planeo, si no la heuristica.
  let th = plan && plan[i] && plan[i].q
    ? { kw: plan[i].q, ai: plan[i].ai || theme(segs[i].text).ai }
    : theme(segs[i].text);
  // Variedad: ningun tema dos veces seguidas NI mas de 2 veces en total.
  if (th.kw === prevKw || (kwCount[th.kw] || 0) >= 2) { th = FILLERS[fillerIdx++ % FILLERS.length]; }
  kwCount[th.kw] = (kwCount[th.kw] || 0) + 1;
  prevKw = th.kw;
  try {
    const r = await makeSeg(i, segs[i], th);
    parts.push(path.resolve(r.out).replace(/\\/g, "/"));
    durs.push(r.dur);
    if (i % 5 === 0) console.log(`  ...plano ${i}/${segs.length} (${r.src}) [${th.kw}]`);
  } catch (e) {
    console.log(`  error plano ${i}: ${e.message}`);
  }
}

if (!parts.length) { console.log("Sin planos -> sin fondo."); fs.writeFileSync(`${outDir}/bg.json`, "[]"); process.exit(0); }

const bg = `${outDir}/bg.mp4`;
if (parts.length === 1) {
  execSync(`ffmpeg -y -i "${parts[0]}" -t ${total.toFixed(2)} -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p "${bg}"`, { stdio: "inherit" });
} else {
  // Cadena de xfade: cada plano se funde con el siguiente con una transicion pro.
  const inputs = parts.map((p) => `-i "${p}"`).join(" ");
  let filter = "";
  let acc = "[0:v]";
  let accLen = durs[0];
  for (let i = 1; i < parts.length; i++) {
    const offset = +(accLen - TD).toFixed(3);
    const tr = TRANS[(i - 1) % TRANS.length];
    const outLbl = `v${i}`;
    filter += `${acc}[${i}:v]xfade=transition=${tr}:duration=${TD}:offset=${offset}[${outLbl}];`;
    acc = `[${outLbl}]`;
    accLen = +(accLen + durs[i] - TD).toFixed(3);
  }
  filter = filter.replace(/;$/, "");
  execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -t ${total.toFixed(2)} -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p "${bg}"`, { stdio: "inherit" });
}

fs.writeFileSync(`${outDir}/bg.json`, JSON.stringify([{ start: 0, dur: +total.toFixed(2), file: bg }], null, 2));
console.log(`bg.mp4 listo: ${parts.length} planos con transiciones (${total.toFixed(1)}s).`);
