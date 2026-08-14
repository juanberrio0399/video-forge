// radar_scan.mjs — BARRIDO del radar (sin Claude): investiga un repo con GEMINI (grounding de
// Google Search) y crea Issues `radar` NUEVOS (anti-duplicados). No toca código. El workflow lo
// corre por cron semanal sobre los repos PRIVADOS de Juan (los públicos los cubre la nube de Claude).
//
// Uso: node pipeline/radar_scan.mjs            (usa RADAR_REPO del entorno)
// Env: GEMINI_API_KEY(,2), GH_TOKEN (para `gh`), RADAR_REPO=owner/repo (repo objetivo, ya clonado en cwd).
import fs from "node:fs";
import { execSync } from "node:child_process";

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
const manifests = [...MANIFESTS, ...tracked.filter((p) => /\.project\.json$/.test(p))]
  .filter(has).map((p) => `### ${p}\n${read(p, 3000)}`).join("\n\n") || "(sin manifiestos detectados)";
const commits = shq("git log --oneline -20 --no-decorate") || "(sin historial)";
const langs = [...new Set(tracked.map((p) => (p.match(/\.([a-zA-Z0-9]+)$/) || [])[1]).filter(Boolean))]
  .reduce((m, e) => (m[e] = (m[e] || 0) + 1, m), {});
const topLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([e, n]) => `.${e}(${n})`).join(" ");

const existing = JSON.parse(shq(`gh issue list -R ${REPO} --state open --limit 200 --json number,title`) || "[]");
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 3));
const existingTitles = existing.map((i) => i.title);
function isDup(title) {                                        // Jaccard de palabras > 0.55 = duplicado
  const a = words(title);
  for (const t of existingTitles) {
    const b = words(t);
    if (!a.size || !b.size) continue;
    let inter = 0; for (const w of a) if (b.has(w)) inter++;
    const jac = inter / (a.size + b.size - inter);
    if (jac > 0.55 || norm(t) === norm(title)) return true;
  }
  return false;
}

console.log(`Radar scan de ${REPO} — ${existing.length} issue(s) abiertos, ${tracked.length} archivos, langs: ${topLangs}`);

// 2) Prompt para Gemini (con grounding de Google Search para traer fuentes reales con fecha).
const prompt = `Eres un "Radar de proyecto": analizas un repositorio de GitHub e identificas de forma investigada acciones de ALTO VALOR para (a) MEJORAR el proyecto y (b) hacerlo CRECER. Usa Google Search para traer novedades REALES y recientes, y cita SIEMPRE fuentes con fecha.

Repositorio: ${REPO}

Cubre estas dimensiones (mezcla mejorar + crecer, prioriza señal sobre ruido):
- ⭐ Oportunidades/novedades para IMPLEMENTAR (funciones, técnicas, herramientas recién salidas del stack que usa).
- 🔧 Mejoras técnicas, releases/breaking changes y deprecations de sus dependencias.
- 🔒 Ciberseguridad: secretos, scopes de tokens/CI, CORS/CSP, hardening, CVEs de sus deps.
- 🎓 Certificaciones relevantes al stack (si aplica a la carrera del autor).
- ™️ Marca personal: README que venda, demo/GIF, case study, badges.
- ©️ Autoría y derechos: ¿hay LICENSE con CRÉDITO OBLIGATORIO a Juan Berrio? Si falta, proponerla.
- 📈 Crecimiento/SEO del proyecto: descubribilidad (topics/tags de GitHub, About, social preview), difusión (subreddits concretos, Dev.to, Show HN, awesome-lists del nicho), ángulos de adquisición de usuarios/stars.

REGLAS:
- Devuelve SOLO un arreglo JSON (sin prosa, sin markdown alrededor). Entre 2 y ${MAX_ISSUES} hallazgos, calidad sobre cantidad.
- NO repitas temas ya cubiertos por estos issues abiertos: ${existingTitles.map((t) => `"${t}"`).join(", ") || "(ninguno)"}.
- Cada afirmación anclada a una URL real con fecha. Nada inventado.
- "location" debe usar una RUTA que exista en el repo (de la lista de archivos). "line" opcional.

Formato de cada elemento del arreglo:
{
  "title": "título corto y accionable",
  "priority": "Alta" | "Media" | "Baja",
  "effort": "S" | "M" | "L",
  "type": "Oportunidad/Novedad" | "Mejora" | "Seguridad" | "Dependencia" | "Deprecation" | "Marca" | "Autoría" | "Crecimiento",
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
    if (r < 3) { console.error(`  (ronda ${r + 1} sin resultado; espero y reintento)`); await wait(8000); }
  }
  return null;
}

const findings = await ask();
if (!Array.isArray(findings) || !findings.length) { console.error("Gemini no devolvió hallazgos usables."); process.exit(3); }

// 4) Asegurar la etiqueta `radar`.
shq(`gh label create radar --color BFD4F2 --description "Radar de proyecto (autom.)" -R ${REPO}`);

// 5) Crear los issues nuevos (anti-duplicados).
const okType = new Set(["Oportunidad/Novedad", "Mejora", "Seguridad", "Dependencia", "Deprecation", "Marca", "Autoría", "Crecimiento"]);
const okPrio = new Set(["Alta", "Media", "Baja"]);
const okEff = new Set(["S", "M", "L"]);
let created = 0; const titles = [];
for (const f of findings) {
  if (created >= MAX_ISSUES) break;
  const title = (f.title || "").toString().trim().slice(0, 120);
  if (!title) continue;
  if (isDup(title)) { console.log(`  ~ omitido (duplicado): ${title}`); continue; }
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
    const out = sh(`gh issue create -R ${REPO} --label radar --title ${JSON.stringify(title)} --body-file ${tmp}`);
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
