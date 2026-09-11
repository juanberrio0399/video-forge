// queue.mjs — capacidad de publicación / profundidad de cola (Brain OS). PURO y testeable.
// Cierra el cuello del loop de aprendizaje: si ya hay >~1 día agendado, NO se produce más (la cola
// drena y el cerebro ve resultados a ~1 día en vez de a ~1 semana). Misma grilla de horas que
// best_slot.mjs (6 franjas ET/día, tope conceptual 1 por franja para no amontonar 2/hora de golpe).
const DAY = 86400000;

// Offset ET (maneja horario de verano) para una fecha dada.
export function etOffsetHours(d) {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
      .formatToParts(d).find((p) => p.type === "timeZoneName").value;
    const m = s.match(/GMT([+-]?\d{1,2})/); return m ? parseInt(m[1], 10) : -4;
  } catch { return -4; }
}
// Mismas franjas que best_slot.mjs (6/día; fin de semana / lunes / resto).
export function bestHoursET(dow) {
  if (dow === 0 || dow === 6) return [9, 11, 13, 15, 18, 20];
  if (dow === 1) return [11, 13, 15, 17, 19, 21];
  return [10, 12, 14, 16, 18, 20];
}

// Genera las franjas (ms UTC) de los próximos `days` días, con horas de datos si se pasan.
export function generateSlots(nowMs, days, dataHours) {
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const slots = [];
  for (let day = 0; day < days; day++) {
    const probe = new Date(nowMs + day * DAY);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(probe);
    const y = +parts.find((p) => p.type === "year").value, mo = +parts.find((p) => p.type === "month").value, da = +parts.find((p) => p.type === "day").value;
    const dow = dowMap[parts.find((p) => p.type === "weekday").value] ?? 2;
    const off = etOffsetHours(probe);
    for (const h of (dataHours && dataHours.length ? dataHours : bestHoursET(dow))) slots.push(Date.UTC(y, mo - 1, da, h - off, 0, 0));
  }
  return slots.sort((a, b) => a - b);
}

// Parsea el CSV de publishAt (lo emite scheduled_times.mjs) a ms futuros.
export function parseOccupied(csv, nowMs = Date.now()) {
  return String(csv || "").split(",").map((s) => Date.parse(s.trim())).filter((n) => !isNaN(n) && n > nowMs).sort((a, b) => a - b);
}

// Cupos LIBRES dentro de la ventana [ahora+minAheadH, ahora+bufferH]: franjas sin nada agendado
// cerca (±30 min). Es cuántos videos NUEVOS caben sin pasar el buffer -> el tope de producción de hoy.
// Devuelve además la foto de la cola (para mostrarla y para "cola consciente").
export function freeSlotsInWindow(occupiedCsv, opts = {}) {
  const nowMs = opts.nowMs || Date.now();
  const bufferH = opts.bufferHours != null ? +opts.bufferHours : 30;
  const minAheadH = opts.minAheadHours != null ? +opts.minAheadHours : 2;
  const dataHours = opts.dataHours || null;
  // perSlot = cupos por franja: 1 = ritmo cómodo; 2 = AGRESIVO (usa el tope real 2/hora de best_slot).
  // Cuando el canal va atrás de la meta, se sube a 2 para no frenar el volumen agresivo (12/día).
  const perSlot = Math.max(1, Math.min(2, Math.floor(+opts.perSlot || 1)));
  const occ = Array.isArray(occupiedCsv) ? occupiedCsv.slice().sort((a, b) => a - b) : parseOccupied(occupiedCsv, nowMs);
  const minMs = nowMs + minAheadH * 3600000;
  const maxMs = nowMs + bufferH * 3600000;
  const days = Math.ceil(bufferH / 24) + 2;
  const slots = generateSlots(nowMs, days, dataHours);
  const nearCount = (s) => occ.filter((o) => Math.abs(o - s) < 30 * 60 * 1000).length;
  let free = 0;
  for (const s of slots) {
    if (s < minMs || s > maxMs) continue;
    free += Math.max(0, perSlot - nearCount(s)); // cupos libres en la franja (hasta perSlot)
  }
  const scheduledAhead = occ.length;
  const lastPublishAt = occ.length ? new Date(occ[occ.length - 1]).toISOString() : null;
  const firstPublishAt = occ.length ? new Date(occ[0]).toISOString() : null;
  return { free, buffer_hours: bufferH, per_slot: perSlot, scheduled_ahead: scheduledAhead, first_publish_at: firstPublishAt, last_publish_at: lastPublishAt };
}
