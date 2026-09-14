// monetization.mjs — Monetization Readiness + War Room (Brain OS Fase 6, corregido por la auditoría). PURO.
// CORRECCIÓN BR-01/BR-02: las metas son SOLO requisitos reales del YouTube Partner Program y se miden por
// VENTANA (vistas de Shorts 90 días; horas vistas sin Shorts 365 días). Se eliminaron "likes" y "vistas
// 200k", que no son requisitos. Un dato ausente queda en null (sin dato), nunca en cero.
// El detalle por niveles (intermedio/completo) y la viabilidad viven en lib/ypp.mjs.

const DAY = 86400000;
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const num = (x) => (x === null || x === undefined || !Number.isFinite(Number(x)) ? null : Number(x));

// Metas YPP por canal. kind: stock (se acumula) | rolling (ventana móvil de `window` días).
export const MONET_GOALS = {
  "data-lens": { path: "longform", deadline: "2026-12-31", goal_tier: "full", targets: [
    { key: "subs", label: "Suscriptores", target: 1000, kind: "stock" },
    { key: "watch_hours_365d", label: "Horas vistas sin Shorts (365 días)", target: 4000, kind: "rolling", window: 365, pace_key: "watch_hours_per_day_28d" },
  ] },
  // Oddly: meta del año = nivel intermedio (decisión de Juan, 2026-09-14). La completa queda como largo plazo.
  "auto2": { path: "shorts", deadline: "2026-12-31", goal_tier: "expanded", targets: [
    { key: "subs", label: "Suscriptores", target: 500, kind: "stock" },
    { key: "shorts_views_90d", label: "Vistas de Shorts (90 días)", target: 3000000, kind: "rolling", window: 90, pace_key: "shorts_views_per_day_28d" },
  ] },
};

// readiness(history, goal, nowMs). history: [{date:'YYYY-MM-DD', <key>:n|null, ...}] ascendente.
export function readiness(history, goal, nowMs = Date.now()) {
  if (!goal) return null;
  const hist = (Array.isArray(history) ? history : []).filter((h) => h && h.date);
  const today = dstr(nowMs);
  const last = hist.length ? hist[hist.length - 1] : {};
  const daysLeft = Math.max(0, Math.ceil((Date.parse(goal.deadline) - nowMs) / DAY));
  const reqs = goal.targets.map((t) => {
    const cur = num(last[t.key]);
    if (cur === null) {
      return { key: t.key, label: t.label, kind: t.kind || "stock", cur: null, target: t.target, pct: null, need: null,
        per_day_needed: null, per_day_actual: null, proj_date: null, on_track: null, done: false, missing: true };
    }
    const need = Math.max(0, t.target - cur);
    const pct = Math.min(100, Math.floor((cur / t.target) * 100));
    let perDayNeeded, perDayActual = null, projDate = null;
    if (t.kind === "rolling") {
      perDayNeeded = t.target / t.window;
      const recent = t.pace_key ? num(last[t.pace_key]) : null;   // ritmo actual (28 días) si existe
      perDayActual = recent !== null ? recent : cur / t.window;
    } else {
      perDayNeeded = daysLeft > 0 ? need / daysLeft : need;
      const win = hist.filter((h) => (Date.parse(today) - Date.parse(h.date)) / DAY <= 7 && num(h[t.key]) !== null);
      if (win.length >= 2) {
        const a = win[0], b = win[win.length - 1];
        const dd = (Date.parse(b.date) - Date.parse(a.date)) / DAY;
        if (dd > 0) perDayActual = (num(b[t.key]) - num(a[t.key])) / dd;
      }
      if (perDayActual > 0 && need > 0) projDate = dstr(nowMs + Math.ceil(need / perDayActual) * DAY);
    }
    const done = cur >= t.target;
    const onTrack = done ? true : (perDayActual == null ? null : perDayActual >= perDayNeeded);
    return { key: t.key, label: t.label, kind: t.kind || "stock", cur, target: t.target, pct, need,
      per_day_needed: Math.max(0, Math.round(perDayNeeded * 100) / 100),
      per_day_actual: perDayActual == null ? null : Math.round(perDayActual * 100) / 100,
      proj_date: projDate, on_track: onTrack, done, missing: false };
  });
  const present = reqs.filter((r) => !r.missing);
  const allDone = reqs.length > 0 && reqs.every((r) => r.done);
  const behind = present.some((r) => !r.done && r.on_track === false);
  const measuring = present.some((r) => !r.done && r.on_track === null);
  const missing = reqs.some((r) => r.missing);
  const status = allDone ? "done" : behind ? "behind" : missing ? "sin_dato" : measuring ? "measuring" : "ontrack";
  return { path: goal.path, deadline: goal.deadline, days_left: daysLeft, status, reqs };
}

