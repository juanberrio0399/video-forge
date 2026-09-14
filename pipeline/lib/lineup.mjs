// lineup.mjs — PLAN DE MAÑANA (Brain OS "en vivo"). PURO y testeable.
// El cerebro no fabrica todo 10 minutos antes: rehace el plan del día siguiente cada pocas horas con lo
// último que sabe (reparto ejecutado, banco de ideas, experimento activo, lo ya programado) y lo produce
// con horas de anticipación. Cada pieza del plan es una DECISIÓN auditable:
//   DECISIÓN → RAZÓN → EVIDENCIA → ACCIÓN → MÉTRICA → PLAZO → CRITERIO DE ÉXITO → SIGUIENTE DECISIÓN
// Además separa lo que el cerebro SABE, CREE, DESCONOCE y está COMPROBANDO (auditoría: incertidumbre).
import { etOffsetHours, bestHoursET } from "./queue.mjs";

const DAY = 86400000, HOUR = 3600000;

// Fecha ET (YYYY-MM-DD) de un instante, desplazada `addDays`.
export function etDate(nowMs, addDays = 0) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(nowMs));
  const y = +p.find((x) => x.type === "year").value, m = +p.find((x) => x.type === "month").value, d = +p.find((x) => x.type === "day").value;
  const t = new Date(Date.UTC(y, m - 1, d + addDays, 12));
  return t.toISOString().slice(0, 10);
}

// Franjas (ms UTC) de un día ET con las horas dadas (o las investigadas por día de la semana).
export function daySlots(dateStr, hoursET) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const off = etOffsetHours(noon);
  const hours = hoursET && hoursET.length ? hoursET : bestHoursET(noon.getUTCDay());
  return hours.map((h) => Date.UTC(y, m - 1, d, h - off, 0, 0)).sort((a, b) => a - b);
}

// Reparto intercalado (round-robin ponderado suave): el mismo nicho no sale en bloque.
export function interleave(allocation) {
  const w = Object.entries(allocation || {}).filter(([, n]) => +n > 0).map(([k, n]) => ({ k, n: +n, cur: 0 }));
  const total = w.reduce((a, x) => a + x.n, 0);
  const out = [];
  for (let i = 0; i < total; i++) {
    w.forEach((x) => { x.cur += x.n; });
    const best = w.slice().sort((a, b) => b.cur - a.cur || a.k.localeCompare(b.k))[0];
    best.cur -= total; out.push(best.k);
  }
  return out;
}

const fmtET = (ms) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
const confidenceOf = (n) => (n >= 15 ? "media" : n >= 5 ? "baja" : "muy baja");

