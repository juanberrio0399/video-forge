// recipe_plan.mjs — planifica un REEL de cocina 9:16 a partir del texto de la receta.
// Gemini actua como chef + editor: convierte la receta en un guion por PASOS
// (narracion en español natural + subtitulo en pantalla + que mostrar). El resultado
// alimenta al TTS (voz de la esposa) y al ensamblador del video.
//
// Uso: node pipeline/recipe_plan.mjs <texto.txt> <numMedios> <plan.json> <voicemap.json>
// Env: GEMINI_API_KEY (opcional; sin ella usa una heuristica), VOICE_REF (ruta al mp3 de la voz).
import fs from "node:fs";

const [textPath, mediaCountArg, planOut, voicemapOut] = process.argv.slice(2);
const GEMINI = process.env.GEMINI_API_KEY || "";
const VOICE_REF = process.env.VOICE_REF || "";
const mediaCount = Math.max(0, parseInt(mediaCountArg || "0", 10) || 0);
const recipe = fs.existsSync(textPath) ? fs.readFileSync(textPath, "utf8").trim() : "";

// Cuantos pasos: cerca del numero de fotos/videos que mando (asi cada medio tiene su
// momento), con un minimo para que la receta se entienda y un techo para no alargar.
const nSteps = Math.min(10, Math.max(4, mediaCount || 5));

async function geminiPlan() {
  if (!GEMINI) return null;
  const prompt =
    `Eres chef y editor de reels de cocina para TikTok/Instagram (vertical 9:16). ` +
    `A partir de esta receta arma el guion de un reel apetitoso, cercano y natural EN ESPAÑOL ` +
    `(como si un amigo te la contara, sin sonar robotico ni a lista rigida). ` +
    `Devuelve SOLO un JSON con esta forma:\n` +
    `{"title":"...","beats":[{"narration":"1-2 frases en español, apetitoso","subtitle":"texto CORTO en pantalla del paso (max 6 palabras)","query":"2-4 palabras en INGLES para buscar b-roll de cocina relevante a ESTE paso","img_prompt":"prompt en INGLES de una imagen de comida apetitosa para ese paso"}]}\n` +
    `Reglas: el PRIMER beat es un gancho mostrando el plato final terminado (apetitoso, invita a quedarse). ` +
    `El ULTIMO beat es el cierre (invita a probar/seguir). En medio, los pasos de preparacion EN ORDEN. ` +
    `Usa ${nSteps} beats en total. Narracion siempre en español; query e img_prompt en ingles.\n\n` +
    `RECETA:\n${recipe || "(sin texto; deduce una receta casera a partir de un platillo casero)"}`;
  for (const m of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-flash-latest"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      });
      if (!r.ok) { console.error(`gemini ${m}: ${r.status}`); continue; }
      const j = await r.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      const obj = JSON.parse(t);
      if (obj && Array.isArray(obj.beats) && obj.beats.length) {
        console.log(`Gemini (${m}) planeo la receta: ${obj.beats.length} beats.`);
        return obj;
      }
    } catch (e) { console.error(`gemini ${m}: ${e.message}`); }
  }
  return null;
}

// Heuristica sin IA: parte la receta en lineas/frases y arma pasos simples.
function heuristicPlan() {
  const lines = recipe
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  const body = lines.length ? lines : ["Preparamos algo delicioso paso a paso."];
  const beats = [];
  beats.push({ narration: "Mira como queda este platillo, se te va a antojar.", subtitle: "El resultado", query: "delicious plated dish", img_prompt: "delicious finished home cooked dish, close up, appetizing" });
  for (const l of body.slice(0, nSteps - 2)) {
    beats.push({ narration: l, subtitle: l.split(/\s+/).slice(0, 5).join(" "), query: "cooking food closeup", img_prompt: "cooking step, food closeup, appetizing, kitchen" });
  }
  beats.push({ narration: "Y listo, a disfrutar. Guarda la receta y cuentame como te quedo.", subtitle: "¡A disfrutar!", query: "serving plated food", img_prompt: "serving a delicious plated dish, warm light, appetizing" });
  return { title: "Receta casera", beats };
}

const plan = (await geminiPlan()) || heuristicPlan();
// Limpieza defensiva de cada beat.
plan.title = plan.title || "Receta casera";
plan.beats = plan.beats.map((b) => ({
  narration: (b.narration || "").toString().trim() || "Seguimos con la preparacion.",
  subtitle: (b.subtitle || "").toString().trim().slice(0, 40),
  query: (b.query || "cooking food closeup").toString().trim(),
  img_prompt: (b.img_prompt || "delicious food, appetizing, close up").toString().trim(),
}));

fs.writeFileSync(planOut, JSON.stringify(plan, null, 2));

// voicemap para el TTS dirigido (mismo formato que el pipeline de voz del canal).
const voicemap = {
  lang: "es",
  voice_ref: VOICE_REF || undefined,
  defaults: { exaggeration: 0.5, cfg: 0.5, pause_after: 0.35 },
  beats: plan.beats.map((b, i) => ({
    text: b.narration,
    tipo: i === 0 ? "gancho" : (i === plan.beats.length - 1 ? "cierre" : "paso"),
    exaggeration: i === 0 ? 0.6 : 0.5,
    cfg: 0.5,
    pause_after: 0.35,
  })),
};
fs.writeFileSync(voicemapOut, JSON.stringify(voicemap, null, 2));

console.log(`Plan de receta: "${plan.title}" · ${plan.beats.length} beats · voz=${VOICE_REF ? "clonada" : "default"}`);
