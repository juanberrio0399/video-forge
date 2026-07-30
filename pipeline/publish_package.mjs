// publish_package.mjs — arma y VALIDA con IA el paquete de publicacion de YouTube
// ANTES de subir. Genera: titulo (alto CTR + SEO), descripcion, tags, capitulos,
// comentario fijado, texto de miniatura, subtitulos (.srt) desde el guion, y una
// VALIDACION de Gemini de todo el paquete (para maximas vistas). Nada se publica
// aqui: solo se prepara y se manda a Telegram para que Juan lo apruebe.
//
// Uso: node pipeline/publish_package.mjs <voicemap.json> <timing.json> "<tema>" [outDir=publish]
import fs from "node:fs";

const [voicemapPath, timingPath, topic = "video de datos", outDir = "publish"] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
fs.mkdirSync(outDir, { recursive: true });

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }

// --- Guion (voicemap) + tiempos (timing) alineados por indice ---
const vm = readJSON(voicemapPath);
const vmBeats = vm ? (vm.beats || vm) : [];
const timing = readJSON(timingPath);
const tBeats = timing ? (timing.beats || timing) : [];

const beats = vmBeats.map((b, i) => {
  const t = tBeats[i] || {};
  return { text: (b.text || b.line || "").trim(), start: t.start, end: t.end, dur: t.dur ?? t.duration };
});
let acc = 0;
for (const b of beats) {
  if (b.start == null) b.start = acc;
  if (b.end == null) b.end = b.start + (b.dur || 3);
  acc = b.end;
}
const transcript = beats.map((b) => b.text).filter(Boolean).join(" ");

// --- Subtitulos .srt desde el guion + tiempos ---
function srtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
const srt = beats.filter((b) => b.text).map((b, i) => `${i + 1}\n${srtTime(b.start)} --> ${srtTime(b.end)}\n${b.text}\n`).join("\n");
fs.writeFileSync(`${outDir}/captions.srt`, srt);

// --- Gemini helper: modelos REALES + reintento con backoff en 429/503 ---
// (el SEO corre justo despues de la voz/shorts, que agotan la cuota gratis: hay que esperar)
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
async function gemini(prompt) {
  if (!KEY) return null;
  for (let round = 0; round < 3; round++) {
    for (const m of MODELS) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
        });
        if (r.status === 429 || r.status === 503) { console.error(`gemini ${m}: ${r.status} (espero y reintento)`); await sleep(15000); continue; }
        if (!r.ok) { console.error(`gemini ${m}: ${r.status}`); continue; }
        const j = await r.json();
        const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
        return JSON.parse(t);
      } catch (e) { console.error(`gemini ${m}: ${e.message}`); }
    }
  }
  console.error("Gemini no respondio tras varios reintentos.");
  return null;
}

// --- 1) Generar el paquete de publicacion (SEO + CTR), en INGLES ---
const pkgPrompt = `Eres experto en SEO y packaging de YouTube para un canal faceless de DATOS/DINERO, en INGLES, mercado EE.UU. Tema del video: "${topic}".
Transcripcion del video: """${transcript.slice(0, 4500)}"""
Devuelve SOLO un JSON con un paquete de publicacion OPTIMIZADO para VISTAS y descubrimiento, TODO en INGLES:
{
 "title": "titulo de alto CTR, <=90 caracteres, con la cifra o idea mas impactante; sin clickbait falso",
 "description": "descripcion SEO: 3-5 lineas (hook + que aprende el espectador + llamado a suscribirse). Deja una linea en blanco y agrega 'Chapters:' con la lista de capitulos (mm:ss - label). Al final agrega en linea aparte: 'This video uses an AI-generated voice.'",
 "tags": ["10 a 15 tags/keywords relevantes en ingles"],
 "chapters": [{"time":"0:00","label":"Intro"}],
 "pinned_comment": "un comentario fijado que invite a comentar (pregunta abierta relacionada)",
 "thumbnail_text": "2 a 4 palabras GRANDES para la miniatura (impacto)",
 "hashtags": ["3 a 5 hashtags"],
 "category": "Education",
 "language": "en"
}`;
// Al REGENERAR, toma en cuenta los comentarios/sugerencias de la vez anterior y hazlo MEJOR y distinto.
const improve = (process.env.SEO_IMPROVE || "").trim();
const pkg = (await gemini(improve
  ? pkgPrompt + `\n\nESTA ES UNA REGENERACION. El auditor pidio mejorar: "${improve}". Corrige eso, haz el TITULO mas fuerte y CLARAMENTE DISTINTO al anterior, y sube el CTR y el SEO.`
  : pkgPrompt)) || {};

