// build_composition.mjs — genera la composicion HyperFrames del video a partir del
// mapa de tiempos (timing.json). Sincroniza subtitulos + contador + numeros hero
// con la voz, y pone la narracion como pista de audio.
//
// Uso: node pipeline/build_composition.mjs <timing.json> <out.html> [audioFile] [maxSeconds]
import fs from "node:fs";

const [timingPath, outPath, audioFile = "voiceover.mp3", maxSecondsArg] = process.argv.slice(2);
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const maxSeconds = maxSecondsArg && parseFloat(maxSecondsArg) > 0 ? parseFloat(maxSecondsArg) : timing.total;

// Beats que caben en el limite (para renders de prueba cortos).
let beats = timing.beats.filter((b) => b.start < maxSeconds);
const total = Math.min(timing.total, maxSeconds);
const RATE = 1902; // USD por segundo (dato real del video) para el contador vivo.

// Numeros "hero": si el texto del beat contiene la frase, se hace un pop grande.
const HEROES = [
  { m: "sixty billion dollars in a single year", big: "$60,000,000,000", sub: "YouTube revenue · 2025" },
  { m: "hundred and sixty-four million dollars a day", big: "$164,000,000", sub: "por dia" },
  { m: "thirty-six billion dollars", big: "$36,400,000,000", sub: "solo en publicidad · 2024" },
  { m: "ten million subscribers", big: "10,000,000", sub: "YouTube TV · a $83/mes" },
  { m: "quietly passed netflix", big: "YouTube > Netflix", sub: "2025" },
  { m: "fifty-five percent", big: "55%", sub: "para los creadores" },
  { m: "one hundred billion dollars", big: "$100,000,000,000", sub: "pagado a creadores · 4 años" },
  { m: "eighty-five million dollars", big: "$85,000,000", sub: "MrBeast · 2024 · Forbes" },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- Construir elementos ---
const captionEls = [];
const captionTweens = [];
const heroEls = [];
const heroTweens = [];

beats.forEach((b, i) => {
  const end = Math.min(b.end, total);
  captionEls.push(
    `<div class="cap" id="cap${i}">${esc(b.text)}</div>`
  );
  // fade in al empezar el beat, fade out cerca del final
  captionTweens.push(`tl.fromTo("#cap${i}",{opacity:0,y:18},{opacity:1,y:0,duration:0.28,ease:"power2.out"},${b.start.toFixed(2)});`);
  captionTweens.push(`tl.to("#cap${i}",{opacity:0,duration:0.22,ease:"power1.in"},${(end - 0.18).toFixed(2)});`);

  // hero?
  const low = b.text.toLowerCase();
  const hero = HEROES.find((h) => low.includes(h.m));
  if (hero) {
    const id = `hero${i}`;
    heroEls.push(
      `<div class="hero" id="${id}"><div class="hero-big">${esc(hero.big)}</div><div class="hero-sub">${esc(hero.sub)}</div></div>`
    );
    const hstart = b.start + 0.15;
    const hout = Math.min(end - 0.2, hstart + 2.6);
    heroTweens.push(`tl.fromTo("#${id}",{opacity:0,scale:0.8},{opacity:1,scale:1,duration:0.5,ease:"back.out(1.7)"},${hstart.toFixed(2)});`);
    heroTweens.push(`tl.to("#${id}",{opacity:0,scale:1.04,duration:0.4,ease:"power1.in"},${hout.toFixed(2)});`);
  }
});

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #070b16; }
      body { font-family: "Inter", system-ui, sans-serif; color: #eaf1ff; }
      .mono { font-family: "JetBrains Mono", monospace; }
      #root {
        position: relative; width: 1920px; height: 1080px;
        background:
          radial-gradient(1200px 700px at 50% 12%, rgba(34,211,238,0.10), transparent 60%),
          radial-gradient(900px 600px at 82% 92%, rgba(52,211,153,0.08), transparent 60%),
          #070b16;
      }
      #grid { position: absolute; inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 64px 64px; }
      /* contador vivo */
      #counter-wrap { position: absolute; top: 90px; left: 0; right: 0; text-align: center; }
      #counter-label { font-size: 24px; letter-spacing: 8px; color: #22d3ee; font-weight: 600; text-transform: uppercase; }
      #counter { font-size: 108px; font-weight: 900; color: #eaf1ff; letter-spacing: -2px; margin-top: 6px; }
      #counter-sub { font-size: 22px; color: #6b7ea3; margin-top: 4px; }
      /* numeros hero (centro) */
      .hero { position: absolute; top: 360px; left: 0; right: 0; text-align: center; opacity: 0; }
      .hero-big { font-size: 132px; font-weight: 900; letter-spacing: -3px;
        background: linear-gradient(90deg,#eaf1ff,#22d3ee 55%,#34d399); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .hero-sub { font-size: 34px; color: #9fb2d4; margin-top: 10px; font-weight: 600; }
      /* subtitulos */
      .cap { position: absolute; bottom: 120px; left: 240px; right: 240px; text-align: center;
        font-size: 46px; font-weight: 800; line-height: 1.25; opacity: 0;
        text-shadow: 0 4px 24px rgba(0,0,0,0.85); }
      #brand { position: absolute; bottom: 44px; right: 70px; font-size: 22px; font-weight: 700; color: #6b7ea3; letter-spacing: 1px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total.toFixed(2)}" data-fps="30" data-width="1920" data-height="1080">
      <div id="grid"></div>

      <audio class="clip" data-start="0" data-duration="${total.toFixed(2)}" data-track-index="9" src="${audioFile}"></audio>

      <div id="counter-wrap">
        <div id="counter-label">YouTube gana ahora mismo</div>
        <div id="counter" class="mono">$0</div>
        <div id="counter-sub">en lo que llevas viendo este video</div>
      </div>

      ${heroEls.join("\n      ")}

      ${captionEls.join("\n      ")}

      <div id="brand">video-forge</div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // contador vivo: sube \$${RATE}/segundo, formateado con comas.
      const money = { v: 0 };
      const fmt = (n) => "$" + Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
      tl.to(money, { v: ${(RATE * total).toFixed(0)}, duration: ${total.toFixed(2)}, ease: "none",
        onUpdate: () => { document.getElementById("counter").textContent = fmt(money.v); } }, 0);

      ${heroTweens.join("\n      ")}

      ${captionTweens.join("\n      ")}

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;

fs.writeFileSync(outPath, html);
console.log(`Composicion generada: ${outPath}`);
console.log(`  duracion ${total.toFixed(1)}s (${(total / 60).toFixed(1)} min) · ${beats.length} subtitulos · ${heroEls.length} numeros hero`);
