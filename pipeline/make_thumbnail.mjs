// make_thumbnail.mjs — arma la MINIATURA de YouTube (1280x720): fondo generado con
// Pollinations (flux, gratis, sin key) segun el tema + el texto grande del paquete SEO
// sobrepuesto con ffmpeg (blanco + acento cian, borde negro para que se lea).
// Uso: node pipeline/make_thumbnail.mjs "<tema>" "<TEXTO MINIATURA>" [out.jpg]
import fs from "node:fs";
import { execSync } from "node:child_process";

const [topic = "data video", ttRaw = "THE DATA LENS", out = "thumbnail.jpg"] = process.argv.slice(2);
const W = 1280, H = 720;
const FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";

// 1) Fondo (flux, sin texto). Reintenta; si falla, fondo oscuro liso.
const prompt = encodeURIComponent(`${topic}, money finance data theme, dramatic cinematic lighting, dark moody background, high contrast, professional, no text, no words, no letters`);
let bgOk = false;
for (let i = 0; i < 4 && !bgOk; i++) {
  try {
    execSync(`curl -s -L "https://image.pollinations.ai/prompt/${prompt}?width=${W}&height=${H}&nologo=true&model=flux&seed=${(i + 1) * 13}" -o bg.jpg`, { stdio: "ignore" });
    if (fs.existsSync("bg.jpg") && fs.statSync("bg.jpg").size > 8000) bgOk = true; else execSync("sleep 4");
  } catch { try { execSync("sleep 4"); } catch {} }
}
if (!bgOk) execSync(`ffmpeg -y -f lavfi -i color=c=0x0a0e18:s=${W}x${H} -frames:v 1 bg.jpg`, { stdio: "ignore" });

// 2) Texto: mayusculas, partido en <=2 lineas balanceadas.
const tt = (ttRaw || "").toUpperCase().replace(/[^A-Z0-9 $%.,!?+-]/g, "").replace(/\s+/g, " ").trim() || "THE DATA LENS";
const words = tt.split(" ");
let l1 = tt, l2 = "";
if (words.length >= 2) {
  let best = 1e9, cut = 1;
  for (let k = 1; k < words.length; k++) {
    const d = Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
    if (d < best) { best = d; cut = k; }
  }
  l1 = words.slice(0, cut).join(" "); l2 = words.slice(cut).join(" ");
}
fs.writeFileSync("l1.txt", l1);
if (l2) fs.writeFileSync("l2.txt", l2);
fs.writeFileSync("brand.txt", "THE DATA LENS");

// 3) Tamaño segun la linea mas larga (que no se desborde).
const maxLen = Math.max(l1.length, l2.length || 0);
const fsz = Math.max(64, Math.min(140, Math.floor(1180 / (maxLen * 0.60))));
const y1 = l2 ? 245 : 300;
const F = [
  `drawbox=x=0:y=0:w=${W}:h=${H}:color=black@0.42:t=fill`,
  `drawtext=textfile=l1.txt:fontfile=${FONT}:fontsize=${fsz}:fontcolor=white:borderw=9:bordercolor=black@0.92:x=(w-text_w)/2:y=${y1}`,
];
if (l2) F.push(`drawtext=textfile=l2.txt:fontfile=${FONT}:fontsize=${fsz}:fontcolor=0x22d3ee:borderw=9:bordercolor=black@0.92:x=(w-text_w)/2:y=${y1 + fsz + 16}`);
F.push(`drawtext=textfile=brand.txt:fontfile=${FONT}:fontsize=34:fontcolor=white@0.85:borderw=4:bordercolor=black@0.8:x=(w-text_w)/2:y=648`);

execSync(`ffmpeg -y -i bg.jpg -vf "${F.join(",")}" -frames:v 1 -q:v 2 "${out}"`, { stdio: "inherit" });
console.log("Miniatura lista:", out, "| lineas:", JSON.stringify([l1, l2].filter(Boolean)));
