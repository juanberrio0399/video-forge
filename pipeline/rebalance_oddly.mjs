// rebalance_oddly.mjs — AUTO-OPTIMIZADOR de la cadencia de Oddly Loop (por datos).
// Lee el ranking de nichos (vistas/dia) + la cadencia actual + el registro de experimentos,
// y RECALCULA la cadencia: reparte los slots proporcional a lo que rinde, CORTA los nichos
// flojos, y reserva 1 slot para el EXPERIMENTO activo (nicho en prueba) que se PROMUEVE si
// funciona o se DESCARTA si no. Escribe cadence.new.json + exp.new.json + summary.txt (locales);
// el workflow los sube a R2 y avisa por Telegram. NO toca lo publicado ni programado.
//
// Uso: node pipeline/rebalance_oddly.mjs
//   Entradas (las baja el workflow): state.json (auto2), cadence.json, exp.json
//   Salidas: cadence.new.json, exp.new.json, summary.txt
import fs from "node:fs";

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };

const state = rj("state.json", {});
const cad = rj("cadence.json", {});
const exp = rj("exp.json", { active: null, queue: [], done: [], promoted: [] });

// Nichos FIJOS del canal (siempre existen). A estos se suman los experimentos PROMOVIDOS.
// animales_tiernos ya es GANADOR probado (79.5 vpd, top del canal) -> ciudadano permanente.
const BASE = ["satisfying", "narrativas", "ciencia_humor", "naturaleza_relax", "animales_tiernos"];
const CUT = 0.4;          // corta nichos con vpd < 40% del ganador
const EXP_MIN_VIDS = 4;   // datos minimos para juzgar un experimento

// label (del reporte) -> key (de la cadencia)
const LABEL2KEY = {
  "Satisfying / ASMR": "satisfying", "Narrativas": "narrativas",
  "Ciencia + humor": "ciencia_humor", "Naturaleza / relax": "naturaleza_relax",
  "Animales tiernos / ASMR": "animales_tiernos",
};
const rank = {}; // key -> {vpd, videos}
for (const r of (state.niche_ranking || [])) {
  const k = LABEL2KEY[r.label] || r.label;
  rank[k] = { vpd: Math.max(0, +r.avg_vpd || 0), videos: +r.videos || 0 };
}
const vpdOf = (k) => (rank[k] ? rank[k].vpd : 0);

// AGRESIVIDAD del Cerebro: la meta (fin-2026) es FIJA. Si Oddly va atrás, se ESCALA el volumen
// (no se alarga el plazo) -> usa la cadencia agresiva que manda el Cerebro (aggressiveness.json).
const aggr = rj("aggressiveness.json", {});
const aggrTotal = aggr && aggr.oddly && aggr.oddly.behind ? +aggr.oddly.cadence_total : 0;
const TOTAL = aggrTotal || Object.values(cad.shorts_per_category || {}).reduce((a, b) => a + (+b || 0), 0) || 8;
const promoted = new Set(exp.promoted || []);
const done = exp.done || [];
let active = exp.active || null;   // { key, label, variant }
const notes = [];

function activarSiguiente() {
  while ((exp.queue || []).length) {
    const next = exp.queue.shift();
    if (next && next.key && !promoted.has(next.key) && !done.some((d) => d.key === next.key)) {
      active = next;
      notes.push(`🧪 Nuevo experimento en prueba: ${next.label}`);
      return;
    }
  }
  active = null;
}

// --- Evaluar el experimento activo: promover / descartar / seguir probando ---
if (active) {
  const info = rank[active.key];
  if (info && info.videos >= EXP_MIN_VIDS) {
    const estVpds = BASE.concat([...promoted]).map(vpdOf).sort((a, b) => a - b);
    const median = estVpds.length ? estVpds[Math.floor(estVpds.length / 2)] : 0;
    if (info.vpd >= median) {
      promoted.add(active.key);
      done.push({ key: active.key, label: active.label, result: "promovido", vpd: info.vpd });
      notes.push(`✅ Experimento PROMOVIDO: ${active.label} (${info.vpd}/dia ≥ mediana ${median.toFixed(0)}). Ahora es fijo.`);
      active = null; activarSiguiente();
    } else {
      done.push({ key: active.key, label: active.label, result: "descartado", vpd: info.vpd });
      notes.push(`❌ Experimento DESCARTADO: ${active.label} (${info.vpd}/dia < mediana ${median.toFixed(0)}).`);
      active = null; activarSiguiente();
    }
  } else {
    notes.push(`🧪 Experimento en prueba: ${active.label} (${(info && info.videos) || 0} videos, faltan datos).`);
  }
} else {
  activarSiguiente();
}

// --- Reparto por datos entre los nichos ESTABLECIDOS (base + promovidos) ---
const expSlots = active ? 1 : 0;
const content = Math.max(1, TOTAL - expSlots);
const established = [...new Set([...BASE, ...promoted])].filter((k) => !active || k !== active.key);
const top = Math.max(1, ...established.map(vpdOf));
let survivors = established.filter((k) => vpdOf(k) >= CUT * top);
if (!survivors.length) survivors = established.slice(0, 1);
const sumV = survivors.reduce((a, k) => a + Math.max(0.01, vpdOf(k)), 0);
const alloc = {};
survivors.forEach((k) => { alloc[k] = Math.max(1, Math.round(content * Math.max(0.01, vpdOf(k)) / sumV)); });
const winner = survivors.slice().sort((a, b) => vpdOf(b) - vpdOf(a))[0];
alloc[winner] += content - Object.values(alloc).reduce((a, b) => a + b, 0); // el ganador absorbe el redondeo
if (alloc[winner] < 1) alloc[winner] = 1;
established.forEach((k) => { if (!(k in alloc)) alloc[k] = 0; }); // los cortados quedan en 0 (explicito)

const newSpc = { ...alloc };
if (active) newSpc[active.key] = 1;

const variant = { ...(cad.variant || {}) };
if (active && active.variant) variant[active.key] = active.variant;

const newCad = {
  _nota: `AUTO-OPTIMIZADA por datos (${String(state.at || state.updated_at || "").slice(0, 10)}). Cadencia proporcional a vistas/dia; corta nichos < ${CUT * 100}% del ganador; 1 slot de experimento cuando hay uno activo. La ajusta rebalance_oddly.mjs cada semana. NO toca lo publicado ni programado.`,
  shorts_per_category: newSpc,
  long_per_day: cad.long_per_day || 0,
  long_rotation: [...new Set([winner, ...survivors, ...(active ? [active.key] : [])])],
  variant,
};

const rankLine = Object.entries(rank).sort((a, b) => b[1].vpd - a[1].vpd)
  .map(([k, d]) => `${k} ${d.vpd}/d`).join(" · ") || "(sin datos aun)";
const cadLine = Object.entries(newSpc).map(([k, v]) => `${k}=${v}`).join(" · ");
const summary = [`📊 Vistas/dia por nicho: ${rankLine}`, ...notes, `🎛️ Nueva cadencia (8/dia): ${cadLine}`].join("\n");

fs.writeFileSync("cadence.new.json", JSON.stringify(newCad, null, 2));
fs.writeFileSync("exp.new.json", JSON.stringify({ active, queue: exp.queue || [], done, promoted: [...promoted] }, null, 2));
fs.writeFileSync("summary.txt", summary);
console.log(summary);
