// review_video.mjs — auto-review de cada video con Gemini (IA, gratis). Saca 4
// fotogramas, los manda a Gemini vision, y devuelve una critica de calidad +
// gancho/retencion + mejoras para MAS VISTAS y MONETIZACION. El resultado se
// manda al chat de Telegram junto con el video.
//
// Uso: node pipeline/review_video.mjs <video.mp4> ["titulo"] [outFile=review.txt]
import fs from "node:fs";
import { execSync } from "node:child_process";

const [video, title = "video del canal de datos", outFile = "review.txt"] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.log("Sin GEMINI_API_KEY -> sin auto-review."); process.exit(0); }
if (!fs.existsSync(video)) { console.log("No hay video para revisar."); process.exit(0); }

// Duracion para muestrear fotogramas repartidos.
let dur = 45;
try { dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${video}"`).toString().trim()) || 45; } catch {}
fs.mkdirSync("_rev_frames", { recursive: true });
const imgs = [];
[0.08, 0.35, 0.62, 0.88].forEach((f, i) => {
  const t = (f * dur).toFixed(1);
  const p = `_rev_frames/r${i}.jpg`;
  try { execSync(`ffmpeg -y -ss ${t} -i "${video}" -frames:v 1 -vf scale=720:-1 -q:v 5 "${p}"`, { stdio: "ignore" }); imgs.push(p); } catch {}
});
if (!imgs.length) { console.log("No pude extraer fotogramas."); process.exit(0); }

const prompt = `Eres un AUDITOR experto de videos faceless de YouTube (canal de DATOS/DINERO en ingles; meta: mas VISTAS y MONETIZACION). Te muestro ${imgs.length} fotogramas de un video titulado "${title}".
Evalua BREVE y ACCIONABLE, en ESPAÑOL, con este formato exacto:
🎯 Gancho/retencion: (¿engancha? 1 frase)
🎨 Calidad visual: (footage, legibilidad, estilo; 1 frase)
📈 Para mas vistas/$: (2-3 mejoras concretas, viñetas cortas)
⭐ Nota: X/10
Maximo 110 palabras. Directo, sin relleno.`;

const parts = [{ text: prompt }, ...imgs.map((p) => ({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(p).toString("base64") } }))];
const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

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

if (out) {
  fs.writeFileSync(outFile, `🔍 Auto-review del video (Gemini)\n\n${out}`);
  console.log(out);
} else {
  console.log("Gemini no devolvio review.");
}
