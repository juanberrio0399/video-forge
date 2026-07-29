// build_short.mjs — SHORT profesional vertical 9:16 estilo "logo audio-reactivo":
// el logo de The Data Lens PULSA con la voz (amplitud pre-calculada con ffmpeg y
// horneada como keyframes, porque HyperFrames renderiza con timeline congelada),
// sobre un fondo de b-roll del tema DESENFOCADO + subtitulos GRANDES bien puestos.
//
// Uso: node pipeline/build_short.mjs <beats.json> <out.html> <audio.mp3> <style> [bg_queries]
//   style: logo (default) | broll | animation
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const [beatsPath, outHtml, audioFile = "short.mp3", style = "logo", bgQueriesArg = ""] = process.argv.slice(2);
const PEXELS = process.env.PEXELS_API_KEY || "";
const data = JSON.parse(fs.readFileSync(beatsPath, "utf8"));
const beats = data.beats || [];
const total = data.total || (beats.length ? beats[beats.length - 1].end : 30);
const W = 1080, H = 1920, FPS = 30;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = (n) => Number(n).toFixed(2);
const isLogo = style === "logo" || style === "animation" ? true : style === "broll" ? false : true;

// Fondo b-roll: para el estilo logo va MUY desenfocado y oscuro (que resalte el logo/texto).
const GRADE = isLogo
  ? "boxblur=24:3,eq=contrast=1.04:saturation=0.85:brightness=-0.08,curves=preset=darker"
  : "eq=contrast=1.08:saturation=1.1:brightness=0.02,curves=preset=lighter,unsharp=3:3:0.3";

