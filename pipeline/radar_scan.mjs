// radar_scan.mjs — BARRIDO del radar (sin Claude): investiga un repo con GEMINI (grounding de
// Google Search) y crea Issues `radar` NUEVOS (anti-duplicados). No toca código. El workflow lo
// corre por cron semanal sobre los repos PRIVADOS de Juan (los públicos los cubre la nube de Claude).
//
// Uso: node pipeline/radar_scan.mjs            (usa RADAR_REPO del entorno)
// Env: GEMINI_API_KEY(,2), GH_TOKEN (para `gh`), RADAR_REPO=owner/repo (repo objetivo, ya clonado en cwd).
import fs from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import { esDuplicado, ubicacionValida, necesitaVerificacion, veredicto, promptVerificacion } from "./lib/radar_filtro.mjs";
import { dependencias, consultas, bloqueFuentes } from "./lib/radar_respaldo.mjs";
import { genText } from "./llm.mjs";

// Plan B sin Gemini: redacta la cadena gratis de llm.mjs. Sin OpenRouter: sus modelos gratis pueden
// guardar lo que reciben y el radar lee repos privados.
const SALTAR = ["Gemini", "OpenRouter"];

const REPO = (process.env.RADAR_REPO || process.env.GITHUB_REPOSITORY || "").trim();
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const MAX_ISSUES = Number(process.env.RADAR_MAX || 4);       // tope de issues nuevos por corrida
if (!REPO) { console.error("Falta RADAR_REPO (owner/repo)."); process.exit(2); }
if (!KEYS.length) { console.error("Falta GEMINI_API_KEY."); process.exit(2); }

const tf = (u, o = {}, ms = 120000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
const shq = (c) => { try { return sh(c); } catch { return ""; } };
const read = (p, max = 8000) => { try { const c = fs.readFileSync(p, "utf8"); return c.length > max ? c.slice(0, max) + "\n…(recortado)" : c; } catch { return ""; } };

// 1) Contexto del repo (README + manifiestos + commits recientes + árbol + issues abiertos).
const tracked = shq("git ls-files").split("\n").filter(Boolean);
const has = (p) => tracked.includes(p);
const readme = ["README.md", "readme.md", "README.MD", "Readme.md"].map((p) => read(p)).find(Boolean) || "(sin README)";
const MANIFESTS = ["package.json", "wrangler.toml", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "composer.json"];
// Los requirements*.txt pueden vivir en subcarpetas y con sufijo (dataforge: CONFIGURACION/requirements-cloud.txt).
const REQS = tracked.filter((p) => /(^|\/)requirements[^/]*\.txt$/.test(p) && p !== "requirements.txt");
const manifests = [...MANIFESTS, ...REQS, ...tracked.filter((p) => /\.project\.json$/.test(p))]
  .filter(has).map((p) => `### ${p}\n${read(p, 3000)}`).join("\n\n") || "(sin manifiestos detectados)";
const commits = shq("git log --oneline -20 --no-decorate") || "(sin historial)";
// Se cuentan TODOS los archivos por extension (antes un Set dejaba cada extension en 1).
const langs = tracked.map((p) => (p.match(/\.([a-zA-Z0-9]+)$/) || [])[1]).filter(Boolean)
  .reduce((m, e) => (m[e] = (m[e] || 0) + 1, m), {});
const topLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([e, n]) => `.${e}(${n})`).join(" ");

const existing = JSON.parse(shq(`gh issue list -R ${REPO} --state open --limit 200 --json number,title`) || "[]");
const existingTitles = existing.map((i) => i.title);
// Los CERRADOS tambien cuentan: lo que se cerro por falso o ya hecho no debe volver a proponerse.
const closed = JSON.parse(shq(`gh issue list -R ${REPO} --state closed --limit 200 --json number,title`) || "[]");
const closedTitles = closed.map((i) => i.title);
const isDup = (title) => esDuplicado(title, [...existingTitles, ...closedTitles]);
const HOY = new Date().toISOString().slice(0, 10);

console.log(`Radar scan de ${REPO} — ${existing.length} abiertos + ${closed.length} cerrados, ${tracked.length} archivos, langs: ${topLangs}`);

