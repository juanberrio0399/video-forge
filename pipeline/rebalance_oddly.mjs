// rebalance_oddly.mjs — MOTOR ÚNICO de reparto de Oddly Loop (corregido por la auditoría BR-04/05/07/09).
// Antes había dos motores (este y decide.mjs) con reglas distintas y la app mostraba el que no se ejecutaba.
// Ahora este script es la única fuente: calcula la cadencia QUE SE EJECUTA y escribe decision.json con
// exactamente ese reparto y su porqué, más una entrada en el registro de decisiones (ledger) con predicción,
// métrica, criterio y fecha de revisión.
//
// Reglas:
//  - Ranking por MEDIANA de vistas/día de la cohorte de 5-30 días, sin nichos inferidos (niche_rank).
//  - Solo nichos con muestra suficiente compiten por explotación; corte = mediana < 40% del mejor.
//  - Subir el volumen (agresividad) SOLO si la cohorte reciente no rinde peor que la anterior a la misma
//    edad (vistas al día 7). Sin dato -> no se escala.
//  - Si el ledger tiene 2 fallos seguidos del escalado, se revierte al volumen base.
//  - HITS (2026-11-01): con 5+ hits en el canal (Shorts de 3-28 días con 1.000+ vistas), el reparto
//    y el líder se deciden por la TASA DE HITS del nicho, no por la mediana. Las vistas de Shorts
//    vienen de pocos videos que pegan; un nicho con buena mediana y cero hits no acerca la meta.
//
// Entradas (las baja el workflow): state.json, cadence.json, exp.json, aggressiveness.json,
//   views_at_age.json, ledger.json. Salidas: cadence.new.json, exp.new.json, decision.json, ledger.new.json, summary.txt
import fs from "node:fs";
import { richReward, proportionalByScore, scoreCandidate } from "./lib/decision.mjs";
import { rankNiches, scaleGate } from "./lib/niche_rank.mjs";
import { newEntry, shouldRevert, trim } from "./lib/ledger.mjs";
import { ODDLY_GOAL, ODDLY_HITO, pushLeader, hitsByNiche } from "./lib/oddly_goal.mjs";
import { aplicarACadencia, aplicarAExperimento } from "./lib/variantes_fijas.mjs";

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const state = rj("state.json", {});
const cad = rj("cadence.json", {});
const exp = rj("exp.json", { active: null, queue: [], done: [], promoted: [] });
const aggr = rj("aggressiveness.json", {});
const viewsAtAge = rj("views_at_age.json", {});
let ledger = rj("ledger.json", []); if (!Array.isArray(ledger)) ledger = [];
const now = Date.now();

const BASE = ["satisfying", "narrativas", "ciencia_humor", "naturaleza_relax", "animales_tiernos"];
const CUT = 0.4;
const EXP_MIN_VIDS = 5;
const BASE_TOTAL = 8;
const notes = [];

// --- Ranking robusto (cohorte comparable). Fallback honesto si el estado aún no trae la lista. ---
let rank = state.niche_rank && Array.isArray(state.niche_rank.rows) ? state.niche_rank : null;
if (!rank && Array.isArray(state.list) && state.list.length) rank = rankNiches(state.list, { nowMs: now });
const engine = rank ? "mediana cohorte 5-30d" : "sin_dato";
const row = {}; for (const r of (rank && rank.rows) || []) row[r.key] = r;
const med = (k) => (row[k] && row[k].median_vpd) || 0;
const nOf = (k) => (row[k] && row[k].n) || 0;
const sufficient = (k) => !!(row[k] && row[k].sufficient);
// Tasa de hits por nicho. Suavizada ((hits+0.5)/(n+1)) para que un nicho sin hits no quede en 0 exacto.
const HN = hitsByNiche(state.list, now);
const hitsMode = HN.hits >= ODDLY_HITO.min_hits;
const hitsOf = (k) => (HN.rows[k] && HN.rows[k].hits) || 0;
const hitRate = (k) => { const r = HN.rows[k]; return r ? (r.hits + 0.5) / (r.n + 1) : 0; };
const pct = (x) => Math.round(x * 1000) / 10;

