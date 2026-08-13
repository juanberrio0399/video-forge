// clip_cc_short.mjs — CLIPEADOR de shorts desde videos RECIENTES con licencia Creative Commons
// (CC-BY) de YouTube. Busca por tema SOLO videos marcados CC (videoLicense=creativeCommon),
// VERIFICA la licencia por API (status.license === "creativeCommon"), descarga con yt-dlp, la IA
// elige el mejor momento y arma un SHORT 9:16 PROFESIONAL (tamaño completo, centrado, sin barras)
// con NUESTRO audio + ATRIBUCIÓN obligatoria (título · canal · link · CC-BY) en la descripción.
//
// Uso: node pipeline/clip_cc_short.mjs "<tema>" <categoria> <out.mp4>
// Env: YT_CLIENT_ID/SECRET/REFRESH (YT2 mapeado), GEMINI_API_KEY(,2). Requiere yt-dlp instalado. music.mp3 opcional.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { sourceWH, smartCropVf, finishClip } from "./clip_frame.mjs";

const [topic, niche = "graciosos", outPath = "short.mp4"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const W = 1080, H = 1920, CLIP = 35;
const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const work = "clipwork"; fs.mkdirSync(work, { recursive: true });
const FONT = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"].find((f) => fs.existsSync(f)) || "";
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"] }).toString();

// 1) Token YT2 + buscar SOLO videos CC en YouTube.
const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
const T = tr.access_token; if (!T) { console.error("sin token YT"); process.exit(1); }
const H2 = { Authorization: `Bearer ${T}` };
console.log(`Buscando videos CC-BY de "${topic}" en YouTube…`);
const s = await (await tf(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoLicense=creativeCommon&videoEmbeddable=true&videoDuration=medium&order=viewCount&relevanceLanguage=en&maxResults=25&q=${encodeURIComponent(topic)}`, { headers: H2 })).json();
const ids = (s.items || []).map((i) => i.id.videoId).filter(Boolean);
if (!ids.length) { console.error("sin resultados CC"); process.exit(1); }
// 2) VERIFICAR licencia + elegir el mejor (más vistas, duración 1-15 min).
const vj = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails,statistics&id=${ids.join(",")}`, { headers: H2 })).json();
const parseDur = (d) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || "") || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };
const cands = (vj.items || []).filter((v) => v.status && v.status.license === "creativeCommon").map((v) => ({ id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, dur: parseDur(v.contentDetails.duration), views: +((v.statistics || {}).viewCount || 0) })).filter((v) => v.dur >= 60 && v.dur <= 1200).sort((a, b) => b.views - a.views);
if (!cands.length) { console.error("ningún candidato CC verificado con duración usable"); process.exit(1); }
const src = cands[0];
console.log(`Elegido (CC-BY verificado): "${src.title}" · ${src.channel} · ${src.views} vistas · ${Math.round(src.dur / 60)}min`);
const attribution = `${src.title} · ${src.channel} · https://youtu.be/${src.id} · CC-BY`;

// 3) Descargar con yt-dlp (la licencia CC-BY permite el reuso). Si hay cookies.txt (sesión de una
// cuenta de YouTube), se pasan para saltar el "confirma que no eres un bot" de la nube.
const film = `${work}/film.mp4`;
const url = `https://www.youtube.com/watch?v=${src.id}`;
const ck = fs.existsSync("cookies.txt") ? "--cookies cookies.txt " : "";
// Proxy RESIDENCIAL (secret YT_PROXY) — cambia la IP a una "de casa" y salta el filtro de reputación
// de datacenter que niega los formatos. Formato: http://user:pass@host:puerto (o socks5://...).
const px = process.env.YT_PROXY ? `--proxy "${process.env.YT_PROXY}" ` : "";
console.log("Descargando (yt-dlp" + (ck ? " + cookies" : "") + (px ? " + proxy" : "") + ")…");
// YouTube niega formatos a IPs de nube (solo storyboards) aun con cookies. Clave: --impersonate
// (falsea la huella TLS/JA3 de un navegador real, vía curl-cffi) + cliente TV. Cascada de intentos.
const FMT = `-f "bv*[height<=1080]+ba/bv*+ba/b/b*" --merge-output-format mp4`;
const attempts = [
  `--force-ipv6 --impersonate chrome --extractor-args "youtube:player_client=tv"`, // IPv6 relaja el filtro de reputación en algunos datacenters
  `--force-ipv6 --extractor-args "youtube:player_client=default,tv,android,ios"`,
  `--impersonate chrome --extractor-args "youtube:player_client=tv"`,
  `--impersonate chrome --extractor-args "youtube:player_client=default,tv,android,ios"`,
  `--impersonate safari --extractor-args "youtube:player_client=tv,mweb"`,
  `--extractor-args "youtube:player_client=default,android,ios,tv"`, // sin impersonate (respaldo)
];
let ok = false;
for (const a of attempts) {
  try { execSync(`yt-dlp -q --no-warnings ${ck}${px}${a} ${FMT} -o "${film}" "${url}"`, { stdio: "inherit" }); if (fs.existsSync(film)) { ok = true; console.log("Bajado con: " + a); break; } } catch {}
}
if (!ok) {
  console.error("yt-dlp no pudo bajar el video. Formatos que YouTube ofrece a esta IP (con impersonate+TV):");
  try { execSync(`yt-dlp --no-warnings ${ck}${px}--impersonate chrome --extractor-args "youtube:player_client=tv" --list-formats "${url}"`, { stdio: "inherit" }); } catch (e) { console.error("(ni --list-formats respondió: " + e.message + ")"); }
  console.error(ck ? "Con cookies el bot pasó, pero YouTube sigue sin dar formatos. Prueba cookies FRESCAS en incógnito." : "Sin cookies: añade cookies.txt.");
  process.exit(2);
}
if (!fs.existsSync(film)) { console.error("no se descargó el video"); process.exit(2); }
const dur = parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${film}"`).trim()) || 0;
if (dur < 30) { console.error("video ilegible"); process.exit(1); }

