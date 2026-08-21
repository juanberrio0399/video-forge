// history_short.mjs — Ensambla un SHORT 9:16 de "Historia que cambio el mundo".
// Por cada beat busca material RELEVANTE al tema y sin repetir:
//   1) imagen historica de alta resolucion en Wikimedia Commons (PD/CC0/CC-BY) -> Ken Burns (zoom/pan)
//   2) respaldo: video de archivo dominio-publico en Archive.org (relevancia por titulo)
// Debajo va la NARRACION de historiador (voz Gemini TTS) con subtitulos KARAOKE + musica con ducking.
// Solo fuentes con descarga permitida y licencia libre (sin evasion). Calidad alta (crf 18).
//
// Uso: node pipeline/history_short.mjs <script.json> <narration.mp3> <out.mp4>
// Requiere en cwd: words.json (Whisper, opcional), music.mp3 (opcional).
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf } from "./clip_frame.mjs";

const [scriptPath = "script.json", narrPath = "narration.mp3", outPath = "short.mp4"] = process.argv.slice(2);
const W = 1080, H = 1920, FPS = 30;
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const beats = (script.beats || []).filter((b) => b && b.query);
const topic = script.topic || "";
const work = "histwork"; fs.mkdirSync(work, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, headers: { "user-agent": "video-forge/1.0 (educational; contact via youtube)", ...(o.headers || {}) }, signal: AbortSignal.timeout(ms) });

const narrDur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${narrPath}"`).trim()) || 45;
console.log(`Narracion: ${narrDur.toFixed(1)}s · beats: ${beats.length}`);

const usedImg = new Set();   // titulos de imagen ya usados (dedup)
const usedVid = new Set();   // ids de Archive ya usados (dedup)
const credits = [];          // atribuciones para la descripcion

// ---------- Wikimedia Commons: imagen historica relevante y de alta resolucion ----------
function imgLicense(ex) {
  const s = ((ex?.LicenseShortName?.value || "") + " " + (ex?.License?.value || "") + " " + (ex?.UsageTerms?.value || "")).toLowerCase();
  if (/public domain|pd-|cc0/.test(s)) return "public-domain";
  if (/cc[ -]by[ -]sa/.test(s)) return null;               // SA: evitar (exigiria compartir-igual el video)
  if (/cc[ -]by/.test(s)) return "cc-by";
  return null;
}
const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
async function wikimediaImage(query) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=25&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2200&format=json`;
  let pages = [];
  try { pages = Object.values(((await (await tf(api)).json())?.query?.pages) || {}); } catch { return null; }
  const want = kw(query);
  const cand = pages
    .map((p) => ({ t: p.title, ii: (p.imageinfo || [])[0] }))
    .filter((x) => x.ii && x.ii.width >= 700 && /\.(jpe?g|png)(\?|$)/i.test(x.ii.thumburl || x.ii.url || ""))
    .map((x) => ({ ...x, lic: imgLicense(x.ii.extmetadata) }))
    .filter((x) => x.lic && !usedImg.has(x.t))
    // RELEVANCIA: el titulo de la imagen debe compartir >=1 palabra clave con la query (evita fotos fuera de tema).
    .filter((x) => { if (!want.length) return true; const tw = kw(x.t); return want.some((w) => tw.includes(w)); })
    .sort((a, b) => (b.ii.width || 0) - (a.ii.width || 0));
  const pick = cand[0];
  if (!pick) return null;
  usedImg.add(pick.t);
  const ex = pick.ii.extmetadata || {};
  return {
    url: pick.ii.thumburl || pick.ii.url,
    page: pick.ii.descriptionshorturl || pick.ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(pick.t)}`,
    lic: pick.lic,
    artist: stripHtml(ex.Artist?.value) || "Wikimedia Commons",
    title: pick.t.replace(/^File:/, ""),
  };
}

// Segmento Ken Burns (zoom/pan lento) a 9:16 desde una imagen de alta resolucion -> nitido.
function kenBurns(imgPath, dur, idx) {
  const frames = Math.max(2, Math.round(dur * FPS));
  const zoomIn = idx % 2 === 0;
  // Escala a un lienzo mayor que 9:16 (para tener margen de paneo) y hace zoompan hacia 1080x1920.
  const z = zoomIn ? `'min(zoom+0.0010,1.28)'` : `'if(eq(on,0),1.28,max(zoom-0.0010,1.0))'`;
  const panX = idx % 3 === 0 ? `'(iw-iw/zoom)/2'` : idx % 3 === 1 ? `'(iw-iw/zoom)*0.15'` : `'(iw-iw/zoom)*0.85'`;
  const vf = `scale=${Math.round(W * 1.35)}:${Math.round(H * 1.35)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.35)}:${Math.round(H * 1.35)},` +
    `zoompan=z=${z}:x=${panX}:y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${FPS},` +
    `eq=contrast=1.06:saturation=1.06:brightness=0.01,unsharp=3:3:0.4,vignette=a=PI/8`;
  const seg = `${work}/seg${idx}.mp4`;
  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  return seg;
}

