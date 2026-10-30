// produccion.mjs — cuantas corridas de produce_oddly sacaron video y cuantas no, y por que.
//
// Una corrida que se salta el video (el guion no salio) termina en VERDE: los pasos de despues
// quedan "skipped". Asi un error estuvo ~4 semanas tumbando 20 de 24 corridas al dia sin que
// nada lo marcara (2026-10-03 -> 2026-10-30). Esto lo cuenta para el reporte del canal.
//
// Cada corrida llega como { conclusion, subida, motivo }:
//   conclusion = la de la corrida en GitHub ("success" | "failure" | "cancelled" ...)
//   subida     = la del paso "Subir a Oddly Loop" ("success" | "skipped" | "failure" | null)
//   motivo     = texto de la advertencia "Oddly sin video" (si la hubo)

export const PASO_SUBIDA = "Subir a Oddly Loop";
export const TITULO_AVISO = "Oddly sin video";
const MIN_CORRIDAS_ALERTA = 4;   // con menos, una o dos sin video no dicen nada

export function clasificar({ conclusion, subida }) {
  if (subida === "success") return "video";
  if (conclusion === "success") return "sin_video";   // verde pero sin subir: el caso silencioso
  if (conclusion === "cancelled" || conclusion === "skipped") return "cancelada";
  return "fallida";                                    // ya sale en rojo en GitHub
}

export function resumir(corridas) {
  const r = { corridas: 0, videos: 0, sin_video: 0, fallidas: 0, canceladas: 0, motivos: {} };
  for (const c of corridas) {
    const tipo = clasificar(c);
    if (tipo === "cancelada") { r.canceladas++; continue; }  // no cuenta: la corto otra corrida
    r.corridas++;
    if (tipo === "video") r.videos++;
    else if (tipo === "fallida") r.fallidas++;
    else {
      r.sin_video++;
      const m = (c.motivo || "sin motivo registrado").trim().slice(0, 160);
      r.motivos[m] = (r.motivos[m] || 0) + 1;
    }
  }
  r.alerta = r.corridas >= MIN_CORRIDAS_ALERTA && r.videos * 2 < r.corridas;
  return r;
}

export function mensaje(r, horas = 24) {
  const motivos = Object.entries(r.motivos).sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `• ${n}x ${m}`).join("\n");
  return `⚠️ Oddly Loop: solo ${r.videos} video(s) en ${r.corridas} corridas de las últimas ${horas} h` +
    (r.sin_video ? `\n${r.sin_video} sin video (en verde en GitHub):\n${motivos}` : "") +
    (r.fallidas ? `\n${r.fallidas} fallida(s) (en rojo).` : "");
}
