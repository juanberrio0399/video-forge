// os_pulse_videoforge.mjs — PULSE de Video Forge para el AI OS. Solo datos reales del cerebro:
// plan de hoy/mañana (lineup), bitácora (journal), ledger, meta por ventana (monetization_report), historial YPP
// y ejecuciones de GitHub Actions (runs). Video Forge es 100% automático: sus "needs" son solo decisiones
// estratégicas (nunca aprobar publicaciones).
// Uso: node pipeline/os_pulse_videoforge.mjs <lineup.json> <journal.json> <ledger.json> <monet.json> <decision.json> <runs.json> <ypp_hist.json> <out.json>
import fs from "node:fs";
import { makePulse, validatePulse } from "./lib/os_contract.mjs";

const [lineupF, journalF, ledgerF, monetF, decisionF, runsF, yppHistF, outF] = process.argv.slice(2);
const rj = (f, d) => { try { const v = JSON.parse(fs.readFileSync(f, "utf8")); return v == null ? d : v; } catch { return d; } };
const now = Date.now();
const L = rj(lineupF, {});
const journal = rj(journalF, []);
const ledger = rj(ledgerF, []);
const monet = rj(monetF, {});
const decision = rj(decisionF, {});
// Solo producción: corridas de main. Un fallo en la rama de un PR no es un fallo de Video Forge.
const runs = rj(runsF, []).filter((r) => !r || r.headBranch == null || r.headBranch === "main");
const yppHist = rj(yppHistF, []);

const runsOf = (name) => (Array.isArray(runs) ? runs : []).filter((r) => r.workflowName === name).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
const lastRun = (name) => runsOf(name)[0] || null;
const runState = (r, active = "executing") => !r ? "idle" : r.status !== "completed" ? active : r.conclusion === "success" ? "completed" : r.conclusion === "failure" ? "failed" : "warning";

const T = L.today || { items: [], summary: {} };
const M = L.tomorrow || { items: [], summary: {} };
const oddly = (monet.channels && monet.channels.auto2) || {};
const ypp = oddly.ypp || null;
// Requisitos de la META elegida (Oddly: nivel intermedio desde 2026-09-14).
const full = ypp && ypp.tiers && ypp.tiers[(ypp && ypp.goal_tier) || "full"];
const shortsReq = full ? [...(full.reqs || []), ...(full.options || [])].find((r) => r.key === "shorts_views_90d") : null;
const subsReq = full ? (full.reqs || []).find((r) => r.key === "subs") : null;

// ---- Agentes (estado desde ejecuciones reales) ----
const brain = lastRun("Cerebro en vivo (plan de mañana + producción continua)");
const produce = runsOf("Producir compilacion (Oddly Loop / canal auto)");
const producing = produce.filter((r) => r.status !== "completed");
const analytics = lastRun("Monetization Dashboard + Brain Report -> R2");
const trends = lastRun("Growth Radar (inteligencia de crecimiento YouTube)");
const agents = [
  { id: "content", name: "Content Agent", state: runState(brain, "thinking"), since: brain && brain.createdAt, detail: M.date ? `Plan del ${M.date}: ${(M.items || []).length} piezas` : "Sin plan todavía" },
  { id: "publishing", name: "Publishing Agent", state: producing.length ? "executing" : ((M.summary || {}).programado ? "completed" : "idle"), since: producing[0] && producing[0].createdAt, detail: producing.length ? `${producing.length} producción(es) en curso` : `${(M.summary || {}).programado || 0} listas para salir solas` },
  { id: "analytics", name: "Analytics Agent", state: runState(analytics, "analyzing"), since: analytics && analytics.createdAt, detail: shortsReq && shortsReq.cur != null ? `Shorts 90 días: ${shortsReq.cur.toLocaleString("es")}` : "Midiendo" },
  { id: "trend", name: "Trend Agent", state: trends ? (trends.status !== "completed" ? "researching" : "observing") : "idle", since: trends && trends.createdAt, detail: "Radar de crecimiento semanal" },
];