// ---------- Archive.org: video de archivo dominio-publico (respaldo) ----------
const PD_COLLECTIONS = ["prelinger", "universal_newsreels", "newsandpublicaffairs", "academic_films", "AENN", "usnationalarchives", "FedFlix"];
function vidLicense(licenseurl, collections) {
  const u = (Array.isArray(licenseurl) ? licenseurl[0] : licenseurl || "").toLowerCase();
  if (/\/by-sa|\/by-nc|\/by-nd/.test(u)) return null;
  if (/publicdomain\/zero|\/cc0/.test(u)) return "cc0";
  if (/\/licenses\/by(\/|$)/.test(u)) return "cc-by";
  if (/publicdomain/.test(u)) return "public-domain";
  const cols = (Array.isArray(collections) ? collections : [collections]).map((c) => String(c || "").toLowerCase());
  if (cols.some((c) => PD_COLLECTIONS.map((p) => p.toLowerCase()).includes(c))) return "public-domain";
  return null;
}
const kw = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
async function archiveVideo(query, dur, idx) {
  const q = `(${query}) AND mediatype:movies AND (licenseurl:(*publicdomain* OR *creativecommons*) OR collection:(${PD_COLLECTIONS.join(" OR ")}))`;
  const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=creator&fl[]=collection&sort[]=downloads+desc&rows=40&output=json`;
  let docs = [];
  try { docs = (((await (await tf(u)).json()).response) || {}).docs || []; } catch { return null; }
  const want = new Set(kw(query));
  // Relevancia: exige que el TITULO comparta al menos una palabra clave con la query. Y dedup por id.
  const relevant = docs.filter((d) => !usedVid.has(d.identifier)).filter((d) => {
    const title = (Array.isArray(d.title) ? d.title[0] : d.title) || "";
    return kw(title).some((w) => want.has(w));
  });
  for (const d of relevant) {
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
      const vf = smartCropVf(W, H, sw, sh2, 0.5, "eq=contrast=1.07:saturation=1.05,unsharp=3:3:0.3");
      const seg = `${work}/seg${idx}.mp4`;
      execSync(`ffmpeg -y -stream_loop -1 -ss ${start.toFixed(2)} -i "${film}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
      const title = (Array.isArray(d.title) ? d.title[0] : d.title) || query;
      const creator = (Array.isArray(d.creator) ? d.creator[0] : d.creator) || "Internet Archive";
      return { seg, cred: `${title} — ${creator} · https://archive.org/details/${d.identifier} · ${lic.toUpperCase()}`, license: lic, page: `https://archive.org/details/${d.identifier}` };
    } catch {}
  }
  return null;
}

