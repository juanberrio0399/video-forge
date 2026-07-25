// recipe_assemble.mjs — arma el REEL vertical 9:16 de la receta.
// Toma TUS fotos/videos EN EL ORDEN que los mandaste (uno por beat), embellece cada
// toma (luz/color apetitoso + encuadre 9:16 + Ken Burns en las fotos), y para los pasos
// que te falten mete b-roll de cocina de Pexels (o una imagen IA) relacionado al paso.
// Sincroniza cada toma con la narracion (voz clonada), quema el subtitulo del paso,
// une todo con transiciones y mezcla voz + musica suave. Salida: reel 1080x1920.
//
// Uso: node pipeline/recipe_assemble.mjs <plan.json> <timing.json> <mediaDir> <voz.wav> <out.mp4>
// Env: PEXELS_API_KEY, PIXABAY_API_KEY (opcionales). Si existe music.mp3 en el cwd, se mezcla.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const [planPath, timingPath, mediaDir, voicePath, outPath] = process.argv.slice(2);
const PEXELS = process.env.PEXELS_API_KEY || "";
const PIXABAY = process.env.PIXABAY_API_KEY || "";

const W = 1080, H = 1920, FPS = 30, TD = 0.4;
const FONT = [
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
].find((f) => fs.existsSync(f)) || "";

// Grade "apetitoso" para comida: mas luz, color vivo y calido, micro-nitidez. Se aplica
// a TODA toma (tuya, Pexels o IA) para que el reel se vea parejo y bonito.
const GRADE = "eq=brightness=0.03:saturation=1.2:contrast=1.06,curves=preset=lighter,unsharp=3:3:0.4";
const COVER = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const beats = plan.beats || [];
const durOf = (i) => {
  const b = (timing.beats || []).find((x) => x.index === i) || (timing.beats || [])[i];
  return Math.max(1.4, (b && b.dur ? +b.dur : 3.5));
};

// Tus medios, en el ORDEN que los mandaste (000, 001, ...).
const media = fs.existsSync(mediaDir)
  ? fs.readdirSync(mediaDir).filter((f) => /\.(jpg|jpeg|png|mp4|mov)$/i.test(f)).sort()
  : [];
console.log(`Reel receta: ${beats.length} beats · ${media.length} medios tuyos · fuente relleno=${PEXELS ? "Pexels" : "IA"}`);

const TRANS = ["fade", "dissolve", "smoothup", "wiperight", "circleopen", "slideup", "fadeblack"];
const work = "reel";
fs.mkdirSync(work, { recursive: true });

async function dl(url, dest) { const r = await fetch(url); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); }

