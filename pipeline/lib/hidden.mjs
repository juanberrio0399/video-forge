// hidden.mjs — lista de videos OCULTOS: nunca se programan ni se publican. Regla de Juan: lo oculto no sale.
// Falla CERRADO: si la lista no se puede leer o no es válida devuelve null, y quien la usa NO programa nada.
import fs from "node:fs";

export function parseHidden(text) {
  try {
    const j = JSON.parse(text);
    return Array.isArray(j) && j.every((x) => typeof x === "string") ? new Set(j) : null;
  } catch { return null; }
}

export function readHiddenFile(path) {
  try { return parseHidden(fs.readFileSync(path, "utf8")); } catch { return null; }
}

// Videos privados, sin fecha de publicación futura y que no estén ocultos. Sin lista válida: ninguno.
export function backlogToSchedule(videos, hidden, nowMs = Date.now()) {
  if (!(hidden instanceof Set)) return [];
  return (videos || []).filter((v) => {
    const st = (v && v.status) || {};
    const scheduled = st.publishAt && Date.parse(st.publishAt) > nowMs;
    return v && v.id && st.privacyStatus !== "public" && !scheduled && !hidden.has(v.id);
  }).map((v) => v.id);
}
