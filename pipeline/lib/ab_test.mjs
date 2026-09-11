// ab_test.mjs — A/B sistemático de UNA variable a la vez (Growth Roadmap Fase 3). PURO y testeable.
// YouTube no da A/B nativo para Shorts, así que se hace por COHORTES: cada video real trae su variante
// (p. ej. hook_type sale del título), se agrupa por variante, se mide una métrica (vs_baseline_pct)
// y se decide GANADOR cuando hay muestra y diferencia suficientes. Honesto: sin p-values de mentira
// en muestras chicas — usamos tamaño de efecto (lift) + un umbral de confianza por muestra.
import { median, sampleConfidence } from "./analytics_math.mjs";

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Agrupa los videos (maduros) por el valor de `variable`, restringido a `variants`.
export function groupByVariant(videos, variable, variants) {
  const g = {}; for (const v of variants) g[v] = [];
  for (const vid of videos || []) {
    if (vid && vid.mature !== false) {
      const val = vid[variable];
      if (g[val]) g[val].push(vid);
    }
  }
  return g;
}

// Métrica por variante: n, media y mediana del campo `metric` (números finitos).
export function measure(groups, metric) {
  const out = {};
  for (const [k, arr] of Object.entries(groups)) {
    const vals = arr.map((v) => Number(v[metric])).filter((x) => Number.isFinite(x));
    out[k] = { n: vals.length, mean: Math.round(mean(vals) * 10) / 10, median: median(vals) };
  }
  return out;
}

// Decide entre DOS variantes. verdict: RUNNING (falta muestra) / WINNER:<v> / INCONCLUSIVE.
// minLift = diferencia mínima de medias (en las unidades de la métrica) para llamar ganador.
export function decide(measured, opts = {}) {
  const variants = Object.keys(measured);
  const minPer = opts.minPerVariant != null ? opts.minPerVariant : 4;
  const minLift = opts.minLift != null ? opts.minLift : 20;
  if (variants.length < 2) return { verdict: "RUNNING", reason: "faltan variantes", leader: null };
  const [a, b] = variants;
  const A = measured[a], B = measured[b];
  if (A.n < minPer || B.n < minPer) {
    return { verdict: "RUNNING", reason: `muestra insuficiente (${a}:${A.n}, ${b}:${B.n} < ${minPer})`, leader: null, lift: null, confidence: sampleConfidence(Math.min(A.n, B.n)) };
  }
  // MEDIANA (no media): robusta a videos virales que inflan el promedio -> A/B honesto.
  const stat = (m) => (Number.isFinite(m.median) ? m.median : m.mean);
  const leader = stat(A) >= stat(B) ? a : b;
  const other = leader === a ? b : a;
  const lift = Math.round((stat(measured[leader]) - stat(measured[other])) * 10) / 10;
  const confidence = sampleConfidence(Math.min(A.n, B.n));
  if (lift >= minLift) {
    return { verdict: `WINNER:${leader}`, leader, lift, confidence, reason: `${leader} supera a ${other} por ${lift} (>= ${minLift})` };
  }
  return { verdict: "INCONCLUSIVE", leader, lift, confidence, reason: `diferencia ${lift} < ${minLift}` };
}

// Corre un experimento completo. exp: { id, variable, variants:[A,B], metric, min_per_variant, min_lift }.
export function runExperiment(videos, exp) {
  const variants = (exp.variants || []).slice(0, 2);
  const groups = groupByVariant(videos, exp.variable, variants);
  const measured = measure(groups, exp.metric);
  const decision = decide(measured, { minPerVariant: exp.min_per_variant, minLift: exp.min_lift });
  return {
    id: exp.id, variable: exp.variable, metric: exp.metric, variants,
    measured, ...decision,
  };
}
