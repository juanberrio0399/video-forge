// build_composition.mjs — genera la composicion HyperFrames del video (nivel pro):
// fondo cinematografico, numeros hero gigantes, barras animadas, comparaciones,
// subtitulos con diseno, y un ticker sutil. Todo sincronizado con timing.json.
//
// Uso: node pipeline/build_composition.mjs <timing.json> <out.html> [audio] [maxSeconds]
import fs from "node:fs";

const [timingPath, outPath, audioFile = "voiceover.mp3", maxSecondsArg, brollPath] = process.argv.slice(2);
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const broll = brollPath && fs.existsSync(brollPath) ? JSON.parse(fs.readFileSync(brollPath, "utf8")) : [];
const maxSeconds = maxSecondsArg && parseFloat(maxSecondsArg) > 0 ? parseFloat(maxSecondsArg) : timing.total;
const beats = timing.beats.filter((b) => b.start < maxSeconds);
const total = Math.min(timing.total, maxSeconds);
const RATE = 1902;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = (n) => Number(n).toFixed(2);

// ---- Datos animados AUTOMATICOS: por cada beat, si menciona una cifra/estadistica fuerte,
// la mostramos GIGANTE y animada encima del b-roll. Funciona para CUALQUIER tema (no hardcodeado).
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const COUNT = "views|users|subscribers|people|customers|stores|employees|downloads|followers";
const magAbbr = { trillion: "T", billion: "B", million: "M", thousand: "K" };
function extractFigure(text) {
  const t = " " + text.replace(/,/g, "") + " ";
  // 1) numero + magnitud + sustantivo de CONTEO -> "300M SUBSCRIBERS"
  let m = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s?(trillion|billion|million|thousand)\\s(${COUNT})`, "i"));
  if (m) return { big: m[1] + magAbbr[m[2].toLowerCase()], sub: m[3].toUpperCase() };
  // 2) numero EN PALABRAS + magnitud (+ dollars/conteo) -> "$85M"
  m = t.match(/\b([a-z]+)(?:[-\s]([a-z]+))?\s(trillion|billion|million|thousand)\s(dollars|people|users|views|subscribers|customers)?/i);
  if (m && WORDNUM[m[1].toLowerCase()]) {
    let n = WORDNUM[m[1].toLowerCase()]; if (m[2] && WORDNUM[m[2].toLowerCase()]) n += WORDNUM[m[2].toLowerCase()];
    if (m[4] && !/dollar/i.test(m[4])) return { big: n + magAbbr[m[3].toLowerCase()], sub: m[4].toUpperCase() };
    const money = /dollar/i.test(m[4] || "") || /\$/.test(text);
    return { big: (money ? "$" : "") + n + magAbbr[m[3].toLowerCase()], sub: "" };
  }
  // 3) $X magnitud -> "$19B"
  m = t.match(/\$\s?(\d+(?:\.\d+)?)\s?(trillion|billion|million|thousand)\b/i);
  if (m) return { big: "$" + m[1] + magAbbr[m[2].toLowerCase()], sub: "" };
  // 4) digito + magnitud sin unidad -> dinero (canal de dinero) "$XB"
  m = t.match(/(\d+(?:\.\d+)?)\s?(trillion|billion|million|thousand)\b/i);
  if (m) return { big: "$" + m[1] + magAbbr[m[2].toLowerCase()], sub: "" };
  // 5) porcentaje
  m = t.match(/(\d+(?:\.\d+)?)\s?(?:percent|%)/i);
  if (m) return { big: m[1] + "%", sub: "" };
  // 6) $X,XXX grande
  m = text.match(/\$\s?\d[\d,]{2,}/);
  if (m) return { big: m[0].replace(/\s/g, ""), sub: "" };
  // 7) numero grande (4+ digitos) + conteo -> "40K STORES"
  m = t.match(new RegExp(`(\\d{4,})\\s?(${COUNT})`, "i"));
  if (m) { const n = +m[1]; const big = n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M" : Math.round(n / 1000) + "K"; return { big, sub: m[2].toUpperCase() }; }
  return null;
}

const els = [];
const tw = []; // lineas GSAP

// ---- Subtitulos (lower third con acento) ----
beats.forEach((b, i) => {
  const end = Math.min(b.end, total);
  els.push(`<div class="cap" id="cap${i}"><span class="cap-bar"></span><span class="cap-txt">${esc(b.text)}</span></div>`);
  tw.push(`tl.fromTo("#cap${i}",{opacity:0,y:26},{opacity:1,y:0,duration:0.32,ease:"power3.out"},${f2(b.start)});`);
  tw.push(`tl.to("#cap${i}",{opacity:0,y:-10,duration:0.24,ease:"power1.in"},${f2(end - 0.2)});`);
});

// ---- Datos animados (automaticos por beat) ----
let sid = 0, lastHeroEnd = -99;
beats.forEach((b) => {
  const tipo = (b.tipo || "").toLowerCase();
  const fig = extractFigure(b.text || "");
  if (!fig || !["dato", "reveal", "hook", "sintesis", "cta"].includes(tipo)) return;
  if (b.start - lastHeroEnd < 3.2) return; // no encimar datos seguidos
  const id = `sc${sid++}`;
  const inT = b.start + 0.15;
  const outT = Math.min(Math.min(b.end, total) - 0.15, inT + 3.0);
  if (outT <= inT + 0.5) return;
  lastHeroEnd = outT;
  const color = (tipo === "reveal" || tipo === "cta") ? "gr" : (tipo === "hook" ? "am" : "cy");
  els.push(`<div class="scene num c-${color}" id="${id}">
      <div class="num-big">${esc(fig.big)}</div>
      ${fig.sub ? `<div class="num-sub">${esc(fig.sub)}</div>` : ""}
    </div>`);
  tw.push(`tl.fromTo("#${id} .num-big",{opacity:0,scale:0.7,y:30},{opacity:1,scale:1,y:0,duration:0.6,ease:"back.out(1.6)"},${f2(inT)});`);
  if (fig.sub) tw.push(`tl.fromTo("#${id} .num-sub",{opacity:0,y:16},{opacity:1,y:0,duration:0.5,ease:"power3.out"},${f2(inT + 0.18)});`);
  tw.push(`tl.to("#${id} .num-big",{scale:1.04,duration:${f2(outT - inT)},ease:"sine.inOut"},${f2(inT + 0.6)});`);
  tw.push(`tl.to("#${id}",{opacity:0,duration:0.35,ease:"power1.in"},${f2(outT)});`);
});

// ---- Capa de b-roll (footage real de fondo) + ken burns ----
const brollEls = [];
const brollTw = [];
broll.forEach((c, i) => {
  if (c.start >= total) return;
  const dur = Math.min(c.dur, total - c.start);
  const isVideo = /\.(mp4|webm|mov)$/i.test(c.file);
  if (isVideo) {
    brollEls.push(`<video class="broll clip" id="bv${i}" data-start="${f2(c.start)}" data-duration="${f2(dur)}" data-track-index="0" src="${c.file}" muted playsinline></video>`);
    brollTw.push(`tl.fromTo("#bv${i}",{opacity:0},{opacity:1,duration:0.6,ease:"power1.out"},${f2(c.start)});`);
    // Zoom lento alternado (in/out) por clip -> movimiento de director, no plano estatico.
    const z0 = i % 2 ? 1.0 : 1.14, z1 = i % 2 ? 1.14 : 1.0;
    brollTw.push(`tl.fromTo("#bv${i}",{scale:${z0}},{scale:${z1},duration:${f2(dur + 0.6)},ease:"none"},${f2(c.start)});`);
  } else {
    // imagen IA con ken burns (zoom + paneo), visibilidad por opacidad en su ventana
    const dx = i % 2 ? -50 : 50;
    brollEls.push(`<img class="broll" id="bv${i}" src="${c.file}" />`);
    brollTw.push(`tl.set("#bv${i}",{opacity:0},0);`);
    brollTw.push(`tl.to("#bv${i}",{opacity:1,duration:0.6,ease:"power1.out"},${f2(c.start)});`);
    brollTw.push(`tl.to("#bv${i}",{opacity:0,duration:0.5,ease:"power1.in"},${f2(Math.max(c.start, c.start + dur - 0.45))});`);
    brollTw.push(`tl.fromTo("#bv${i}",{scale:1.05,xPercent:0,yPercent:0},{scale:1.22,xPercent:${dx / 20},yPercent:-2,duration:${f2(dur)},ease:"none"},${f2(c.start)});`);
  }
});
const hasBroll = brollEls.length > 0;

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=1920, height=1080" />
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1920px;height:1080px;overflow:hidden;background:#05070f}
  body{font-family:"Inter",system-ui,sans-serif;color:#eaf1ff}
  .mono{font-family:"JetBrains Mono",monospace}
  #root{position:relative;width:1920px;height:1080px;background:#05070f;overflow:hidden}
  /* b-roll de fondo (footage real) + capa oscura para legibilidad */
  .broll{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;opacity:0}
  #dark{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,15,.05),rgba(5,7,15,.08) 55%,rgba(5,7,15,.22))}
  /* fondo cinematografico: blobs de gradiente que se mueven lento */
  .blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:${hasBroll ? 0.28 : 0.5}}
  #b1{width:900px;height:900px;left:-160px;top:-200px;background:radial-gradient(circle,#1b8fb0,transparent 65%)}
  #b2{width:1000px;height:1000px;right:-220px;top:120px;background:radial-gradient(circle,#0e7a53,transparent 65%)}
  #b3{width:760px;height:760px;left:35%;bottom:-260px;background:radial-gradient(circle,#5b3fb0,transparent 65%)}
  #grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:70px 70px}
  #vig{position:absolute;inset:0;background:radial-gradient(120% 120% at 50% 45%,transparent 55%,rgba(0,0,0,.65))}
  /* ticker sutil arriba a la derecha */
  #ticker{position:absolute;top:54px;right:70px;text-align:right;padding:14px 22px;border:1px solid rgba(120,160,220,.18);border-radius:16px;background:rgba(10,16,30,.35);backdrop-filter:blur(6px)}
  #ticker .tl{font-size:15px;letter-spacing:3px;color:#6b86b8;text-transform:uppercase;font-weight:600}
  #ticker .tv{font-size:40px;font-weight:900;color:#eaf1ff;margin-top:2px}
  /* numeros hero */
  .scene{position:absolute;top:300px;left:0;right:0;text-align:center;opacity:0}
  .num-big{font-size:200px;font-weight:900;letter-spacing:-6px;line-height:1;background:linear-gradient(90deg,#eaf1ff,#22d3ee 60%,#34d399);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 12px 40px rgba(34,211,238,.25))}
  .c-gr .num-big{background:linear-gradient(90deg,#eaf1ff,#34d399);-webkit-background-clip:text;background-clip:text}
  .c-am .num-big{background:linear-gradient(90deg,#fde68a,#f59e0b);-webkit-background-clip:text;background-clip:text}
  .num-sub{font-size:40px;font-weight:800;color:#9fb2d4;margin-top:14px;letter-spacing:1px;text-transform:uppercase}
  .stmt{top:330px;padding:0 220px}
  .stmt-big{font-size:96px;font-weight:900;line-height:1.06;letter-spacing:-2px;background:linear-gradient(90deg,#eaf1ff,#22d3ee 72%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 10px 34px rgba(34,211,238,.22))}
  .stmt-sub{font-size:38px;font-weight:700;color:#9fb2d4;margin-top:20px;letter-spacing:.5px}
  /* comparacion */
  .cmp{top:340px;padding:0 360px}
  .cmp-row{display:flex;align-items:center;gap:28px;margin:22px 0}
  .cmp-name{width:220px;text-align:right;font-size:44px;font-weight:800}
  .cmp-track{flex:1;height:64px;background:rgba(255,255,255,.06);border-radius:14px;overflow:hidden}
  .cmp-fill{height:100%;width:0;border-radius:14px}
  .f-yt{background:linear-gradient(90deg,#22d3ee,#2563eb);box-shadow:0 0 40px rgba(34,211,238,.35)}
  .f-nf{background:linear-gradient(90deg,#f87171,#b91c1c)}
  .cmp-sub{text-align:center;font-size:34px;color:#9fb2d4;margin-top:22px;font-weight:600}
  /* split */
  .split{top:380px;padding:0 400px}
  .split-bar{display:flex;height:90px;border-radius:16px;overflow:hidden;background:rgba(255,255,255,.06)}
  .split-g{width:0;background:linear-gradient(90deg,#34d399,#059669)}
  .split-c{width:0;background:linear-gradient(90deg,#64748b,#334155)}
  .split-legend{display:flex;justify-content:center;gap:60px;margin-top:26px;font-size:34px;font-weight:800}
  .lg.gr{color:#34d399}.lg.mut{color:#7c8aa5}
  /* subtitulos lower third */
  .cap{position:absolute;bottom:104px;left:260px;right:260px;display:flex;align-items:center;gap:22px;opacity:0}
  .cap-bar{width:8px;align-self:stretch;min-height:54px;border-radius:6px;background:linear-gradient(180deg,#22d3ee,#34d399)}
  .cap-txt{flex:1;text-align:left;font-size:44px;font-weight:800;line-height:1.22;text-shadow:0 4px 28px rgba(0,0,0,.9)}
  #brand{position:absolute;bottom:46px;left:70px;font-size:22px;font-weight:800;color:#6b7ea3;letter-spacing:2px}
</style></head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${f2(total)}" data-fps="30" data-width="1920" data-height="1080">
    ${brollEls.join("\n    ")}
    ${hasBroll ? '<div id="dark"></div>' : ""}
    <div class="blob" id="b1"></div><div class="blob" id="b2"></div><div class="blob" id="b3"></div>
    <div id="grid"></div><div id="vig"></div>

    <audio id="voz" class="clip" data-start="0" data-duration="${f2(total)}" data-track-index="9" src="${audioFile}"></audio>

    ${els.join("\n    ")}

    <div id="brand">The Data Lens</div>
  </div>

  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    const T = ${f2(total)};

    // fondo: blobs a la deriva (seek-safe, sobre toda la duracion)
    tl.to("#b1",{x:180,y:120,duration:T,ease:"sine.inOut"},0);
    tl.to("#b2",{x:-160,y:-90,duration:T,ease:"sine.inOut"},0);
    tl.to("#b3",{x:120,y:-140,duration:T,ease:"sine.inOut"},0);

    ${brollTw.join("\n    ")}

    ${tw.join("\n    ")}

    window.__timelines["main"] = tl;
  </script>
</body></html>
`;

fs.writeFileSync(outPath, html);
const nScenes = (html.match(/class="scene/g) || []).length;
console.log(`Composicion PRO: ${outPath}`);
console.log(`  ${f2(total)}s (${(total / 60).toFixed(1)} min) · ${beats.length} subtitulos · ${nScenes} escenas hero`);
