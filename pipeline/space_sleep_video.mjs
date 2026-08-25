// space_sleep_video.mjs — Ensambla un video LARGO 16:9 (1920x1080) de relajación/sueño para Oddly:
// imágenes REALES de la NASA (dominio público) con Ken Burns MUY lento y fundidos largos, un lecho
// AMBIENTAL generado con ffmpeg (pad de acorde menor + brisa cósmica + eco — 100% original y legal),
// la narración calmada por encima, tarjeta de título elegante y fundidos de entrada/salida suaves.
// Sin subtítulos (visual limpio para dormir). Calidad alta pero encode ágil (video largo).
//
// Uso: node pipeline/space_sleep_video.mjs <script.json> <narration.mp3> <out.mp4>
import fs from "node:fs";
import { execSync } from "node:child_process";

const [scriptPath = "script.json", narrPath = "narration.mp3", outPath = "sleep.mp4"] = process.argv.slice(2);
const W = 1920, H = 1080, FPS = 24;
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const facts = (script.facts || []).filter((f) => f && f.query);
const work = "sleepwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const tf = (u, o = {}, ms = 120000) => fetch(u, { ...o, headers: { "user-agent": "video-forge/1.0 (relaxation; contact via youtube)", ...(o.headers || {}) }, signal: AbortSignal.timeout(ms) });

const narrDur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${narrPath}"`).trim()) || 300;
const DUR = +(narrDur + 3).toFixed(2); // cola suave de 3 s al final (queda ambiente + estrellas)
console.log(`Narración: ${narrDur.toFixed(1)}s -> video ${DUR.toFixed(1)}s · datos: ${facts.length}`);

// Cuántas imágenes: ~1 cada ~30-40 s. Entre 8 y 20.
const N = Math.max(8, Math.min(20, Math.round(DUR / 34)));
const FALLBACK_QUERIES = ["Orion Nebula", "Andromeda Galaxy", "Saturn Cassini", "Pillars of Creation Hubble", "Carina Nebula", "Jupiter", "Milky Way core", "Earth from space", "Hubble deep field", "Helix Nebula", "Whirlpool Galaxy", "solar flare Sun"];

const usedImg = new Set();
const credits = [];

