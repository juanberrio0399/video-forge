// alerts.mjs — Alertas de crecimiento (Growth Roadmap Fase 4). PURO y testeable.
// Vigila la memoria que las neuronas YA calculan y avisa cuando algo va mal: crecimiento cayendo,
// saturación de formato, dependencia de un solo nicho, pipeline parado, meta atrasada. Cada regla
// es defensiva ante datos faltantes y devuelve una alerta {id,severity,title,detail} o null.
import { median } from "./analytics_math.mjs";

const DAY = 86400000;
export const SEVERITY = { critical: 0, warn: 1, info: 2 };

// Snapshot del historial más cercano a `targetMs` (para medir el ritmo de una ventana).
function snapshotNear(history, targetMs) {
  let best = null, bestD = Infinity;
  for (const h of history || []) {
    const t = Date.parse(h && h.date); if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - targetMs); if (d < bestD) { bestD = d; best = h; }
  }
  return best;
}

// R1 — Crecimiento cayendo: gana(últimos 7d) vs gana(7d previos) para una métrica acumulada.
export function growthDrop(history, key, label, nowMs = Date.now()) {
  const hist = (history || []).filter((h) => h && h.date);
  if (hist.length < 3) return null;
  const now = snapshotNear(hist, nowMs);
  const d7 = snapshotNear(hist, nowMs - 7 * DAY);
  const d14 = snapshotNear(hist, nowMs - 14 * DAY);
  if (!now || !d7 || !d14) return null;
  const recent = (Number(now[key]) || 0) - (Number(d7[key]) || 0);
  const prior = (Number(d7[key]) || 0) - (Number(d14[key]) || 0);
  if (prior <= 0) return null; // sin base positiva no hay "caída"
  if (recent <= 0) return { id: `growth_stall_${key}`, severity: "critical", title: `${label} se estancó`, detail: `${label}: +${prior} la semana pasada → ${recent} esta semana.` };
  if (recent < 0.5 * prior) return { id: `growth_drop_${key}`, severity: "warn", title: `${label} desacelera`, detail: `${label}: +${prior} → +${recent} (${Math.round((1 - recent / prior) * 100)}% menos).` };
  return null;
}

// R2 — Saturación de formato: la cohorte RECIENTE de un formato rinde mucho menos que la vieja.
export function formatFatigue(episodes, opts = {}) {
  const eps = (episodes || []).filter((e) => e && e.format && Number.isFinite(e.vpd) && e.age_days != null && (Number(e.views) || 0) >= (opts.minViews != null ? opts.minViews : 50));
  const cut = opts.recentDays != null ? opts.recentDays : 14;
  const minPer = opts.minPer != null ? opts.minPer : 3;
  const byFmt = {};
  for (const e of eps) { (byFmt[e.format] ||= { recent: [], older: [] })[e.age_days <= cut ? "recent" : "older"].push(e.vpd); }
  const out = [];
  for (const [fmt, g] of Object.entries(byFmt)) {
    if (g.recent.length < minPer || g.older.length < minPer) continue;
    const mr = median(g.recent), mo = median(g.older);
    if (mo > 0 && mr < 0.6 * mo) out.push({ id: `fatigue_${fmt}`, severity: "warn", title: `Saturación de formato: ${fmt}`, detail: `vpd reciente ${mr.toFixed(1)} vs ${mo.toFixed(1)} antes (${Math.round((1 - mr / mo) * 100)}% menos).` });
  }
  return out;
}

// R3 — Dependencia: un solo nicho concentra demasiada producción (reparto del decision engine).
export function concentration(allocation, opts = {}) {
  const alloc = allocation || {};
  const entries = Object.entries(alloc).filter(([, n]) => Number(n) > 0);
  const total = entries.reduce((a, [, n]) => a + Number(n), 0);
  if (total <= 0 || entries.length < 2) return null;
  const [topK, topN] = entries.sort((a, b) => b[1] - a[1])[0];
  const share = topN / total;
  const thr = opts.threshold != null ? opts.threshold : 0.7;
  if (share >= thr) return { id: "concentration", severity: "warn", title: "Dependés de un solo nicho", detail: `${topK} = ${Math.round(share * 100)}% de la producción. Diversifica para no depender de una sola fuente.` };
  return null;
}

// R4 — Pipeline parado: no se publica hace demasiados días (algo se rompió).
export function pipelineStalled(episodes, opts = {}) {
  const maxDays = opts.maxDays != null ? opts.maxDays : 4;
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const pubs = (episodes || []).filter((e) => e && e.published_at).map((e) => Date.parse(e.published_at)).filter(Number.isFinite);
  if (!pubs.length) return null;
  const last = Math.max(...pubs);
  const days = Math.floor((nowMs - last) / DAY);
  if (days > maxDays) return { id: "pipeline_stalled", severity: "critical", title: "Pipeline parado", detail: `Sin publicar hace ${days} días. Revisa la producción/agendado.` };
  return null;
}

// R5 — Meta atrasada: el canal va detrás de su ritmo para la fecha límite.
export function behindGoal(readiness, warRoom) {
  if (!readiness || readiness.status !== "behind") return null;
  const focus = warRoom && warRoom.focus_label ? warRoom.focus_label : null;
  return { id: "behind_goal", severity: "warn", title: "Meta atrasada", detail: `Vas detrás del ritmo (${readiness.days_left}d al plazo)${focus ? `. Foco: ${focus}.` : "."}` };
}

// Corre TODAS las reglas sobre los datos disponibles del canal. Ordena critical→warn→info.
export function evaluateAlerts(input = {}) {
  const { channel, history, historyKeys, episodes, allocation, readiness, warRoom, nowMs } = input;
  const now = nowMs != null ? nowMs : Date.now();
  const alerts = [];
  for (const { key, label } of (historyKeys || [])) {
    const a = growthDrop(history, key, label, now); if (a) alerts.push(a);
  }
  alerts.push(...formatFatigue(episodes));
  const c = concentration(allocation); if (c) alerts.push(c);
  const p = pipelineStalled(episodes, { nowMs: now }); if (p) alerts.push(p);
  const b = behindGoal(readiness, warRoom); if (b) alerts.push(b);
  return alerts
    .filter(Boolean)
    .map((a) => ({ ...a, channel: channel || null }))
    .sort((x, y) => SEVERITY[x.severity] - SEVERITY[y.severity]);
}