// --- Experimento de nicho activo: promover / descartar con muestra real ---
const promoted = new Set(exp.promoted || []);
const done = exp.done || [];
let active = exp.active || null;
function activarSiguiente() {
  while ((exp.queue || []).length) {
    const next = exp.queue.shift();
    if (next && next.key && !promoted.has(next.key) && !done.some((d) => d.key === next.key)) { active = next; notes.push(`🧪 Nuevo experimento en prueba: ${next.label}`); return; }
  }
  active = null;
}
if (active) {
  if (nOf(active.key) >= EXP_MIN_VIDS && rank && rank.channel_median_vpd) {
    if (med(active.key) >= rank.channel_median_vpd) {
      promoted.add(active.key);
      done.push({ key: active.key, label: active.label, result: "promovido", median_vpd: med(active.key) });
      notes.push(`✅ Experimento PROMOVIDO: ${active.label} (mediana ${med(active.key)}/día ≥ canal ${rank.channel_median_vpd}).`);
    } else {
      done.push({ key: active.key, label: active.label, result: "descartado", median_vpd: med(active.key) });
      notes.push(`❌ Experimento DESCARTADO: ${active.label} (mediana ${med(active.key)}/día < canal ${rank.channel_median_vpd}).`);
    }
    active = null; activarSiguiente();
  } else {
    notes.push(`🧪 Experimento en prueba: ${active.label} (${nOf(active.key)} videos en la cohorte, faltan datos).`);
  }
} else activarSiguiente();

// --- Volumen: base, o agresivo SOLO si la cohorte reciente no se diluye ---
const currentTotal = Object.values(cad.shorts_per_category || {}).reduce((a, b) => a + (+b || 0), 0) || BASE_TOTAL;
const wantsMore = !!(aggr && aggr.oddly && aggr.oddly.behind && +aggr.oddly.cadence_total > currentTotal);
const gate = scaleGate(viewsAtAge, { nowMs: now });
const reverted = shouldRevert(ledger, "cadence_scale", "auto2");
let TOTAL = currentTotal;
let scaleDecision = null;
if (reverted) {
  TOTAL = Math.min(currentTotal, BASE_TOTAL);
  notes.push(`↩️ Escalado REVERTIDO: 2 revisiones seguidas fallaron. Vuelvo a ${TOTAL}/día.`);
} else if (wantsMore && gate.allow) {
  TOTAL = +aggr.oddly.cadence_total;
  scaleDecision = "subir";
  notes.push(`📈 Subo a ${TOTAL}/día: ${gate.reason}.`);
} else if (wantsMore) {
  notes.push(`⏸️ Escalado bloqueado (sigo en ${TOTAL}/día): ${gate.reason}.`);
}
// Tope diario fijado por Juan (channel/auto2/variants.json): ningun escalado lo pasa.
const topeJuan = +(rj("channel/auto2/variants.json", {}).tope_diario || 0);
if (topeJuan && TOTAL > topeJuan) { notes.push(`🧢 Tope de Juan: ${TOTAL} -> ${topeJuan}/día.`); TOTAL = topeJuan; }

// --- Reparto por score (mediana × confianza) entre nichos con muestra ---
const expSlots = active ? 1 : 0;
const content = Math.max(1, TOTAL - expSlots);
const established = [...new Set([...BASE, ...promoted])].filter((k) => !active || k !== active.key);
const withSample = established.filter(sufficient);
const top = Math.max(1, ...withSample.map(med));
const topRate = Math.max(1e-6, ...withSample.map(hitRate));
// Sobrevive el nicho que llega al 40% del mejor: en tasa de hits si hay hits suficientes, si no en mediana.
let survivors = withSample.filter((k) => (hitsMode ? hitRate(k) >= CUT * topRate : med(k) >= CUT * top));
if (hitsMode) notes.push(`🎯 Reparto por hits: ${HN.hits} de ${HN.n} Shorts de 3-28 días pasan las ${ODDLY_HITO.hit_views.toLocaleString("es")} vistas (${withSample.map((k) => `${(row[k] || {}).label || k} ${hitsOf(k)}/${(HN.rows[k] || {}).n || 0}`).join(", ")}).`);
else notes.push(`📏 Reparto por mediana: solo ${HN.hits} hits en el canal (hacen falta ${ODDLY_HITO.min_hits}).`);
let fallback = false;
if (!survivors.length) {
  // Sin nichos con muestra: no se inventa ganador; se conserva la cadencia vigente.
  fallback = true;
  survivors = Object.entries(cad.shorts_per_category || {}).filter(([, v]) => +v > 0).map(([k]) => k);
  if (!survivors.length) survivors = ["satisfying"];
  notes.push("⚠️ Sin nichos con muestra suficiente en la cohorte: conservo la cadencia vigente.");
}

