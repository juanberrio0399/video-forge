// growth_radar.mjs — GROWTH RADAR: inteligencia de crecimiento de YouTube para los 2 canales.
// Si hay BRAVE_API_KEY: BUSCA en la web (Brave Search) resultados frescos y se los pasa a Gemini
// (investigacion verificada). Si no, usa el conocimiento de Gemini. Investiga tendencias,
// competencia, OUTLIERS, algoritmo/politicas, IA/reutilizado, y requisitos YPP; clasifica por
// evidencia y propone EXPERIMENTOS. Todo en la infra de Juan. Salida: growth_radar.txt + .json.
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);
const TAVILY = process.env.TAVILY_API_KEY;
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

// --- Busqueda web (Tavily, gratis sin tarjeta) ---
async function tavily(q) {
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${TAVILY}` },
      body: JSON.stringify({ query: q, max_results: 5, search_depth: "basic" }),
    });
    if (!r.ok) { console.error(`tavily "${q}": ${r.status} ${(await r.text()).slice(0, 100)}`); return []; }
    const j = await r.json();
    return (j.results || []).slice(0, 5)
      .map((x) => `- ${x.title}: ${String(x.content || "").slice(0, 180)} (${x.url})`);
  } catch (e) { console.error(`tavily: ${e.message}`); return []; }
}
async function research() {
  if (!TAVILY) return "";
  const queries = [
    "YouTube Shorts monetization requirements 2026 YPP subscribers views 90 days",
    "YouTube Shorts viral trends 2026 formats satisfying ASMR animals",
    "YouTube algorithm 2026 AI generated content reused content policy update",
    "fastest growing faceless YouTube shorts channels 2026 what works",
  ];
  const blocks = [];
  for (const q of queries) {
    const res = await tavily(q);
    if (res.length) blocks.push(`### ${q}\n${res.join("\n")}`);
    await sleep(400);
  }
  return blocks.join("\n\n");
}

const basePrompt = `Eres un equipo de ELITE de crecimiento de YouTube (estratega + analista de tendencias + analista de competencia + experto en Shorts/ASMR/humor/datos/curiosidades + SEO + monetizacion + investigador de algoritmo y politicas). Mercado: EE.UU., ingles. Estamos en agosto 2026.

Canales que hacemos crecer:
- "Oddly Loop" (@oddlyloophq): Shorts satisfying / ASMR / animales / curiosidades / absurdo. Su ganador por datos es Satisfying/ASMR. Meta: monetizar por ruta Shorts.
- "The Data Lens" (@TheDataLensHQ): datos curiosos (rankings, datos cotidianos relatables, escala/extremos). Acaba de pivotar del nicho saturado de finanzas.

Produce un informe BREVE, PRIORIZADO y ACCIONABLE (cabe en un mensaje de Telegram, ~2600 caracteres MAX). Clasifica cada afirmacion importante por evidencia: [OFICIAL] [FUERTE] [EXPERIMENTAL] [HIPOTESIS] [RUMOR]. No trates un "hack" de foro como verdad. Si algo pudo cambiar y no lo puedes verificar, dilo.

Usa EXACTAMENTE estas secciones y emojis, cortas:
🚨 OPORTUNIDADES (2-3 lo mas accionable YA)
📈 TENDENCIAS/FORMATOS creciendo en estos nichos (2-3)
🎯 OUTLIERS/COMPETENCIA (1-2 patrones de videos que revientan y como adaptarlos ORIGINAL, sin copiar)
⚠️ ALGORITMO/POLITICAS/IA (cambios recientes: Shorts, contenido IA, reutilizado, copyright) con su evidencia
💰 MONETIZACION (requisitos YPP ACTUALES: subs, watch hours, vistas de Shorts/90d — marca [OFICIAL] si los confirmas)
🧪 EXPERIMENTOS (2-3): cada uno en 1 linea -> Hipotesis · Variable · Metrica principal · Criterio de exito.

Se DIRECTO, sin relleno. Prioriza impacto hacia monetizacion y velocidad de aprendizaje. NO recomiendes atajos destructivos (bots, compra de views/subs, contenido robado, reuploads sin transformar, evadir politicas).`;

async function gemini(prompt) {
  for (const k of KEYS) for (const m of TEXT_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (r.status === 429 || r.status === 503) { await sleep(6000); continue; }
        if (!r.ok) { console.error(`${m}: ${r.status} ${(await r.text()).slice(0, 100)}`); break; }
        const j = await r.json();
        const t = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
        if (t) return { text: t, model: m };
        break;
      } catch (e) { console.error(`${m}: ${e.message}`); break; }
    }
  }
  return null;
}

const ctx = await research();
const grounded = ctx.length > 0;
const prompt = grounded
  ? `RESULTADOS DE BUSQUEDA WEB RECIENTES (agosto 2026) — usalos para VERIFICAR y priorizar lo actual:\n\n${ctx}\n\n---\n\n${basePrompt}`
  : basePrompt;

const out = await gemini(prompt);
if (!out) { console.error("Growth Radar: Gemini no respondio"); process.exit(1); }

const header = `🔭 GROWTH RADAR — inteligencia de crecimiento${grounded ? " (con búsqueda web ✅)" : " (conocimiento de Gemini)"}`;
const report = `${header}\n\n${out.text}`.slice(0, 3900);
fs.writeFileSync("growth_radar.txt", report);
fs.writeFileSync("growth_radar.json", JSON.stringify({ at: new Date().toISOString(), grounded, model: out.model, report: out.text }, null, 2));
console.log(report);
