// space_short.mjs — Short 9:16 CALMADO de espacio ("space facts to fall asleep to" como vibe).
// Footage de VIDEO REAL (no fotos): por cada beat busca un clip de VIDEO de la NASA (dominio público),
// respaldo video de Archive.org, y solo si no hay video cae a imagen (Ken Burns) o fondo estelar.
// Narración calmada (voz suave) + lecho ambiental generado (original) con ducking + subtítulos suaves.
//
// Uso: node pipeline/space_short.mjs <script.json> <narration.mp3> <out.mp4>
// Requiere en cwd: words.json (Whisper, opcional).
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf } from "./clip_frame.mjs";
import { keepFootage, prefersGood, kwOf, FOOTAGE_BAD } from "./footage_filter.mjs";

const [scriptPath = "script.json", narrPath = "narration.mp3", outPath = "short.mp4"] = process.argv.slice(2);
const W = 1080, H = 1920, FPS = 30;
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const beats = (script.beats || []).filter((b) => b && b.query);
const topic = script.topic || "space";
const work = "spacework"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, headers: { "user-agent": "video-forge/1.0 (relaxation; contact via youtube)", ...(o.headers || {}) }, signal: AbortSignal.timeout(ms) });
const kw = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);

const narrDur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${narrPath}"`).trim()) || 45;
console.log(`Narración: ${narrDur.toFixed(1)}s · beats: ${beats.length}`);

const usedVid = new Set(), usedImg = new Set();
const credits = [];

