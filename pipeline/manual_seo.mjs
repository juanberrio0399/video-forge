// manual_seo.mjs — SEO de un clip manual con IA (Gemini): titulo, descripcion y #hashtags.
// Uso: node pipeline/manual_seo.mjs <transcript.txt> "<caption/pista opcional>"
// Escribe title.txt y description.txt (lo que consume short_publish.mjs).
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [txtPath, caption = ""] = process.argv.slice(2);
const transcript = (txtPath && fs.existsSync(txtPath) ? fs.readFileSync(txtPath, "utf8") : "").trim();
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);

function escribir(title, desc) {
  fs.writeFileSync("title.txt", String(title).slice(0, 100));
  fs.writeFileSync("description.txt", String(desc).slice(0, 4900));
}

function fallback() {
  const base = (caption || transcript || "My Clip").slice(0, 90);
  escribir(base, `${base}\n\n#Shorts #clip #viral`);
  console.log("SEO fallback (sin Gemini):", base);
}

const prompt =
  `Eres editor de un canal de Shorts en YouTube. Te doy la transcripcion de un clip (y una pista opcional). ` +
  `Crea el SEO para publicarlo. Responde SOLO JSON: ` +
  `{"title":"titulo con alto CTR, <=90 chars, sin clickbait falso","description":"2-3 frases que enganchen","hashtags":["#tag", ...4-6 relevantes]}.\n` +
  `Escribe en el MISMO idioma del contenido (si no hay dialogo, usa la pista; si tampoco hay, ingles).\n` +
  (caption ? `PISTA: ${caption}\n` : "") +
  `TRANSCRIPCION:\n${transcript.slice(0, 6000) || "(sin dialogo; es un clip visual)"}`;

async function gemini() {
  if (!KEYS.length) return null;
  for (const k of KEYS) for (const m of TEXT_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      const p = JSON.parse(t);
      if (p && p.title) return p;
    } catch { /* siguiente modelo/clave */ }
  }
  return null;
}

const seo = await gemini();
if (!seo) { fallback(); process.exit(0); }

const title = String(seo.title || "My Clip").slice(0, 100);
let tags = Array.isArray(seo.hashtags) ? seo.hashtags.map((h) => (String(h).startsWith("#") ? h : "#" + h)) : [];
if (!tags.some((t) => /#shorts/i.test(t))) tags.push("#Shorts");
tags = tags.slice(0, 6);
const desc = `${(seo.description || "").trim()}\n\n${tags.join(" ")}`;
escribir(title, desc);
console.log("SEO:", title, "|", tags.join(" "));
