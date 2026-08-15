// video_script.mjs — guionista IA: dado un TEMA, Gemini escribe el guion completo del
// video (faceless, datos/dinero, ingles, alta retencion) en el formato de voicemap que
// usan la voz (Chatterbox dirigido) y el render. Salida: voicemap_full.json.
//
// Uso: node pipeline/video_script.mjs "<tema>" <out.json>
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [topic, out = "voicemap.json"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);
if (!topic) { console.error("Falta el tema"); process.exit(1); }

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
async function gemini(prompt) {
  // Multi-llave (respaldo = doble cuota) + reintento con backoff si TODO esta saturado (429/503).
  for (let round = 0; round < 3; round++) {
    for (let k = 0; k < KEYS.length; k++) {
      for (const m of TEXT_MODELS) {
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEYS[k]}`, {
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
    await sleep(15000);
  }
  console.error("Gemini no respondio tras varios reintentos (guion).");
  return null;
}

// MEJORA CONTINUA: aprendizajes de lo ya publicado (métricas reales + tendencias). Los inyecta
// produce_video.yml via env LEARNINGS (de pipeline/learnings.mjs). Si viene, el guion los aplica.
const LEARN = (process.env.LEARNINGS || "").trim();
const learnBlock = LEARN
  ? `\n\nAPRENDIZAJES DE ESTE CANAL (rendimiento real + tendencias) — APLÍCALOS en este guion (ángulo, tipo de gancho, formato de título, ritmo):\n${LEARN}\n`
  : "";

// DURACION OBJETIVO (experimento de la fabrica): produce_video inyecta TARGET_MIN desde channel/experiments.json.
// La fabrica sube la duracion poco a poco; el guionista apunta a esa duracion (~7 beats por minuto).
const TARGET_MIN = Math.max(4, parseInt(process.env.TARGET_MIN || "8", 10) || 8);
const BEATS = Math.round(TARGET_MIN * 7);
const BEATS_MIN = Math.max(28, BEATS - 8), BEATS_MAX = BEATS + 10;

// CONTROL DE DURACION REAL: el largo del video lo determinan las PALABRAS habladas, no el nº de beats
// (un beat corto dura ~2s; el "~7 beats/min" subestimaba y el video salia corto). Ritmo efectivo del TTS
// dirigido, con pausas, ~135 palabras/min (medido). Apuntamos a esas palabras y EXTENDEMOS si queda corto.
const WPM = 135;
const TARGET_WORDS = Math.round(TARGET_MIN * WPM);
const MIN_WORDS = Math.round(TARGET_WORDS * 0.9);          // aceptamos desde el 90% del objetivo
const words = (bs) => (bs || []).reduce((n, b) => n + String(b.text || "").trim().split(/\s+/).filter(Boolean).length, 0);
const estMin = (bs) => (words(bs) / WPM).toFixed(1);

// TONO DE CRECIMIENTO (para conseguir SUSCRIPTORES): channel/growth.json -> GROWTH_TONE.
const TONE = (process.env.GROWTH_TONE || "retador").toLowerCase();
const TONES = {
  retador: `El GANCHO inicial y el CTA final deben ser RETADORES CON AUTORIDAD: directos y punzantes, que reten al espectador ("quien siga de largo se queda sin saberlo") y lo empujen a SUSCRIBIRSE ya — SIN mentir ni clickbait falso; manten la credibilidad de un canal de datos.`,
  provocador: `El GANCHO y el CTA deben ser PROVOCADORES/CONTRARIAN: postura audaz us-vs-them que prenda debate, empujando a suscribirse para "probar quien tiene razon", sin faltar a la verdad de los datos.`,
  suave: `El CTA final invita a suscribirse de forma clara y amable.`,
};
const TONE_TXT = TONES[TONE] || TONES.retador;

const prompt =
  `Eres guionista de un canal faceless de YouTube de DATOS/DINERO en INGLES (mercado EE.UU.), ` +
  `estilo documental cinematografico con ALTA RETENCION. Escribe el guion COMPLETO (~${TARGET_MIN} min) del video sobre: "${topic}".${learnBlock}\n` +
  `Reglas de retencion: gancho brutal en la 1a frase; promete algo al inicio y pagalo al final; ` +
  `escala cifras/datos de menor a mayor; una vuelta de tuerca ("twist") a mitad y al final; ` +
  `micro-ganchos entre secciones; cierra con CTA (suscribirse + el siguiente video de la serie). ` +
  `PIENSA COMO EDITOR CINEMATOGRAFICO: construye un ARCO emocional (calma -> tension -> clímax -> resolución), varia el RITMO (frases cortas para tension, pausas para peso), y estructura por escenas con transiciones motivadas (cada beat prepara el siguiente). Momentos de SILENCIO/pausa antes de un dato fuerte. ` +
  `${TONE_TXT} ` +
  `Para ${TARGET_MIN} min, manten la retencion ALTA todo el video (nada de relleno: cada beat aporta un dato o giro). ` +
  `IMPORTANTE — LARGO: apunta a ~${TARGET_WORDS} PALABRAS de narracion en TOTAL (es lo que llena ${TARGET_MIN} min hablados). NO te quedes corto: si te falta, agrega mas datos, contexto historico y ejemplos REALES (nunca relleno vacio). ` +
  `Todo en INGLES natural (no robotico). Devuelve SOLO JSON:\n` +
  `{"title":"titulo en ingles","beats":[{"text":"1-3 frases en ingles","tipo":"hook|dato|contexto|reveal|cta|sintesis"}]}\n` +
  `Usa ${BEATS_MIN} a ${BEATS_MAX} beats. El PRIMER beat es el gancho; el ULTIMO es CTA.`;

const scr = await gemini(prompt);
if (!scr || !Array.isArray(scr.beats) || !scr.beats.length) { console.error("Gemini no devolvio guion"); process.exit(1); }

// CONTROL DE DURACION: si el guion quedo corto (menos palabras de las que llenan TARGET_MIN),
// le pedimos a Gemini que lo EXTIENDA con contenido real. Hasta 3 rondas; si no crece, cortamos.
let beats = scr.beats;
console.log(`Guion inicial: ${words(beats)} palabras (~${estMin(beats)} min), objetivo ~${TARGET_WORDS} (${TARGET_MIN} min).`);
for (let round = 1; round <= 3 && words(beats) < MIN_WORDS; round++) {
  const have = words(beats), faltan = TARGET_WORDS - have;
  console.log(`  Corto (${have}/${TARGET_WORDS}) -> ronda ${round}: pido extender ~${faltan} palabras…`);
  const extendPrompt =
    `Este guion de YouTube quedo CORTO: tiene ~${have} palabras pero necesita ~${TARGET_WORDS} (para ${TARGET_MIN} min hablados). ` +
    `EXTIENDELO agregando beats NUEVOS de contenido REAL y valioso (mas datos, contexto historico, ejemplos concretos, giros) — profundiza el tema, NADA de relleno vacio ni repetir lo dicho. Manten el arco, la calidad y el estilo. ` +
    `Devuelve SOLO JSON con TODOS los beats (los actuales, que puedes mejorar, MAS los nuevos), el gancho (hook) PRIMERO y el CTA al FINAL: {"title":"...","beats":[{"text":"1-3 frases en ingles","tipo":"hook|dato|contexto|reveal|cta|sintesis"}]}.\n\n` +
    `## Tema\n${topic}\n\n## Guion actual (a extender)\n${JSON.stringify({ title: scr.title, beats }, null, 0)}`;
  const more = await gemini(extendPrompt);
  if (more && Array.isArray(more.beats) && words(more.beats) > have) { beats = more.beats; scr.title = more.title || scr.title; }
  else { console.log("  la extension no agrego contenido; me quedo con lo que hay."); break; }
}
if (words(beats) < MIN_WORDS) console.log(`⚠️ Guion final ~${estMin(beats)} min (objetivo ${TARGET_MIN}); quedo algo corto pero es lo mejor tras 3 rondas.`);
else console.log(`✓ Guion final: ${words(beats)} palabras (~${estMin(beats)} min) — cumple el objetivo.`);

// Direccion de voz por tipo (energia/ritmo/pausa) para el TTS dirigido.
const DIR = {
  hook: { exaggeration: 0.7, cfg: 0.55, pause_after: 0.35 },
  dato: { exaggeration: 0.55, cfg: 0.45, pause_after: 0.28 },
  reveal: { exaggeration: 0.68, cfg: 0.5, pause_after: 0.4 },
  contexto: { exaggeration: 0.5, cfg: 0.42, pause_after: 0.25 },
  sintesis: { exaggeration: 0.58, cfg: 0.46, pause_after: 0.3 },
  cta: { exaggeration: 0.6, cfg: 0.48, pause_after: 0.3 },
};
const voicemap = {
  lang: "en",
  voice_ref: "assets/voice/ref_juan_es.mp3",
  title: scr.title || topic,
  defaults: { exaggeration: 0.5, cfg: 0.44, pause_after: 0.25 },
  beats: beats.map((b) => {
    const d = DIR[(b.tipo || "contexto").toLowerCase()] || DIR.contexto;
    return { text: (b.text || "").trim(), tipo: b.tipo || "contexto", ...d };
  }).filter((b) => b.text),
};
fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
console.log(`Guion: "${voicemap.title}" · ${voicemap.beats.length} beats -> ${out}`);
