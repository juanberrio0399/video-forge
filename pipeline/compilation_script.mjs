// compilation_script.mjs — guionista de COMPILACIONES para el canal auto (Oddly Loop).
// La IA escribe una narración CALMADA con un dato/curiosidad por clip (formato satisfying/
// ASMR + facts) = valor original TRANSFORMADOR (no solo re-subir clips). Salida = voicemap
// compatible con tts_kokoro.py y build_compilation.mjs: {title, beats:[{text,query,tipo,...}]}.
//
// Uso: node pipeline/compilation_script.mjs <niche> <out.json>
// Env: GEMINI_API_KEY
import fs from "node:fs";

const [niche = "satisfying", out = "voicemap.json"] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const tf = (u, o = {}, ms = 30000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

// Sugerencia de queries de stock por nicho (la IA puede refinarlas). Sale de sources.json.
let sources = {};
try { sources = JSON.parse(fs.readFileSync("channel/auto2/sources.seed.json", "utf8")); } catch {}
const nicheCfg = (sources.niches || {})[niche] || {};
const label = nicheCfg.label || niche;
const pool = (nicheCfg.queries || ["satisfying"]).join(", ");

const NICHE_STYLE = {
  satisfying: "compilación 'oddly satisfying' con narración CALMADA y suave (vibra ASMR/relax); cada clip trae un dato curioso corto sobre lo que se ve (por qué es satisfactorio / la ciencia detrás).",
  narrativas: "historia narrada con tensión (giros), con b-roll atmosférico; cada beat avanza la historia.",
  ciencia_humor: "datos de ciencia explicados con humor ligero; cada beat un hecho asombroso.",
  naturaleza_relax: "naturaleza relajante con narración calmada y datos de la naturaleza.",
}[niche] || "narración calmada con un dato curioso por clip.";

async function gemini(prompt) {
  if (!KEY) return null;
  for (let round = 0; round < 3; round++) {
    for (const m of ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]) {
      try {
        const r = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
        });
        if (r.status === 429 || r.status === 503) { console.error(`${m}: ${r.status} (espero 15s)`); await sleep(15000); continue; }
        if (!r.ok) { console.error(`${m}: ${r.status}`); continue; }
        const j = await r.json();
        const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
        return JSON.parse(t);
      } catch (e) { console.error(`${m}: ${e.message}`); }
    }
  }
  return null;
}

const prompt =
  `Eres guionista de un canal faceless de YouTube en INGLES (audiencia EEUU) tipo "${label}". ` +
  `Estilo: ${NICHE_STYLE}\n` +
  `Escribe el guion de UNA compilación con ALTA RETENCION. Cada "beat" = un clip de stock con su narración corta. ` +
  `La narración da valor ORIGINAL (dato/curiosidad/comentario), no describe lo obvio. Tono acorde al nicho. ` +
  `El "query" de cada beat es un termino de busqueda de STOCK en ingles (elige de o inspirate en: ${pool}). ` +
  `Devuelve SOLO JSON:\n` +
  `{"title":"titulo en ingles de alto CTR (sin clickbait falso)","beats":[{"text":"1-2 frases en ingles","query":"termino stock en ingles","tipo":"intro|clip|reveal|cta"}]}\n` +
  `Usa 12 a 18 beats. El PRIMER beat engancha; el ULTIMO es un CTA suave a SUSCRIBIRSE. Nada de relleno.`;

const scr = await gemini(prompt);
if (!scr || !Array.isArray(scr.beats) || !scr.beats.length) { console.error("Gemini no devolvio guion de compilacion"); process.exit(1); }

const voicemap = {
  lang: "en",
  title: scr.title || `${label} compilation`,
  niche,
  defaults: { pause_after: 0.35 },
  beats: scr.beats.map((b) => ({
    text: (b.text || "").trim(),
    query: (b.query || nicheCfg.queries?.[0] || niche).trim(),
    tipo: b.tipo || "clip",
    pause_after: 0.35,
  })).filter((b) => b.text),
};
fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
console.log(`Guion compilacion (${niche}): "${voicemap.title}" · ${voicemap.beats.length} clips -> ${out}`);
