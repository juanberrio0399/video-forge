// niche_map.mjs — lee el mapa video_id -> categoria del canal auto (Oddly), que ahora
// tambien guarda la VARIANTE de formato con la que se produjo cada video.
//
// Por que existe: el mapa era `{ "abc123": "animales_tiernos" }`, un string suelto. Con eso
// se puede rankear por categoria, pero NO se puede medir una pregunta de formato: "un hecho
// concreto rinde mas que una lista de 14?". El A/B por cohortes (lib/ab_test.mjs) agrupa por
// el valor de un campo del video, asi que la variante tiene que viajar con cada video.
//
// Compatibilidad: los ~518 videos ya publicados estan guardados como string. Esos siguen
// leyendose igual y quedan con variant=null (no entran en el A/B, que es lo correcto: no
// sabemos con que formato se hicieron). Los nuevos se guardan como { n, v }.

/** Normaliza una entrada del mapa, venga en formato viejo (string) o nuevo ({n, v}). */
export function leerEntrada(entrada) {
  if (typeof entrada === "string") return { niche: entrada || null, variant: null };
  if (entrada && typeof entrada === "object") {
    return {
      niche: entrada.n || entrada.niche || null,
      variant: entrada.v || entrada.variant || null,
    };
  }
  return { niche: null, variant: null };
}

/** Entrada nueva para guardar en el mapa. */
export function nuevaEntrada(niche, variant) {
  return { n: niche || null, v: variant || null };
}

/**
 * Pega `niche` y `variant` a cada video del inventario, leyendo el mapa.
 * No pisa lo que el video ya traiga: el mapa es la fuente, pero si el inventario
 * ya resolvio el dato, se respeta.
 */
export function anotarVideos(videos, mapa) {
  const m = mapa && typeof mapa === "object" ? mapa : {};
  return (videos || []).map((v) => {
    if (!v || !v.video_id) return v;
    const { niche, variant } = leerEntrada(m[v.video_id]);
    return { ...v, niche: v.niche || niche, variant: v.variant || variant };
  });
}

/** Cuantos videos del mapa tienen variante registrada (para saber si el A/B ya puede medir). */
export function conVariante(mapa) {
  const m = mapa && typeof mapa === "object" ? mapa : {};
  return Object.values(m).filter((e) => leerEntrada(e).variant).length;
}