// ---------- NASA images-api: imagen real de alta resolución (dominio público) ----------
async function nasaImage(query) {
  let items = [];
  try {
    const s = await (await tf(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=24`)).json();
    items = (s.collection && s.collection.items) || [];
  } catch { return null; }
  for (const it of items) {
    const nasaId = it.data && it.data[0] && it.data[0].nasa_id;
    if (!nasaId || usedImg.has(nasaId)) continue;
    let assets = [];
    try { assets = await (await tf(it.href, {}, 30000)).json(); } catch { assets = []; }
    const jpgs = (Array.isArray(assets) ? assets : []).filter((u) => /\.jpe?g$/i.test(u) && !/~thumb\./i.test(u));
    // Preferir "large" (buena calidad, peso manejable); evitar "orig" (puede pesar decenas de MB).
    const pick = jpgs.find((u) => /~large\./i.test(u)) || jpgs.find((u) => /~medium\./i.test(u)) || jpgs.find((u) => /~orig\./i.test(u)) || (it.links && it.links[0] && it.links[0].href);
    if (!pick) continue;
    usedImg.add(nasaId);
    return { url: pick.replace(/^http:/, "https:"), id: nasaId, title: (it.data[0].title || query).slice(0, 90) };
  }
  return null;
}

// Fondo de espacio profundo generado (última red: nunca aborta el video).
function starfield(dur, idx) {
  const seg = `${work}/seg${idx}.mp4`;
  const c0 = ["0x05070f", "0x0a0612", "0x060a12"][idx % 3];
  try {
    execSync(`ffmpeg -y -f lavfi -i "gradients=s=${W}x${H}:c0=${c0}:c1=0x000000:d=${dur.toFixed(2)}:speed=0.008" -t ${dur.toFixed(2)} -vf "noise=alls=7:allf=t,vignette=a=PI/6,eq=brightness=-0.03" -r ${FPS} -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  } catch {
    execSync(`ffmpeg -y -f lavfi -i "color=c=${c0}:s=${W}x${H}:d=${dur.toFixed(2)}" -vf "vignette" -r ${FPS} -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  }
  return { seg, kind: "generated" };
}

// Ken Burns 16:9 MUY lento (zoom suave, paneo mínimo) -> sensación de deriva calmada.
function kenBurns(imgPath, dur, idx) {
  const frames = Math.max(2, Math.round(dur * FPS));
  const zoomIn = idx % 2 === 0;
  const z = zoomIn ? `'min(zoom+0.00030,1.14)'` : `'if(eq(on,0),1.14,max(zoom-0.00030,1.0))'`;
  const panX = idx % 3 === 0 ? `'(iw-iw/zoom)/2'` : idx % 3 === 1 ? `'(iw-iw/zoom)*0.25'` : `'(iw-iw/zoom)*0.75'`;
  const vf = `scale=${Math.round(W * 1.25)}:${Math.round(H * 1.25)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.25)}:${Math.round(H * 1.25)},` +
    `zoompan=z=${z}:x=${panX}:y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${FPS},` +
    `eq=contrast=1.03:saturation=1.05:brightness=-0.02,vignette=a=PI/6`;
  const seg = `${work}/seg${idx}.mp4`;
  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  return seg;
}

async function buildSegment(query, dur, idx) {
  const tries = [query, ...FALLBACK_QUERIES];
  for (const q of tries) {
    let img = null; try { img = await nasaImage(q); } catch {}
    if (!img) continue;
    try {
      const ip = `${work}/img${idx}.jpg`;
      const r = await tf(img.url, {}, 180000);
      if (!r.ok) continue;
      fs.writeFileSync(ip, Buffer.from(await r.arrayBuffer()));
      // Verificar que ffmpeg pueda leerla (algunas NASA vienen corruptas/enormes).
      try { sh(`ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "${ip}"`); } catch { continue; }
      const seg = kenBurns(ip, dur, idx);
      console.log(`  seg ${idx}: NASA "${img.title}"`);
      credits.push(`${img.title} — NASA (public domain) · https://images.nasa.gov/details/${img.id}`);
      return { seg, kind: "nasa", id: img.id };
    } catch {}
  }
  console.error(`  seg ${idx}: sin imagen NASA para "${query}" -> campo estelar generado`);
  return starfield(dur, idx);
}

// Repartir N imágenes a lo largo de la narración (usa las queries de los datos, en orden, ciclando).
const TD = 1.4; // fundido largo entre imágenes (disolvencia onírica)
const segDur = +(((DUR + TD * (N - 1)) / N) + 0.3).toFixed(2);
const built = [];
for (let i = 0; i < N; i++) {
  const q = facts.length ? facts[i % facts.length].query : FALLBACK_QUERIES[i % FALLBACK_QUERIES.length];
  built.push(await buildSegment(q, segDur, i));
}

// Concatenar con xfade -> fondo del largo total.
const bg = `${work}/bg.mp4`;
if (built.length === 1) {
  execSync(`ffmpeg -y -stream_loop -1 -i "${built[0].seg}" -t ${DUR.toFixed(2)} -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
} else {
  const inputs = built.map((p) => `-i "${p.seg}"`).join(" ");
  let filter = "", acc = "[0:v]", accLen = segDur;
  for (let i = 1; i < built.length; i++) {
    const off = +(accLen - TD).toFixed(3);
    filter += `${acc}[${i}:v]xfade=transition=fade:duration=${TD}:offset=${off}[v${i}];`;
    acc = `[v${i}]`; accLen = +(accLen + segDur - TD).toFixed(3);
  }
  filter = filter.replace(/;$/, "");
  execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -t ${DUR.toFixed(2)} -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
}

// ---------- Lecho ambiental generado (pad de La menor + brisa cósmica + eco). Legal y original. ----------
// tremolo exige f>=0.1 Hz. Envuelto en try/catch: un ambiente que falla NO debe tumbar el render.
const amb = `${work}/ambient.m4a`;
try {
  execSync(`ffmpeg -y ` +
    `-f lavfi -i "sine=frequency=110:duration=${DUR.toFixed(2)}" ` +      // A2 (raíz)
    `-f lavfi -i "sine=frequency=130.81:duration=${DUR.toFixed(2)}" ` +   // C3 (tercera menor)
    `-f lavfi -i "sine=frequency=164.81:duration=${DUR.toFixed(2)}" ` +   // E3 (quinta)
    `-f lavfi -i "sine=frequency=220:duration=${DUR.toFixed(2)}" ` +      // A3 (octava, sutil)
    `-f lavfi -i "anoisesrc=duration=${DUR.toFixed(2)}:color=pink:amplitude=0.07" ` + // brisa cósmica
    `-filter_complex "` +
    `[0:a]volume=0.55,tremolo=f=0.10:d=0.35[d0];` +
    `[1:a]volume=0.30,tremolo=f=0.10:d=0.45[d1];` +
    `[2:a]volume=0.26,tremolo=f=0.12:d=0.4[d2];` +
    `[3:a]volume=0.12[d3];` +
    `[4:a]lowpass=f=650,volume=0.55[nz];` +
    `[d0][d1][d2][d3][nz]amix=inputs=5:normalize=0[mx];` +
    `[mx]lowpass=f=1500,aecho=0.8:0.85:900|1700:0.35|0.25,volume=1.1,` +
    `afade=t=in:d=6,afade=t=out:st=${(DUR - 7).toFixed(2)}:d=7[a]" ` +
    `-map "[a]" -c:a aac -b:a 160k "${amb}"`, { stdio: "pipe" });
} catch (e) {
  console.error("ambiente principal falló -> ambiente simple:", String(e.message || e).slice(0, 140));
  try {
    execSync(`ffmpeg -y ` +
      `-f lavfi -i "sine=frequency=110:duration=${DUR.toFixed(2)}" ` +
      `-f lavfi -i "sine=frequency=164.81:duration=${DUR.toFixed(2)}" ` +
      `-f lavfi -i "anoisesrc=duration=${DUR.toFixed(2)}:color=pink:amplitude=0.05" ` +
      `-filter_complex "[0:a]volume=0.5[a0];[1:a]volume=0.22[a1];[2:a]lowpass=f=600,volume=0.5[a2];` +
      `[a0][a1][a2]amix=inputs=3:normalize=0,lowpass=f=1400,afade=t=in:d=5,afade=t=out:st=${(DUR - 6).toFixed(2)}:d=6[a]" ` +
      `-map "[a]" -c:a aac -b:a 160k "${amb}"`, { stdio: "pipe" });
  } catch (e2) {
    console.error("ambiente simple también falló -> silencio:", String(e2.message || e2).slice(0, 140));
    execSync(`ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${DUR.toFixed(2)} -c:a aac -b:a 96k "${amb}"`, { stdio: "ignore" });
  }
}

// ---------- Tarjeta de título elegante (primeros ~7 s, con fundido) ----------
const FONTS = ["/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"];
const FONT = FONTS.find((f) => fs.existsSync(f)) || "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const cardText = (script.card_title || "Space Facts to Fall Asleep To").replace(/[^A-Za-z0-9 ,'’&|-]/g, "").slice(0, 60);
fs.writeFileSync(`${work}/title.txt`, cardText);
const titleVf = `drawtext=textfile='${work}/title.txt':fontfile='${FONT}':fontcolor=white:fontsize=62:` +
  `x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black@0.6:shadowx=2:shadowy=2:` +
  `alpha='if(lt(t\\,1)\\,t\\,if(lt(t\\,6)\\,1\\,if(lt(t\\,7)\\,7-t\\,0)))':enable='between(t\\,0\\,7)'`;

// ---------- Mezcla final: fondo + título + narración calmada + ambiente + fundidos ----------
execSync(`ffmpeg -y -i "${bg}" -i "${narrPath}" -i "${amb}" ` +
  `-filter_complex "` +
  `[0:v]${titleVf},fade=t=in:d=2.5,fade=t=out:st=${(DUR - 3).toFixed(2)}:d=3[v];` +
  `[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[nar];` +
  `[2:a]volume=0.17[ambv];` +
  `[nar][ambv]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]" ` +
  `-map "[v]" -map "[a]" -t ${DUR.toFixed(2)} -r ${FPS} ` +
  `-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${outPath}"`, { stdio: "inherit" });

// ---------- Paquete SEO + manifiesto de compliance ----------
const uniqCred = [...new Set(credits)];
const nasaCount = built.filter((b) => b.kind === "nasa").length;
const title = String(script.title || "Space Facts to Fall Asleep To | Deep Space Relaxation").slice(0, 100);
const desc = [
  script.seo_desc || "Calm space facts narrated softly to help you relax and fall asleep, with real imagery from deep space.",
  "",
  "Drift off to sleep with gentle facts about our universe — planets, nebulae, galaxies and the quiet vastness of space — over real photographs from NASA. Best with headphones, at a low volume, in the dark.",
  "",
  "⏱ Timestamps: put on, close your eyes, and let it play.",
  "",
  ((script.hashtags || ["#sleep", "#space", "#relaxation"]).join(" ")).trim(),
  "",
  "Imagery: NASA (public domain):",
  ...uniqCred.slice(0, 40),
  "",
  "This video uses an AI-generated narration voice and original ambient sound design. For relaxation and educational purposes.",
].join("\n");
fs.mkdirSync("publish", { recursive: true });
fs.writeFileSync("publish/package.json", JSON.stringify({
  title, description: desc,
  tags: ["space", "sleep", "relaxation", "asmr", "space facts", "deep space", "fall asleep", "study", "meditation", "nasa"],
  language: "en",
}, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({
  niche: "space_sleep", format: "16:9", duration_s: Math.round(DUR),
  clips: built.map((b, i) => ({ clip_id: "s" + i, source: b.kind === "nasa" ? "nasa_images" : "generated_bg", license: b.kind === "nasa" ? "public-domain" : "generated", id: b.id || "", query: facts[i % Math.max(1, facts.length)] ? facts[i % facts.length].query : "" })),
  transform: { narration: true, original_audio: false, editing: true, original_script: true, sound_design: true, music: "generated_ambient" },
}, null, 2));
console.log(`Video de SUEÑO listo -> ${outPath} · "${title}" · ${built.length} segmentos (${nasaCount} NASA / ${built.length - nasaCount} generados) · ${DUR.toFixed(0)}s`);
