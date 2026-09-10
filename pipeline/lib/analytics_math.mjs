// analytics_math.mjs — utilidades PURAS de análisis (sin red, sin R2, deterministas).
// Base para los BASELINES de la Fase 1. NO cambia ningún comportamiento existente:
// nadie lo importa todavía. Solo aporta funciones testeables (semilla de la red de tests).

// Lunes (UTC) de la semana ISO de una fecha "YYYY-MM-DD".
export function mondayUTC(dstr) {
  const dt = new Date(dstr + "T00:00:00Z");
  const back = (dt.getUTCDay() + 6) % 7; // 0 = lunes
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

// Mediana de una lista de números (ignora no-finitos). [] -> null.
export function median(values) {
  const xs = (values || []).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

// Delta % de un valor vs una base. Base 0 o inválida -> null.
export function pctVsBaseline(value, baseline) {
  const v = Number(value), b = Number(baseline);
  if (!Number.isFinite(v) || !Number.isFinite(b) || b === 0) return null;
  return Math.round(((v - b) / b) * 100);
}

// Confianza por tamaño de muestra (0..1): crece con n y satura. Para "knowledge confidence" (Fase 1).
// n = k -> 0.5 ; n = 3k -> 0.75. Nunca supera 1.
export function sampleConfidence(n, k = 10) {
  const x = Math.max(0, Number(n) || 0);
  return Math.round((x / (x + k)) * 100) / 100;
}
