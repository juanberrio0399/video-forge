// compilation_script.mjs — guionista de COMPILACIONES para el canal auto (Oddly Loop).
// La IA escribe una narración CALMADA con un dato/curiosidad por clip (formato satisfying/
// ASMR + facts) = valor original TRANSFORMADOR (no solo re-subir clips). Salida = voicemap
// compatible con tts_kokoro.py y build_compilation.mjs: {title, beats:[{text,query,tipo,...}]}.
//
// Uso: node pipeline/compilation_script.mjs <niche> <out.json>
// Env: GEMINI_API_KEY
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";
import { genText } from "./llm.mjs";
import { revisar } from "./lib/titulos.mjs";

const [niche = "satisfying", out = "voicemap.json", variant = "narrado", kind = "video"] = process.argv.slice(2);

// Titulos ya publicados en el canal (los baja el workflow desde R2). Oddly repetia titulos:
// el 2026-10-03 habia 3 titulos exactos duplicados entre 45 Shorts. Es mucho menos que en
// Data Lens (22 de 45), pero es gratis evitarlo. AQUI SOLO se vigila el duplicado, NO la
// plantilla generica: en Oddly el listicle rinde mejor que el resto (mediana 53 vs 36) y
// ademas es el brazo de control del experimento de formato.
let titulosUsados = [];
try { titulosUsados = JSON.parse(fs.readFileSync("oddly_titles.json", "utf8")); } catch {}
if (!Array.isArray(titulosUsados)) titulosUsados = [];
const noRepetir = titulosUsados.slice(-60);
const bloqueNoRepetir = noRepetir.length
  ? `TITLES ALREADY USED on this channel — writing any of them again is forbidden: ${noRepetir.join(" | ")}. `
  : "";

/** Revisa el titulo, reintenta una vez con la queja, y si insiste no produce.
 *  `exigirPregunta` es una preferencia, no una puerta: si tras reintentar sigue sin ser pregunta
 *  pero NO esta repetido, se usa igual (perder un video por la redaccion es peor que el titulo). */
async function tituloValido(titulo, rehacer, extra = {}) {
  const opts = { prohibirGenerico: false, ...extra };
  let chequeo = revisar(titulo, titulosUsados, opts);
  if (chequeo.ok) return titulo;
  console.error(`Titulo rechazado (${chequeo.motivo}): "${titulo}" — reintentando`);
  const nuevo = await rehacer(chequeo.queja);
  if (nuevo && revisar(nuevo, titulosUsados, opts).ok) return nuevo;
  const sinPregunta = (t) => t && revisar(t, titulosUsados, { prohibirGenerico: false }).ok;
  if (extra.exigirPregunta && (sinPregunta(nuevo) || sinPregunta(titulo))) {
    const usar = sinPregunta(nuevo) ? nuevo : titulo;
    console.error(`Aviso: el titulo no quedo como pregunta tras reintentar; se usa igual: "${usar}"`);
    return usar;
  }
  console.error(`TITULO REPETIDO tras reintentar: "${nuevo || titulo}". No se produce.`);
  process.exit(1);
}
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
const EXPERT_RULES = "REGLAS DE RETENCIÓN: (1) el PRIMER beat engancha en los primeros 2 segundos (pattern interrupt / brecha de curiosidad / algo contraintuitivo); NADA de 'in this video'. (2) Frases CORTAS y rítmicas, aptas para voz. (3) A la mitad, un cambio que re-engancha. (4) El ÚLTIMO beat cierra fuerte (giro, remate o CTA de 3 palabras). (5) Cero relleno: si un beat no sube la apuesta, va fuera. (6) EDITA COMO CINE: piensa como EDITOR CINEMATOGRÁFICO — planifica VARIEDAD de planos (general → detalle → macro), RITMO que corta con el sonido, CONTRASTE visual entre beats consecutivos, y un ARCO emocional (calma → clímax → cierre). Elige queries de tomas con MOVIMIENTO y TEXTURA (cámara lenta, macro, dron), nunca estáticas ni genéricas.";

