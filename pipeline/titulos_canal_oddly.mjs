// titulos_canal_oddly.mjs — antes de escribir el guion, suma a oddly_titles.json los títulos REALES del canal
// (públicos, privados y programados), leídos de YouTube. El guionista solo veía titles.json + el inventario,
// que no trae los programados: la IA repetía títulos y la puerta final (youtube_upload, TITULO_UNICO) los
// frenaba con el video ya fabricado. Del 2026-10-25 al 2026-11-08 fueron 18 videos perdidos así.
//
// Deja los del canal al FINAL y del más viejo al más nuevo: el guionista muestra a la IA los últimos 60,
// así ve los más recientes. Si YouTube no responde, no rompe nada (la puerta final sigue cuidando).
// Uso: node pipeline/titulos_canal_oddly.mjs [oddly_titles.json]   Env: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
import fs from "node:fs";
import { titulosDelCanal, unirTitulos } from "./lib/titulo_unico.mjs";

async function token() {
  const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) throw new Error("faltan credenciales de YouTube");
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", {
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

{
  const archivo = process.argv[2] || "oddly_titles.json";
  let previos = [];
  try { previos = JSON.parse(fs.readFileSync(archivo, "utf8")); } catch {}
  if (!Array.isArray(previos)) previos = [];
  try {
    const canal = await titulosDelCanal(await token());
    const todos = unirTitulos(previos, canal);
    fs.writeFileSync(archivo, JSON.stringify(todos));
    console.log(`titulos usados: ${todos.length} (${canal.length} leídos del canal, incluidos privados y programados)`);
  } catch (e) {
    console.log(`::warning::No pude leer los títulos del canal (${e.message}); el guion usa la lista de R2 y la puerta final sigue revisando.`);
  }
}
