// radar_filtro.mjs — filtros del radar ANTES de crear un issue. Puro: sin red, sin disco, sin gh.
//
// Por que existe (auditoria 2026-10-21): de ~200 issues abiertos del radar, varios de los
// "importantes" eran falsos o ya estaban hechos. Causas: el modelo solo veia README + arbol (no
// el codigo que criticaba), no sabia la fecha (llamo "futura" a una de 2026), y el anti-duplicados
// solo miraba los ABIERTOS, asi que lo que se cerraba por falso volvia a proponerse.

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const palabras = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 3));

/** Duplicado si se parece (Jaccard > 0.55) a CUALQUIER titulo conocido, abierto o cerrado. */
export function esDuplicado(titulo, conocidos = []) {
  const a = palabras(titulo);
  for (const t of conocidos) {
    if (norm(t) === norm(titulo)) return true;
    const b = palabras(t);
    if (!a.size || !b.size) continue;
    let inter = 0; for (const w of a) if (b.has(w)) inter++;
    if (inter / (a.size + b.size - inter) > 0.55) return true;
  }
  return false;
}

/** La ruta citada tiene que existir en el repo (archivo o carpeta). Sin ruta real, no hay issue. */
export function ubicacionValida(loc, archivos = []) {
  const p = String(loc || "").replace(/`/g, "").split(/[:#\s]/)[0].replace(/^\.?\//, "").replace(/\/$/, "");
  if (!p) return null;
  if (archivos.includes(p)) return p;
  return archivos.some((f) => f.startsWith(p + "/")) ? p : null;
}

// Tipos que AFIRMAN algo sobre el codigo actual: esos se verifican contra el archivo real.
const VERIFICABLES = new Set(["Error/Bug", "Seguridad", "Dependencia", "Deprecation", "Mejora"]);
export function necesitaVerificacion(tipo) { return VERIFICABLES.has(tipo); }

/** Lee la respuesta del verificador: {"existe": bool, "evidencia": "..."}. Si no se entiende, NO pasa. */
export function veredicto(texto) {
  if (!texto) return { existe: false, evidencia: "sin respuesta del verificador" };
  const s = String(texto).replace(/```json|```/g, "");
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  try {
    const o = JSON.parse(s.slice(i, j + 1));
    return { existe: o.existe === true, evidencia: String(o.evidencia || "").slice(0, 400) };
  } catch { return { existe: false, evidencia: "respuesta ilegible del verificador" }; }
}

/** Prompt del verificador: el hallazgo + el codigo real del archivo citado. */
export function promptVerificacion(hallazgo, ruta, codigo, hoy) {
  return `Hoy es ${hoy}. Eres un revisor escéptico. Un radar automático afirma lo siguiente sobre el archivo \`${ruta}\`:

TÍTULO: ${hallazgo.title}
DESCRIPCIÓN: ${hallazgo.description}
ACCIÓN SUGERIDA: ${hallazgo.action}

Este es el contenido REAL y actual de \`${ruta}\`:
<<<
${codigo}
>>>

¿El problema descrito EXISTE de verdad en este código hoy? Responde "existe": false si el código ya lo resuelve, si la afirmación es falsa, si depende de una fecha o versión mal supuesta, o si no se puede confirmar con lo que ves. Devuelve SOLO JSON: {"existe": true|false, "evidencia": "1-2 frases citando lo que ves en el código"}`;
}