// Que respuesta cuenta: por defecto un guion con beats. El reintento del titulo pide SOLO
// {"title":"..."}; antes se le exigian beats tambien, asi que NUNCA pasaba y cada titulo
// repetido tumbaba el video (2026-10-03 -> 2026-10-30: ~20 de 24 corridas al dia sin video).
const conBeats = (p) => p && Array.isArray(p.beats) && p.beats.length > 0;
const conTitulo = (p) => p && typeof p.title === "string" && p.title.trim().length > 0;

async function gemini(prompt, valido = conBeats) {
  const p = await soloGemini(prompt, valido);
  if (p) return p;
  // Gemini sin cuota (429) o caido: la cadena gratis de llm.mjs (Groq, OpenRouter, Cloudflare...).
  const t = await genText(prompt, { json: true, saltar: ["Gemini"] });
  let q = null; try { q = t ? JSON.parse(t) : null; } catch { console.error("respaldo: JSON invalido"); }
  return valido(q) ? q : null;
}

async function soloGemini(prompt, valido) {
  if (!KEYS.length) return null;
  for (let round = 0; round < 3; round++) {
    for (let k = 0; k < KEYS.length; k++) {           // prueba cada API key (respaldo = doble cuota)
      for (const m of TEXT_MODELS) {
        try {
          const r = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEYS[k]}`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
          });
          if (r.status === 429 || r.status === 503) { console.error(`key${k + 1}/${m}: ${r.status}`); continue; }
          if (!r.ok) { console.error(`key${k + 1}/${m}: ${r.status}`); continue; }
          const j = await r.json();
          const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
          if (!t) continue;
          let p = null; try { p = JSON.parse(t); } catch { console.error(`key${k + 1}/${m}: JSON invalido`); continue; }
          if (valido(p)) return p; // solo cuenta una respuesta con lo pedido; si no, sigue probando
          console.error(`key${k + 1}/${m}: respuesta sin lo pedido`);
        } catch (e) { console.error(`key${k + 1}/${m}: ${e.message}`); }
      }
    }
    await sleep(15000); // todas las llaves/modelos saturados -> espero y reintento la ronda
  }
  return null;
}

// IDEA del plan del cerebro (brain_live): ángulo o brazo de experimento que esta pieza debe respetar.
const IDEA = (process.env.ODDLY_IDEA || "").trim().slice(0, 300);
const ideaBlock = IDEA ? `ÁNGULO QUE EL CEREBRO QUIERE PROBAR EN ESTA PIEZA (respétalo; no inventes datos falsos): ${IDEA}\n` : "";

// Sanea lo que devuelve el modelo antes de escribirlo. Gemini es una fuente de red: su
// respuesta no es de fiar por definicion, aunque el prompt sea nuestro. Aqui no puede causar
// dano directo (el texto va a un JSON, y el subtitulo se pasa a ffmpeg por `textfile=`, que
// lee el archivo en vez de interpolarlo en el filtro), pero se acota igual: fuera caracteres
// de control, espacios colapsados y un tope de largo. De paso evita que un modelo que se va
// por las ramas meta un parrafo donde debia ir una frase.
function limpiar(valor, max) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// VARIANTE "un_hecho" (EXPERIMENTO de formato, 2026-10-03): UN sujeto, UN hecho, corto.
// Por que: el canal lleva 518 videos con mediana de 46 vistas haciendo LISTAS de 10-14 hechos
// genericos. El unico Short que desperto fue "Why Baby Otters Hold Hands" (918 vistas, 20x la
// mediana): 18,7 segundos, un solo animal, un solo dato, metraje real de ESE animal y un titulo
// que es una pregunta concreta. Esta variante produce esa forma para poder medirla contra la
// lista (A/B "formato_un_hecho_vs_lista" en ab_tests.mjs).
//
// Las diferencias que se prueban, todas a la vez porque son UNA forma, no cinco ajustes:
//   - UN sujeto en todo el video (no 14 cosas distintas)
//   - UN hecho sorprendente y especifico (no "14 triggers que resetean tu cerebro")
//   - 3-4 clips DEL MISMO sujeto (no un clip por hecho)
//   - ~15-20 s (no 60-91)
//   - titulo = pregunta concreta sobre ese sujeto
if (variant === "un_hecho") {
  const scr = await gemini(
    `Eres guionista de un canal faceless en INGLES (audiencia EEUU) tipo "${label}". ${ideaBlock}${bloqueNoRepetir}` +
    `Escribe un Short de UN SOLO HECHO: elige UN sujeto concreto (un animal, un objeto, un fenomeno) ` +
    `y UN hecho sorprendente y VERIFICABLE sobre el. Nada de listas, nada de "10 datos". ` +
    `El video entero muestra ESE sujeto: todas las queries de stock son del mismo sujeto, en planos distintos. ` +
    `Estructura: beat 1 = la pregunta/gancho en 2 segundos ("Why do X...?"), beats 2-3 = la respuesta ` +
    `con el dato, beat final = el remate que ENGANCHA CON EL INICIO: termina en una frase que lleva de vuelta a la pregunta del beat 1 ` +
    `(p. ej. "...and that's why they never let go." -> "Why do sea otters hold hands?"), para que el video haga LOOP y se vuelva a ver sin corte. ` +
    `Entre 3 y 4 beats, frases CORTISIMAS (el video dura 15-20 segundos). ` +
    `El titulo es una PREGUNTA CONCRETA sobre el sujeto, no una promesa generica. ` +
    `Inspirate en el pool del nicho si encaja: ${pool}. ` +
    `Devuelve SOLO JSON: {"subject":"el sujeto en una palabra o dos","title":"pregunta concreta en ingles terminada en #Shorts","beats":[{"text":"1 frase corta en ingles","query":"termino stock en ingles DEL MISMO SUJETO","tipo":"intro|clip|reveal"}]}`
  );
  if (!scr || !Array.isArray(scr.beats) || !scr.beats.length) {
    console.error("Gemini no devolvio guion de un_hecho");
    process.exit(1);
  }
  const sujeto = limpiar(scr.subject, 40);
  const beats = scr.beats.slice(0, 4).map((b) => ({
    text: limpiar(b.text, 120),
    query: limpiar(b.query || sujeto || nicheCfg.queries?.[0] || niche, 60),
    tipo: ["intro", "clip", "reveal", "cta"].includes(b.tipo) ? b.tipo : "clip",
    pause_after: 0.1,
  }));
  const tituloBruto = limpiar(scr.title, 100) || `Why ${sujeto || "This"}? #Shorts`;
  const titulo = await tituloValido(tituloBruto, async (queja) => {
    const r = await gemini(`Devuelve SOLO {"title":"..."} con un titulo nuevo. ${queja}`, conTitulo);
    return limpiar(r && r.title, 100);
  });
  const voicemap = {
    lang: "en",
    title: titulo,
    niche, variant, kind,
    subject: sujeto || null,
    defaults: { pause_after: 0.1 },
    transform: { on_screen_insight: true, sound_design: true, narration: true },
    beats,
  };
  fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
  console.log(`Guion UN HECHO: "${voicemap.title}" · sujeto "${voicemap.subject}" · ${beats.length} beats -> ${out}`);
  process.exit(0);
}

// VARIANTE "puro" (ASMR sin voz): NO hay narración. Solo curamos clips (queries) + título.
// Es lo más fiel al ASMR real: mandan el SONIDO y el VISUAL. Robusto: si Gemini no está,
// armamos la lista con el pool del nicho -> la producción NO depende de la IA.
if (variant === "puro") {
  const scr = await gemini(
    `Eres curador de un canal ASMR / "oddly satisfying" en YouTube (audiencia EEUU). ${ideaBlock}${bloqueNoRepetir}` +
    `Elige 14 clips de stock MUY satisfying/ASMR (cortes limpios, agua, slime, arena cinética, prensa hidráulica, pintura, resina, etc.). ` +
    `Inspírate en o elige de: ${pool}. Cada "query" = término de búsqueda de stock en INGLES. ` +
    `Para cumplir con políticas de transformación (YPP inauthentic content), incluye para cada beat un breve texto o dato en pantalla relevante ("insight") que aporte valor único. ` +
    // Titulo como PREGUNTA: el A/B hook_question_vs_statement la dio ganadora (n16 vs n5, 2026-10-16).
    `El título es una PREGUNTA CONCRETA sobre lo que se ve (p. ej. "Why Does Kinetic Sand Hold Its Shape?", "What Happens When You Cut a Wet Soap Bar?"), sin clickbait falso. ` +
    `Devuelve SOLO JSON: {"title":"pregunta en inglés sobre lo que se ve${isShort ? ", terminada en #Shorts" : ""}","beats":[{"query":"término stock en inglés","insight":"short text/fact on screen","tipo":"clip"}]}`
  );
  const rawBeats = (scr && Array.isArray(scr.beats) && scr.beats.length) ? scr.beats : (nicheCfg.queries || ["satisfying"]).map((q) => ({ query: q, insight: "Satisfying ASMR visual", tipo: "clip" }));
  // El fallback llevaba un titulo FIJO, asi que a partir del segundo video sin Gemini
  // chocaba consigo mismo siempre. Se diferencia por nicho y dia para que no colisione.
  const sello = new Date().toISOString().slice(0, 10);
  const tituloBase = (scr && scr.title)
    || (isShort ? `Why Is This ${niche} So Oddly Satisfying? (${sello}) #Shorts` : `Why Is This ${niche} So Oddly Satisfying? (${sello})`);
  const title = await tituloValido(tituloBase, async (queja) => {
    const r = await gemini(`Devuelve SOLO {"title":"..."} con un titulo nuevo para un Short ASMR/satisfying. ${queja}`, conTitulo);
    return (r && r.title) || "";
  }, { exigirPregunta: true });
  const voicemap = {
    lang: "en", title, niche, variant, kind, defaults: { pause_after: 0 },
    transform: { on_screen_insight: true, sound_design: true, narration: false },
    beats: rawBeats.slice(0, isShort ? SHORT.max_beats : 16).map((b) => ({ text: b.insight || "", query: (b.query || nicheCfg.queries?.[0] || niche).trim(), tipo: b.tipo || "clip", pause_after: 0 })),
  };
  fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
  console.log(`Guion ASMR PURO ${isShort ? "SHORT " : ""}(con capas de valor): "${title}" · ${voicemap.beats.length} clips${scr ? "" : " (fallback pool, sin Gemini)"} -> ${out}`);
  process.exit(0);
}

// APRENDIZAJE: los titulos que MAS rinden en este canal (vistas/dia), inyectados por produce_oddly
// desde el reporte. El guion imita su ESTILO de gancho/estructura (no copia el tema) -> replicar lo top.
const LEARN = (process.env.ODDLY_LEARN || "").trim();
const learnBlock = LEARN ? `LO QUE MAS RINDE EN ESTE CANAL (estudia el ESTILO de gancho y estructura de estos ganadores y escribe en ese espiritu; NO copies el tema): ${LEARN}\n` : "";

const prompt =
  `Eres guionista EXPERTO de un canal faceless de YouTube en INGLES (audiencia EEUU) tipo "${label}". ` +
  `Estilo: ${NICHE_STYLE}\n${EXPERT_RULES}\n${learnBlock}${ideaBlock}${bloqueNoRepetir}` +
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

const tituloNarrado = await tituloValido(scr.title || `${label} compilation`, async (queja) => {
  const r = await gemini(`Devuelve SOLO {"title":"..."} con un titulo nuevo. ${queja}`, conTitulo);
  return (r && r.title) || "";
});
const voicemap = {
  lang: "en",
  title: tituloNarrado,
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
