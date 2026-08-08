// compilation_script.mjs — guionista de COMPILACIONES para el canal auto (Oddly Loop).
// La IA escribe una narración CALMADA con un dato/curiosidad por clip (formato satisfying/
// ASMR + facts) = valor original TRANSFORMADOR (no solo re-subir clips). Salida = voicemap
// compatible con tts_kokoro.py y build_compilation.mjs: {title, beats:[{text,query,tipo,...}]}.
//
// Uso: node pipeline/compilation_script.mjs <niche> <out.json>
// Env: GEMINI_API_KEY
import fs from "node:fs";

const [niche = "satisfying", out = "voicemap.json", variant = "narrado", kind = "video"] = process.argv.slice(2);
const isShort = kind === "short"; // Short = 9:16, ~6-8 clips, punchy (lo que más se descubre)
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const tf = (u, o = {}, ms = 30000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

// Sugerencia de queries de stock por nicho (la IA puede refinarlas). Sale de sources.json.
let sources = {};
try { sources = JSON.parse(fs.readFileSync("channel/auto2/sources.seed.json", "utf8")); } catch {}
const nicheCfg = (sources.niches || {})[niche] || {};
const label = nicheCfg.label || niche;
const pool = (nicheCfg.queries || ["satisfying"]).join(", ");
// Duración del SHORT por CATEGORÍA: ASMR aguanta más largo (retención alta); ciencia va corto.
// Es un RANGO -> la IA/producción alarga solo si el material realmente engancha ("lo entretenido").
const SHORT = nicheCfg.short || { min_beats: 6, max_beats: 8, clip_sec: 6 };

// ESTILO EXPERTO por nicho (destilado de investigación de canales faceless que funcionan).
const NICHE_STYLE = {
  satisfying: "compilación 'oddly satisfying' con narración CALMADA y suave (vibra ASMR/relax); cada clip trae un dato curioso corto sobre lo que se ve (por qué es satisfactorio / la ciencia detrás).",
  narrativas: "HISTORIA con tensión real: gancho de intriga en 2s (giro/pregunta/afirmación contraintuitiva), narración TENSA y ajustada (frases cortas, ritmo), cada beat sube la apuesta con un giro, y un FINAL con vuelta de tuerca que da ganas de compartir. Recontrata la atención a la mitad con un cambio (revelación). Nada de relleno.",
  ciencia_humor: "DATO asombroso + HUMOR: estructura de chiste (montaje serio o predecible -> giro absurdo/inesperado = punchline). Timing: una pausa antes del remate. Observacional y relatable, no forzado. Ágil y punchy. Cada beat = un hecho que sorprende + un toque de humor seco.",
  naturaleza_relax: "naturaleza relajante con narración calmada y datos de la naturaleza; ritmo lento, cada beat una imagen bella con un dato asombroso.",
}[niche] || "narración calmada con un dato curioso por clip.";
// Reglas de RETENCIÓN que aplican a todo guion narrado (lo que separa lo pro de lo genérico).
const EXPERT_RULES = "REGLAS DE RETENCIÓN: (1) el PRIMER beat engancha en los primeros 2 segundos (pattern interrupt / brecha de curiosidad / algo contraintuitivo); NADA de 'in this video'. (2) Frases CORTAS y rítmicas, aptas para voz. (3) A la mitad, un cambio que re-engancha. (4) El ÚLTIMO beat cierra fuerte (giro, remate o CTA de 3 palabras). (5) Cero relleno: si un beat no sube la apuesta, va fuera.";

async function gemini(prompt) {
  if (!KEYS.length) return null;
  for (let round = 0; round < 3; round++) {
    for (let k = 0; k < KEYS.length; k++) {           // prueba cada API key (respaldo = doble cuota)
      for (const m of ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]) {
        try {
          const r = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEYS[k]}`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
          });
          if (r.status === 429 || r.status === 503) { console.error(`key${k + 1}/${m}: ${r.status}`); continue; }
          if (!r.ok) { console.error(`key${k + 1}/${m}: ${r.status}`); continue; }
          const j = await r.json();
          const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
          if (t) return JSON.parse(t);
        } catch (e) { console.error(`key${k + 1}/${m}: ${e.message}`); }
      }
    }
    await sleep(15000); // todas las llaves/modelos saturados -> espero y reintento la ronda
  }
  return null;
}

// VARIANTE "puro" (ASMR sin voz): NO hay narración. Solo curamos clips (queries) + título.
// Es lo más fiel al ASMR real: mandan el SONIDO y el VISUAL. Robusto: si Gemini no está,
// armamos la lista con el pool del nicho -> la producción NO depende de la IA.
if (variant === "puro") {
  const scr = await gemini(
    `Eres curador de un canal ASMR / "oddly satisfying" en YouTube (audiencia EEUU). ` +
    `Elige 14 clips de stock MUY satisfying/ASMR (cortes limpios, agua, slime, arena cinética, prensa hidráulica, pintura, resina, etc.). ` +
    `Inspírate en o elige de: ${pool}. Cada "query" = término de búsqueda de stock en INGLES. ` +
    `Devuelve SOLO JSON: {"title":"título en inglés de alto CTR estilo 'Oddly Satisfying' (SIN datos, SIN clickbait falso)","beats":[{"query":"término stock en inglés","tipo":"clip"}]}`
  );
  const rawBeats = (scr && Array.isArray(scr.beats) && scr.beats.length) ? scr.beats : (nicheCfg.queries || ["satisfying"]).map((q) => ({ query: q, tipo: "clip" }));
  const title = (scr && scr.title) || (isShort ? "Oddly Satisfying ASMR #Shorts" : "The Most Oddly Satisfying Video to Melt Your Stress Away");
  const voicemap = {
    lang: "en", title, niche, variant, kind, defaults: { pause_after: 0 },
    beats: rawBeats.slice(0, isShort ? SHORT.max_beats : 16).map((b) => ({ text: "", query: (b.query || nicheCfg.queries?.[0] || niche).trim(), tipo: b.tipo || "clip", pause_after: 0 })),
  };
  fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
  console.log(`Guion ASMR PURO ${isShort ? "SHORT " : ""}(sin voz): "${title}" · ${voicemap.beats.length} clips${scr ? "" : " (fallback pool, sin Gemini)"} -> ${out}`);
  process.exit(0);
}

const prompt =
  `Eres guionista EXPERTO de un canal faceless de YouTube en INGLES (audiencia EEUU) tipo "${label}". ` +
  `Estilo: ${NICHE_STYLE}\n${EXPERT_RULES}\n` +
  `Escribe el guion de UNA compilación con ALTA RETENCION. Cada "beat" = un clip de stock con su narración corta. ` +
  `La narración da valor ORIGINAL (dato/curiosidad/comentario), no describe lo obvio. Tono acorde al nicho. ` +
  `El "query" de cada beat es un termino de busqueda de STOCK en ingles (elige de o inspirate en: ${pool}). ` +
  `Devuelve SOLO JSON:\n` +
  `{"title":"titulo en ingles de alto CTR (sin clickbait falso)${isShort ? " terminado en #Shorts" : ""}","beats":[{"text":"1-2 frases en ingles","query":"termino stock en ingles","tipo":"intro|clip|reveal|cta"}]}\n` +
  (isShort
    ? `Es un SHORT vertical: usa entre ${SHORT.min_beats} y ${SHORT.max_beats} beats. LO ENTRETENIDO manda: alarga (hacia ${SHORT.max_beats}) SOLO si cada clip realmente engancha; si no, corto (hacia ${SHORT.min_beats}). El PRIMER beat engancha en 2s; el ULTIMO es un CTA de 3 palabras a suscribirse. Frases cortisimas, sin relleno.`
    : `Usa 12 a 18 beats. El PRIMER beat engancha; el ULTIMO es un CTA suave a SUSCRIBIRSE. Nada de relleno.`);

const scr = await gemini(prompt);
if (!scr || !Array.isArray(scr.beats) || !scr.beats.length) { console.error("Gemini no devolvio guion de compilacion"); process.exit(1); }

const voicemap = {
  lang: "en",
  title: scr.title || `${label} compilation`,
  niche, variant, kind,
  defaults: { pause_after: isShort ? 0.15 : 0.35 },
  beats: scr.beats.map((b) => ({
    text: (b.text || "").trim(),
    query: (b.query || nicheCfg.queries?.[0] || niche).trim(),
    tipo: b.tipo || "clip",
    pause_after: isShort ? 0.15 : 0.35,
  })).filter((b) => b.text).slice(0, isShort ? SHORT.max_beats : 18),
};
fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
console.log(`Guion compilacion ${isShort ? "SHORT " : ""}(${niche}, ${variant}): "${voicemap.title}" · ${voicemap.beats.length} clips -> ${out}`);