// ---------- NASA images-api: CLIP DE VIDEO real (dominio público) ----------
async function nasaVideo(query, dur, idx) {
  let items = [];
  try {
    const s = await (await tf(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=video&page_size=20`)).json();
    items = (s.collection && s.collection.items) || [];
  } catch { return null; }
  // FILTRO COMPARTIDO: fuera producido/ingeniería/misión (texto quemado, naves, cohetes); exige el SUJETO.
  const want = kwOf(query);
  const txtOf = (it) => (it.data[0].title || "") + " " + (it.data[0].description || "");
  const cands = items.filter((it) => {
    const d = it.data && it.data[0]; if (!d || !d.nasa_id || usedVid.has(d.nasa_id)) return false;
    return keepFootage(txtOf(it), want);
  }).sort((a, b) => prefersGood(txtOf(b)) - prefersGood(txtOf(a)));
  for (const it of cands) {
    const nasaId = it.data[0].nasa_id;
    const title = (it.data[0].title || query).slice(0, 90);
    let urls = [];
    try { const col = await (await tf(it.href, {}, 30000)).json(); urls = (Array.isArray(col) ? col : []).filter((u) => /\.mp4$/i.test(u)); } catch {}
    // Preferir "large"/"medium" (calidad buena, peso manejable); evitar "orig" (puede pesar cientos de MB).
    const pick = urls.find((u) => /~large\.mp4$/i.test(u)) || urls.find((u) => /~medium\.mp4$/i.test(u)) || urls.find((u) => !/~orig\.mp4$/i.test(u)) || urls[0];
    if (!pick) continue;
    try {
      const film = `${work}/nvid${idx}.mp4`;
      const r = await tf(pick.replace(/^http:/, "https:"), {}, 300000);
      if (!r.ok) continue;
      fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
      const fdur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
      if (fdur < 2) continue;
      usedVid.add(nasaId);
      const start = fdur > dur + 1 ? Math.min(fdur * 0.15, fdur - dur - 0.3) : 0;
      const { w: sw, h: sh2 } = sourceWH(film);
      const vf = smartCropVf(W, H, sw, sh2, 0.5, "eq=contrast=1.04:saturation=1.06,vignette=a=PI/7");
      const seg = `${work}/seg${idx}.mp4`;
      execSync(`ffmpeg -y -stream_loop -1 -ss ${start.toFixed(2)} -i "${film}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
      return { seg, cred: `${title} — NASA (public domain) · https://images.nasa.gov/details/${nasaId}`, license: "public-domain", page: `https://images.nasa.gov/details/${nasaId}`, kind: "nasa_video" };
    } catch {}
  }
  return null;
}

// ---------- Archive.org: VIDEO dominio-público de espacio (respaldo) ----------
const PD_COLLECTIONS = ["nasa", "spaceflight", "nasaimages", "newsandpublicaffairs", "usnationalarchives"];
function vidLicense(licenseurl, collections) {
  const u = (Array.isArray(licenseurl) ? licenseurl[0] : licenseurl || "").toLowerCase();
  if (/\/by-sa|\/by-nc|\/by-nd/.test(u)) return null;
  if (/publicdomain\/zero|\/cc0/.test(u)) return "cc0";
  if (/\/licenses\/by(\/|$)/.test(u)) return "cc-by";
  if (/publicdomain/.test(u)) return "public-domain";
  const cols = (Array.isArray(collections) ? collections : [collections]).map((c) => String(c || "").toLowerCase());
  if (cols.some((c) => PD_COLLECTIONS.includes(c))) return "public-domain";
  return null;
}
async function archiveVideo(query, dur, idx) {
  const q = `(${query} space) AND mediatype:movies AND (licenseurl:(*publicdomain* OR *creativecommons*) OR collection:(${PD_COLLECTIONS.join(" OR ")}))`;
  const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=collection&sort[]=downloads+desc&rows=40&output=json`;
  let docs = [];
  try { docs = (((await (await tf(u)).json()).response) || {}).docs || []; } catch { return null; }
  for (const d of docs) {
    if (usedVid.has(d.identifier)) continue;
    const lic = vidLicense(d.licenseurl, d.collection);
    if (!lic) continue;
    try {
      const meta = await (await tf(`https://archive.org/metadata/${d.identifier}`)).json();
      const files = (meta.files || []).filter((f) => /\.(mp4|m4v|ogv)$/i.test(f.name) && +(f.size || 0) > 1.2e6).sort((a, b) => +a.size - +b.size);
      if (!files.length) continue;
      const f = files[0];
      usedVid.add(d.identifier);
      const film = `${work}/film${idx}.mp4`;
      const r = await tf(`https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name)}`, {}, 300000);
      if (!r.ok) continue;
      fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
      const fdur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
      if (fdur < 2) continue;
      const start = fdur > dur + 1 ? Math.min(fdur * 0.25, fdur - dur - 0.3) : 0;
      const { w: sw, h: sh2 } = sourceWH(film);
      const vf = smartCropVf(W, H, sw, sh2, 0.5, "eq=contrast=1.05:saturation=1.05,vignette=a=PI/7");
      const seg = `${work}/seg${idx}.mp4`;
      execSync(`ffmpeg -y -stream_loop -1 -ss ${start.toFixed(2)} -i "${film}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
      const title = (Array.isArray(d.title) ? d.title[0] : d.title) || query;
      return { seg, cred: `${title} — Internet Archive · https://archive.org/details/${d.identifier} · ${lic.toUpperCase()}`, license: lic, page: `https://archive.org/details/${d.identifier}`, kind: "archive_video" };
    } catch {}
  }
  return null;
}

