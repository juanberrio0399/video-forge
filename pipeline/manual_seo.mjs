// manual_seo.mjs — SEO de un clip manual con IA (Gemini multimodal).
// Gemini ESCUCHA el audio del clip + la pista/caption y escribe title.txt / description.txt.
// Uso: node pipeline/manual_seo.mjs <audio.mp3|""> "<caption/pista opcional>"
// Si no hay audio (o falla), cae al caption. Sin dependencias pesadas (no whisper).
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [audioPath, caption = ""] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);
// Solo mandamos el audio si existe y es chico (limite de request inline ~20MB).
const hasAudio = !!(audioPath && fs.existsSync(audioPath) && fs.statSync(audioPath).size > 2000 && fs.statSync(audioPath).size < 15 * 1024 * 1024);

function escribir(title, desc) {
  fs.writeFileSync("title.txt", String(title).slice(0, 100));
  fs.writeFileSync("description.txt", String(desc).slice(0, 4900));
}
function fallback() {
  const base = (caption || "My Clip").slice(0, 90);
  escribir(base, `${base}\n\n#Shorts #clip #viral`);
  console.log("SEO fallback (sin Gemini/audio):", base);
}

const instrucciones =
  `Eres editor de un canal de Shorts en YouTube. ` +
  (hasAudio ? `Te doy el AUDIO de un clip` : `Te doy una pista de un clip`) +
  (caption ? ` y una pista del autor: "${caption}"` : ``) +
  `. Crea el SEO para publicarlo. Responde SOLO JSON: ` +
  `{"title":"titulo con alto CTR, <=90 chars, sin clickbait falso","description":"2-3 frases que enganchen","hashtags":["#tag", ...4-6 relevantes]}. ` +
  `Escribe en el MISMO idioma del contenido (si no puedes saberlo, ingles).`;

function parts() {
  const p = [];
  if (hasAudio) p.push({ inlineData: { mimeType: "audio/mp3", data: fs.readFileSync(audioPath).toString("base64") } });
  p.push({ text: instrucciones });
  return p;
}

async function gemini() {
  if (!KEYS.length) return null;
  const models = hasAudio ? ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"] : TEXT_MODELS;
  for (const k of KEYS) for (const m of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: parts() }], generationConfig: { responseMimeType: "application/json" } }),
      });
      if (!r.ok) { console.error(`${m}: ${r.status}`); continue; }
      const j = await r.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      const p = JSON.parse(t);
      if (p && p.title) return p;
    } catch (e) { console.error(`${m}: ${e.message}`); }
  }
  return null;
}

const seo = await gemini();
if (!seo) { fallback(); process.exit(0); }

const title = String(seo.title || "My Clip").slice(0, 100);
let tags = Array.isArray(seo.hashtags) ? seo.hashtags.map((h) => (String(h).startsWith("#") ? h : "#" + h)) : [];
if (!tags.some((t) => /#shorts/i.test(t))) tags.push("#Shorts");
tags = tags.slice(0, 6);
escribir(title, `${(seo.description || "").trim()}\n\n${tags.join(" ")}`);
console.log("SEO:", title, "|", tags.join(" "), hasAudio ? "(con audio)" : "(solo pista)");