// --- Bloque de LINKS profesionales, SIEMPRE en la descripcion (canal, suscribir, redes) ---
// Enlaces internos = mas vistas por sesion y canal mas profesional. Las redes se toman de
// env (SOCIAL_TIKTOK / SOCIAL_IG) si existen; si no, no se ponen enlaces vacios.
const CHANNEL_URL = "https://youtube.com/@TheDataLensHQ";
const SUB_URL = "https://youtube.com/@TheDataLensHQ?sub_confirmation=1";
// Respaldo: si la IA no respondio, NO dejar un paquete vacio (titulo "-"). Usar el tema real.
if (!pkg.title) pkg.title = topic;
if (!pkg.description) pkg.description = `${topic}\n\nThe numbers behind how this really works — explained with data.\n\nThis video uses an AI-generated voice.`;
if (!pkg.tags || !pkg.tags.length) pkg.tags = ["data", "money", "youtube", "finance", "business", "explained"];
if (!pkg.hashtags || !pkg.hashtags.length) pkg.hashtags = ["#data", "#money", "#youtube"];
const links = [
  `▶️ Subscribe for more: ${SUB_URL}`,
  `📺 More videos: ${CHANNEL_URL}/videos`,
];
if (process.env.SOCIAL_TIKTOK) links.push(`🎵 TikTok: ${process.env.SOCIAL_TIKTOK}`);
if (process.env.SOCIAL_IG) links.push(`📸 Instagram: ${process.env.SOCIAL_IG}`);
const linkBlock = "\n\n— — —\n" + links.join("\n");
// Anexa los links a la descripcion (sin duplicar el disclosure de voz IA, que ya lo trae).
if (pkg && typeof pkg.description === "string" && !pkg.description.includes("Subscribe for more")) {
  pkg.description = pkg.description + linkBlock;
}

// --- 2) VALIDAR el paquete (auditor de publicacion) ---
const valPrompt = `Eres un auditor estricto de publicaciones de YouTube (meta: maximas vistas y descubrimiento). Valida este paquete: ${JSON.stringify(pkg)}.
Devuelve SOLO JSON:
{"ctr_titulo": X, "seo_descripcion": X, "tags_ok": true, "problemas": ["..."], "sugerencias": ["..."], "listo": true, "nota_global": X}
donde X es 0-10. Se estricto: baja la nota si el titulo es debil, la descripcion no tiene keywords, faltan capitulos o los tags son genericos.`;
const val = (await gemini(valPrompt)) || {};

fs.writeFileSync(`${outDir}/package.json`, JSON.stringify({ topic, ...pkg, validation: val }, null, 2));

// --- Resumen para Telegram (aprobacion de Juan) ---
const chaptersTxt = (pkg.chapters || []).map((c) => `${c.time} ${c.label}`).join("\n") || "-";
const summary = [
  `📦 Paquete de publicacion (validado por IA) — nota ${val.nota_global ?? "?"}/10`,
  ``,
  `🏷️ Titulo: ${pkg.title || "-"}`,
  ``,
  `📝 Descripcion:`,
  `${(pkg.description || "-").slice(0, 700)}`,
  ``,
  `🔖 Tags: ${(pkg.tags || []).join(", ") || "-"}`,
  `#️⃣ Hashtags: ${(pkg.hashtags || []).join(" ") || "-"}`,
  ``,
  `⏱️ Capitulos:`,
  `${chaptersTxt}`,
  ``,
  `📌 Comentario fijado: ${pkg.pinned_comment || "-"}`,
  `🖼️ Miniatura (texto): ${pkg.thumbnail_text || "-"}`,
  ``,
  `🔎 Validacion IA: CTR titulo ${val.ctr_titulo ?? "?"}/10 · SEO desc ${val.seo_descripcion ?? "?"}/10 · ${val.listo ? "✅ listo" : "⚠️ revisar"}`,
  (val.problemas && val.problemas.length) ? `⚠️ Problemas: ${val.problemas.join("; ")}` : ``,
  (val.sugerencias && val.sugerencias.length) ? `💡 Sugerencias: ${val.sugerencias.join("; ")}` : ``,
  ``,
  `📄 Subtitulos captions.srt generados (${beats.filter((b) => b.text).length} lineas).`,
  `ℹ️ Al subir se marca "contenido alterado/sintetico" (voz IA), como exige YouTube.`,
].filter((l) => l !== undefined).join("\n");
fs.writeFileSync(`${outDir}/summary.txt`, summary);
console.log(summary);