async function pexelsVideo(q) {
  if (!PEXELS) return null;
  try {
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=12`, { headers: { Authorization: PEXELS } });
    if (!r.ok) return null;
    const j = await r.json();
    const vids = (j.videos || []).sort(() => Math.random() - 0.5);
    for (const v of vids) {
      const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.height);
      files.sort((a, b) => b.height - a.height);
      const f = files.find((f) => f.height >= 1080 && f.height <= 1920) || files[0];
      if (f) return f.link;
    }
  } catch {}
  return null;
}
async function pixabayVideo(q) {
  if (!PIXABAY) return null;
  try {
    const r = await fetch(`https://pixabay.com/api/videos/?key=${PIXABAY}&q=${encodeURIComponent(q)}&per_page=12`);
    if (!r.ok) return null;
    const j = await r.json();
    for (const h of (j.hits || []).sort(() => Math.random() - 0.5)) {
      const f = (h.videos || {}).large || (h.videos || {}).medium || (h.videos || {}).small;
      if (f && f.url) return f.url;
    }
  } catch {}
  return null;
}
async function aiImage(prompt, dest, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ", appetizing food photography, natural warm light, shallow depth of field, no text")}?width=${W}&height=${H}&nologo=true&model=flux&seed=${seed}`;
  await dl(url, dest);
}

// Parte el subtitulo en <=2 lineas para que quepa a lo ancho.
function wrap(text, per = 18) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > per && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2).join("\n");
}

// Filtro de subtitulo (caja legible abajo). Usa textfile para no pelear con el escapado.
function subtitleFilter(i, text) {
  if (!FONT || !text) return "";
  const tf = path.resolve(`${work}/sub${i}.txt`).replace(/\\/g, "/");
  fs.writeFileSync(tf, wrap(text));
  return `,drawtext=fontfile='${FONT}':textfile='${tf}':fontcolor=white:fontsize=54:line_spacing=10:box=1:boxcolor=black@0.55:boxborderw=26:x=(w-text_w)/2:y=h-460`;
}

// Genera el clip de un beat: fuente (tu medio / Pexels / IA) -> 9:16 + grade + Ken Burns
// (si es foto) + subtitulo quemado, con duracion = narracion del beat (+ cola para fundir).
async function makeBeat(i) {
  const dur = +(durOf(i) + TD).toFixed(2);
  const out = `${work}/beat${String(i).padStart(3, "0")}.mp4`;
  const sub = subtitleFilter(i, beats[i].subtitle);
  const mine = media[i] ? path.join(mediaDir, media[i]) : null;
  const isVideo = (p) => /\.(mp4|mov)$/i.test(p);

  // 1) Tu medio, si mandaste uno para este beat.
  if (mine && fs.existsSync(mine)) {
    if (isVideo(mine)) {
      execSync(`ffmpeg -y -stream_loop -1 -i "${mine}" -t ${dur} -vf "${COVER},${GRADE}${sub}" -an -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
    } else {
      kenBurns(mine, out, dur, i, sub);
    }
    return { out, dur, src: "tuyo" };
  }

  // 2) Relleno: b-roll de cocina de Pexels/Pixabay relacionado al paso.
  let link = await pexelsVideo(beats[i].query);
  if (!link) link = await pixabayVideo(beats[i].query);
  if (link) {
    const raw = `${work}/raw${i}.mp4`;
    await dl(link, raw);
    execSync(`ffmpeg -y -stream_loop -1 -i "${raw}" -t ${dur} -vf "${COVER},${GRADE}${sub}" -an -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
    fs.rmSync(raw, { force: true });
    return { out, dur, src: "pexels" };
  }

  // 3) Ultimo recurso: imagen IA de comida animada.
  const img = `${work}/img${i}.jpg`;
  await aiImage(beats[i].img_prompt, img, 2000 + i);
  kenBurns(img, out, dur, i, sub);
  return { out, dur, src: "ia" };
}

// Foto -> video con movimiento suave (Ken Burns) para que no se sienta estatico.
function kenBurns(img, out, dur, i, sub) {
  const frames = Math.round(dur * FPS);
  const zin = i % 2 === 0;
  const z = zin ? "min(zoom+0.0009,1.25)" : "if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0009))";
  execSync(`ffmpeg -y -loop 1 -i "${img}" -t ${dur} -vf "scale=${W * 1.4}:${H * 1.4},zoompan=z='${z}':d=${frames}:s=${W}x${H}:fps=${FPS},${GRADE}${sub}" -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
}

// Construye todos los beats en orden.
const parts = [], durs = [];
for (let i = 0; i < beats.length; i++) {
  try {
    const r = await makeBeat(i);
    parts.push(path.resolve(r.out).replace(/\\/g, "/"));
    durs.push(r.dur);
    console.log(`  beat ${i} (${r.src}) [${beats[i].subtitle || "-"}] ${r.dur}s`);
  } catch (e) {
    console.log(`  error beat ${i}: ${e.message}`);
  }
}
if (!parts.length) { console.error("Sin clips -> no puedo armar el reel."); process.exit(1); }

// Une los clips con transiciones (cadena xfade), como el fondo del canal.
const silent = `${work}/silent.mp4`;
if (parts.length === 1) {
  execSync(`ffmpeg -y -i "${parts[0]}" -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${silent}"`, { stdio: "inherit" });
} else {
  const inputs = parts.map((p) => `-i "${p}"`).join(" ");
  let filter = "", acc = "[0:v]", accLen = durs[0];
  for (let i = 1; i < parts.length; i++) {
    const offset = +(accLen - TD).toFixed(3);
    const tr = TRANS[(i - 1) % TRANS.length];
    filter += `${acc}[${i}:v]xfade=transition=${tr}:duration=${TD}:offset=${offset}[v${i}];`;
    acc = `[v${i}]`;
    accLen = +(accLen + durs[i] - TD).toFixed(3);
  }
  filter = filter.replace(/;$/, "");
  execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${silent}"`, { stdio: "inherit" });
}

// Mezcla voz (narracion clonada) + musica suave si hay music.mp3.
const hasMusic = fs.existsSync("music.mp3");
if (hasMusic) {
  execSync(`ffmpeg -y -i "${silent}" -i "${voicePath}" -stream_loop -1 -i music.mp3 -filter_complex "[1:a]volume=1.0[v];[2:a]volume=0.10[m];[v][m]amix=inputs=2:duration=first:dropout_transition=0[a]" -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
} else {
  execSync(`ffmpeg -y -i "${silent}" -i "${voicePath}" -map 0:v -map 1:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
}
console.log(`Reel listo -> ${outPath} (${parts.length} beats, ${W}x${H}, musica=${hasMusic ? "si" : "no"})`);
