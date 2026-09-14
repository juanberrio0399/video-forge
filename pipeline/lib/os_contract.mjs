// os_contract.mjs — CONTRATO del AI OS de Juan (Video Forge · Viento · Radar + Orchestrator). PURO y testeable.
// Cada especialista publica un PULSE con la misma forma; el Orchestrator los une en un GLOBAL. Todo lo que se
// muestra en las Mini Apps sale de aquí: estado, agentes, actividad real, tareas, decisiones (needs) e insights.
// Reglas del brief que este contrato hace cumplir:
//  - La confianza solo existe si trae su base de datos; si no, "datos insuficientes".
//  - Toda decisión (need) declara autonomía, evidencia y acciones permitidas.
//  - Un pulse viejo NO se muestra como sano: pasa a "degraded" con "sin señal".
//  - Se distingue quién hizo qué: sugerido, preparado, ejecutado, aprobado.

export const SYSTEMS = {
  "video-forge": { name: "Video Forge", role: "Create", accent: "#A594FF" },
  viento: { name: "Viento", role: "Grow", accent: "#3DDBB0" },
  radar: { name: "Radar", role: "Improve", accent: "#4CC9F0" },
};
export const PULSE_STATUS = ["normal", "attention", "degraded", "critical"];
export const AI_STATES = ["idle", "observing", "thinking", "researching", "analyzing", "executing", "waiting", "asking", "completed", "warning", "failed", "paused"];
export const TASK_STATUS = ["QUEUED", "RUNNING", "THINKING", "WAITING", "APPROVAL", "COMPLETED", "FAILED", "CANCELLED"];
export const AUTONOMY = ["AUTO", "REVIEW", "APPROVAL", "CRITICAL"];
export const TRUST = ["suggested", "prepared", "executed", "approved"];
export const SEVERITY = ["info", "warn", "critical"];

const RANK = { critical: 0, degraded: 1, attention: 2, normal: 3 };
const SEV_RANK = { critical: 0, warn: 1, info: 2 };
const str = (x, max = 280) => { const t = (x == null ? "" : String(x)).replace(/\s+/g, " ").trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t; };
const iso = (x, fallback) => { const t = Date.parse(x); return Number.isFinite(t) ? new Date(t).toISOString() : fallback; };
const oneOf = (x, list, dflt) => (list.includes(x) ? x : dflt);

// Confianza honesta: {value 0..1, basis} o null. Sin base -> null.
export function normConfidence(c) {
  if (c == null || typeof c !== "object") return null;
  const v = Number(c.value);
  const basis = str(c.basis, 160);
  if (!Number.isFinite(v) || v < 0 || v > 1 || !basis) return null;
  return { value: Math.round(v * 100) / 100, basis };
}
export function confidenceLabel(c) {
  const n = normConfidence(c);
  return n ? `Confianza ${Math.round(n.value * 100)}% · ${n.basis}` : "Confianza: datos insuficientes";
}

