// creative_bank.mjs — Banco permanente de ideas/hooks/títulos (Growth Roadmap Fase 3). PURO.
// Cada idea tiene ESTADO (BACKLOG→TESTING→WINNER|KILLED) y una PRIORIDAD por la fórmula
// IMPACTO × PROBABILIDAD × VELOCIDAD ÷ COSTE -> bucket P0/P1/P2/P3/KILL, para decidir qué probar
// primero. Se auto-siembra desde los OUTLIERS de Fase 2 (patrón ganador -> idea a replicar).
// Sin dependencias, determinista (las fechas se inyectan).

export const STATES = ["BACKLOG", "TESTING", "WINNER", "KILLED"];
const NEXT = { BACKLOG: ["TESTING", "KILLED"], TESTING: ["WINNER", "KILLED", "BACKLOG"], WINNER: ["BACKLOG"], KILLED: ["BACKLOG"] };

const clampN = (x, lo, hi, d) => { const n = Number(x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

// Prioridad ICE-V: impacto(1-5) × probabilidad(0-1) × velocidad(1-5) ÷ coste(1-5). Máx = 25.
export function priorityScore(item = {}) {
  const impact = clampN(item.impact, 1, 5, 3);
  const prob = clampN(item.probability, 0, 1, 0.5);
  const vel = clampN(item.velocity, 1, 5, 3);
  const cost = clampN(item.cost, 1, 5, 3);
  return Math.round((impact * prob * vel / cost) * 100) / 100;
}

// Bucket de prioridad. Un item KILLED va a "KILL" pase lo que pase.
export function bucket(item = {}) {
  if (item.state === "KILLED") return "KILL";
  const s = priorityScore(item);
  if (s >= 12) return "P0";
  if (s >= 7) return "P1";
  if (s >= 3) return "P2";
  return "P3";
}

let _seq = 0;
export function newItem(fields = {}, nowMs = Date.now()) {
  const at = new Date(nowMs).toISOString();
  const id = fields.id || `cb_${nowMs.toString(36)}_${(_seq++).toString(36)}`;
  const item = {
    id,
    kind: fields.kind || "idea",           // hook | title | idea | format
    channel: fields.channel || null,        // data-lens | auto2 | null(ambos)
    text: fields.text || "",
    impact: clampN(fields.impact, 1, 5, 3),
    probability: clampN(fields.probability, 0, 1, 0.5),
    velocity: clampN(fields.velocity, 1, 5, 3),
    cost: clampN(fields.cost, 1, 5, 3),
    state: STATES.includes(fields.state) ? fields.state : "BACKLOG",
    source: fields.source || "manual",      // manual | outlier | radar | hypothesis
    evidence: fields.evidence || null,
    created_at: fields.created_at || at,
    updated_at: at,
  };
  item.priority = priorityScore(item);
  item.bucket = bucket(item);
  return item;
}

// Transición de estado validada. Devuelve el item nuevo (no muta) o lanza si la transición es inválida.
export function advance(item, to, nowMs = Date.now()) {
  if (!STATES.includes(to)) throw new Error(`estado inválido: ${to}`);
  const allowed = NEXT[item.state] || [];
  if (item.state !== to && !allowed.includes(to)) throw new Error(`transición inválida ${item.state}->${to}`);
  const out = { ...item, state: to, updated_at: new Date(nowMs).toISOString() };
  out.priority = priorityScore(out);
  out.bucket = bucket(out);
  return out;
}

// Ordena el banco: por bucket (P0>P1>P2>P3>KILL) y dentro por prioridad desc.
const BORD = { P0: 0, P1: 1, P2: 2, P3: 3, KILL: 4 };
export function rankBank(items = []) {
  return (items || []).slice().sort((a, b) => (BORD[bucket(a)] - BORD[bucket(b)]) || (priorityScore(b) - priorityScore(a)));
}

// Lo próximo a PROBAR: BACKLOG mejor priorizado.
export function nextToTest(items = [], n = 3) {
  return rankBank((items || []).filter((i) => i.state === "BACKLOG")).slice(0, n);
}

// Auto-siembra desde los outliers de Fase 2: si el patrón ganador no tiene ya una idea similar
// en el banco, agrega una idea BACKLOG (source=outlier). `outliers` = salida de findOutliers.
export function seedFromOutliers(items, outliers, channel, nowMs = Date.now()) {
  const bank = (items || []).slice();
  if (!outliers || !outliers.count || !outliers.pattern) return bank;
  const hook = outliers.pattern.hook && outliers.pattern.hook.value;
  const fmt = outliers.pattern.format && outliers.pattern.format.value;
  if (!hook) return bank;
  const text = `Replicar patrón ganador: hook "${hook}"${fmt ? ` en ${fmt}` : ""}`;
  // Idempotente: no duplicar la misma idea (por texto + canal) si sigue viva.
  const exists = bank.some((i) => i.channel === channel && i.text === text && i.state !== "KILLED");
  if (exists) return bank;
  bank.push(newItem({
    kind: "hook", channel, text, source: "outlier",
    impact: 4, probability: Math.min(0.9, 0.4 + outliers.count * 0.05), velocity: 4, cost: 2,
    evidence: `${outliers.count} outlier(s) con este patrón`,
  }, nowMs));
  return bank;
}