let alloc = {};
if (fallback) {
  const prev = cad.shorts_per_category || {};
  const sum = Object.values(prev).reduce((a, b) => a + (+b || 0), 0) || 1;
  survivors.forEach((k) => { alloc[k] = Math.round(content * (+prev[k] || 0) / sum); });
  const k0 = survivors[0]; alloc[k0] = (alloc[k0] || 0) + content - Object.values(alloc).reduce((a, b) => a + b, 0);
} else {
  const cand = survivors.map((k) => ({ key: k, reward: hitsMode ? richReward({ vpd: hitRate(k) }, { vpd: topRate }) : richReward({ vpd: med(k) }, { vpd: top }), samples: nOf(k) }));
  alloc = proportionalByScore(cand, content, { minPerArm: content >= survivors.length ? 1 : 0 }).alloc;
}
// Estrategia del hito intermedio (decisión de Juan, 2026-09-14): mayoría de cupos al nicho líder, solo si
// tiene muestra, rinde claramente sobre el canal y el ledger no pidió revertir el reparto.
let goalPush = null;
if (!fallback) {
  const lead = survivors.slice().sort((a, b) => (hitsMode ? hitRate(b) - hitRate(a) : 0) || med(b) - med(a))[0];
  const revertAlloc = shouldRevert(ledger, "niche_allocation", "auto2");
  // Con hits, el líder debe pegar claramente más que el canal: tasa >= min_rel × la del canal y 2+ hits.
  const leadClaro = lead && (hitsMode
    ? hitsOf(lead) >= 2 && hitRate(lead) >= ODDLY_GOAL.strategy.min_rel * HN.rate
    : row[lead] && row[lead].rel != null && row[lead].rel >= ODDLY_GOAL.strategy.min_rel);
  if (leadClaro && !revertAlloc) {
    const r = pushLeader(alloc, lead, ODDLY_GOAL.strategy.leader_share, 1);
    alloc = r.alloc;
    goalPush = { niche: lead, share: ODDLY_GOAL.strategy.leader_share, slots: alloc[lead], of: content, moved: r.moved };
    if (r.moved) notes.push(`🎯 Hito intermedio: ${(row[lead] || {}).label || lead} pasa a ${alloc[lead]} de ${content} cupos (${hitsMode ? `${pct(hitRate(lead))}% de hits contra ${pct(HN.rate)}% del canal` : `${row[lead].rel}x el canal`}).`);
  } else if (lead && revertAlloc) {
    notes.push("↩️ Hito intermedio: no concentro cupos en el líder porque el reparto falló 2 revisiones seguidas.");
  }
}
established.forEach((k) => { if (!(k in alloc)) alloc[k] = 0; });
const newSpc = { ...alloc };
if (active) newSpc[active.key] = 1;
const variant = { ...(cad.variant || {}) };
if (active && active.variant) variant[active.key] = active.variant;
// El formato que fijo Juan (channel/auto2/variants.json, viene en el checkout) gana sobre ambos.
const fijas = rj("channel/auto2/variants.json", {});
Object.assign(variant, aplicarACadencia({ variant }, fijas).variant);
const leader = Object.entries(newSpc).sort((a, b) => b[1] - a[1])[0];

const newCad = {
  _nota: `MOTOR ÚNICO (${new Date(now).toISOString().slice(0, 10)}): ${engine}; corte <${CUT * 100}% del mejor con muestra; escalado solo si la cohorte no se diluye. Lo que dice decision.json es lo que se ejecuta.`,
  shorts_per_category: newSpc,
  long_per_day: cad.long_per_day || 0,
  long_rotation: [...new Set([...(leader ? [leader[0]] : []), ...survivors])],
  variant,
};

// --- decision.json = EXACTAMENTE lo ejecutado, con porqué por nicho ---
const candidates = [...new Set([...established, ...(active ? [active.key] : [])])].map((k) => {
  const r = row[k] || {};
  const sc = scoreCandidate({ key: k, reward: richReward({ vpd: med(k) }, { vpd: top }), samples: nOf(k) });
  const why = !r.n ? "sin videos en la cohorte de 5-30 días"
    : !r.sufficient ? `muestra insuficiente (${r.n} < ${rank.min_n})`
    : active && k === active.key ? "experimento activo"
    : hitsMode && !survivors.includes(k) ? `cortado: ${hitsOf(k)} hits en ${(HN.rows[k] || {}).n || 0} Shorts (${pct(hitRate(k))}% < ${pct(CUT * topRate)}%)`
    : !hitsMode && med(k) < CUT * top ? `cortado: mediana ${med(k)} < ${Math.round(CUT * top)}`
    : hitsMode ? `${hitsOf(k)} hits en ${(HN.rows[k] || {}).n || 0} Shorts (${pct(hitRate(k))}%) · mediana ${med(k)}/día`
    : `mediana ${med(k)}/día · ${r.rel != null ? r.rel + "x el canal" : ""}`;
  return { key: k, label: r.label || k, median_vpd: r.median_vpd ?? null, n: r.n || 0, rel: r.rel ?? null, hits: hitsOf(k), hit_rate: pct(hitRate(k)), sufficient: !!r.sufficient, score: sc.score, confidence: sc.confidence, slots: newSpc[k] || 0, why };
}).sort((a, b) => b.slots - a.slots || (b.median_vpd || 0) - (a.median_vpd || 0));

