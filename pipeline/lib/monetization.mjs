// monetization.mjs — Monetization Readiness + War Room 60 días (Brain OS Fase 6). PURO y testeable.
// Formaliza (y prueba, deuda CF1) la matemática que hoy vive en monetTrack del Worker: a partir del
// historial diario (monetization_history.json) + la meta del canal calcula, por objetivo, el gap, el
// ritmo real vs el necesario, la fecha proyectada y si va en camino; y sintetiza el estado del canal,
// el modo War Room (últimos ~60 días) con foco/riesgo/próxima-acción. Sin dependencias ni I/O.

const DAY = 86400000;
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);

// Metas YPP por canal (FUENTE DE VERDAD replicada de bot/src/index.js MONET_GOALS; mantener en sync).
export const MONET_GOALS = {
  "data-lens": { path: "longform", deadline: "2026-12-31", targets: [
    { key: "subs", label: "Suscriptores", target: 1000 },
    { key: "watch_hours", label: "Horas vistas", target: 4000 },
    { key: "views", label: "Vistas", target: 200000 },
    { key: "likes", label: "Likes", target: 3000 },
  ] },
  "auto2": { path: "shorts", deadline: "2026-12-31", targets: [
    { key: "subs", label: "Suscriptores", target: 1000 },
    { key: "shorts_views", label: "Vistas de Shorts", target: 10000000 },
    { key: "likes", label: "Likes", target: 100000 },
  ] },
};

// readiness(history, goal, nowMs): mismo criterio que monetTrack, pero PURO (deriva `current` del
// último snapshot). history: [{date:'YYYY-MM-DD', <key>:n, ...}] ordenado ascendente.
export function readiness(history, goal, nowMs = Date.now()) {
  if (!goal) return null;
  const hist = (Array.isArray(history) ? history : []).filter((h) => h && h.date);
  const today = dstr(nowMs);
  const last = hist.length ? hist[hist.length - 1] : {};
  const daysLeft = Math.max(0, Math.ceil((Date.parse(goal.deadline) - nowMs) / DAY));
  const win = hist.filter((h) => (Date.parse(today) - Date.parse(h.date)) / DAY <= 7); // ritmo de 7 días
  const reqs = goal.targets.map((t) => {
    const cur = Math.round(+last[t.key] || 0);
    const need = Math.max(0, t.target - cur);
    const pct = Math.min(100, Math.floor((cur / t.target) * 100));
    const perDayNeeded = daysLeft > 0 ? need / daysLeft : need;
    let perDayActual = null, projDate = null;
    if (win.length >= 2) {
      const a = win[0], b = win[win.length - 1];
      const dd = (Date.parse(b.date) - Date.parse(a.date)) / DAY;
      if (dd > 0) perDayActual = ((+b[t.key] || 0) - (+a[t.key] || 0)) / dd;
    }
    if (perDayActual > 0 && need > 0) projDate = dstr(nowMs + Math.ceil(need / perDayActual) * DAY);
    const done = cur >= t.target;
    const onTrack = done ? true : (perDayActual == null ? null : perDayActual >= perDayNeeded);
    return { key: t.key, label: t.label, cur, target: t.target, pct, need,
      per_day_needed: Math.max(0, Math.round((perDayNeeded) * 100) / 100),
      per_day_actual: perDayActual == null ? null : Math.round(perDayActual * 100) / 100,
      proj_date: projDate, on_track: onTrack, done };
  });
  const allDone = reqs.every((r) => r.done);
  const measuring = reqs.some((r) => !r.done && r.on_track === null);
  const behind = reqs.some((r) => !r.done && r.on_track === false);
  const status = allDone ? "done" : behind ? "behind" : measuring ? "measuring" : "ontrack";
  return { path: goal.path, deadline: goal.deadline, days_left: daysLeft, status, reqs };
}

// Acción concreta según el objetivo que más urge (no opinión: sale del métrico atrasado).
const ACTION_BY_KEY = {
  subs: "Empuja suscriptores: CTA de suscripción + colaboración/serie que fidelice.",
  watch_hours: "Sube horas vistas: retención (mejor hook 0-30s) y duración de los largos.",
  views: "Más vistas: volumen + hooks/títulos ganadores (mira decision.json/hooks).",
  shorts_views: "Más vistas de Shorts: dobla el nicho ganador y sube cadencia.",
  likes: "Más likes: pide el like en el momento de mayor retención.",
};

// warRoom(readiness): capa 60 días. Prioriza watch/subs/retención/velocidad; elige FOCO (lo más
// atrasado), RIESGO y la próxima acción. active si quedan <=windowDays o el canal va atrás.
export function warRoom(rd, opts = {}) {
  if (!rd) return null;
  const windowDays = opts.windowDays || 60;
  const active = rd.status !== "done" && (rd.days_left <= windowDays || rd.status === "behind");
  const pending = rd.reqs.filter((r) => !r.done);
  // Foco: primero los que van atrás (on_track===false), luego el de menor % de avance.
  const focusReq = pending.slice().sort((a, b) => {
    const ax = a.on_track === false ? 0 : 1, bx = b.on_track === false ? 0 : 1;
    return ax - bx || a.pct - b.pct;
  })[0] || null;
  const behindCount = pending.filter((r) => r.on_track === false).length;
  let risk = "bajo";
  if (rd.status === "done") risk = "ninguno";
  else if (behindCount >= 2 || (behindCount >= 1 && rd.days_left <= 30)) risk = "alto";
  else if (behindCount >= 1 || rd.status === "measuring") risk = "medio";
  // Prioridades del modo (orden del audit: watch -> subs -> retención -> velocidad).
  const order = ["watch_hours", "subs", "shorts_views", "views", "likes"];
  const priorities = pending.slice().sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((r) => r.key);
  return {
    active, window_days: windowDays, days_left: rd.days_left, status: rd.status, risk,
    focus: focusReq ? focusReq.key : null,
    focus_label: focusReq ? focusReq.label : null,
    next_action: focusReq ? (ACTION_BY_KEY[focusReq.key] || `Avanza ${focusReq.label}.`) : "Meta cumplida.",
    priorities,
  };
}

// Reporte formateado (Telegram/dashboard) para un canal.
export function reportChannel(name, rd, wr) {
  if (!rd) return `${name}: sin datos.`;
  const icon = { done: "✅", ontrack: "🟢", measuring: "🟡", behind: "🔴" }[rd.status] || "•";
  const lines = [`${icon} ${name} — ${rd.status.toUpperCase()} · ${rd.days_left}d al plazo · riesgo ${wr ? wr.risk : "?"}`];
  for (const r of rd.reqs) {
    const mark = r.done ? "✅" : r.on_track === false ? "🔴" : r.on_track ? "🟢" : "🟡";
    const proj = r.proj_date ? ` · proy ${r.proj_date}` : "";
    lines.push(`  ${mark} ${r.label}: ${r.cur.toLocaleString("es")}/${r.target.toLocaleString("es")} (${r.pct}%)${proj}`);
  }
  if (wr && wr.active) lines.push(`  🎯 Foco: ${wr.focus_label} — ${wr.next_action}`);
  return lines.join("\n");
}
