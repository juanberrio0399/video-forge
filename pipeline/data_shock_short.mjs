// data_shock_short.mjs — Ensambla el Short VISUAL "DATA SHOCK": por cada fact, imagen icónica de Wikimedia
// (Ken Burns) con el NÚMERO gigante + etiqueta quemados; hook card los primeros 2.5s; música que empuja;
// SIN narración (sound-off first). Corto y agresivo (~22-26s). Solo imágenes con licencia libre.
// Uso: node pipeline/data_shock_short.mjs [script.json] [out.mp4]   (music.mp3 opcional en cwd)
import fs from "node:fs";
import { execSync } from "node:child_process";

const [scriptPath = "script.json", outPath = "short.mp4"] = process.argv.slice(2);
const W = 1080, H = 1920, FPS = 30;
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const facts = (script.facts || []).filter((f) => f && (f.num || f.label)).slice(0, 4);
const work = "dswork"; fs.mkdirSync(work, { recursive: true });
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, headers: { "user-agent": "video-forge/1.0 (educational; contact via youtube)", ...(o.headers || {}) }, signal: AbortSignal.timeout(ms) });
const FONT = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"].find((p) => fs.existsSync(p)) || "";

const kw = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
function imgLicense(ex) {
  const s = ((ex?.LicenseShortName?.value || "") + " " + (ex?.License?.value || "") + " " + (ex?.UsageTerms?.value || "")).toLowerCase();
  if (/public domain|pd-|cc0/.test(s)) return "public-domain";
  if (/cc[ -]by[ -]sa/.test(s)) return "cc-by-sa"; // se acepta con atribución (crédito en la descripción) -> amplía mucho el pool
  if (/cc[ -]by/.test(s)) return "cc-by";
  return null;
}
const usedImg = new Set(); const credits = [];
async function wikimediaImage(query) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=25&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2200&format=json`;
  let pages = [];
  try { pages = Object.values(((await (await tf(api)).json())?.query?.pages) || {}); } catch { return null; }
  const want = kw(query);
  const pick = pages.map((p) => ({ t: p.title, ii: (p.imageinfo || [])[0] }))
    .filter((x) => x.ii && x.ii.width >= 700 && /\.(jpe?g|png)(\?|$)/i.test(x.ii.thumburl || x.ii.url || ""))
    .map((x) => ({ ...x, lic: imgLicense(x.ii.extmetadata) }))
    .filter((x) => x.lic && !usedImg.has(x.t))
    .filter((x) => !/portable antiquities|scale bar|\bruler\b|specimen|catalogue|\bobverse\b|\breverse\b|\blogo\b|diagram|infographic|\bicon\b|screenshot/i.test(x.t))
    .filter((x) => { if (!want.length) return true; const tw = kw(x.t); return want.some((w) => tw.includes(w)); })
    .sort((a, b) => (b.ii.width || 0) - (a.ii.width || 0))[0];
  if (!pick) return null;
  usedImg.add(pick.t);
  const ex = pick.ii.extmetadata || {};
  return { url: pick.ii.thumburl || pick.ii.url, page: pick.ii.descriptionshorturl || pick.ii.descriptionurl, lic: pick.lic, artist: stripHtml(ex.Artist?.value) || "Wikimedia Commons", title: pick.t.replace(/^File:/, "") };
}

// Ken Burns OSCURECIDO (para que el número en oro resalte) desde una imagen de alta resolución.
function kbDim(imgPath, dur, idx) {
  const frames = Math.max(2, Math.round(dur * FPS));
  const z = idx % 2 === 0 ? `'min(zoom+0.0009,1.2)'` : `'if(eq(on,0),1.2,max(zoom-0.0009,1.0))'`;
  const vf = `scale=${Math.round(W * 1.3)}:${Math.round(H * 1.3)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.3)}:${Math.round(H * 1.3)},` +
    `zoompan=z=${z}:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${FPS},eq=brightness=-0.30:saturation=1.05:contrast=1.02,vignette=a=PI/5`;
  const s = `${work}/bg${idx}.mp4`;
  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "${s}"`, { stdio: "ignore" });
  return s;
}

const PER = 5.0;
const total = +(facts.length * PER).toFixed(2);

// 1) Reunir TODAS las imágenes que existan (los números abstractos no tienen foto propia -> se usan de fondo).
const imgPaths = [];
async function grabImg(query, tag) {
  let img = null; try { img = await wikimediaImage(query); } catch {}
  if (!img) return false;
  try {
    const buf = Buffer.from(await (await tf(img.url)).arrayBuffer());
    const p = `${work}/img${imgPaths.length}${tag}.jpg`; fs.writeFileSync(p, buf);
    imgPaths.push(p); credits.push(`${img.title} — ${img.artist} · ${img.page} · ${img.lic.toUpperCase()}`);
    console.log(`  IMG "${img.title}"`); return true;
  } catch { return false; }
}
for (let i = 0; i < facts.length; i++) await grabImg(facts[i].query, `f${i}`);
// FALLBACK: DATA SHOCK VIVE de la imagen icónica. Si Wikimedia devolvió poco, busca por tema/título/etiquetas
// (y términos de época) hasta tener al menos 2 imágenes, para no quedar en gradiente pelado.
if (imgPaths.length < 2) {
  const extra = [script.topic, script.title, ...(facts.map((f) => f.label))]
    .concat([`${script.topic} historical painting`, `${script.topic} history photograph`, `${script.topic} historical engraving`])
    .filter(Boolean);
  for (const q of extra) { if (imgPaths.length >= 3) break; await grabImg(q, "x"); }
}
console.log(`imágenes: ${imgPaths.length}/${facts.length}`);

