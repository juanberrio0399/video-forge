// hypotheses.mjs — mantiene el registro de hipótesis en channel/brain/hypotheses.json (Fase 3).
// Idempotente: asegura las hipótesis semilla (sin pisar las existentes) y recalcula sus estados.
// Uso: node pipeline/hypotheses.mjs [registro.json] [salida.json]
import fs from "node:fs";
import { ensureSeeds, recompute } from "./lib/hypothesis.mjs";

// Semillas reales (grounded en lo que sabemos). Empiezan en NEW; las fases futuras añaden evidencia.
const SEEDS = [
  { id: "dl-money-niche", channel_scope: "data_lens", statement: "El nicho de DINERO/economía rinde por encima de la mediana en The Data Lens (pico histórico de 666 vistas/semana en esa era)." },
  { id: "global-question-hook", channel_scope: "global", statement: "Los hooks que abren con una PREGUNTA en los primeros 3s mejoran la retención inicial." },
  { id: "oddly-cute-animals", channel_scope: "oddly", statement: "Las compilaciones de animales tiernos/ASMR rinden sobre la mediana en Oddly Loop." },
  { id: "global-short-under-45s", channel_scope: "global", statement: "Los Shorts de <=45s tienen mayor tasa de finalización que los más largos." },
];

const src = process.argv[2] || "hypotheses.json";
const out = process.argv[3] || "hypotheses.json";
let reg = [];
try { const j = JSON.parse(fs.readFileSync(src, "utf8")); reg = Array.isArray(j) ? j : (j.hypotheses || []); } catch {}
reg = ensureSeeds(reg, SEEDS).map(recompute);
fs.writeFileSync(out, JSON.stringify(reg, null, 2));
const byStatus = reg.reduce((m, h) => ((m[h.status] = (m[h.status] || 0) + 1), m), {});
console.log(`hypotheses: ${reg.length} en registro -> ${out} | por estado: ${JSON.stringify(byStatus)}`);