// ---- Actividad: la bitácora del cerebro (eventos reales) + fallos de ejecución ----
const AGENT_BY_KIND = { plan: "Content Agent", produccion: "Publishing Agent", autocritica: "Analytics Agent", ciclo: "Content Agent" };
// Sin ruido: si la bitácora repite el mismo texto, queda solo el más reciente.
const seenText = new Set();
const journalRecent = (Array.isArray(journal) ? journal : []).slice(-60).reverse().filter((j) => { const k = String(j.text || ""); if (seenText.has(k)) return false; seenText.add(k); return true; }).slice(0, 20).reverse();
const activity = journalRecent.map((j) => ({ at: j.at, agent: AGENT_BY_KIND[j.kind] || "Content Agent", text: j.text, kind: j.kind, trust: "executed" }));
for (const r of (Array.isArray(runs) ? runs : []).filter((x) => x.conclusion === "failure" && now - Date.parse(x.createdAt) < 24 * 3600e3)) {
  activity.push({ at: r.updatedAt || r.createdAt, agent: "Orchestrator", text: `Falló: ${r.workflowName}`, kind: "error", trust: "executed", result: "revisar el run" });
}

// ---- Tareas: producciones reales ----
const tasks = produce.slice(0, 8).map((r) => ({
  id: String(r.databaseId), name: r.displayTitle && r.displayTitle !== r.workflowName ? r.displayTitle : "Producir Short", agent: "Publishing Agent",
  status: r.status === "queued" ? "QUEUED" : r.status !== "completed" ? "RUNNING" : r.conclusion === "success" ? "COMPLETED" : r.conclusion === "cancelled" ? "CANCELLED" : "FAILED",
  started: r.createdAt, updated: r.updatedAt, duration_s: r.status === "completed" ? (Date.parse(r.updatedAt) - Date.parse(r.createdAt)) / 1000 : null,
  result: r.status === "completed" && r.conclusion === "success" ? "Lista y en su franja" : null, next: r.status !== "completed" ? "Sale sola en su franja al terminar" : null, url: r.url,
}));

// ---- Decisiones (solo estratégicas) ----
const needs = [];
// La meta ya la decidió Juan (nivel intermedio). Solo vuelve a pedir criterio si la revisión de 28 días falla.
const goalReview = L.oddly_goal && L.oddly_goal.review;
if (goalReview && goalReview.status === "FALLO") {
  needs.push({
    id: "vf-goal-review", title: "El hito intermedio no duplicó el ritmo", severity: "warn", autonomy: "REVIEW",
    why: "La estrategia de concentrar cupos en el líder y probar ganchos no alcanzó el criterio de 28 días.",
    evidence: goalReview.verdict_note || "", impact: "Hace falta otra estrategia para la meta del año", risk: "high",
    actions: [{ id: "open-meta", label: "Ver análisis", kind: "open" }],
  });
}
const dl = L.data_lens;
if (dl && dl.paused && dl.review_at && Date.parse(dl.review_at) - now < 3 * 86400e3) {
  needs.push({ id: "vf-datalens-review", title: "Revisión de la pausa de Data Lens", severity: "info", autonomy: "REVIEW", why: "Se cumple el plazo de 21 días del experimento semanal.", evidence: dl.best_views_so_far != null ? `Mejor experimento: ${dl.best_views_so_far} vistas (criterio ${dl.target_views_7d})` : "Sin experimentos medidos aún", actions: [{ id: "open-dl", label: "Ver", kind: "open" }] });
}