// Acción según el requisito que limita. Sin recetas de "más volumen": el volumen solo si no diluye.
const ACTION_BY_KEY = {
  subs: "Sube la conversión a suscriptor: serie reconocible, CTA al final y temas que invitan a volver. Mide suscriptores por video.",
  watch_hours_365d: "Sube horas sin Shorts: retención del primer minuto y duración de los videos largos.",
  shorts_views_90d: "Sube la mediana de vistas por Short (gancho de 1 segundo, nicho con mejor mediana). Más volumen solo si la cohorte reciente no rinde peor.",
};

// warRoom(readiness): foco = requisito atrasado con dato; sin dato se declara como tal (no se inventa foco).
export function warRoom(rd, opts = {}) {
  if (!rd) return null;
  const windowDays = opts.windowDays || 60;
  const active = rd.status !== "done" && (rd.days_left <= windowDays || rd.status === "behind");
  const pending = rd.reqs.filter((r) => !r.done && !r.missing);
  const focusReq = pending.slice().sort((a, b) => {
    const ax = a.on_track === false ? 0 : 1, bx = b.on_track === false ? 0 : 1;
    return ax - bx || a.pct - b.pct;
  })[0] || null;
  const behindCount = pending.filter((r) => r.on_track === false).length;
  const missing = rd.reqs.filter((r) => r.missing).map((r) => r.key);
  let risk = "bajo";
  if (rd.status === "done") risk = "ninguno";
  else if (behindCount >= 2 || (behindCount >= 1 && rd.days_left <= 30)) risk = "alto";
  else if (behindCount >= 1 || rd.status === "measuring" || missing.length) risk = "medio";
  const order = ["watch_hours_365d", "subs", "shorts_views_90d"];
  const priorities = pending.slice().sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((r) => r.key);
  return {
    active, window_days: windowDays, days_left: rd.days_left, status: rd.status, risk,
    focus: focusReq ? focusReq.key : null,
    focus_label: focusReq ? focusReq.label : null,
    next_action: focusReq ? (ACTION_BY_KEY[focusReq.key] || `Avanza ${focusReq.label}.`) : (missing.length ? `Sin dato de ${missing.join(", ")}: primero medir.` : "Meta cumplida."),
    missing,
    priorities,
  };
}

export function reportChannel(name, rd, wr) {
  if (!rd) return `${name}: sin datos.`;
  const icon = { done: "✅", ontrack: "🟢", measuring: "🟡", behind: "🔴", sin_dato: "⚪" }[rd.status] || "•";
  const lines = [`${icon} ${name} — ${rd.status.toUpperCase()} · ${rd.days_left}d al plazo · riesgo ${wr ? wr.risk : "?"}`];
  for (const r of rd.reqs) {
    if (r.missing) { lines.push(`  ⚪ ${r.label}: sin dato`); continue; }
    const mark = r.done ? "✅" : r.on_track === false ? "🔴" : r.on_track ? "🟢" : "🟡";
    const pace = r.per_day_actual != null ? ` · ritmo ${r.per_day_actual.toLocaleString("es")}/día vs ${r.per_day_needed.toLocaleString("es")} necesario` : "";
    const proj = r.proj_date ? ` · proy ${r.proj_date}` : "";
    lines.push(`  ${mark} ${r.label}: ${r.cur.toLocaleString("es")}/${r.target.toLocaleString("es")} (${r.pct}%)${pace}${proj}`);
  }
  if (wr && wr.active) lines.push(`  🎯 Foco: ${wr.focus_label || "medir"} — ${wr.next_action}`);
  return lines.join("\n");
}
