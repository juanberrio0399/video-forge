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
