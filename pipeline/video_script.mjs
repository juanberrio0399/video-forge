// video_script.mjs — guionista IA: dado un TEMA, Gemini escribe el guion completo del
// video (faceless, datos/dinero, ingles, alta retencion) en el formato de voicemap que
// usan la voz (Chatterbox dirigido) y el render. Salida: voicemap_full.json.
//
// Uso: node pipeline/video_script.mjs "<tema>" <out.json>
import fs from "node:fs";

const [topic, out = "voicemap.json"] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
if (!topic) { console.error("Falta el tema"); process.exit(1); }

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
async function gemini(prompt) {
  // Reintenta con backoff en 429/503 (el guion corre al inicio; si Gemini esta saturado, espera).
  for (let round = 0; round < 3; round++) {
    for (const m of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
        });
        if (r.status === 429 || r.status === 503) { console.error(`${m}: ${r.status} (espero 15s y reintento)`); await sleep(15000); continue; }
        if (!r.ok) { console.error(`${m}: ${r.status}`); continue; }
        const j = await r.json();
        const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
        return JSON.parse(t);
      } catch (e) { console.error(`${m}: ${e.message}`); }
    }
  }
  console.error("Gemini no respondio tras varios reintentos (guion).");
  return null;
}

const prompt =
  `Eres guionista de un canal faceless de YouTube de DATOS/DINERO en INGLES (mercado EE.UU.), ` +
  `estilo documental cinematografico con ALTA RETENCION. Escribe el guion COMPLETO (~7-9 min) del video sobre: "${topic}".\n` +
  `Reglas de retencion: gancho brutal en la 1a frase; promete algo al inicio y pagalo al final; ` +
  `escala cifras/datos de menor a mayor; una vuelta de tuerca ("twist") a mitad y al final; ` +
  `micro-ganchos entre secciones; cierra con CTA (suscribirse + el siguiente video de la serie). ` +
  `Todo en INGLES natural (no robotico). Devuelve SOLO JSON:\n` +
  `{"title":"titulo en ingles","beats":[{"text":"1-3 frases en ingles","tipo":"hook|dato|contexto|reveal|cta|sintesis"}]}\n` +
  `Usa 45 a 65 beats. El PRIMER beat es el gancho; el ULTIMO es CTA.`;

const scr = await gemini(prompt);
if (!scr || !Array.isArray(scr.beats) || !scr.beats.length) { console.error("Gemini no devolvio guion"); process.exit(1); }

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
  beats: scr.beats.map((b) => {
    const d = DIR[(b.tipo || "contexto").toLowerCase()] || DIR.contexto;
    return { text: (b.text || "").trim(), tipo: b.tipo || "contexto", ...d };
  }).filter((b) => b.text),
};
fs.writeFileSync(out, JSON.stringify(voicemap, null, 2));
console.log(`Guion: "${voicemap.title}" · ${voicemap.beats.length} beats -> ${out}`);
