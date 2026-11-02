// repetidos.mjs — arma el plan para renombrar los títulos repetidos que ya están en Oddly Loop.
//
// titulo_unico.mjs frena los repetidos NUEVOS desde el 2026-11-02, pero en el canal quedaron 46
// títulos repetidos en 118 videos. En cada grupo se queda con su título el video con más vistas
// (si empatan, el más viejo): es el que YouTube ya asoció a ese título. Los demás se renombran.

import { normalizar } from "./titulos.mjs";

/** Grupos de videos con el mismo título (normalizado). Ojo: la playlist de subidas repite ids
 *  entre páginas, así que se cuenta cada video una sola vez. */
export function agruparRepetidos(videos) {
  const unicos = new Map();
  for (const v of videos || []) if (v && v.id && !unicos.has(v.id)) unicos.set(v.id, v);
  const grupos = new Map();
  for (const v of unicos.values()) {
    const k = normalizar(v.title);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(v);
  }
  return [...grupos.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const orden = [...g].sort((a, b) => (b.views || 0) - (a.views || 0)
        || String(a.publishedAt || "").localeCompare(String(b.publishedAt || "")));
      return { titulo: orden[0].title, conserva: orden[0], renombrar: orden.slice(1) };
    })
    .sort((a, b) => b.renombrar.length - a.renombrar.length || a.titulo.localeCompare(b.titulo));
}

/** Hashtags del final del título ("... #Shorts #asmr") para conservarlos en el nombre nuevo. */
export function hashtagsFinales(titulo) {
  const m = String(titulo || "").match(/(\s+#[\p{L}\p{N}_]+)+\s*$/u);
  return m ? m[0].trim() : "";
}

/** Título nuevo con los hashtags del viejo, sin pasar los 100 caracteres de YouTube. */
export function conHashtags(nuevo, viejo) {
  const base = String(nuevo || "").replace(/(\s+#[\p{L}\p{N}_]+)+\s*$/u, "").trim();
  const tags = hashtagsFinales(viejo);
  const t = tags ? `${base} ${tags}` : base;
  return t.length <= 100 ? t : base.slice(0, 100).trim();
}
