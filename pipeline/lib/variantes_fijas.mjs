// variantes_fijas.mjs — aplica el formato por nicho que decidio Juan (channel/auto2/variants.json)
// sobre la cadencia viva y sobre el experimento activo. Puro: sin red ni disco.
//
// Por que existe: la variante vivia en dos sitios que se pisan. rebalance_oddly.mjs copia
// cad.variant y despues le encima active.variant del experimento; y sync_cadence.yml sube el seed
// ENTERO, que pisa el reparto que el rebalance calculo con datos. Un cambio de formato no podia
// entrar sin arriesgar una de las dos cosas. Con esto, las decisiones de formato viven en un
// archivo propio que siempre gana, y lo demas de la cadencia no se toca.

/** Devuelve la cadencia con `variant` = lo que ya tenia + lo fijado (lo fijado gana). */
export function aplicarACadencia(cad = {}, fijas = {}) {
  const v = (fijas && fijas.variant) || {};
  if (!Object.keys(v).length) return cad;
  return { ...cad, variant: { ...((cad && cad.variant) || {}), ...v } };
}

/** Si el experimento activo es de un nicho fijado, su variante pasa a ser la fijada (si no, la pisaria). */
export function aplicarAExperimento(exp = {}, fijas = {}) {
  const v = (fijas && fijas.variant) || {};
  const a = exp && exp.active;
  if (!a || !a.key || !(a.key in v)) return exp;
  return { ...exp, active: { ...a, variant: v[a.key] } };
}

/**
 * Tope diario de Shorts (variants.json -> tope_diario). Reparte el tope en proporcion al reparto
 * que ya calculo el rebalance (resto mayor), sin dejar en 0 a un nicho que tenia cupos si el tope
 * alcanza para todos. Sin tope o si ya cabe, devuelve el reparto igual.
 * Por que: 12 Shorts/dia con plantilla es justo lo que YouTube llama "contenido inautentico /
 * producido en masa" (se evalua por canal) y ademas agota la cuota diaria de la API (2026-10-24).
 */
export function aplicarTope(spc = {}, tope) {
  const t = Math.floor(+tope);
  const total = Object.values(spc).reduce((a, b) => a + (+b || 0), 0);
  if (!t || t < 1 || total <= t) return { ...spc };
  const activos = Object.entries(spc).filter(([, n]) => +n > 0);
  const base = t >= activos.length ? 1 : 0;
  const resto = t - base * activos.length;
  const cuota = activos.map(([k, n]) => {
    const exacto = (resto * (+n)) / total;
    return { k, n: base + Math.floor(exacto), frac: exacto - Math.floor(exacto) };
  });
  let falta = t - cuota.reduce((a, c) => a + c.n, 0);
  for (const c of [...cuota].sort((a, b) => b.frac - a.frac)) { if (falta <= 0) break; c.n++; falta--; }
  const out = Object.fromEntries(Object.keys(spc).map((k) => [k, 0]));
  for (const c of cuota) out[c.k] = c.n;
  return out;
}