const week = (() => { const t = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate())); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return `${t.getUTCFullYear()}-W${String(1 + Math.round(((t - f) / 86400000 - 3 + ((f.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0")}`; })();
const decision = {
  at: new Date(now).toISOString(), week, engine: hitsMode && !fallback ? "tasa de hits 3-28d" : engine, executed: true,
  hits: { mode: hitsMode, total: HN.hits, of: HN.n, threshold: ODDLY_HITO.hit_views, min_hits: ODDLY_HITO.min_hits }, total: TOTAL, base_total: currentTotal,
  channel_median_vpd: rank ? rank.channel_median_vpd : null, cohort_size: rank ? rank.cohort_size : 0,
  excluded_inferred: rank ? rank.excluded_inferred : 0,
  scale_gate: gate, scale_reverted: reverted, experiment: active,
  goal: { tier: ODDLY_GOAL.tier, label: ODDLY_GOAL.label, decided_at: ODDLY_GOAL.decided_at, push: goalPush },
  candidates, recommended_allocation: newSpc, notes,
  note: "Motor único: este reparto es la cadencia que ejecuta la producción. HECHO: mediana y n de la cohorte. INFERENCIA: score y corte.",
};

// --- Ledger: predicción verificable de ESTA decisión ---
if (leader && leader[1] > 0 && row[leader[0]] && row[leader[0]].rel != null) {
  ledger.push(newEntry({
    type: "niche_allocation", channel: "auto2", subject: leader[0],
    decision: `Dar ${leader[1]} de ${TOTAL} cupos diarios a ${row[leader[0]].label}`,
    reason: `mediana ${med(leader[0])}/día en la cohorte, ${row[leader[0]].rel}x el canal (n=${nOf(leader[0])})`,
    evidence: `niche_rank ${rank.window_days.join("-")} días, ${rank.cohort_size} videos`,
    action: "cadencia aplicada en R2", metric: "top_niche_rel", baseline: row[leader[0]].rel,
    criterion: { op: ">=", value: 1.0 }, confidence: nOf(leader[0]) >= 15 ? "media" : "baja",
    review_after_days: 7, next: "si falla 2 veces seguidas, el reparto vuelve a pesos iguales entre nichos con muestra",
  }, now));
}
if (scaleDecision === "subir") {
  ledger.push(newEntry({
    type: "cadence_scale", channel: "auto2", subject: "total",
    decision: `Subir producción de ${currentTotal} a ${TOTAL}/día`, reason: gate.reason,
    evidence: `vistas al día 7: reciente ${gate.recent_median_d7} (n=${gate.recent_n}) vs anterior ${gate.prior_median_d7} (n=${gate.prior_n})`,
    action: "cadencia aplicada en R2", metric: "d7_change_pct", baseline: gate.change_pct,
    criterion: { op: ">=", value: -25 }, confidence: "baja", review_after_days: 14,
    next: "2 fallos seguidos revierten al volumen base",
  }, now));
}
ledger = trim(ledger);

const rankLine = candidates.map((c) => `${c.key} ${c.median_vpd ?? "–"}/d (n${c.n})`).join(" · ");
const cadLine = Object.entries(newSpc).map(([k, v]) => `${k}=${v}`).join(" · ");
const summary = [`📊 Mediana vistas/día por nicho (cohorte 5-30 días): ${rankLine}`, ...notes, `🎛️ Cadencia ejecutada (${TOTAL}/día): ${cadLine}`].join("\n");

fs.writeFileSync("cadence.new.json", JSON.stringify(newCad, null, 2));
fs.writeFileSync("exp.new.json", JSON.stringify(aplicarAExperimento({ active, queue: exp.queue || [], done, promoted: [...promoted] }, fijas), null, 2));
fs.writeFileSync("decision.json", JSON.stringify(decision, null, 2));
fs.writeFileSync("ledger.new.json", JSON.stringify(ledger, null, 2));
fs.writeFileSync("summary.txt", summary);
console.log(summary);