export function normAgent(a = {}) {
  return { id: str(a.id, 40), name: str(a.name, 40), state: oneOf(a.state, AI_STATES, "idle"), detail: str(a.detail, 140), since: iso(a.since, null) };
}
export function normActivity(e = {}, nowIso) {
  return { at: iso(e.at, nowIso), agent: str(e.agent, 40), text: str(e.text, 220), kind: str(e.kind, 24) || "event", trust: oneOf(e.trust, TRUST, "executed"), result: str(e.result, 140) || null };
}
export function normTask(t = {}, nowIso) {
  const progress = Number(t.progress);
  return {
    id: str(t.id, 60), name: str(t.name, 120), agent: str(t.agent, 40),
    status: oneOf(t.status, TASK_STATUS, "QUEUED"),
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null,
    priority: oneOf(t.priority, ["low", "normal", "high"], "normal"),
    started: iso(t.started, null), duration_s: Number.isFinite(Number(t.duration_s)) ? Math.round(Number(t.duration_s)) : null,
    result: str(t.result, 160) || null, impact: str(t.impact, 120) || null, next: str(t.next, 160) || null,
    url: str(t.url, 300) || null, updated: iso(t.updated, nowIso),
  };
}
export function normNeed(n = {}, system, nowIso) {
  const actions = (Array.isArray(n.actions) ? n.actions : []).map((x) => ({ id: str(x.id, 40), label: str(x.label, 30), kind: oneOf(x.kind, ["approve", "review", "dismiss", "open"], "review") })).filter((x) => x.id && x.label).slice(0, 3);
  return {
    id: str(n.id, 80), system, title: str(n.title, 120), why: str(n.why, 240), evidence: str(n.evidence, 240),
    impact: str(n.impact, 120) || null, risk: oneOf(n.risk, ["low", "medium", "high"], null),
    severity: oneOf(n.severity, SEVERITY, "warn"), autonomy: oneOf(n.autonomy, AUTONOMY, "APPROVAL"),
    confidence: normConfidence(n.confidence), actions, created_at: iso(n.created_at, nowIso), url: str(n.url, 300) || null,
  };
}
export function normInsight(i = {}) {
  return { what: str(i.what, 160), why: str(i.why, 220), impact: str(i.impact, 160) || null, action: str(i.action, 160) || null, confidence: normConfidence(i.confidence) };
}
export function normMetric(m = {}) {
  const value = m.value == null ? null : Number(m.value);
  const change = m.change_pct == null ? null : Number(m.change_pct);
  return {
    key: str(m.key, 40), label: str(m.label, 60), value: Number.isFinite(value) ? value : null, unit: str(m.unit, 16) || null,
    change_pct: Number.isFinite(change) ? Math.round(change * 10) / 10 : null, timeframe: str(m.timeframe, 40) || null,
    context: str(m.context, 120) || null, interpretation: str(m.interpretation, 200) || null,
    series: (Array.isArray(m.series) ? m.series : []).map(Number).filter(Number.isFinite).slice(-60),
  };
}

// Construye un pulse válido (lanza si el sistema o el estado no existen: el contrato no admite inventos).
export function makePulse(p = {}, nowMs = Date.now()) {
  if (!SYSTEMS[p.system]) throw new Error(`sistema desconocido: ${p.system}`);
  const nowIso = new Date(nowMs).toISOString();
  const status = p.status == null ? "normal" : p.status;
  if (!PULSE_STATUS.includes(status)) throw new Error(`estado de pulse inválido: ${status}`);
  return {
    v: 1, system: p.system, name: SYSTEMS[p.system].name, role: SYSTEMS[p.system].role,
    at: iso(p.at, nowIso), status, headline: str(p.headline, 90), sub: str(p.sub, 160),
    agents: (p.agents || []).map(normAgent).filter((a) => a.id).slice(0, 8),
    activity: (p.activity || []).map((e) => normActivity(e, nowIso)).filter((e) => e.text).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 40),
    tasks: (p.tasks || []).map((t) => normTask(t, nowIso)).filter((t) => t.id && t.name).slice(0, 30),
    needs: (p.needs || []).map((n) => normNeed(n, p.system, nowIso)).filter((n) => n.id && n.title).slice(0, 12),
    insights: (p.insights || []).map(normInsight).filter((i) => i.what).slice(0, 8),
    metrics: (p.metrics || []).map(normMetric).filter((m) => m.key).slice(0, 12),
  };
}

export function validatePulse(p) {
  const errors = [];
  if (!p || typeof p !== "object") return { ok: false, errors: ["pulse vacío"] };
  if (!SYSTEMS[p.system]) errors.push("system");
  if (!PULSE_STATUS.includes(p.status)) errors.push("status");
  if (!Number.isFinite(Date.parse(p.at))) errors.push("at");
  if (!p.headline) errors.push("headline");
  for (const n of p.needs || []) if (!n.actions || !n.actions.length) errors.push(`need ${n.id} sin acciones`);
  return { ok: errors.length === 0, errors };
}

// Pulse viejo = sin señal. Nunca se muestra como sano.
export function applyStaleness(p, nowMs = Date.now(), maxAgeMin = 180) {
  const age = (nowMs - Date.parse(p.at)) / 60000;
  if (!(age > maxAgeMin)) return { ...p, stale: false, age_min: Math.max(0, Math.round(age)) };
  const h = age >= 90 ? `${Math.round(age / 60)} h` : `${Math.round(age)} min`;
  return { ...p, stale: true, age_min: Math.round(age), status: RANK[p.status] <= RANK.degraded ? p.status : "degraded", headline: `Sin señal de ${p.name} desde hace ${h}` };
}

