// inventario.mjs — normaliza el inventario de videos, que llega en TRES formas distintas:
//   - cache del bot (channel/inventory_cache.json): { longs, shorts }
//   - estado de Data Lens (channel/state.json):     { published, shorts }  <- stats ANIDADOS
//   - estado de Oddly   (channel/auto2/state.json): { list }
//
// La tercera forma hacia falta porque el cache del bot NO es una fuente fiable: lo escribe
// el Worker de Telegram solo cuando alguien ABRE la app, y SIETE workflows lo borran a
// proposito para forzar el refresco. `episodes.mjs` encontraba el archivo ausente, sacaba
// "0 episodios", y el workflow restauraba la copia vieja de R2: todo el analisis de Data
// Lens llevaba 11 dias congelado, y la alerta "Pipeline parado" medi­a la edad del DATO.

/** Aplana los stats anidados de channel/state.json sin pisar valores ya planos. */
export function aplanar(v) {
  if (!v) return v;
  const st = v.stats || {};
  return {
    ...v,
    views: v.views != null ? v.views : (st.views || 0),
    likes: v.likes != null ? v.likes : (st.likes || 0),
    comments: v.comments != null ? v.comments : (st.comments || 0),
  };
}

/** Lista de videos lista para buildEpisode, venga el inventario en la forma que venga. */
export function normalizarInventario(data) {
  const d = data && typeof data === "object" ? data : {};
  let videos = [];
  if (Array.isArray(d.published)) videos = [...(d.published || []), ...(d.shorts || [])];
  else if (Array.isArray(d.longs) || Array.isArray(d.shorts)) videos = [...(d.longs || []), ...(d.shorts || [])];
  else if (Array.isArray(d.list)) videos = d.list;
  const vistos = new Set();
  return videos
    .map(aplanar)
    .filter((v) => v && v.video_id)
    // Un video puede estar en `published` y en `shorts` a la vez.
    .filter((v) => (vistos.has(v.video_id) ? false : (vistos.add(v.video_id), true)));
}
