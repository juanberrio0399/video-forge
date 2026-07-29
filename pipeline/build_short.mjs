// build_short.mjs — arma un SHORT profesional NATIVO en vertical 9:16 (1080x1920).
// NO recicla el video horizontal: construye la composicion vertical con fondo a
// pantalla completa (b-roll real vertical o animacion limpia de marca), subtitulos
// GRANDES animados (frase por frase, con resalte), numeros hero gigantes y barra de
// progreso. Estilo finanzas/datos moderno. Render con HyperFrames.
//
// Uso: node pipeline/build_short.mjs <beats.json> <out.html> <audio.mp3> <style> [bg_queries]
//   beats.json = { total, beats:[{text,start,end}] }  (re-baseados a 0)
//   style = broll | animation | hybrid
//   bg_queries = lista separada por '|' de queries de b-roll (opcional)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const [beatsPath, outHtml, audioFile = "short.mp3", style = "broll", bgQueriesArg = ""] = process.argv.slice(2);
const PEXELS = process.env.PEXELS_API_KEY || "";
const data = JSON.parse(fs.readFileSync(beatsPath, "utf8"));
const beats = data.beats || [];
const total = data.total || (beats.length ? beats[beats.length - 1].end : 30);
const W = 1080, H = 1920, FPS = 30;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = (n) => Number(n).toFixed(2);

// Grade "premium" para el b-roll: contraste filmico + un pelin de saturacion + oscurecido
// leve abajo para que el texto grande se lea siempre.
const GRADE = "eq=contrast=1.08:saturation=1.1:brightness=0.02,curves=preset=lighter,unsharp=3:3:0.3";

// ---- Numeros hero (mismas cifras que el video largo, en vertical) ----
const HERO = [
  { m: "nineteen hundred dollars a second", big: "$1,900", sub: "PER SECOND" },
  { m: "sixty billion dollars", big: "$60B", sub: "A YEAR" },
  { m: "hundred and sixty-four million", big: "$164M", sub: "PER DAY" },
  { m: "six point eight million", big: "$6.8M", sub: "PER HOUR" },
  { m: "hundred and fourteen thousand", big: "$114K", sub: "PER MINUTE" },
  { m: "ten million subscribers", big: "10M", sub: "YOUTUBE TV SUBS" },
  { m: "eight hundred million", big: "$800M", sub: "PER MONTH" },
  { m: "ten billion dollars a year", big: "$10B", sub: "PER YEAR" },
  { m: "thirty-six billion", big: "$36B", sub: "ADS · 2024" },
  { m: "hundred billion", big: "$100B", sub: "PAID TO CREATORS" },
  { m: "eighty-five million", big: "$85M", sub: "MRBEAST · 2024" },
];