// ---------- Imagen NASA (Ken Burns) — solo si no hay VIDEO ----------
async function nasaImage(query, dur, idx) {
  let items = [];
  try { const s = await (await tf(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=16`)).json(); items = (s.collection && s.collection.items) || []; } catch { return null; }
  // Mismo filtro compartido: fuera diagramas/hardware/misión; exige el sujeto. (Las fotos de telescopio son limpias.)
  const want = kwOf(query);
  for (const it of items) {
    const nasaId = it.data && it.data[0] && it.data[0].nasa_id;
    if (!nasaId || usedImg.has(nasaId)) continue;
    if (!keepFootage((it.data[0].title || "") + " " + (it.data[0].description || ""), want)) continue;
    let assets = []; try { assets = await (await tf(it.href, {}, 30000)).json(); } catch {}
    const jpgs = (Array.isArray(assets) ? assets : []).filter((u) => /\.jpe?g$/i.test(u) && !/~thumb\./i.test(u));
    const pick = jpgs.find((u) => /~large\./i.test(u)) || jpgs.find((u) => /~medium\./i.test(u)) || jpgs[0];
    if (!pick) continue;
    try {
      const ip = `${work}/img${idx}.jpg`;
      const r = await tf(pick.replace(/^http:/, "https:"), {}, 120000);
      if (!r.ok) continue;
      fs.writeFileSync(ip, Buffer.from(await r.arrayBuffer()));
      try { sh(`ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "${ip}"`); } catch { continue; }
      usedImg.add(nasaId);
      const frames = Math.max(2, Math.round(dur * FPS));
      const zoomIn = idx % 2 === 0;
      const z = zoomIn ? `'min(zoom+0.0009,1.25)'` : `'if(eq(on,0),1.25,max(zoom-0.0009,1.0))'`;
      const vf = `scale=${Math.round(W * 1.35)}:${Math.round(H * 1.35)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.35)}:${Math.round(H * 1.35)},` +
        `zoompan=z=${z}:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${FPS},eq=saturation=1.05,vignette=a=PI/7`;
      const seg = `${work}/seg${idx}.mp4`;
      execSync(`ffmpeg -y -loop 1 -i "${ip}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
      return { seg, cred: `${(it.data[0].title || query).slice(0, 90)} — NASA (public domain) · https://images.nasa.gov/details/${nasaId}`, license: "public-domain", page: `https://images.nasa.gov/details/${nasaId}`, kind: "nasa_image" };
    } catch {}
  }
  return null;
}

function fallbackSegment(dur, idx) {
  const seg = `${work}/seg${idx}.mp4`;
  try {
    execSync(`ffmpeg -y -f lavfi -i "gradients=s=${W}x${H}:c0=0x060a18:c1=0x000000:d=${dur.toFixed(2)}:speed=0.01" -t ${dur.toFixed(2)} -vf "noise=alls=7:allf=t,vignette=a=PI/6" -r ${FPS} -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  } catch {
    execSync(`ffmpeg -y -f lavfi -i "color=c=0x060a18:s=${W}x${H}:d=${dur.toFixed(2)}" -vf "vignette" -r ${FPS} -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  }
  return { seg, kind: "fallback", license: "", page: "" };
}

// Escalera de queries (acorta de específica a general) para no quedar sin material.
function queryLadder(beat) {
  const q0 = beat.query || topic;
  const core = q0.split(/\s+/).filter((w) => /^[A-Z]/.test(w) || w.length > 3).slice(0, 3).join(" ");
  const two = q0.split(/\s+/).slice(0, 2).join(" ");
  return [...new Set([q0, core, two, topic].filter(Boolean))];
}

// Descarga un clip, corta una tajada y recorta a 9:16 (smart crop). Devuelve el segmento o null.
async function cutClip(url, dur, idx, id) {
  try {
    const film = `${work}/clip${idx}.mp4`;
    const r = await tf(url.replace(/^http:/, "https:"), {}, 300000);
    if (!r.ok) return null;
    fs.writeFileSync(film, Buffer.from(await r.arrayBuffer()));
    const fdur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
    if (fdur < 2) return null;
    if (id) usedVid.add(id);
    const start = fdur > dur + 1 ? Math.min(fdur * 0.15, fdur - dur - 0.3) : 0;
    const { w: sw, h: sh2 } = sourceWH(film);
    const vf = smartCropVf(W, H, sw, sh2, 0.5, "eq=contrast=1.04:saturation=1.07,vignette=a=PI/7");
    const seg = `${work}/seg${idx}.mp4`;
    execSync(`ffmpeg -y -stream_loop -1 -ss ${start.toFixed(2)} -i "${film}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
    return seg;
  } catch { return null; }
}

// ---------- STOCK (Pexels + Pixabay): video de espacio LIMPIO y cinematográfico (sin texto quemado) ----------
async function stockVideo(query, dur, idx) {
  const bad = (txt) => FOOTAGE_BAD.test(String(txt || "").toLowerCase()); // el buscador ya filtra por tema -> solo rechazamos basura
  const PEX = process.env.PEXELS_API_KEY;
  if (PEX) {
    try {
      const j = await (await tf(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=25&orientation=portrait`, { headers: { Authorization: PEX } })).json();
      for (const v of (j.videos || [])) {
        if (usedVid.has("px" + v.id) || bad(v.url)) continue;
        const files = (v.video_files || []).filter((f) => f.link && /mp4/i.test(f.file_type || f.link));
        const pick = files.filter((f) => (f.height || 0) >= (f.width || 0)).sort((a, b) => (b.height || 0) - (a.height || 0))[0]
          || files.filter((f) => (f.width || 0) <= 1920 && (f.width || 0) > 0).sort((a, b) => (b.width || 0) - (a.width || 0))[0] || files[0];
        if (!pick) continue;
        const seg = await cutClip(pick.link, dur, idx, "px" + v.id);
        if (seg) return { seg, cred: `Video by ${(v.user && v.user.name) || "Pexels"} on Pexels · ${v.url}`, license: "pexels", page: v.url, kind: "stock_video" };
      }
    } catch {}
  }
  const PIX = process.env.PIXABAY_API_KEY;
  if (PIX) {
    try {
      const j = await (await tf(`https://pixabay.com/api/videos/?key=${PIX}&q=${encodeURIComponent(query)}&per_page=25&safesearch=true&order=popular`)).json();
      for (const h of (j.hits || [])) {
        if (usedVid.has("pb" + h.id) || bad(h.tags)) continue;
        const vs = h.videos || {};
        const pick = vs.large || vs.medium || vs.small || vs.tiny;
        if (!pick || !pick.url) continue;
        const seg = await cutClip(pick.url, dur, idx, "pb" + h.id);
        if (seg) return { seg, cred: `Video by ${h.user || "Pixabay"} on Pixabay · https://pixabay.com/videos/id-${h.id}/`, license: "pixabay", page: `https://pixabay.com/videos/id-${h.id}/`, kind: "stock_video" };
      }
    } catch {}
  }
  return null;
}

