// review_video.mjs — auto-review de cada video con Gemini (IA, gratis). Saca 4
// fotogramas, los manda a Gemini vision, y devuelve una critica de calidad +
// gancho/retencion + mejoras para MAS VISTAS y MONETIZACION. El resultado se
// manda al chat de Telegram junto con el video.
//
// Uso: node pipeline/review_video.mjs <video.mp4> ["titulo"] [outFile=review.txt]
import fs from "node:fs";
import { execSync } from "node:child_process";

const [video, title = "video del canal de datos", outFile = "review.txt", jsonOut = "review.json", voicemap = ""] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.log("Sin GEMINI_API_KEY -> sin auto-review."); process.exit(0); }
if (!fs.existsSync(video)) { console.log("No hay video para revisar."); process.exit(0); }

// Lee la narracion de APERTURA (ahi vive el gancho) para juzgarlo desde el guion, no de un frame.
let openingText = "";
if (voicemap && fs.existsSync(voicemap)) {
  try {
    const vm = JSON.parse(fs.readFileSync(voicemap, "utf8"));
    const beats = vm.beats || vm;
    openingText = beats.slice(0, 4).map((b) => b.text || b.line || "").join(" ").trim();
  } catch {}
}
const hookBlock = openingText
  ? `\nGANCHO (analiza el TEXTO de la narracion de apertura, ahi vive el gancho): "${openingText}"\nDi si es FUERTE o DEBIL y por que (curiosidad, cifra impactante, promesa clara). Si es debil, propon una mejor primera linea.\n`
  : "";

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

const prompt = `Eres un AUDITOR experto de videos faceless de YouTube (canal de DATOS/DINERO en ingles; meta: mas VISTAS y MONETIZACION), titulo "${title}". Te doy DOS cosas: ${imgs.length} FOTOGRAMAS FIJOS y el texto de la narracion de apertura.
${hookBlock}IMPORTANTE sobre los frames: son imagenes FIJAS. NO evalues animacion, transiciones, ritmo, musica ni cosas de la subida (tarjetas, suscribete): NO los ves. Evalua SOLO lo visible: iluminacion/brillo, color y contraste, composicion, legibilidad de textos y numeros, y relevancia/variedad/calidad del footage de fondo.
Feedback BREVE y ACCIONABLE, en ESPAÑOL, formato exacto:
🪝 Gancho: (fuerte o debil + 1 frase; si es debil, propon mejor apertura)
🎨 Calidad visual: (luz, color, footage; 1 frase)
📈 Mejoras concretas: (2-3 vinetas, SOLO palancas del render: luz, contraste, saturacion, footage mas relevante/variado, textos. PROHIBIDO animaciones/musica/subida.)
⭐ Nota: X/10
Maximo 120 palabras.

Al FINAL, en una linea aparte, EXACTAMENTE:
FIX: {"score": X.X, "fixes": {"brightness": 0.0, "saturation": 0.0, "contrast": 0.0, "pace": "same"}, "footage_feedback": "", "hook": ""}
- score = la MISMA nota.
- fixes: ajustes PEQUEÑOS -0.06..+0.10 segun lo que ves (sube brillo si oscuro, saturacion/contraste si plano). pace siempre "same".
- footage_feedback: 6-12 palabras con QUE mejorar del footage el proximo intento (mas relevante al tema, mas variado, mas cinematografico), o "" si esta bien.
- hook: "fuerte" o "debil" + 3-6 palabras de por que.
Numeros y strings validos.`;

const parts = [{ text: prompt }, ...imgs.map((p) => ({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(p).toString("base64") } }))];
const models = ["gemini-2.5-flash-lite", "gemini-flash-latest-lite", "gemini-flash-latest", "gemini-flash-latest"];

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
  let footage_feedback = "";
  let hook = "";
  const m = text.match(/FIX:\s*(\{[\s\S]*\})/);
  if (m) {
    try {
      const j = JSON.parse(m[1]);
      if (j.score != null) score = +j.score || 0;
      if (j.fixes) fixes = { ...fixes, ...j.fixes };
      if (typeof j.footage_feedback === "string") footage_feedback = j.footage_feedback.slice(0, 120);
      if (typeof j.hook === "string") hook = j.hook.slice(0, 80);
    } catch {}
  }
  if (!score) {
    const s = text.match(/Nota:\s*([\d.]+)/i);
    if (s) score = +s[1] || 0;
  }
  return { score, fixes, footage_feedback, hook };
}

const EMPTY = { score: 0, fixes: { brightness: 0, saturation: 0, contrast: 0, pace: "same" }, footage_feedback: "", hook: "" };
if (out) {
  const { score, fixes, footage_feedback, hook } = parseFix(out);
  const human = out.replace(/\n?FIX:\s*\{[\s\S]*\}\s*$/i, "").trim();
  fs.writeFileSync(outFile, `🔍 Auto-review del video (Gemini)\n\n${human}`);
  fs.writeFileSync(jsonOut, JSON.stringify({ score, fixes, footage_feedback, hook }));
  console.log(`nota=${score} hook=${JSON.stringify(hook)} footage_feedback=${JSON.stringify(footage_feedback)} fixes=${JSON.stringify(fixes)}`);
  console.log(human);
} else {
  fs.writeFileSync(jsonOut, JSON.stringify(EMPTY));
  console.log("Gemini no devolvio review.");
}