// input: {
//   nowMs, date, hoursET, perSlot, allocation, niches:{key:{label,median_vpd,n,rel,why}}, channelMedianVpd,
//   variants:{key:variant}, bank:[{id,text,state,priority,channel}], experiment:{id,variable,arms,hypothesis,niche},
//   scheduled:[{video_id,title,publish_at,niche}], producing:[{slot_utc,niche,run_url,claimed_at}], missing:[keys],
//   d7Median, channel
// }
export function buildLineup(input = {}) {
  const nowMs = input.nowMs != null ? input.nowMs : Date.now();
  const date = input.date || etDate(nowMs, 1);
  const perSlot = Math.max(1, Math.min(2, Math.floor(+input.perSlot || 1)));
  const slots = daySlots(date, input.hoursET);
  const niches = input.niches || {};
  const seqAll = interleave(input.allocation || {});
  const capacity = Math.min(seqAll.length, slots.length * perSlot);
  const seq = seqAll.slice(0, capacity);

  // Slots expandidos (perSlot por franja), en orden temporal.
  const slotList = [];
  slots.forEach((s) => { for (let i = 0; i < perSlot; i++) slotList.push(s); });

  // Ideas del banco para este canal, mejor priorizadas primero, sin repetir, y SOLO donde encajan:
  // idea con nicho -> ese nicho; hook/título/formato (genéricas) -> cualquiera; idea de tema sin nicho ->
  // solo el nicho líder. Una pieza en experimento de gancho no recibe ideas de gancho (una variable).
  const ideas = (input.bank || []).filter((b) => b && b.state === "BACKLOG" && (!b.channel || b.channel === (input.channel || "auto2")))
    .sort((a, b) => (+b.priority || 0) - (+a.priority || 0));
  const usedIdeas = new Set();
  const leaderKey = Object.entries(input.allocation || {}).sort((a, b) => b[1] - a[1])[0];
  const fits = (idea, nicheKey, inExperiment) => {
    if (inExperiment && idea.kind === "hook") return false;
    if (idea.niche) return idea.niche === nicheKey;
    if (["hook", "title", "format"].includes(idea.kind)) return true;
    return !!leaderKey && leaderKey[0] === nicheKey;
  };

  // Experimento: UNA variable, solo en un nicho; el resto es control (no cambia nada más).
  const exp = input.experiment && input.experiment.id && Array.isArray(input.experiment.arms) && input.experiment.arms.length === 2 ? input.experiment : null;
  let armToggle = 0;

  const scheduled = (input.scheduled || []).map((v) => ({ ...v, t: Date.parse(v.publish_at) })).filter((v) => Number.isFinite(v.t));
  const used = new Set();
  const producing = input.producing || [];

  const items = seq.map((nicheKey, i) => {
    const slot = slotList[i];
    const meta = niches[nicheKey] || {};
    const label = meta.label || nicheKey;
    // Reconciliación: video programado cerca de la franja (mismo nicho primero).
    const near = scheduled.filter((v) => !used.has(v.video_id) && Math.abs(v.t - slot) <= 40 * 60000);
    const match = near.find((v) => v.niche === nicheKey) || near[0] || null;
    if (match) used.add(match.video_id);
    const claim = producing.find((p) => Math.abs(Date.parse(p.slot_utc) - slot) < 60000 && p.niche === nicheKey);
    let status;
    if (match) status = slot <= nowMs ? "publicado" : "programado";
    else if (claim) status = "produciendo";
    else if (slot <= nowMs) status = "vencido";
    else if (slot - nowMs < 2.5 * HOUR) status = "sin_tiempo";
    else status = "planeado";

    let experiment = null;
    if (exp && (!exp.niche || exp.niche === nicheKey)) { experiment = { id: exp.id, variable: exp.variable, arm: exp.arms[armToggle % 2] }; armToggle++; }
    let idea = null;
    if (!match && status !== "vencido") {
      idea = ideas.find((c) => !usedIdeas.has(c.id || c.text) && fits(c, nicheKey, !!experiment)) || null;
      if (idea) usedIdeas.add(idea.id || idea.text);
    }

    const criterionText = input.d7Median != null
      ? `≥ ${Math.round(input.d7Median)} vistas al día 7 (mediana del canal)`
      : "≥ mediana del canal al día 7 (se fija cuando haya 5 videos medidos a esa edad)";
    const actionByStatus = {
      planeado: "Producir con horas de anticipación y programar en esta franja",
      produciendo: "En producción ahora; se programa en esta franja al terminar",
      programado: "Listo y programado; se publica solo",
      publicado: "Publicado; medir al día 3 y al día 7",
      sin_tiempo: "Sin margen para producir con calidad: se omite (no se fabrica a última hora)",
      vencido: "La franja pasó sin video: no se recupera, cuenta como hueco del plan",
    };
    return {
      slot_utc: new Date(slot).toISOString(), slot_et: fmtET(slot),
      niche: nicheKey, niche_label: label, variant: (input.variants || {})[nicheKey] || null,
      status,
      video_id: match ? match.video_id : null, title: match ? match.title : null,
      idea: idea ? { id: idea.id, text: idea.text, priority: idea.priority } : null,
      experiment,
      confidence: confidenceOf(+meta.n || 0),
      record: {
        decision: `Short de ${label} a las ${fmtET(slot)} ET`,
        reason: meta.why || "cupo del reparto semanal ejecutado",
        evidence: meta.median_vpd != null ? `mediana ${meta.median_vpd} vistas/día en la cohorte, n=${meta.n}${meta.rel != null ? `, ${meta.rel}x el canal` : ""}` : "sin muestra suficiente en la cohorte",
        action: actionByStatus[status],
        metric: "vistas al día 7",
        deadline: new Date(slot + 7 * DAY).toISOString().slice(0, 10),
        criterion: criterionText,
        next: experiment ? `cierra el brazo "${experiment.arm}" del experimento ${experiment.id}` : "si 2 de cada 3 del nicho quedan bajo el criterio, el reparto del lunes le quita cupos",
      },
    };
  });

  const count = (s) => items.filter((x) => x.status === s).length;
  const knowledge = buildKnowledge(input, niches);
  return {
    channel: input.channel || "auto2", date, generated_at: new Date(nowMs).toISOString(),
    per_slot: perSlot, slots: slots.map((s) => new Date(s).toISOString()), capacity,
    planned_total: seqAll.length, trimmed: seqAll.length - capacity,
    items,
    summary: { planeado: count("planeado"), produciendo: count("produciendo"), programado: count("programado"), publicado: count("publicado"), sin_tiempo: count("sin_tiempo"), vencido: count("vencido") },
    experiment: exp,
    knowledge,
  };
}