// Temas donde el VIDEO real de la NASA es LIMPIO (feeds crudos, sin anotaciones): Tierra/ISS, Sol/SDO, auroras.
// El resto (nebulosas, galaxias, planetas, espacio profundo) casi solo tiene video PRODUCIDO con texto quemado
// -> para esos usamos IMAGEN Hubble limpia (con Ken Burns). Así ningún clip trae basura.
const VIDEO_OK = /\bearth\b|\biss\b|space station|\bsun\b|\bsolar\b|flare|prominence|corona|aurora|from orbit|re-?entry|\bcloud|storm|hurricane|lightning|\blimb\b|day and night|city lights/i;

async function buildSegment(beat, dur, idx) {
  const queries = queryLadder(beat);
  const dynamic = VIDEO_OK.test(beat.query || "");
  const tryVideo = async () => { for (const q of queries) { let v = null; try { v = await nasaVideo(q, dur, idx); } catch {} if (v) { console.log(`  beat ${idx}: NASA VIDEO`); credits.push(v.cred); return v; } } return null; };
  // Stock: prueba las queries del beat y, si no hay, queries GENÉRICAS de espacio (siempre hay video limpio)
  // -> así casi nunca cae a imagen (Juan: nada de fotos, se ve básico).
  const SPACE_GENERIC = ["nebula", "galaxy", "cosmos", "deep space", "starfield", "aurora borealis", "milky way", "space stars"];
  const tryStock = async () => { for (const q of [...queries, ...SPACE_GENERIC]) { let v = null; try { v = await stockVideo(q, dur, idx); } catch {} if (v) { console.log(`  beat ${idx}: STOCK video (${v.license})`); credits.push(v.cred); return v; } } return null; };
  const tryImage = async () => { for (const q of queries) { let im = null; try { im = await nasaImage(q, dur, idx); } catch {} if (im) { console.log(`  beat ${idx}: imagen NASA (Ken Burns)`); credits.push(im.cred); return im; } } return null; };
  // STOCK primero para TODO: es la única fuente de video LIMPIO y confiable (sin texto quemado ni gráficos).
  // Luego imagen NASA real (Hubble/Spitzer, siempre limpia, con Ken Burns). NASA video queda de ÚLTIMO recurso
  // (aun con filtros mete gráficos de laboratorio con texto quemado), y solo para temas dinámicos (Tierra/Sol).
  // NUNCA Archive.org (basura).
  const r = (await tryStock()) || (await tryImage()) || (dynamic ? await tryVideo() : null);
  if (r) return r;
  console.error(`  beat ${idx}: sin material limpio para "${beat.query}" -> fondo estelar`);
  return fallbackSegment(dur, idx);
}