async function dl(url, dest) { const r = await fetch(url); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); }
async function pexelsPortrait(q) {
  if (!PEXELS) return null;
  try {
    const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=12`, { headers: { Authorization: PEXELS } });
    if (!r.ok) return null;
    const j = await r.json();
    for (const v of (j.videos || []).sort(() => 0.5 - (Date.now() % 2))) {
      const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.height);
      files.sort((a, b) => b.height - a.height);
      const f = files.find((f) => f.height >= 1280 && f.height <= 1920) || files[0];
      if (f) return f.link;
    }
  } catch {}
  return null;
}
async function aiImage(prompt, dest, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ", cinematic vertical, bright clean light, no text")}?width=${W}&height=${H}&nologo=true&model=flux&seed=${seed}`;
  await dl(url, dest);
}

// ---- Fondo vertical: b-roll a pantalla completa con cortes rapidos (o animacion) ----
async function buildBg() {
  if (style === "animation") return null; // fondo animado por CSS, sin video
  const queries = bgQueriesArg ? bgQueriesArg.split("|").map((s) => s.trim()).filter(Boolean)
    : ["money cash counting bright", "modern city skyline day", "stock market data bright", "person working laptop office", "gold coins wealth bright"];
  const SEG = 2.6; // cortes rapidos
  const n = Math.max(1, Math.ceil(total / SEG));
  const parts = [];
  for (let i = 0; i < n; i++) {
    const q = queries[i % queries.length];
    const out = `short_seg${i}.mp4`;
    const dur = +(Math.min(SEG, total - i * SEG) + 0.3).toFixed(2);
    if (dur <= 0.3) break;
    let link = await pexelsPortrait(q);
    try {
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
    const TD = 0.3, TR = ["fade", "wiperight", "slideup", "circleopen"];
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
  return bg;
}

const bgFile = await buildBg();

// ---- Composicion HTML (HyperFrames, timeline pausada seek-safe) ----
const els = [], tw = [];
let sid = 0;
beats.forEach((b, i) => {
  const start = +b.start || 0;
  const end = Math.min(+b.end || start + 2, total);
  // Subtitulo GRANDE (frase) con pop-in + resalte.
  els.push(`<div class="cap" id="cap${i}"><span class="capt">${esc((b.text || "").trim())}</span></div>`);
  tw.push(`tl.fromTo("#cap${i}",{opacity:0,scale:0.86,y:40},{opacity:1,scale:1,y:0,duration:0.3,ease:"back.out(1.7)"},${f2(start)});`);
  tw.push(`tl.to("#cap${i}",{opacity:0,scale:1.04,duration:0.2,ease:"power1.in"},${f2(end - 0.12)});`);
  // Numero hero si la frase menciona una cifra clave.
  const low = (b.text || "").toLowerCase();
  const hero = HERO.find((h) => low.includes(h.m));
  if (hero) {
    const id = `h${sid++}`;
    els.push(`<div class="hero" id="${id}"><div class="hbig">${esc(hero.big)}</div><div class="hsub">${esc(hero.sub)}</div></div>`);
    const hend = Math.min(end, start + 2.6);
    tw.push(`tl.fromTo("#${id} .hbig",{opacity:0,scale:0.6,y:20},{opacity:1,scale:1,y:0,duration:0.45,ease:"back.out(2)"},${f2(start + 0.05)});`);
    tw.push(`tl.fromTo("#${id} .hsub",{opacity:0},{opacity:1,duration:0.3},${f2(start + 0.25)});`);
    tw.push(`tl.to("#${id}",{opacity:0,duration:0.3},${f2(hend)});`);
  }
});
// Barra de progreso.
tw.push(`tl.fromTo("#prog",{width:"0%"},{width:"100%",duration:${f2(total)},ease:"none"},0);`);

const bgLayer = bgFile
  ? `<video id="bg" class="clip" data-start="0" data-duration="${f2(total)}" data-track-index="0" src="${bgFile}"></video><div id="shade"></div>`
  : `<div id="animbg"></div><div id="grid"></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:#05070f;font-family:'Arial Black',Arial,sans-serif;color:#fff}
  #root{position:relative;width:${W}px;height:${H}px;overflow:hidden}
  #bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  #shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,15,.35),rgba(5,7,15,.15) 40%,rgba(5,7,15,.65))}
  #animbg{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 20%,#122040,#05070f 70%)}
  #grid{position:absolute;inset:0;background-image:linear-gradient(rgba(90,140,220,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(90,140,220,.08) 1px,transparent 1px);background-size:64px 64px}
  #handle{position:absolute;top:70px;left:0;right:0;text-align:center;font-size:40px;font-weight:800;color:#eaf1ff;letter-spacing:1px;text-shadow:0 3px 14px rgba(0,0,0,.6)}
  .hero{position:absolute;top:640px;left:0;right:0;text-align:center;opacity:0}
  .hbig{font-size:230px;font-weight:900;letter-spacing:-6px;line-height:1;background:linear-gradient(90deg,#eaf1ff,#22d3ee 60%,#34d399);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 14px 44px rgba(34,211,238,.35))}
  .hsub{font-size:52px;font-weight:800;color:#9fd6ff;margin-top:10px;letter-spacing:2px}
  .cap{position:absolute;left:60px;right:60px;bottom:430px;text-align:center;opacity:0}
  .capt{display:inline;font-size:76px;line-height:1.12;font-weight:900;color:#fff;letter-spacing:-1px;
        text-shadow:0 4px 18px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.9);
        background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0));
        box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:6px 14px}
  #progwrap{position:absolute;bottom:150px;left:80px;right:80px;height:12px;background:rgba(255,255,255,.14);border-radius:8px;overflow:hidden}
  #prog{height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#34d399);border-radius:8px}
</style></head><body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${f2(total)}" data-fps="${FPS}" data-width="${W}" data-height="${H}">
    ${bgLayer}
    <div id="handle">@TheDataLensHQ</div>
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
console.log(`Short vertical listo: ${outHtml} (estilo ${style}, ${beats.length} frases, ${f2(total)}s, bg=${bgFile ? "b-roll" : "animacion"})`);
