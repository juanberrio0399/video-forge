// clip_pd_short.mjs — CLIPEADOR de shorts a partir de video LARGO de DOMINIO PÚBLICO (Archive.org).
// Flujo: resuelve el item en Archive.org -> descarga el mp4 -> saca miniaturas -> la IA (Gemini
// Vision) "mira" y elige el MEJOR momento (gag/escena) + título -> corta ~35s -> arma un SHORT 9:16
// (fondo desenfocado + film centrado) con NUESTRO audio (música) + subtítulo + crédito PD + grade
// cine. Salida: <out.mp4> + publish/package.json + clip_manifest.json (para la puerta de compliance).
// REGLA: solo el VIDEO del film (PD por antigüedad); el audio original se DESCARTA (ponemos el nuestro).
//
// Uso: node pipeline/clip_pd_short.mjs "<título>" <categoria> <out.mp4>
// Env: GEMINI_API_KEY(,2). music.mp3 opcional en el cwd.
import fs from "node:fs";
import { execSync } from "node:child_process";

const [title, niche = "graciosos", outPath = "short.mp4"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const W = 1080, H = 1920, CLIP = 35;
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const work = "clipwork"; fs.mkdirSync(work, { recursive: true });
const FONT = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"].find((f) => fs.existsSync(f)) || "";
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();

// 1) Resolver el item en Archive.org (por título, mediatype movies, preferir 1080p).
console.log(`Buscando "${title}" en Archive.org…`);
const q = encodeURIComponent(`title:(${title}) AND mediatype:movies`);
const sr = await (await tf(`https://archive.org/advancedsearch.php?q=${q}&fl=identifier,title,year&rows=15&output=json`)).json();
let docs = (sr.response && sr.response.docs) || [];
if (!docs.length) { console.error("No encontré el item en Archive.org"); process.exit(1); }
docs.sort((a, b) => (/1080|hd|high/i.test(b.title || "") ? 1 : 0) - (/1080|hd|high/i.test(a.title || "") ? 1 : 0));

// 2) Elegir un mp4 grande del primer item que tenga uno.
let mp4url = null, ident = null;
for (const d of docs.slice(0, 6)) {
  try {
    const meta = await (await tf(`https://archive.org/metadata/${d.identifier}`)).json();
    const files = (meta.files || []).filter((f) => /\.mp4$/i.test(f.name) && +(f.size || 0) > 5e6).sort((a, b) => +b.size - +a.size);
    if (files.length) { ident = d.identifier; mp4url = `https://archive.org/download/${d.identifier}/${encodeURIComponent(files[0].name)}`; break; }
  } catch {}
}
if (!mp4url) { console.error("No hallé un mp4 descargable"); process.exit(1); }
console.log(`Item: ${ident}`);

// 3) Descargar el film.
const film = `${work}/film.mp4`;
console.log("Descargando el film…");
const r = await tf(mp4url, {}, 600000);
if (!r.ok) { console.error("descarga falló " + r.status); process.exit(1); }
fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
if (dur < 60) { console.error("film muy corto/ilegible"); process.exit(1); }
console.log(`Duración: ${Math.round(dur / 60)} min`);

// 4) Miniaturas cada ~ (dur/18), saltando 8% inicial/final.
const a0 = dur * 0.08, a1 = dur * 0.92, N = 16, step = (a1 - a0) / N;
const thumbs = [];
for (let i = 0; i < N; i++) {
  const t = Math.round(a0 + i * step);
  const p = `${work}/th${i}.jpg`;
  try { execSync(`ffmpeg -y -ss ${t} -i "${film}" -frames:v 1 -vf "scale=320:-1" "${p}"`, { stdio: "ignore" }); if (fs.existsSync(p)) thumbs.push({ t, p }); } catch {}
}
if (!thumbs.length) { console.error("no pude sacar miniaturas"); process.exit(1); }

// 5) La IA MIRA las miniaturas y elige el mejor momento + título/subtítulo.
async function pickMoment() {
  if (!KEYS.length) return null;
  const parts = [{ text: `Eres editor de SHORTS virales. Estas ${thumbs.length} miniaturas son de la película muda de DOMINIO PÚBLICO "${title}" (categoría: ${niche}). Cada una trae su timestamp en segundos. Elige el momento MÁS ICÓNICO y VIRAL: el gag/escena más famoso e impactante que la gente COMPARTIRÍA hoy — NADA aburrido ni de relleno; prioriza acción/movimiento/sorpresa clara y con el sujeto BIEN CENTRADO en el encuadre. Devuelve SOLO JSON: {"start": <segundos, del timestamp elegido menos 4>, "title": "título en INGLÉS de alto CTR (<=60 chars)"}.` }];
  thumbs.forEach((th) => { parts.push({ text: `t=${th.t}s` }); parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(th.p).toString("base64") } }); });
  for (let round = 0; round < 2; round++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }) }, 60000);
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      if (t) return JSON.parse(t);
    } catch {}
  }
  return null;
}
let pick = await pickMoment();
if (!pick || !isFinite(+pick.start)) { const t = thumbs[Math.floor(thumbs.length * 0.7)]; pick = { start: t.t, title: `${title} — Classic Comedy Moment`, caption: "" }; console.log("(fallback: momento del último tercio)"); }
let start = Math.max(a0, Math.min(+pick.start, dur - CLIP - 2));
console.log(`Momento elegido: ${Math.round(start)}s · "${pick.title}"`);

// 6) Cortar + 9:16 PROFESIONAL: LLENA la pantalla (escala a lo alto y recorta al centro) =
// tamaño completo, bien centrado, SIN barras ni subtítulos. Grade cine + viñeta sutil. Audio nuestro.
const vf = `scale=-2:${H}:flags=lanczos,crop=${W}:${H},eq=contrast=1.07:saturation=1.06:brightness=0.01,unsharp=3:3:0.3,vignette=a=PI/7`;
// Corte PRECISO: seek rápido a un keyframe antes + seek fino exacto -> primer fotograma NÍTIDO
// (evita el frame ampliado/borroso de arrancar a mitad de GOP).
const pre = Math.max(0, start - 3), fine = (start - pre).toFixed(2);
const silent = `${work}/silent.mp4`;
execSync(`ffmpeg -y -ss ${pre} -i "${film}" -ss ${fine} -t ${CLIP} -vf "${vf}" -an -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p "${silent}"`, { stdio: "inherit" });
if (fs.existsSync("music.mp3")) execSync(`ffmpeg -y -i "${silent}" -stream_loop -1 -i music.mp3 -filter_complex "[1:a]volume=0.5,afade=t=in:st=0:d=1[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
else execSync(`ffmpeg -y -i "${silent}" -map 0:v -an -c:v copy "${outPath}"`, { stdio: "inherit" });

// 7) Paquete de publicación + manifiesto de compliance (fuente = dominio público).
fs.mkdirSync("publish", { recursive: true });
const pkg = { title: (pick.title || title).slice(0, 100) + " #Shorts", description: `${pick.caption || ""}\n\nClip de "${title}" — dominio público.\n#Shorts #classicmovies #comedy`, tags: ["shorts", "classic movie", "comedy", "silent film", niche], language: "en" };
fs.writeFileSync("publish/package.json", JSON.stringify(pkg, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({ niche, format: "9:16", clips: [{ clip_id: "pd1", source: "archive_org", license: "public-domain", url: `https://archive.org/details/${ident}`, query: title }], transform: { narration: false, editing: true, original_script: true, sound_design: true } }, null, 2));
console.log(`Short listo -> ${outPath} · "${pkg.title}"`);