// 2) FONDO oscurecido para TODA la duración: Ken Burns sobre las imágenes cicladas; si no hay ninguna, gradiente sobrio.
const bg = `${work}/bg.mp4`;
if (imgPaths.length) {
  const per = total / imgPaths.length;
  const segs = imgPaths.map((p, i) => kbDim(p, per, i));
  fs.writeFileSync(`${work}/bglist.txt`, segs.map((s) => `file '${s.split("/").pop()}'`).join("\n"));
  execSync(`ffmpeg -y -f concat -safe 0 -i ${work}/bglist.txt -c copy "${bg}"`, { stdio: "ignore" });
} else {
  execSync(`ffmpeg -y -f lavfi -i color=c=0x0d1b2a:s=${W}x${H}:d=${total}:r=${FPS} -vf "vignette=a=PI/6" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
}

// 3) Overlays: hook card (0-2.5s) + cada número+etiqueta en su ventana de tiempo, sobre el fondo.
const hookCard = String(script.hook_card || script.title || "DATA SHOCK").toUpperCase().replace(/[\r\n]+/g, " ").slice(0, 32);
fs.writeFileSync(`${work}/hook.txt`, hookCard);
const hookFs = Math.max(42, Math.min(80, Math.round(900 / Math.max(7, hookCard.length) / 0.66)));
let ov = FONT ? `,drawtext=textfile='${work}/hook.txt':fontfile='${FONT}':expansion=none:fontcolor=white:fontsize=${hookFs}:borderw=9:bordercolor=black@0.9:shadowx=4:shadowy=4:x=(w-text_w)/2:y=(h*0.12):text_align=C:enable='lt(t\\,2.5)':alpha='if(lt(t\\,0.3)\\,t/0.3\\,if(lt(t\\,2.0)\\,1\\,max(0\\,(2.5-t)/0.5)))'` : "";
facts.forEach((f, i) => {
  const lbl = String(f.label || "");
  fs.writeFileSync(`${work}/num${i}.txt`, String(f.num || "")); fs.writeFileSync(`${work}/lbl${i}.txt`, lbl);
  const numFs = Math.max(56, Math.min(146, Math.round(900 / Math.max(5, String(f.num || "").length) / 0.66)));
  // Etiqueta también ADAPTATIVA: nunca se sale del cuadro (presupuesto ~980px, ~0.60/char), tope 72 para no competir con el número en oro.
  const lblFs = Math.max(36, Math.min(72, Math.round(980 / Math.max(8, lbl.length) / 0.60)));
  const en = `enable='between(t\\,${(i * PER).toFixed(2)}\\,${((i + 1) * PER).toFixed(2)})'`;
  if (FONT) {
    ov += `,drawtext=textfile='${work}/num${i}.txt':fontfile='${FONT}':expansion=none:fontcolor=gold:fontsize=${numFs}:borderw=13:bordercolor=black@0.92:shadowx=5:shadowy=5:x=(w-text_w)/2:y=(h*0.30):text_align=C:${en}`;
    ov += `,drawtext=textfile='${work}/lbl${i}.txt':fontfile='${FONT}':expansion=none:fontcolor=white:fontsize=${lblFs}:borderw=8:bordercolor=black@0.9:x=(w-text_w)/2:y=(h*0.30)+185:text_align=C:${en}`;
  }
});

// 4) Música (o silencio) + render final.
const hasMusic = fs.existsSync("music.mp3");
if (hasMusic) {
  execSync(`ffmpeg -y -i "${bg}" -stream_loop -1 -i music.mp3 -filter_complex "[0:v]format=yuv420p${ov}[v];[1:a]volume=0.5,afade=t=in:st=0:d=0.6,afade=t=out:st=${(total - 0.8)}:d=0.8[a]" -map "[v]" -map "[a]" -t ${total} -r ${FPS} -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
} else {
  execSync(`ffmpeg -y -i "${bg}" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]format=yuv420p${ov}[v]" -map "[v]" -map 1:a -t ${total} -r ${FPS} -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
}

// Paquete SEO + manifiesto
const uniq = [...new Set(credits)];
const title = ((script.title || "History in Numbers").slice(0, 92) + " #Shorts").slice(0, 100);
const desc = [script.hook_card || "", "", ((script.hashtags || ["#History", "#Shorts"]).join(" ") + " #Shorts #history #dataviz").trim(), "", "Archival images (public domain / Creative Commons):", ...uniq, "", "Data-visual short. Historical facts for educational purposes."].join("\n");
fs.mkdirSync("publish", { recursive: true });
fs.writeFileSync("publish/package.json", JSON.stringify({ title, description: desc, tags: ["shorts", "history", "data", "facts"], language: "en" }, null, 2));
console.log(`DATA SHOCK listo -> ${outPath} · "${title}" · ${facts.length} facts · ${imgPaths.length} imgs · ${total}s`);