// ---- Insights con qué/por qué/impacto/acción ----
const insights = [];
if (L.oddly_goal && shortsReq && shortsReq.per_day_actual != null) {
  const rv = L.oddly_goal.review;
  insights.push({
    what: `Meta del año: ${L.oddly_goal.label}`,
    why: `Ritmo de 28 días ${Math.round(shortsReq.per_day_actual).toLocaleString("es")}/día; el nivel pide ${Math.round(shortsReq.per_day_needed || 0).toLocaleString("es")}/día hasta el ${ypp.deadline}`,
    impact: rv ? `Primer hito: ${Math.round(rv.target_pace).toLocaleString("es")}/día al ${String(rv.review_at).slice(0, 10)}` : null,
    action: "Mayoría de cupos al nicho líder y un par de ganchos distinto cada semana",
  });
}
const lead = (decision.candidates || []).filter((c) => c.sufficient).sort((a, b) => (b.rel || 0) - (a.rel || 0))[0];
if (lead && lead.rel != null) insights.push({ what: `${lead.label} rinde ${lead.rel}× la mediana del canal`, why: `Mediana de ${lead.median_vpd} vistas/día en videos de 5 a 30 días`, impact: `Recibe ${lead.slots} de ${decision.total} cupos diarios`, action: "Mantener el reparto; se revisa en el ledger en 7 días", confidence: { value: lead.confidence, basis: `${lead.n} videos comparables` } });
const judged = (Array.isArray(ledger) ? ledger : []).filter((e) => e.status === "ACERTO" || e.status === "FALLO");
if (judged.length) { const hits = judged.filter((e) => e.status === "ACERTO").length; insights.push({ what: `El cerebro acertó ${hits} de ${judged.length} decisiones juzgadas`, why: "Cada decisión se revisa en su fecha contra su propio criterio", action: judged.length - hits >= 2 ? "Revisar las reglas que fallaron" : "Seguir midiendo" }); }

// ---- Métricas con interpretación ----
const metrics = [];
if (shortsReq && shortsReq.cur != null) {
  metrics.push({ key: "shorts_views_90d", label: "Vistas de Shorts", value: shortsReq.cur, timeframe: "últimos 90 días", context: `requisito ${shortsReq.target.toLocaleString("es")}`, interpretation: `Ritmo ${Math.round(shortsReq.per_day_actual || 0).toLocaleString("es")}/día; se necesitan ${Math.round(shortsReq.per_day_needed || 0).toLocaleString("es")}/día.`, series: (Array.isArray(yppHist) ? yppHist : []).map((h) => h.shorts_views_per_day_28d).filter((x) => x != null) });
}
if (subsReq && subsReq.cur != null) metrics.push({ key: "subs", label: "Suscriptores", value: subsReq.cur, timeframe: "total", context: `requisito ${subsReq.target}`, interpretation: subsReq.per_day_actual != null ? `Ritmo ${subsReq.per_day_actual}/día; se necesitan ${subsReq.per_day_needed}/día.` : "Midiendo el ritmo con la historia diaria.", series: (Array.isArray(yppHist) ? yppHist : []).map((h) => h.subs).filter((x) => x != null) });

// ---- Estado y titular ----
const failures = (Array.isArray(runs) ? runs : []).filter((r) => r.conclusion === "failure" && now - Date.parse(r.createdAt) < 6 * 3600e3);
const ready = (T.summary || {}).programado || 0, tomorrowReady = (M.summary || {}).programado || 0;
let status = needs.length ? "attention" : "normal";
if (failures.length >= 3) status = "critical"; else if (failures.length) status = status === "normal" ? "attention" : status;
const headline = producing.length ? `Produciendo ${producing.length} pieza${producing.length > 1 ? "s" : ""} para mañana`
  : tomorrowReady ? `${tomorrowReady} Shorts listos para mañana` : ready ? `${ready} Shorts salen hoy solos` : "Plan en preparación";
const sub = ypp ? `Todo automático. Meta del año: ${(ypp.goal_label || "monetización").toLowerCase()}${ypp.feasibility === "improbable" ? ", lejos al ritmo actual" : ""}.` : "Todo automático.";

const pulse = makePulse({ system: "video-forge", at: new Date(now).toISOString(), status, headline, sub, agents, activity, tasks, needs, insights, metrics }, now);
const v = validatePulse(pulse);
fs.writeFileSync(outF || "os_pulse_video-forge.json", JSON.stringify(pulse, null, 2));
console.log(`pulse video-forge: ${pulse.status} · "${pulse.headline}" · agentes ${pulse.agents.length} · actividad ${pulse.activity.length} · tareas ${pulse.tasks.length} · decisiones ${pulse.needs.length} · insights ${pulse.insights.length} · válido ${v.ok}${v.ok ? "" : " (" + v.errors.join(", ") + ")"}`);
