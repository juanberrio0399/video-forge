// radar_respaldo.mjs — plan B del barrido del radar cuando Gemini no tiene cuota.
//
// El barrido necesita investigar en la web y solo lo hacia con Google Search de Gemini: con la
// cuota gratis agotada fallaba la semana entera (4 de 8 semanas entre sep y oct de 2026). El plan B
// busca con Tavily (gratis, 1000 busquedas al mes) a partir de las dependencias REALES del repo y le
// pasa esas fuentes a la cadena gratis de llm.mjs para redactar los hallazgos.
//
// Lo de aqui es PURO (testeable); la red la hace radar_scan.mjs.

const MAX_CONSULTAS = 5;

// Nombres de dependencias de los manifiestos que el repo SI tiene (package.json / requirements.txt
// / pyproject.toml). Sin @types/* ni herramientas de test/lint: no aportan novedades que valgan un issue.
const RUIDO = /^(@types\/|eslint|prettier|vitest|jest|mocha|pytest|ruff|black|flake8|mypy|typescript$|ts-node|nodemon|husky|lint-staged)/i;

export function dependencias(archivos) {
  const out = [];
  const pkg = archivos["package.json"];
  if (pkg) {
    try {
      const j = JSON.parse(pkg);
      out.push(...Object.keys({ ...(j.dependencies || {}), ...(j.devDependencies || {}) }));
    } catch { /* package.json invalido: se ignora */ }
  }
  for (const f of ["requirements.txt", "pyproject.toml"]) {
    const txt = archivos[f];
    if (!txt) continue;
    for (const linea of txt.split(/\r?\n/)) {
      const m = linea.trim().match(/^"?([A-Za-z][A-Za-z0-9_.-]+)\s*(\[[^\]]*\])?\s*(==|>=|~=|<=|>|<|"|$)/);
      if (m && !/^(name|version|description|requires|python|readme|license|authors|build-backend|requires-python)$/i.test(m[1])) out.push(m[1]);
    }
  }
  if (archivos["wrangler.toml"]) out.push("Cloudflare Workers");
  return [...new Set(out.filter((d) => !RUIDO.test(d)))];
}

// Consultas de busqueda: novedades/seguridad de las dependencias principales (de a 2 por consulta
// para gastar poca cuota) + buenas practicas del lenguaje principal. Tope MAX_CONSULTAS.
export function consultas(deps, lenguaje, anio) {
  const q = [];
  const principales = deps.slice(0, 6);
  for (let i = 0; i < principales.length; i += 2) {
    q.push(`${principales.slice(i, i + 2).join(" ")} new release changelog security ${anio}`);
  }
  if (lenguaje) q.push(`${lenguaje} free open source tools best practices ${anio}`);
  return q.slice(0, MAX_CONSULTAS);
}

// Bloque de fuentes para el prompt. Recorta cada fragmento y quita URLs repetidas.
export function bloqueFuentes(resultados) {
  const vistos = new Set();
  const filas = [];
  for (const r of resultados || []) {
    if (!r || !r.url || vistos.has(r.url)) continue;
    vistos.add(r.url);
    filas.push(`- ${String(r.title || "").slice(0, 140)} — ${r.url}\n  ${String(r.content || "").replace(/\s+/g, " ").slice(0, 320)}`);
  }
  if (!filas.length) return "";
  return `\n\nFUENTES WEB ENCONTRADAS HOY (no tienes busqueda propia: afirma novedades, versiones o CVEs SOLO si salen de estas fuentes y cita su URL; si no hay fuente para algo, no lo propongas):\n${filas.slice(0, 25).join("\n")}\n`;
}