// 2) Prompt para Gemini (con grounding de Google Search para traer fuentes reales con fecha).
const prompt = `Eres un "Radar de proyecto": analizas un repositorio de GitHub e identificas de forma investigada acciones de ALTO VALOR para (a) MEJORAR lo que ya existe, (b) AGREGAR capacidades, features e INTEGRACIONES NUEVAS que le den un salto (no solo arreglar), y (c) hacerlo CRECER. Prioriza traer COSAS NUEVAS del ecosistema (APIs/herramientas/modelos/técnicas recién salidos) que el proyecto podría integrar YA. Usa Google Search para traer novedades REALES y recientes, y cita SIEMPRE fuentes con fecha.

⛔ RESTRICCIÓN INNEGOCIABLE — TODO DEBE SER GRATIS: cada herramienta, API, modelo, servicio, hosting o integración que propongas TIENE que ser 100% gratuito de forma sostenible: open-source, o con free tier permanente que NO exija tarjeta de crédito. PROHIBIDO sugerir: servicios/APIs de pago, planes "premium/pro/paid", suscripciones, créditos que se agotan y hay que comprar, trials que caducan, o cualquier cosa que pida tarjeta. Si la ÚNICA forma de lograr algo es pagando, NO lo propongas (busca la alternativa gratis, o descártalo). En cada hallazgo que integre algo externo, indica explícitamente por qué es gratis (ej. "MIT/Apache", "free tier sin tarjeta", "self-host").

Repositorio: ${REPO}
Fecha de hoy: ${HOY}. Una fecha igual o anterior a hoy NO es "futura"; una versión ya publicada NO es "dev".

Cubre estas dimensiones (mezcla mejorar + crecer, prioriza señal sobre ruido):
- ⭐ Oportunidades/novedades para IMPLEMENTAR (funciones, técnicas, herramientas recién salidas del stack que usa).
- 🔧 Mejoras técnicas, releases/breaking changes y deprecations de sus dependencias.
- 🔒 Ciberseguridad: secretos, scopes de tokens/CI, CORS/CSP, hardening, CVEs de sus deps.
- 🎓 Certificaciones relevantes al stack (si aplica a la carrera del autor).
- ™️ Marca personal: README que venda, demo/GIF, case study, badges.
- ©️ Autoría y derechos: ¿hay LICENSE con CRÉDITO OBLIGATORIO a Juan Berrio? Si falta, proponerla.
- 📈 Crecimiento/SEO del proyecto: descubribilidad (topics/tags de GitHub, About, social preview), difusión (subreddits concretos, Dev.to, Show HN, awesome-lists del nicho), ángulos de adquisición de usuarios/stars.
- 🐛 Errores, fallos y salud del proyecto: comprueba si algo está ROTO — CI/CD en rojo (gh run list del repo), build/lint/tests que fallan, bugs de código, y sobre todo manejo de errores que SILENCIA fallos (catch vacío, redirigir stderr a /dev/null), config rota (secrets/manifiestos), enlaces/demos muertos. Clasifica el TIPO y severidad y propón el arreglo. Prioriza ALTA lo roto en producción o lo que oculta fallos.
- 🔮 Predicción de patrones y tendencias (FUNDAMENTAL): cruza la TRAYECTORIA del repo (qué se ha construido, qué se repite en commits/issues, etapa, deuda) con hacia dónde va el ecosistema, y PREDICE qué va a necesitar el proyecto y qué decisión estructural conviene tomar HOY para alinearse con lo que viene. Separa dato (ya pasó) de predicción (razonada) y declara confianza alto/medio/bajo.

REGLAS:
- ⛔ SOLO GRATIS: descarta cualquier hallazgo cuya solución dependa de algo de pago (ver restricción arriba). Solo herramientas/APIs/servicios gratis sostenibles (open-source o free tier sin tarjeta).
- Devuelve SOLO un arreglo JSON (sin prosa, sin markdown alrededor). Entre 2 y ${MAX_ISSUES} hallazgos, calidad sobre cantidad.
- NO repitas temas ya cubiertos por estos issues abiertos: ${existingTitles.map((t) => `"${t}"`).join(", ") || "(ninguno)"}.
- Tampoco propongas de nuevo lo ya CERRADO (resuelto o descartado por falso): ${closedTitles.slice(0, 120).map((t) => `"${t}"`).join(", ") || "(ninguno)"}.
- Si afirmas que algo del código está mal o desactualizado, tiene que poder verificarse en el archivo de "location": antes de crear el issue se compara contra el código real y se descarta si no se confirma.
- Cada afirmación anclada a una URL real con fecha. Nada inventado.
- "location" debe usar una RUTA que exista en el repo (de la lista de archivos). "line" opcional.

Formato de cada elemento del arreglo:
{
  "title": "título corto y accionable",
  "priority": "Alta" | "Media" | "Baja",
  "effort": "S" | "M" | "L",
  "type": "Oportunidad/Novedad" | "Mejora" | "Error/Bug" | "Seguridad" | "Dependencia" | "Deprecation" | "Marca" | "Autoría" | "Crecimiento" | "Predicción/Tendencia",
  "description": "3-6 líneas explicando el hallazgo",
  "why": "por qué importa a ESTE repo en concreto",
  "references": ["Autor/Org. (Año, Mes Día). Título. Sitio. https://url"],
  "location": "ruta/archivo.ext",
  "action": "acción sugerida concreta",
  "implement_prompt": "prompt copy-paste COMPLETO para un implementador: crear rama radar/<slug>, cambios concretos por archivo, criterios de aceptación, abrir PR sin merge"
}

## README
${readme}

## Manifiestos
${manifests}

## Commits recientes
${commits}

## Archivos del repo (muestra)
${tracked.slice(0, 300).join("\n")}`;

