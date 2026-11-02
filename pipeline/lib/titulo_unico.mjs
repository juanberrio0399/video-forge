// titulo_unico.mjs — puerta final contra títulos repetidos en Oddly Loop. Se usa en youtube_upload
// con TITULO_UNICO=1 (solo los workflows de Oddly).
//
// Por qué aquí: la guarda del guionista comparaba contra channel/auto2/titles.json, que solo escribe
// produce_oddly y que las corridas en paralelo se pisan (202 títulos para 597 videos al 2026-11-02).
// Clippers y space_* no revisaban nada. Resultado: 46 títulos repetidos en 118 videos. Antes de subir
// se compara contra TODOS los videos del canal (públicos, privados y programados), leídos de YouTube.

import { normalizar } from "./titulos.mjs";

/** Títulos de todos los videos del canal (uploads playlist). ~1 unidad de cuota por cada 50 videos. */
export async function titulosDelCanal(token, fetchFn = fetch) {
  const get = async (url) => {
    const r = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const ch = await get("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true");
  const up = ch.items && ch.items[0] && ch.items[0].contentDetails.relatedPlaylists.uploads;
  if (!up) throw new Error("sin playlist de subidas");
  const titulos = [];
  let page = "";
  do {
    const j = await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${up}&pageToken=${page}`);
    for (const it of j.items || []) if (it.snippet && it.snippet.title) titulos.push(it.snippet.title);
    page = j.nextPageToken || "";
  } while (page && titulos.length < 5000);
  return titulos;
}

/** El título repetido de `usados` (comparado normalizado), o null si es nuevo. */
export function repetido(titulo, usados) {
  const t = normalizar(titulo);
  if (!t) return null;
  return (usados || []).find((u) => normalizar(u) === t) || null;
}