async function dl(url, dest) { const r = await fetch(url); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); }
async function pexelsPortrait(q) {
  if (!PEXELS) return null;
  try {
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=12`, { headers: { Authorization: PEXELS } });
    if (!r.ok) return null;
    const j = await r.json();
    for (const v of (j.videos || [])) {
      const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.height);
      files.sort((a, b) => b.height - a.height);
      const f = files.find((f) => f.height >= 1280 && f.height <= 1920) || files[0];
      if (f) return f.link;
    }
  } catch {}
  return null;
}
async function aiImage(prompt, dest, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ", cinematic vertical, dark, no text")}?width=${W}&height=${H}&nologo=true&model=flux&seed=${seed}`;
  await dl(url, dest);
}

// ---- Fondo vertical (b-roll con cortes, desenfocado para el logo) ----
async function buildBg() {
  const queries = bgQueriesArg ? bgQueriesArg.split("|").map((s) => s.trim()).filter(Boolean)
    : ["money cash counting", "modern city skyline day", "stock market data screen", "server room data center", "gold coins wealth"];
  const SEG = isLogo ? 3.2 : 2.6;
  const n = Math.max(1, Math.ceil(total / SEG));
  const parts = [];
  for (let i = 0; i < n; i++) {
    const q = queries[i % queries.length];
    const out = `short_seg${i}.mp4`;
    const dur = +(Math.min(SEG, total - i * SEG) + 0.3).toFixed(2);
    if (dur <= 0.3) break;
    try {
      const link = await pexelsPortrait(q);
      if (link) {
        const raw = `short_raw${i}.mp4`;
        await dl(link, raw);
        execSync(`ffmpeg -y -stream_loop -1 -i "${raw}" -t ${dur} -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${GRADE}" -an -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
        fs.rmSync(raw, { force: true });
      } else {
        const img = `short_img${i}.jpg`;
        await aiImage(q, img, 500 + i);
        const frames = Math.round(dur * FPS);
        execSync(`ffmpeg -y -loop 1 -i "${img}" -t ${dur} -vf "scale=${Math.round(W * 1.3)}:${Math.round(H * 1.3)},zoompan=z='min(zoom+0.001,1.3)':d=${frames}:s=${W}x${H}:fps=${FPS},${GRADE}" -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${out}"`, { stdio: "ignore" });
      }
      parts.push({ file: path.resolve(out).replace(/\\/g, "/"), dur });
    } catch (e) { console.error("seg", i, e.message); }
  }
  if (!parts.length) return null;
  const bg = "short_bg.mp4";
  if (parts.length === 1) {
    execSync(`ffmpeg -y -i "${parts[0].file}" -t ${f2(total)} -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
  } else {
    const TD = 0.3, TR = ["fade", "fade", "fadeblack"];
    const inputs = parts.map((p) => `-i "${p.file}"`).join(" ");
    let filter = "", acc = "[0:v]", accLen = parts[0].dur;
    for (let i = 1; i < parts.length; i++) {
      const off = +(accLen - TD).toFixed(3);
      filter += `${acc}[${i}:v]xfade=transition=${TR[(i - 1) % TR.length]}:duration=${TD}:offset=${off}[v${i}];`;
      acc = `[v${i}]`; accLen = +(accLen + parts[i].dur - TD).toFixed(3);
    }
    filter = filter.replace(/;$/, "");
    execSync(`ffmpeg -y ${inputs} -filter_complex "${filter}" -map "${acc}" -t ${f2(total)} -r ${FPS} -c:v libx264 -preset veryfast -pix_fmt yuv420p "${bg}"`, { stdio: "ignore" });
  }
  // Pista de audio en silencio (HyperFrames exige audio en el clip de video).
  try {
    execSync(`ffmpeg -y -i "${bg}" -f lavfi -t ${f2(total)} -i anullsrc=r=44100:cl=stereo -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest short_bg_a.mp4`, { stdio: "ignore" });
    fs.rmSync(bg, { force: true }); fs.renameSync("short_bg_a.mp4", bg);
  } catch (e) { console.error("silent audio:", e.message); }
  return bg;
}

// ---- Envolvente de amplitud de la voz (para que el logo PULSE con la voz) ----
function amplitudeEnvelope() {
  // RMS por ventana de 0.1s (10 muestras/seg) con ffmpeg astats.
  try {
    execSync(`ffmpeg -y -i "${audioFile}" -af "asetnsamples=4410:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=amp.txt" -f null - `, { stdio: "ignore" });
    const txt = fs.readFileSync("amp.txt", "utf8");
    // Captura cada RMS_level (incluye "-inf" en silencios -> amplitud 0, sin desalinear).
    const lin = [...txt.matchAll(/RMS_level=(\S+)/g)].map((m) => {
      const db = parseFloat(m[1]);
      return isFinite(db) ? Math.pow(10, db / 20) : 0;
    });
    const max = Math.max(...lin, 1e-6);
    return lin.map((v) => Math.min(1, v / max));
  } catch (e) {
    console.error("amplitude:", e.message);
    return [];
  }
}

const bgFile = await buildBg();
const amp = amplitudeEnvelope();

// ---- Composicion HTML ----
const els = [], tw = [];
// SUBTITULOS -> se generan como .ass y se QUEMAN con ffmpeg despues del render.
// (GSAP no ocultaba bien el texto al saltar de frame en HyperFrames -> se encimaban
// todos. ffmpeg/libass muestra exactamente UNO a la vez por su timing: a prueba de balas.)
function assTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
}
const dia = [];
beats.forEach((b) => {
  const start = +b.start || 0;
  const end = Math.min(+b.end || start + 2, total);
  const words = (b.text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const PER = 4;
  const chunks = [];
  for (let w = 0; w < words.length; w += PER) chunks.push(words.slice(w, w + PER).join(" "));
  const dur = Math.max(0.35, (end - start) / chunks.length);
  chunks.forEach((txt, ci) => {
    const cs = start + ci * dur;
    const ce = Math.min(end, start + (ci + 1) * dur);
    dia.push(`Dialogue: 0,${assTime(cs)},${assTime(ce)},Def,,0,0,0,,${txt.replace(/[\r\n]+/g, " ")}`);
  });
});
// Estilo: grande, blanco, borde negro grueso, negrita, centrado abajo (bajo el logo).
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Def,Liberation Sans,96,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,4,2,90,90,360,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dia.join("\n")}
`;
fs.writeFileSync("captions.ass", ass);
console.log(`captions.ass: ${dia.length} trozos`);
// Logo audio-reactivo: escala del logo + glow segun la amplitud (horneado, seek-safe).
amp.forEach((a, i) => {
  const t = f2(i * 0.1);
  tw.push(`tl.to("#logo",{scale:${(1 + a * 0.20).toFixed(3)},duration:0.1,ease:"power1.out"},${t});`);
  tw.push(`tl.to("#glow",{scale:${(1 + a * 0.55).toFixed(3)},opacity:${(0.12 + a * 0.45).toFixed(2)},duration:0.1,ease:"power1.out"},${t});`);
});
tw.push(`tl.fromTo("#prog",{width:"0%"},{width:"100%",duration:${f2(total)},ease:"none"},0);`);

// Logo SVG de The Data Lens (lente/ojo con linea de tendencia + pupila en el pico).
const LOGO_SVG = `<svg viewBox="0 0 220 220" width="100%" height="100%">
  <defs><linearGradient id="lg" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#34d399"/></linearGradient></defs>
  <path d="M18,110 Q110,42 202,110 Q110,178 18,110 Z" fill="none" stroke="url(#lg)" stroke-width="8"/>
  <polyline points="58,132 88,116 116,126 146,86 172,74" fill="none" stroke="url(#lg)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="172" cy="74" r="13" fill="url(#lg)"/>
</svg>`;

const bgLayer = bgFile
  ? `<video id="bg" class="clip" data-start="0" data-duration="${f2(total)}" data-track-index="0" src="${bgFile}"></video><div id="shade"></div>`
  : `<div id="animbg"></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:#05070f;font-family:'Arial Black',Arial,sans-serif;color:#fff}
  #root{position:relative;width:${W}px;height:${H}px;overflow:hidden}
  #bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  #shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,15,.55),rgba(5,7,15,.35) 45%,rgba(5,7,15,.8))}
  #animbg{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 30%,#10203f,#05070f 70%)}
  #handle{position:absolute;top:90px;left:0;right:0;text-align:center;font-size:44px;font-weight:800;color:#eaf1ff;letter-spacing:1px;text-shadow:0 3px 16px rgba(0,0,0,.7)}
  #logowrap{position:absolute;top:540px;left:0;right:0;display:flex;justify-content:center}
  #glow{position:absolute;top:520px;left:50%;transform:translateX(-50%);width:560px;height:560px;border-radius:50%;
        background:radial-gradient(circle,rgba(34,211,238,.45),rgba(34,211,238,0) 68%);opacity:.12}
  #logo{width:440px;height:440px;filter:drop-shadow(0 18px 50px rgba(34,211,238,.35));transform-origin:center center}
  .cap{position:absolute;left:80px;right:80px;top:1120px;height:520px;display:flex;align-items:center;justify-content:center;text-align:center;opacity:0}
  .capt{font-size:96px;line-height:1.1;font-weight:900;color:#fff;letter-spacing:-1px;
        text-shadow:0 5px 24px rgba(0,0,0,.92),0 0 3px rgba(0,0,0,.95)}
  #progwrap{position:absolute;bottom:150px;left:90px;right:90px;height:12px;background:rgba(255,255,255,.14);border-radius:8px;overflow:hidden}
  #prog{height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#34d399);border-radius:8px}
</style></head><body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${f2(total)}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    ${bgLayer}
    <div id="handle">@TheDataLensHQ</div>
    <div id="glow"></div>
    <div id="logowrap"><div id="logo">${LOGO_SVG}</div></div>
    ${els.join("\n    ")}
    <div id="progwrap"><div id="prog"></div></div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    ${tw.join("\n    ")}
    window.__timelines["main"] = tl;
  </script>
</body></html>`;

fs.writeFileSync(outHtml, html);
console.log(`Short LOGO listo: ${outHtml} (${beats.length} frases, ${f2(total)}s, ${amp.length} muestras de amplitud, bg=${bgFile ? "b-roll" : "animacion"})`);