export function worstStatus(list) {
  const s = (list || []).filter((x) => PULSE_STATUS.includes(x));
  return s.length ? s.sort((a, b) => RANK[a] - RANK[b])[0] : "degraded";
}

// GLOBAL: lo que ve el usuario en los 5 segundos del Home, igual en las tres apps.
export function mergeGlobal(pulses, nowMs = Date.now(), opts = {}) {
  const expected = opts.expected || Object.keys(SYSTEMS);
  const bySystem = {};
  for (const p of pulses || []) if (p && SYSTEMS[p.system]) bySystem[p.system] = applyStaleness(p, nowMs, opts.maxAgeMin);
  const systems = expected.map((k) => bySystem[k] || { system: k, name: SYSTEMS[k].name, role: SYSTEMS[k].role, status: "degraded", stale: true, headline: `Sin señal de ${SYSTEMS[k].name}`, at: null, agents: [], activity: [], tasks: [], needs: [], insights: [], metrics: [] });
  const status = worstStatus(systems.map((s) => s.status));
  const needs = systems.flatMap((s) => s.needs || []).sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || (Date.parse(a.created_at) - Date.parse(b.created_at)));
  const activity = systems.flatMap((s) => (s.activity || []).map((e) => ({ ...e, system: s.system }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 40);
  const running = systems.flatMap((s) => (s.tasks || []).filter((t) => ["RUNNING", "THINKING", "WAITING"].includes(t.status)).map((t) => ({ ...t, system: s.system })));
  const insights = systems.flatMap((s) => (s.insights || []).map((i) => ({ ...i, system: s.system })));
  const activeAgents = systems.flatMap((s) => (s.agents || []).filter((a) => !["idle", "paused"].includes(a.state))).length;
  let headline;
  if (status === "critical") headline = "Atención: hay un problema crítico";
  else if (needs.length) headline = needs.length === 1 ? "1 decisión te espera" : `${needs.length} decisiones te esperan`;
  else if (status === "degraded") headline = "Un sistema no está reportando";
  else headline = "Todo está corriendo";
  const priority = needs[0] ? { type: "need", system: needs[0].system, title: needs[0].title, why: needs[0].why }
    : insights[0] ? { type: "insight", system: insights[0].system, title: insights[0].what, why: insights[0].why } : null;
  return {
    v: 1, at: new Date(nowMs).toISOString(), status, headline,
    counts: { active: activeAgents + running.length, running: running.length, insights: insights.length, needs: needs.length },
    systems: systems.map((s) => ({ system: s.system, name: s.name, role: s.role, status: s.status, headline: s.headline, sub: s.sub || "", at: s.at, stale: !!s.stale, needs: (s.needs || []).length, running: (s.tasks || []).filter((t) => t.status === "RUNNING").length })),
    needs, activity, running, insights: insights.slice(0, 10), priority,
  };
}

// Lo que devuelve /api/os en cada Worker: une los pulses guardados en el momento de la lectura.
// getJson(key) -> objeto o null. Un pulse que falta o está viejo sale como "sin señal".
export async function osStateFrom(getJson, system, nowMs = Date.now(), opts = {}) {
  const keys = Object.keys(SYSTEMS);
  const raw = await Promise.all(keys.map((k) => Promise.resolve().then(() => getJson(`os/pulse/${k}.json`)).catch(() => null)));
  const pulses = raw.filter((p) => p && SYSTEMS[p.system] && Number.isFinite(Date.parse(p.at)));
  const global = mergeGlobal(pulses, nowMs, opts);
  const mine = pulses.find((p) => p.system === system);
  return { v: 1, system, global, pulse: mine ? applyStaleness(mine, nowMs, opts.maxAgeMin) : null };
}

// Autonomía por tipo de acción (el OS nunca ejecuta CRITICAL solo).
export function canAutoExecute(autonomy) { return autonomy === "AUTO"; }
