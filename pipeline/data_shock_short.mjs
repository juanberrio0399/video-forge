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
  if (/cc[ -]by[ -]sa/.test(s)) return null;
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
    .filter((x) => { if (!want.length) return true; const tw = kw(x.t); return want.some((w) => tw.includes(w)); })
    .sort((a, b) => (b.ii.width || 0) - (a.ii.width || 0))[0];
  if (!pick) return null;
  usedImg.add(pick.t);
  const ex = pick.ii.extmetadata || {};
  return { url: pick.ii.thumburl || pick.ii.url, page: pick.ii.descriptionshorturl || pick.ii.descriptionurl, lic: pick.lic, artist: stripHtml(ex.Artist?.value) || "Wikimedia Commons", title: pick.t.replace(/^File:/, "") };
}

// Segmento: Ken Burns + NÚMERO gigante (oro) + etiqueta (blanco), texto por archivo (sin problemas de escape).
function factSegment(imgPath, num, label, dur, idx) {
  const frames = Math.max(2, Math.round(dur * FPS));
  const z = idx % 2 === 0 ? `'min(zoom+0.0011,1.24)'` : `'if(eq(on,0),1.24,max(zoom-0.0011,1.0))'`;
  fs.writeFileSync(`${work}/num${idx}.txt`, String(num || ""));
  fs.writeFileSync(`${work}/lbl${idx}.txt`, String(label || ""));
  const numDt = FONT ? `,drawtext=textfile='${work}/num${idx}.txt':fontfile='${FONT}':fontcolor=gold:fontsize=150:borderw=13:bordercolor=black@0.92:shadowcolor=black@0.55:shadowx=5:shadowy=5:x=(w-text_w)/2:y=(h*0.28):text_align=C` : "";
  const lblDt = FONT ? `,drawtext=textfile='${work}/lbl${idx}.txt':fontfile='${FONT}':fontcolor=white:fontsize=66:borderw=8:bordercolor=black@0.9:x=(w-text_w)/2:y=(h*0.28)+185:text_align=C` : "";
  const vf = `scale=${Math.round(W * 1.3)}:${Math.round(H * 1.3)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.3)}:${Math.round(H * 1.3)},` +
    `zoompan=z=${z}:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${FPS},eq=contrast=1.08:saturation=1.1,unsharp=3:3:0.4,vignette=a=PI/7${numDt}${lblDt}`;
  const seg = `${work}/seg${idx}.mp4`;
  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -t ${dur.toFixed(2)} -vf "${vf}" -an -r ${FPS} -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  return seg;
}
// Segmento de respaldo: fondo oscuro degradado + número (si no hubo imagen).
function fallbackSegment(num, label, dur, idx) {
  fs.writeFileSync(`${work}/num${idx}.txt`, String(num || "")); fs.writeFileSync(`${work}/lbl${idx}.txt`, String(label || ""));
  const numDt = FONT ? `,drawtext=textfile='${work}/num${idx}.txt':fontfile='${FONT}':fontcolor=gold:fontsize=160:borderw=6:bordercolor=black:x=(w-text_w)/2:y=(h*0.30):text_align=C` : "";
  const lblDt = FONT ? `,drawtext=textfile='${work}/lbl${idx}.txt':fontfile='${FONT}':fontcolor=white:fontsize=68:x=(w-text_w)/2:y=(h*0.30)+195:text_align=C` : "";
  const seg = `${work}/seg${idx}.mp4`;
  execSync(`ffmpeg -y -f lavfi -i color=c=0x0d1b2a:s=${W}x${H}:d=${dur.toFixed(2)}:r=${FPS} -vf "vignette=a=PI/6${numDt}${lblDt}" -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p "${seg}"`, { stdio: "ignore" });
  return seg;
}

const PER = 5.0; // s por fact
const segs = [];
for (let i = 0; i < facts.length; i++) {
  const f = facts[i];
  let img = null; try { img = await wikimediaImage(f.query); } catch {}
  if (img) {
    try { const buf = Buffer.from(await (await tf(img.url)).arrayBuffer()); fs.writeFileSync(`${work}/img${i}.jpg`, buf); segs.push(factSegment(`${work}/img${i}.jpg`, f.num, f.label, PER, i)); credits.push(`${img.title} — ${img.artist} · ${img.page} · ${img.lic.toUpperCase()}`); console.log(`  ${i + 1}. IMG "${img.title}" — ${f.num}`); continue; } catch (e) { console.error("img fail:", e.message); }
  }
  segs.push(fallbackSegment(f.num, f.label, PER, i)); console.log(`  ${i + 1}. FONDO — ${f.num}`);
}
if (!segs.length) { console.error("sin segmentos"); process.exit(1); }

// Concatenar
fs.writeFileSync(`${work}/list.txt`, segs.map((s) => `file '${s.split("/").pop()}'`).join("\n"));
execSync(`ffmpeg -y -f concat -safe 0 -i ${work}/list.txt -c copy ${work}/joined.mp4`, { stdio: "ignore" });

// Hook card (primeros 2.5s) + música (o silencio) en la mezcla final.
const hookCard = String(script.hook_card || script.title || "DATA SHOCK").toUpperCase().replace(/[\r\n]+/g, " ").slice(0, 42);
fs.writeFileSync(`${work}/hook.txt`, hookCard);
const hookDt = FONT ? `,drawtext=textfile='${work}/hook.txt':fontfile='${FONT}':fontcolor=white:fontsize=96:borderw=9:bordercolor=black@0.9:shadowcolor=black@0.55:shadowx=4:shadowy=4:x=(w-text_w)/2:y=(h*0.12):text_align=C:enable='lt(t\\,2.5)':alpha='if(lt(t\\,0.3)\\,t/0.3\\,if(lt(t\\,2.0)\\,1\\,max(0\\,(2.5-t)/0.5)))'` : "";
const total = (segs.length * PER).toFixed(2);
const hasMusic = fs.existsSync("music.mp3");
if (hasMusic) {
  execSync(`ffmpeg -y -i ${work}/joined.mp4 -stream_loop -1 -i music.mp3 -filter_complex "[0:v]format=yuv420p${hookDt}[v];[1:a]volume=0.5,afade=t=in:st=0:d=0.6,afade=t=out:st=${(total - 0.8)}:d=0.8[a]" -map "[v]" -map "[a]" -t ${total} -r ${FPS} -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
} else {
  execSync(`ffmpeg -y -i ${work}/joined.mp4 -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]format=yuv420p${hookDt}[v]" -map "[v]" -map 1:a -t ${total} -r ${FPS} -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -movflags +faststart "${outPath}"`, { stdio: "inherit" });
}

// Paquete SEO + manifiesto
const uniq = [...new Set(credits)];
const title = ((script.title || "History in Numbers").slice(0, 92) + " #Shorts").slice(0, 100);
const desc = [script.hook_card || "", "", ((script.hashtags || ["#History", "#Shorts"]).join(" ") + " #Shorts #history #dataviz").trim(), "", "Archival images (public domain / Creative Commons):", ...uniq, "", "Data-visual short. Historical facts for educational purposes."].join("\n");
fs.mkdirSync("publish", { recursive: true });
fs.writeFileSync("publish/package.json", JSON.stringify({ title, description: desc, tags: ["shorts", "history", "data", "facts"], language: "en" }, null, 2));
console.log(`DATA SHOCK listo -> ${outPath} · "${title}" · ${segs.length} facts · ${total}s`);