// Fondo cinematografico generado (ultima red de seguridad: un beat SIN material no tumba el short).
function fallbackSegment(dur, idx) {
  const seg = `${work}/seg${idx}.mp4`;
  try {
    execSync(`ffmpeg -y -f lavfi -i "gradients=s=${W}x${H}:c0=0x0b1a33:c1=0x020509:d=${dur.toFixed(2)}:speed=0.01" -t ${dur.toFixed(2)} -vf "vignette=a=PI/7,noise=alls=5:allf=t" -r ${FPS} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  } catch {
    execSync(`ffmpeg -y -f lavfi -i "color=c=0x0b1a33:s=${W}x${H}:d=${dur.toFixed(2)}" -vf "vignette" -r ${FPS} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  }
  return seg;
}

// ---------- Un segmento por beat: imagen Wikimedia (Ken Burns) -> respaldo video Archive -> fondo ----------
async function buildSegment(beat, dur, idx) {
  // Escalera de queries que ACORTA (de especifica a general) -> Wikimedia no devuelve 0 por frases largas.
  const q0 = beat.query || topic;
  const noYear = q0.replace(/\b(1[0-9]{3}|20\d{2})\b/g, "").replace(/\s+/g, " ").trim();
  const sig = q0.split(/\s+/).filter((w) => /^[A-Z]/.test(w) || w.length > 3);
  const core = sig.slice(0, 3).join(" ");
  const two = q0.split(/\s+/).slice(0, 2).join(" ");
  const queries = [...new Set([q0, noYear, core, two, topic].filter(Boolean))];
  // 1) Imagen Wikimedia relevante y de alta resolucion.
  for (const q of queries) {
    let img = null; try { img = await wikimediaImage(q); } catch {}
    if (!img) continue;
    try {
      const ip = `${work}/img${idx}.jpg`;
      const r = await tf(img.url, {}, 120000);
      if (!r.ok) continue;
      fs.writeFileSync(ip, Buffer.from(await r.arrayBuffer()));
      const seg = kenBurns(ip, dur, idx);
      console.log(`  beat ${idx}: IMG "${img.title}" (${img.lic})`);
      credits.push(`${img.title} — ${img.artist} · ${img.page} · ${img.lic.toUpperCase()}`);
      return { seg, kind: "img", page: img.page, license: img.lic };
    } catch {}
  }
  // 2) Respaldo: video de archivo relevante.
  for (const q of queries) {
    let v = null; try { v = await archiveVideo(q, dur, idx); } catch {}
    if (v) { console.log(`  beat ${idx}: VIDEO archivo (${v.license})`); credits.push(v.cred); return { seg: v.seg, kind: "vid", page: v.page, license: v.license }; }
  }
  // 3) Ultima red: fondo cinematografico (nunca aborta la categoria).
  console.error(`  beat ${idx}: sin material real para "${beat.query}" -> fondo cinematografico`);
  return { seg: fallbackSegment(dur, idx), kind: "fallback", page: "", license: "" };
}

const TD = 0.4;
const segDur = +((narrDur + TD * (beats.length - 1)) / Math.max(1, beats.length) + 0.25).toFixed(2);
const built = [];
for (let i = 0; i < beats.length; i++) {
  const s = await buildSegment(beats[i], segDur, i);
  if (s) built.push(s);
}
if (!built.length) { console.error("No conseguí NINGÚN material -> no puedo armar el short"); process.exit(1); }
while (built.length < beats.length) built.push(built[built.length % built.length]);

// Concatenar con xfade -> fondo del largo de la narracion.
const bg = `${work}/bg.mp4`;
if (built.length === 1) {
  execSync(`ffmpeg -y -stream_loop -1 -i "${built[0].seg}" -t ${narrDur.toFixed(2)} -r ${FPS} -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
} else {
  const inputs = built.map((p) => `-i "${p.seg}"`).join(" ");
  const TR = ["fade", "fadeblack", "wipeleft", "fade", "smoothleft"];
  let filter = "", acc = "[0:v]", accLen = segDur;
  for (let i = 1; i < built.length; i++) {
    const off = +(accLen - TD).toFixed(3);
    filter += `${acc}[${i}:v]xfade=transition=${TR[(i - 1) % TR.length]}:duration=${TD}:offset=${off}[v${i}];`;
    acc = `[v${i}]`; accLen = +(accLen + segDur - TD).toFixed(3);
  }
  filter = filter.replace(/;$/, "");
  execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -t ${narrDur.toFixed(2)} -r ${FPS} -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
}

// Subtitulos KARAOKE desde words.json (Whisper). Fallback: frases de los beats.
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
Style: Kar,Liberation Sans,108,&H0022D3EE,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,8,5,2,80,80,500,1
`;
fs.writeFileSync("captions.ass", ass + `\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${dia.join("\n")}\n`);
console.log(`captions.ass: ${dia.length} lineas`);

// Mezcla final: fondo + subtitulos quemados + narracion + musica con ducking (asplit: la voz no se puede reusar).
const hasMusic = fs.existsSync("music.mp3");
if (hasMusic) {
  execSync(`ffmpeg -y -i "${bg}" -i "${narrPath}" -stream_loop -1 -i music.mp3 ` +
    `-filter_complex "[0:v]subtitles=captions.ass[v];` +
    `[2:a]volume=0.28,afade=t=in:st=0:d=0.8[mus];` +
    `[1:a]loudnorm=I=-14:TP=-1.5,asplit=2[nar1][nar2];` +
    `[mus][nar1]sidechaincompress=threshold=0.03:ratio=9:attack=12:release=280[mduck];` +
    `[nar2][mduck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]" ` +
    `-map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
} else {
  execSync(`ffmpeg -y -i "${bg}" -i "${narrPath}" -filter_complex "[0:v]subtitles=captions.ass[v];[1:a]loudnorm=I=-14:TP=-1.5[a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
}

// Paquete SEO + manifiesto de compliance (footage con licencia/atribucion).
const uniqCred = [...new Set(credits)];
const musicCredit = "Music: Kevin MacLeod (incompetech.com), licensed under CC BY 4.0";
const title = ((script.title || topic || "History").slice(0, 92) + " #Shorts").slice(0, 100);
const desc = [
  script.hook || topic || "",
  "",
  ((script.hashtags || ["#History", "#Shorts"]).join(" ") + " #Shorts #history").trim(),
  "",
  "Archival images/footage (public domain / Creative Commons):",
  ...uniqCred,
  "",
  musicCredit,
  "",
  "This short uses an AI-generated narration voice. Historical content for educational purposes.",
].join("\n");
fs.mkdirSync("publish", { recursive: true });
fs.writeFileSync("publish/package.json", JSON.stringify({ title, description: desc, tags: ["shorts", "history", "documentary"], language: "en" }, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({
  niche: "history", format: "9:16",
  clips: built.map((b, i) => ({ clip_id: "h" + i, source: b.kind === "img" ? "wikimedia_commons" : b.kind === "vid" ? "archive_pd" : "generated_bg", license: b.license, url: b.page, query: beats[i]?.query || "" })),
  transform: { narration: true, original_audio: false, editing: true, original_script: true, sound_design: true },
}, null, 2));
console.log(`Short de HISTORIA listo -> ${outPath} · "${title}" · ${built.length} segmentos (${built.filter((b) => b.kind === "img").length} img / ${built.filter((b) => b.kind === "vid").length} video / ${built.filter((b) => b.kind === "fallback").length} fondo)`);
