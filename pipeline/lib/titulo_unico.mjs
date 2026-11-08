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

/** Une sin repetir (comparando normalizado) los títulos que ya había con los del canal (que llegan del más
 *  nuevo al más viejo). Los del canal quedan al FINAL, del más viejo al más nuevo: el guionista muestra a la
 *  IA los últimos 60, así ve los más recientes. */
export function unirTitulos(previos, delCanalNuevoPrimero) {
  const vistos = new Set(), out = [];
  const meter = (t) => { const k = normalizar(t); if (!k || vistos.has(k)) return; vistos.add(k); out.push(t); };
  const canal = [...(delCanalNuevoPrimero || [])].reverse();
  const enCanal = new Set(canal.map(normalizar));
  for (const t of previos || []) if (!enCanal.has(normalizar(t))) meter(t);
  for (const t of canal) meter(t);
  return out;
}

/** Access token de YouTube con el refresh token del entorno (YT_CLIENT_ID/SECRET/REFRESH_TOKEN). 3 intentos. */
export async function tokenYouTube(env = process.env, fetchFn = fetch) {
  const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = env;
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) throw new Error("faltan credenciales de YouTube");
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchFn("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(20000),
        body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.access_token) return j.access_token;
    } catch {}
    await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
  }
  throw new Error("no pude obtener el token de YouTube");
}
