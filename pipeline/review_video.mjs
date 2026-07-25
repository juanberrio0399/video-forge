// review_video.mjs — auto-review de cada video con Gemini (IA, gratis). Saca 4
// fotogramas, los manda a Gemini vision, y devuelve una critica de calidad +
// gancho/retencion + mejoras para MAS VISTAS y MONETIZACION. El resultado se
// manda al chat de Telegram junto con el video.
//
// Uso: node pipeline/review_video.mjs <video.mp4> ["titulo"] [outFile=review.txt]
import fs from "node:fs";
import { execSync } from "node:child_process";

const [video, title = "video del canal de datos", outFile = "review.txt", jsonOut = "review.json"] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.log("Sin GEMINI_API_KEY -> sin auto-review."); process.exit(0); }
if (!fs.existsSync(video)) { console.log("No hay video para revisar."); process.exit(0); }

// Duracion para muestrear fotogramas repartidos.
let dur = 45;
try { dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${video}"`).toString().trim()) || 45; } catch {}
fs.mkdirSync("_rev_frames", { recursive: true });
const imgs = [];
[0.05, 0.16, 0.29, 0.42, 0.55, 0.68, 0.82, 0.94].forEach((f, i) => {
  const t = (f * dur).toFixed(1);
  const p = `_rev_frames/r${i}.jpg`;
  try { execSync(`ffmpeg -y -ss ${t} -i "${video}" -frames:v 1 -vf scale=720:-1 -q:v 5 "${p}"`, { stdio: "ignore" }); imgs.push(p); } catch {}
});
if (!imgs.length) { console.log("No pude extraer fotogramas."); process.exit(0); }

const prompt = `Eres un AUDITOR experto de fotogramas de videos faceless de YouTube (canal de DATOS/DINERO en ingles; meta: mas VISTAS y MONETIZACION). Te muestro ${imgs.length} FOTOGRAMAS FIJOS de un video titulado "${title}".
IMPORTANTE: son imagenes FIJAS. NO evalues animacion, transiciones, ritmo de cortes, musica ni nada de la subida a YouTube (tarjetas, pantalla final, suscribete): NO los ves y NO se cambian en el render. Evalua SOLO lo visible en un frame: iluminacion/brillo, color y contraste, composicion, legibilidad de textos y numeros, y relevancia/variedad/calidad del footage de fondo.
Da feedback BREVE y ACCIONABLE, en ESPAÑOL, formato exacto:
🎯 Legibilidad/gancho: (¿el frame comunica y atrae? 1 frase)
🎨 Calidad visual: (luz, color, footage; 1 frase)
📈 Mejoras concretas: (2-3 vinetas, SOLO sobre lo que el render cambia: mas/menos luz, mas contraste/saturacion, footage mas relevante o variado, textos mas grandes/legibles. PROHIBIDO sugerir animaciones, musica o cosas de la subida.)
⭐ Nota: X/10
Maximo 110 palabras.

Al FINAL, en una linea aparte, EXACTAMENTE:
FIX: {"score": X.X, "fixes": {"brightness": 0.0, "saturation": 0.0, "contrast": 0.0, "pace": "same"}}
score = la MISMA nota. Los "fixes" son ajustes PEQUEÑOS para el proximo intento SEGUN lo que ves:
brightness/saturation/contrast entre -0.06 y +0.10 (0 = igual; sube brillo si se ve oscuro, sube
saturacion/contraste si se ve plano). pace = "same" (no juzgas ritmo desde fotos). Numeros, no texto.`;

const parts = [{ text: prompt }, ...imgs.map((p) => ({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(p).toString("base64") } }))];
const models = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-2.0-flash"];

let out = "";
for (const m of models) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    if (!r.ok) { console.error(`${m}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue; }
    const j = await r.json();
    out = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (out) { console.log(`(modelo: ${m})`); break; }
  } catch (e) { console.error(`${m}: ${e.message}`); }
}

function parseFix(text) {
  let score = 0;
  let fixes = { brightness: 0, saturation: 0, contrast: 0, pace: "same" };
  const m = text.match(/FIX:\s*(\{[\s\S]*\})/);
  if (m) {
    try {
      const j = JSON.parse(m[1]);
      if (j.score != null) score = +j.score || 0;
      if (j.fixes) fixes = { ...fixes, ...j.fixes };
    } catch {}
  }
  if (!score) {
    const s = text.match(/Nota:\s*([\d.]+)/i);
    if (s) score = +s[1] || 0;
  }
  return { score, fixes };
}

const EMPTY = { score: 0, fixes: { brightness: 0, saturation: 0, contrast: 0, pace: "same" } };
if (out) {
  const { score, fixes } = parseFix(out);
  const human = out.replace(/\n?FIX:\s*\{[\s\S]*\}\s*$/i, "").trim();
  fs.writeFileSync(outFile, `🔍 Auto-review del video (Gemini)\n\n${human}`);
  fs.writeFileSync(jsonOut, JSON.stringify({ score, fixes }));
  console.log(`nota=${score} fixes=${JSON.stringify(fixes)}`);
  console.log(human);
} else {
  fs.writeFileSync(jsonOut, JSON.stringify(EMPTY));
  console.log("Gemini no devolvio review.");
}
