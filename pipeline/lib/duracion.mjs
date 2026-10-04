// duracion.mjs — leer la duracion ISO8601 de YouTube y distinguir Short de largo.
//
// Por que existe: `idle_check.mjs` decidia si tocaba producir un video largo mirando
// "horas desde el ULTIMO video subido al canal", sin filtrar por tipo. Desde que The Data
// Lens publica Shorts a diario, siempre habia un video de hace pocas horas, asi que la
// guarda de 18h nunca se abria y `produce_video.yml` dejo de correr el 2026-08-21.
// La guarda preguntaba "se subio algo?" cuando queria preguntar "hace rato que no hay un
// LARGO?". Los Shorts la satisfacian siempre.

/** Segundos de una duracion ISO8601 de la API de YouTube ("PT1M30S", "P1DT2H"). */
export function segundosISO(d) {
  const m = String(d || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

// YouTube admite Shorts de hasta 3 minutos. Se usa ese corte, no uno propio, para que
// "largo" signifique aqui lo mismo que para la plataforma.
export const SEGUNDOS_SHORT = 180;

/** ¿Es un video largo (no un Short)? Duracion 0/desconocida -> NO cuenta como largo. */
export function esLargo(segundos) {
  const s = Number(segundos) || 0;
  return s > SEGUNDOS_SHORT;
}