// 3) Descubrir modelos vivos que soporten generateContent (evita 404 por nombres adivinados).
let MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"];
async function discoverModels() {
  for (const k of KEYS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}&pageSize=200`, {}, 30000);
      if (!res.ok) continue;
      const j = await res.json();
      const names = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/embedding|aqa|imagen|-tts|vision|1\.5|2\.0|lite/i.test(m.name)).map((m) => m.name.replace("models/", ""));
      if (names.length) {
        const rank = (n) => (/flash-latest/.test(n) ? 0 : /2\.5-flash$/.test(n) ? 1 : /flash/.test(n) ? 2 : /pro-latest/.test(n) ? 3 : /pro/.test(n) ? 4 : 5);
        MODELS = [...new Set(names)].sort((a, b) => rank(a) - rank(b)).slice(0, 5);
        console.log("Modelos vivos:", MODELS.join(", "));
        return;
      }
    } catch {}
  }
  console.log("Uso lista de modelos por defecto:", MODELS.join(", "));
}

function extractJsonArray(t) {
  if (!t) return null;
  let s = t.replace(/```json|```/g, "").trim();
  const i = s.indexOf("["), j = s.lastIndexOf("]");
  if (i >= 0 && j > i) s = s.slice(i, j + 1);
  try { return JSON.parse(s); } catch { return null; }
}

async function ask() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await discoverModels();
  const body = (withTool) => ({
    contents: [{ parts: [{ text: prompt }] }],
    ...(withTool ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { temperature: 0.35 },
  });
  for (let r = 0; r < 4; r++) {
    for (const k of KEYS) for (const m of MODELS) for (const withTool of [true, false]) {
      try {
        const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body(withTool)) });
        if (!res.ok) { console.error(`  ${m}${withTool ? "+search" : ""}: HTTP ${res.status}`); continue; }
        const j = await res.json();
        const t = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        const arr = extractJsonArray(t);
        if (Array.isArray(arr) && arr.length) { console.log(`  hallazgos con ${m}${withTool ? " (grounded)" : ""}: ${arr.length}`); return arr; }
      } catch (e) { console.error(`  ${m}: ${e.message}`); }
    }
    if (r < 3) { const ms = 30000 * (r + 1); console.error(`  (ronda ${r + 1} sin resultado; espero ${ms / 1000}s por la cuota y reintento)`); await wait(ms); }
  }
  return askRespaldo();
}

// Gemini sin cuota: busca con Tavily desde las dependencias reales y redacta con la cadena gratis.
// Sin fuentes NO redacta: un radar sin investigar inventaria versiones y CVEs.
async function askRespaldo() {
  const KEY = process.env.TAVILY_API_KEY;
  if (!KEY) { console.error("  Plan B: falta TAVILY_API_KEY; sin busqueda web no hay barrido."); return null; }
  const archivos = Object.fromEntries([...MANIFESTS, ...REQS].filter(has).map((p) => [p, read(p, 20000)]));
  const LENG = { py: "Python", js: "JavaScript", mjs: "JavaScript", ts: "TypeScript", tsx: "TypeScript", jsx: "JavaScript", lua: "Luau", luau: "Luau", go: "Go", rs: "Rust", java: "Java" };
  const lenguaje = Object.entries(langs).sort((a, b) => b[1] - a[1]).map(([e]) => LENG[e]).find(Boolean) || "";
  const qs = consultas(dependencias(archivos), lenguaje, HOY.slice(0, 4));
  const resultados = [];
  for (const query of qs) {
    try {
      const res = await tf("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: KEY, query, max_results: 5, search_depth: "basic" }) }, 30000);
      if (!res.ok) { console.error(`  Tavily "${query}": HTTP ${res.status}`); continue; }
      resultados.push(...(((await res.json()) || {}).results || []));
    } catch (e) { console.error(`  Tavily "${query}": ${e.message}`); }
  }
  const fuentes = bloqueFuentes(resultados);
  if (!fuentes) { console.error("  Plan B: Tavily no devolvio fuentes."); return null; }
  console.log(`  Plan B: ${qs.length} busquedas en Tavily, ${resultados.length} resultados; redacto con la cadena gratis.`);
  const arr = extractJsonArray(await genText(prompt + fuentes, { json: false, saltar: SALTAR }));
  if (Array.isArray(arr) && arr.length) { console.log(`  hallazgos con el plan B (Tavily + cadena gratis): ${arr.length}`); return arr; }
  return null;
}

// Una pregunta corta sin Google Search (para el verificador). Devuelve el texto o "".
async function preguntar(texto) {
  for (const k of KEYS) for (const m of MODELS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: texto }] }], generationConfig: { temperature: 0 } }) }, 60000);
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      if (t) return t;
    } catch {}
  }
  // Sin Gemini el verificador no se salta: sin respuesta, veredicto() descarta el hallazgo.
  return (await genText(texto, { json: false, saltar: SALTAR })) || "";
}

const findings = await ask();
if (!Array.isArray(findings) || !findings.length) { console.error("Ni Gemini ni el plan B (Tavily + cadena gratis) devolvieron hallazgos usables."); process.exit(3); }

// 4) Asegurar la etiqueta `radar`.
shq(`gh label create radar --color BFD4F2 --description "Radar de proyecto (autom.)" -R ${REPO}`);

// 5) Crear los issues nuevos (anti-duplicados).
const okType = new Set(["Oportunidad/Novedad", "Mejora", "Error/Bug", "Seguridad", "Dependencia", "Deprecation", "Marca", "Autoría", "Crecimiento", "Predicción/Tendencia"]);
const okPrio = new Set(["Alta", "Media", "Baja"]);
const okEff = new Set(["S", "M", "L"]);
let created = 0; const titles = [];
for (const f of findings) {
  if (created >= MAX_ISSUES) break;
  const title = (f.title || "").toString().trim().slice(0, 120);
  if (!title) continue;
  if (isDup(title)) { console.log(`  ~ omitido (duplicado, abierto o cerrado): ${title}`); continue; }
  const ruta = ubicacionValida(f.location, tracked);
  if (!ruta) { console.log(`  ~ omitido (la ruta "${f.location}" no existe en el repo): ${title}`); continue; }
  if (necesitaVerificacion(f.type) && fs.existsSync(ruta) && fs.statSync(ruta).isFile()) {
    const v = veredicto(await preguntar(promptVerificacion(f, ruta, read(ruta, 14000), HOY)));
    if (!v.existe) { console.log(`  ~ descartado al verificar contra ${ruta}: ${title} — ${v.evidencia}`); continue; }
    f.verificado = v.evidencia;
  }
  const prio = okPrio.has(f.priority) ? f.priority : "Media";
  const eff = okEff.has(f.effort) ? f.effort : "M";
  const type = okType.has(f.type) ? f.type : "Mejora";
  const refs = (Array.isArray(f.references) ? f.references : [f.references]).filter(Boolean).map((s) => `- ${s}`).join("\n") || "- (sin fuente — verificar antes de implementar)";
  const loc = (f.location || "(ver descripción)").toString().replace(/`/g, "");
  const body = `**Prioridad:** ${prio} · **Esfuerzo:** ${eff} · **Tipo:** ${type}

## Descripción
${(f.description || "").toString().trim()}

## Por qué importa a ESTE repo
${(f.why || "").toString().trim()}

## Referencias (APA)
${refs}

## Ubicación en el repo
\`${loc}\`
${f.verificado ? `
## Verificado contra el código (${HOY})
${f.verificado}
` : ""}
## Acción sugerida
${(f.action || "").toString().trim()}

## Prompt para implementar
\`\`\`
${(f.implement_prompt || "").toString().trim()}
\`\`\`

---
<sub>🛰️ Generado automáticamente por el radar (Gemini + Google Search). Revisar las fuentes antes de implementar.</sub>`;

  const tmp = `radar_body_${created}.md`;
  fs.writeFileSync(tmp, body);
  try {
    // Seguridad: el título lo escribe un LLM. Se pasa como ARGUMENTO (sin shell), así "$(...)" o backticks
    // no pueden ejecutarse. Antes iba interpolado en un comando de shell.
    const out = execFileSync("gh", ["issue", "create", "-R", REPO, "--label", "radar", "--title", String(title).slice(0, 240), "--body-file", tmp], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 }).toString();
    const url = (out.match(/https?:\/\/\S+/) || [""])[0];
    console.log(`  + creado: ${title} ${url}`);
    existingTitles.push(title);                                // evita duplicar dentro de la misma corrida
    titles.push(title); created++;
  } catch (e) { console.error(`  ! error creando "${title}": ${e.message}`); }
  finally { try { fs.unlinkSync(tmp); } catch {} }
}

console.log(`\nResumen ${REPO}: ${created} issue(s) nuevo(s).`);
titles.forEach((t) => console.log(`  - ${t}`));
if (!created) console.log("(nada nuevo que reportar esta corrida)");
