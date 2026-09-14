// ledger.mjs — Registro de DECISIONES con predicción y AUTOCRÍTICA (auditoría BR-06). PURO.
// Cada decisión se guarda ANTES de actuar con: razón, evidencia, acción, métrica, criterio de éxito y fecha
// de revisión. Un revisor la juzga en su fecha (ACERTÓ / FALLÓ / INCONCLUSO) contra su PROPIO criterio,
// y dos fallos seguidos del mismo tipo piden revertir la regla. Sin I/O, fechas inyectadas.

const DAY = 86400000;
export const OPS = { ">=": (a, b) => a >= b, ">": (a, b) => a > b, "<=": (a, b) => a <= b, "<": (a, b) => a < b };

let _seq = 0;
export function newEntry(fields = {}, nowMs = Date.now()) {
  const crit = fields.criterion || {};
  if (!OPS[crit.op] || !Number.isFinite(Number(crit.value))) throw new Error("criterio inválido: se requiere {op, value}");
  if (!fields.metric) throw new Error("métrica requerida");
  const reviewDays = Number.isFinite(Number(fields.review_after_days)) ? Number(fields.review_after_days) : 7;
  return {
    id: fields.id || `dec_${nowMs.toString(36)}_${(_seq++).toString(36)}`,
    at: new Date(nowMs).toISOString(),
    type: fields.type || "general",
    channel: fields.channel || null,
    subject: fields.subject || null,
    decision: fields.decision || "",
    reason: fields.reason || "",
    evidence: fields.evidence || "",
    action: fields.action || "",
    metric: fields.metric,
    baseline: fields.baseline != null ? Number(fields.baseline) : null,
    criterion: { op: crit.op, value: Number(crit.value) },
    confidence: fields.confidence || "baja",
    review_at: new Date(nowMs + reviewDays * DAY).toISOString(),
    next: fields.next || "",
    status: "PENDIENTE",
    observed: null,
    verdict_note: null,
    reviewed_at: null,
  };
}

export function dueEntries(ledger, nowMs = Date.now()) {
  return (ledger || []).filter((e) => e && e.status === "PENDIENTE" && Date.parse(e.review_at) <= nowMs);
}

// Juicio contra el criterio propio. Sin dato observado -> INCONCLUSO (nunca se da por bueno ni por malo).
export function judge(entry, observed) {
  const v = observed === null || observed === undefined || !Number.isFinite(Number(observed)) ? null : Number(observed);
  if (v === null) return { status: "INCONCLUSO", note: `sin dato de ${entry.metric} al revisar` };
  const ok = OPS[entry.criterion.op](v, entry.criterion.value);
  return { status: ok ? "ACERTO" : "FALLO", note: `${entry.metric} = ${Math.round(v * 100) / 100} (criterio ${entry.criterion.op} ${entry.criterion.value})` };
}

export function applyReview(ledger, id, observed, nowMs = Date.now()) {
  return (ledger || []).map((e) => {
    if (e.id !== id || e.status !== "PENDIENTE") return e;
    const j = judge(e, observed);
    return { ...e, status: j.status, observed: observed == null ? null : Number(observed), verdict_note: j.note, reviewed_at: new Date(nowMs).toISOString() };
  });
}

// Fallos consecutivos más recientes de un tipo/canal (los INCONCLUSO no rompen ni suman la racha).
export function consecutiveFailures(ledger, type, channel = null) {
  const judged = (ledger || [])
    .filter((e) => e.type === type && (channel == null || e.channel === channel) && (e.status === "ACERTO" || e.status === "FALLO"))
    .sort((a, b) => Date.parse(b.reviewed_at || b.at) - Date.parse(a.reviewed_at || a.at));
  let n = 0;
  for (const e of judged) { if (e.status === "FALLO") n++; else break; }
  return n;
}

export function shouldRevert(ledger, type, channel = null, threshold = 2) {
  return consecutiveFailures(ledger, type, channel) >= threshold;
}

// Tasa de acierto (solo juzgadas) para mostrar la calidad del propio cerebro.
export function hitRate(ledger, type = null) {
  const judged = (ledger || []).filter((e) => (type == null || e.type === type) && (e.status === "ACERTO" || e.status === "FALLO"));
  if (!judged.length) return { judged: 0, hits: 0, rate: null };
  const hits = judged.filter((e) => e.status === "ACERTO").length;
  return { judged: judged.length, hits, rate: Math.round((hits / judged.length) * 100) / 100 };
}

// Conserva todo lo pendiente y las últimas `keep` revisadas.
export function trim(ledger, keep = 200) {
  const pend = (ledger || []).filter((e) => e.status === "PENDIENTE");
  const done = (ledger || []).filter((e) => e.status !== "PENDIENTE").sort((a, b) => Date.parse(b.reviewed_at || b.at) - Date.parse(a.reviewed_at || a.at)).slice(0, keep);
  return [...pend, ...done].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