// Sabe / cree / desconoce / comprobando — sin inventar certeza.
export function buildKnowledge(input = {}, niches = {}) {
  const sabe = [], cree = [], desconoce = [], comprobando = [];
  const rows = Object.entries(niches);
  if (input.channelMedianVpd != null) sabe.push(`La mediana del canal es ${input.channelMedianVpd} vistas/día en videos de 5 a 30 días.`);
  rows.filter(([, m]) => m.n >= 5 && m.median_vpd != null).forEach(([, m]) => sabe.push(`${m.label}: mediana ${m.median_vpd}/día con ${m.n} videos.`));
  rows.filter(([, m]) => m.n >= 5 && m.rel != null && m.rel >= 1.3).forEach(([, m]) => cree.push(`${m.label} rinde por encima del canal (${m.rel}x). Es una creencia: falta confirmarlo en dos cohortes seguidas.`));
  rows.filter(([, m]) => (m.n || 0) < 5).forEach(([, m]) => desconoce.push(`Si ${m.label} funciona: solo ${m.n || 0} videos comparables.`));
  (input.missing || []).forEach((k) => desconoce.push(`Métrica sin dato: ${k}.`));
  if (input.d7Median == null) desconoce.push("Vistas al día 7 de referencia: aún no hay 5 videos medidos a esa edad.");
  if (input.experiment && input.experiment.hypothesis) comprobando.push(input.experiment.hypothesis);
  return { sabe, cree, desconoce, comprobando };
}

// Qué producir AHORA: piezas planeadas con margen (ni última hora ni demasiado lejos), primero las más cercanas.
export function pickToProduce(lineups, nowMs = Date.now(), opts = {}) {
  const max = opts.max != null ? opts.max : 3;
  const minLead = (opts.minLeadHours != null ? opts.minLeadHours : 3) * HOUR;
  const maxLead = (opts.maxLeadHours != null ? opts.maxLeadHours : 40) * HOUR;
  const all = [];
  for (const l of lineups || []) for (const it of (l && l.items) || []) {
    const t = Date.parse(it.slot_utc);
    if (it.status === "planeado" && t - nowMs >= minLead && t - nowMs <= maxLead) all.push(it);
  }
  return all.sort((a, b) => Date.parse(a.slot_utc) - Date.parse(b.slot_utc)).slice(0, max);
}

// Diferencias entre el plan anterior y el nuevo -> pensamientos para la bitácora.
export function diffLineups(prev, next) {
  const out = [];
  if (!next) return out;
  const tally = (l) => { const c = {}; ((l && l.items) || []).forEach((i) => { c[i.niche_label || i.niche] = (c[i.niche_label || i.niche] || 0) + 1; }); return c; };
  if (!prev || prev.date !== next.date) {
    const t = tally(next);
    out.push(`Armé el plan del ${next.date}: ${next.items.length} Shorts (${Object.entries(t).map(([k, v]) => `${v} ${k}`).join(", ")}).`);
    if (next.trimmed > 0) out.push(`Recorté ${next.trimmed} piezas del reparto: solo caben ${next.capacity} en las franjas del día.`);
    return out;
  }
  const a = tally(prev), b = tally(next);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const moved = keys.filter((k) => (a[k] || 0) !== (b[k] || 0)).map((k) => `${k} ${a[k] || 0}→${b[k] || 0}`);
  if (moved.length) out.push(`Ajusté el plan del ${next.date}: ${moved.join(", ")}.`);
  const st = (l, s) => ((l && l.summary) || {})[s] || 0;
  const newlyScheduled = st(next, "programado") - st(prev, "programado");
  if (newlyScheduled > 0) out.push(`${newlyScheduled} pieza(s) del plan del ${next.date} quedaron listas y programadas.`);
  const lost = st(next, "sin_tiempo") - st(prev, "sin_tiempo");
  if (lost > 0) out.push(`${lost} pieza(s) del ${next.date} se quedaron sin margen y no se fabricarán a última hora.`);
  return out;
}

export function journalAppend(journal, texts, nowMs = Date.now(), keep = 150, kind = "plan") {
  const j = Array.isArray(journal) ? journal.slice() : [];
  for (const t of texts || []) if (t) j.push({ at: new Date(nowMs).toISOString(), kind, text: t });
  return j.slice(-keep);
}