const TD = 0.5;
const segDur = +((narrDur + TD * (beats.length - 1)) / Math.max(1, beats.length) + 0.25).toFixed(2);
const built = [];
for (let i = 0; i < beats.length; i++) built.push(await buildSegment(beats[i], segDur, i));
if (!built.length) { console.error("Sin material -> no puedo armar el short"); process.exit(1); }

// Concatenar con xfade -> fondo del largo de la narración.
const bg = `${work}/bg.mp4`;
if (built.length === 1) {
  execSync(`ffmpeg -y -stream_loop -1 -i "${built[0].seg}" -t ${narrDur.toFixed(2)} -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
} else {
  const inputs = built.map((p) => `-i "${p.seg}"`).join(" ");
  let filter = "", acc = "[0:v]", accLen = segDur;
  for (let i = 1; i < built.length; i++) {
    const off = +(accLen - TD).toFixed(3);
    filter += `${acc}[${i}:v]xfade=transition=fade:duration=${TD}:offset=${off}[v${i}];`;
    acc = `[v${i}]`; accLen = +(accLen + segDur - TD).toFixed(3);
  }
  filter = filter.replace(/;$/, "");
  execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -t ${narrDur.toFixed(2)} -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
}

// Subtítulos suaves (Whisper karaoke). Fallback: frases de los beats.
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
  // Sin Whisper: parte cada frase en trozos cortos (<=6 palabras) para NO llenar la pantalla (máx ~2 líneas).
  const per = narrDur / Math.max(1, beats.length);
  beats.forEach((b, i) => {
    const w = asc(b.text || "").split(/\s+/).filter(Boolean);
    const CH = 6, chunks = [];
    for (let k = 0; k < w.length; k += CH) chunks.push(w.slice(k, k + CH).join(" "));
    if (!chunks.length) return;
    const seg = per / chunks.length;
    chunks.forEach((c, j) => dia.push(`Dialogue: 0,${assTime(i * per + j * seg)},${assTime(i * per + (j + 1) * seg)},Kar,,0,0,0,,${c}`));
  });
}
// Estilo calmado: blanco suave, contorno leve (menos agresivo que un short de hype).
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kar,Liberation Sans,98,&H00FFFFFF,&H0060E0FF,&H00141414,&H7A000000,-1,0,0,0,100,100,0.6,0,1,4,2,2,110,110,470,1
`;
fs.writeFileSync("captions.ass", ass + `\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${dia.join("\n")}\n`);

// OUTRO suave: cola de ~2.6s con CTA de marca (gana suscriptores) + fundido. El ambiente sigue sonando.
const OUTRO = 2.6, TOTAL = +(narrDur + OUTRO).toFixed(2);
const NDUR = narrDur.toFixed(2);
const FONTS = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"];
const FONT = FONTS.find((f) => fs.existsSync(f)) || "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
fs.writeFileSync(`${work}/outro.txt`, "Follow for more\ncalm space");

// Lecho ambiental generado (pad de La menor + brisa cósmica + eco). Dura TOTAL (sigue en el outro). tremolo f>=0.1.
const amb = `${work}/ambient.m4a`;
try {
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=110:duration=${TOTAL}" -f lavfi -i "sine=frequency=164.81:duration=${TOTAL}" -f lavfi -i "sine=frequency=220:duration=${TOTAL}" -f lavfi -i "anoisesrc=duration=${TOTAL}:color=pink:amplitude=0.06" -filter_complex "[0:a]volume=0.5,tremolo=f=0.10:d=0.35[d0];[1:a]volume=0.28,tremolo=f=0.12:d=0.4[d1];[2:a]volume=0.12[d2];[3:a]lowpass=f=650,volume=0.5[nz];[d0][d1][d2][nz]amix=inputs=4:normalize=0[mx];[mx]lowpass=f=1500,aecho=0.8:0.85:900|1700:0.35|0.25,volume=1.1,afade=t=in:d=1.5,afade=t=out:st=${(TOTAL - 2).toFixed(2)}:d=2[a]" -map "[a]" -c:a aac -b:a 160k "${amb}"`, { stdio: "pipe" });
} catch (e) {
  console.error("ambiente falló -> silencio:", String(e.message || e).slice(0, 120));
  execSync(`ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${TOTAL} -c:a aac -b:a 96k "${amb}"`, { stdio: "ignore" });
}

// Mezcla final PRO: fondo + cola/outro con CTA de marca + subtítulos + audio con ducking y fundidos suaves.
const ctaVf = `drawtext=textfile='${work}/outro.txt':fontfile='${FONT}':fontcolor=white:fontsize=66:line_spacing=14:borderw=5:bordercolor=black@0.85:shadowcolor=black@0.6:shadowx=3:shadowy=3:x=(w-text_w)/2:y=(h-text_h)/2:text_align=C:alpha='if(lt(t\\,${NDUR})\\,0\\,min(1\\,(t-${NDUR})/0.6))':enable='gte(t\\,${NDUR})'`;
execSync(`ffmpeg -y -i "${bg}" -i "${narrPath}" -i "${amb}" ` +
  `-filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=${OUTRO},subtitles=captions.ass,${ctaVf},fade=t=in:d=0.6,fade=t=out:st=${(TOTAL - 1.3).toFixed(2)}:d=1.3[v];` +
  `[2:a]volume=0.62[amb];` +
  `[1:a]loudnorm=I=-15:TP=-1.5,apad=whole_dur=${TOTAL},asplit=2[nar1][nar2];` +
  `[amb][nar1]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=320[aducked];` +
  `[nar2][aducked]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,afade=t=in:d=0.5,afade=t=out:st=${(TOTAL - 1.6).toFixed(2)}:d=1.6[a]" ` +
  `-map "[v]" -map "[a]" -t ${TOTAL} -r ${FPS} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${outPath}"`, { stdio: "inherit" });

// Paquete SEO + manifiesto de compliance.
const uniqCred = [...new Set(credits)];
const title = ((script.title || "Space Facts to Fall Asleep To").slice(0, 92) + " #Shorts").slice(0, 100);
const desc = [
  script.hook || "A calm drift through space.",
  "",
  ((script.hashtags || ["#space", "#relaxation", "#Shorts"]).join(" ") + " #Shorts #space #relaxing").trim(),
  "",
  "Footage: NASA (public domain):",
  ...uniqCred.slice(0, 20),
  "",
  "AI-generated narration voice + original ambient sound design. For relaxation and educational purposes.",
].join("\n");
fs.mkdirSync("publish", { recursive: true });
fs.writeFileSync("publish/package.json", JSON.stringify({ title, description: desc, tags: ["space", "relaxation", "sleep", "asmr", "shorts", "nasa", "space facts"], language: "en" }, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({
  niche: "space_calm", format: "9:16",
  clips: built.map((b, i) => ({ clip_id: "sp" + i, source: b.kind || "unknown", license: b.license || "", url: b.page || "", query: beats[i] ? beats[i].query : "" })),
  transform: { narration: true, original_audio: false, editing: true, original_script: true, sound_design: true },
}, null, 2));
const nv = built.filter((b) => b.kind === "nasa_video").length, av = built.filter((b) => b.kind === "archive_video").length;
console.log(`Short de ESPACIO listo -> ${outPath} · "${title}" · ${built.length} segmentos (${nv} NASA-video / ${av} archivo-video / ${built.length - nv - av} otros)`);
