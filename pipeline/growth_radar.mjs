// growth_radar.mjs — GROWTH RADAR: inteligencia de crecimiento de YouTube para los 2 canales.
// Investiga (con Gemini + busqueda web/grounding si esta disponible): tendencias, competencia,
// OUTLIERS, cambios de algoritmo/politicas, IA/contenido reutilizado, y VERIFICA los requisitos
// YPP actuales. Clasifica por evidencia y propone EXPERIMENTOS. Todo en la infra de Juan.
// Salida: growth_radar.txt (informe para Telegram) + growth_radar.json (para la Mini App).
import fs from "node:fs";

const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);

const prompt = `Eres un equipo de ELITE de crecimiento de YouTube (estratega + analista de tendencias + analista de competencia + experto en Shorts/ASMR/humor/datos/curiosidades + SEO + monetizacion + investigador de algoritmo y politicas). Mercado: EE.UU., ingles. Estamos en agosto 2026.

Canales que hacemos crecer:
- "Oddly Loop" (@oddlyloophq): Shorts satisfying / ASMR / animales / curiosidades / absurdo. Su ganador por datos es Satisfying/ASMR. Meta: monetizar por ruta Shorts.
- "The Data Lens" (@TheDataLensHQ): datos curiosos (rankings, datos cotidianos relatables, escala/extremos). Acaba de pivotar del nicho saturado de finanzas.

INVESTIGA lo mas ACTUAL posible y produce un informe BREVE, PRIORIZADO y ACCIONABLE (cabe en un mensaje de Telegram, ~2600 caracteres MAX). Clasifica cada afirmacion importante por evidencia usando etiquetas: [OFICIAL] [FUERTE] [EXPERIMENTAL] [HIPOTESIS] [RUMOR]. No trates un "hack" de foro como verdad. Si algo pudo cambiar y no lo puedes verificar, dilo.

Usa EXACTAMENTE estas secciones y emojis, cortas:
🚨 OPORTUNIDADES (2-3 lo mas accionable YA)
📈 TENDENCIAS/FORMATOS creciendo en estos nichos (2-3)
🎯 OUTLIERS/COMPETENCIA (1-2 patrones de videos que revientan y como adaptarlos de forma ORIGINAL, sin copiar)
⚠️ ALGORITMO/POLITICAS/IA (cambios recientes relevantes: Shorts, contenido IA, reutilizado, copyright) con su evidencia
💰 MONETIZACION (requisitos YPP ACTUALES: subs, watch hours, vistas de Shorts/90d — marca [OFICIAL] si los confirmas)
🧪 EXPERIMENTOS (2-3): cada uno en 1 linea -> Hipotesis · Variable · Metrica principal · Criterio de exito.

Se DIRECTO, sin relleno. Prioriza impacto hacia monetizacion y velocidad de aprendizaje. NO recomiendes atajos destructivos (bots, compra de views/subs, contenido robado, reuploads sin transformar, evadir politicas).`;

async function gemini(withSearch) {
  for (const k of KEYS) for (const m of ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"]) {
    try {
      const body = { contents: [{ parts: [{ text: prompt }] }] };
      if (withSearch) body.tools = [{ google_search: {} }];
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) { console.error(`${m}${withSearch ? "+search" : ""}: ${r.status} ${(await r.text()).slice(0, 120)}`); continue; }
      const j = await r.json();
      const t = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      if (t) return { text: t, model: m, grounded: !!withSearch };
    } catch (e) { console.error(`${m}: ${e.message}`); }
  }
  return null;
}

let out = await gemini(true);          // con busqueda web (grounding)
if (!out) out = await gemini(false);   // respaldo sin busqueda
if (!out) { console.error("Growth Radar: Gemini no respondio"); process.exit(1); }

const header = `🔭 GROWTH RADAR — inteligencia de crecimiento${out.grounded ? " (con búsqueda web)" : ""}`;
const report = `${header}\n\n${out.text}`.slice(0, 3900);
fs.writeFileSync("growth_radar.txt", report);
fs.writeFileSync("growth_radar.json", JSON.stringify({ at: new Date().toISOString(), grounded: out.grounded, model: out.model, report: out.text }, null, 2));
console.log(report);
