// tope_dia.mjs — el tope diario de Shorts de Oddly (channel/auto2/variants.json -> tope_diario),
// aplicado donde se programa, que es por donde pasa TODO lo que se publica.
//
// Por que aqui: el tope de 6/dia (2026-10-24) solo lo respetaban brain_live y el rebalance al
// armar el plan. El blitz diario, el backlog y las franjas del plan programaban por su cuenta, y
// salian 15-23 Shorts al dia (semana del 26-oct: 99). best_slot y produce_oddly usan esto.
//
// Puro: sin red. El dia se cuenta en hora de Nueva York, igual que las franjas de best_slot.

import fs from "node:fs";

const DIA_ET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" del dia (hora de Nueva York) en que cae un instante en ms. */
export function diaET(ms) {
  return DIA_ET.format(new Date(ms));
}

/** Cuantos de los instantes (ms) caen en cada dia ET. */
export function porDia(instantes) {
  const m = {};
  for (const t of instantes) {
    if (!Number.isFinite(t)) continue;
    const d = diaET(t);
    m[d] = (m[d] || 0) + 1;
  }
  return m;
}

/** true si el dia de `slot` ya tiene `tope` o mas programados. Sin tope (0/NaN) nunca esta lleno. */
export function diaLleno(slot, ocupados, tope) {
  const t = Math.floor(+tope);
  if (!t || t < 1) return false;
  return (porDia(ocupados)[diaET(slot)] || 0) >= t;
}

/**
 * ¿Se produce otra pieza? No, si la cola ya cubre `dias` dias de tope: producir mas solo la
 * alarga (cada dia sigue saliendo `tope`) y los videos salen a una semana de hechos.
 */
export function colaLlena(ocupados, tope, dias = 2) {
  const t = Math.floor(+tope);
  if (!t || t < 1) return false;
  return ocupados.filter(Number.isFinite).length >= t * dias;
}

/** Lee tope_diario de un variants.json. 0 si no hay archivo o tope (= sin tope). */
export function leerTope(ruta) {
  if (!ruta) return 0;
  try { return Math.floor(+JSON.parse(fs.readFileSync(ruta, "utf8")).tope_diario) || 0; } catch { return 0; }
}