// 4) Miniaturas + IA elige el mejor momento (idéntico al clipeador de dominio público).
const a0 = dur * 0.08, a1 = dur * 0.92, N = 16, step = (a1 - a0) / N, thumbs = [];
for (let i = 0; i < N; i++) { const t = Math.round(a0 + i * step), p = `${work}/th${i}.jpg`; try { execSync(`ffmpeg -y -ss ${t} -i "${film}" -frames:v 1 -vf "scale=320:-1" "${p}"`, { stdio: "ignore" }); if (fs.existsSync(p)) thumbs.push({ t, p }); } catch {} }
async function pickMoment() {
  if (!KEYS.length || !thumbs.length) return null;
  const parts = [{ text: `Eres editor de SHORTS virales. Estas ${thumbs.length} miniaturas son del video "${src.title}" (tema: ${topic}). Cada una trae su timestamp en segundos. Elige el momento MÁS VIRAL/impactante (lo que la gente compartiría hoy). Devuelve SOLO JSON: {"start": <segundos, del timestamp elegido menos 4>, "title": "título en INGLÉS de alto CTR (<=60 chars)", "subject_x": <0.0 a 1.0: posición horizontal del sujeto principal>}.` }];
  thumbs.forEach((th) => { parts.push({ text: `t=${th.t}s` }); parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(th.p).toString("base64") } }); });
  for (let r = 0; r < 2; r++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) { try { const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }) }); if (!res.ok) continue; const j = await res.json(); const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim(); if (t) return JSON.parse(t); } catch {} }
  return null;
}
let pick = await pickMoment();
if (!pick || !isFinite(+pick.start)) pick = { start: Math.round(dur * 0.4), title: src.title.slice(0, 60) };
const start = Math.max(0, Math.min(+pick.start, dur - CLIP - 2));
console.log(`Momento: ${Math.round(start)}s · "${pick.title}"`);

// 5) 9:16 profesional con sujeto centrado (smart crop) + música.
const { w: srcW, h: srcH } = sourceWH(film);
const sx = isFinite(+pick.subject_x) ? +pick.subject_x : 0.5;
const vf = smartCropVf(W, H, srcW, srcH, sx, "eq=contrast=1.06:saturation=1.05");
const pre = Math.max(0, start - 3), fine = (start - pre).toFixed(2);
const raw = `${work}/raw.mp4`;
// Corte conservando el AUDIO ORIGINAL del video CC-BY (sin -an).
execSync(`ffmpeg -y -ss ${pre} -i "${film}" -ss ${fine} -t ${CLIP} -vf "${vf}" -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 160k "${raw}"`, { stdio: "inherit" });
const hadAudio = finishClip(raw, outPath);
console.log("audio original: " + (hadAudio ? "sí" : "no (solo música)"));

// 6) Paquete con ATRIBUCIÓN (obligatoria en CC-BY) + manifiesto.
fs.mkdirSync("publish", { recursive: true });
const pkg = { title: (pick.title || src.title).slice(0, 92) + " #Shorts", description: `#Shorts\n\nCredit: ${attribution}\nUsed under Creative Commons (CC-BY). Edited/clipped.`, tags: ["shorts", niche, "creative commons"], language: "en" };
fs.writeFileSync("publish/package.json", JSON.stringify(pkg, null, 2));
fs.writeFileSync("clip_manifest.json", JSON.stringify({ niche, format: "9:16", clips: [{ clip_id: "cc1", source: "youtube_cc", license: "cc-by", url: `https://youtu.be/${src.id}`, attribution, query: topic }], transform: { narration: false, original_audio: hadAudio, editing: true, original_script: true, sound_design: true } }, null, 2));
console.log(`Short CC-BY listo -> ${outPath} · "${pkg.title}"`);
