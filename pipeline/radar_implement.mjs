// radar_implement.mjs — MOTOR del radar: implementa un GitHub Issue `radar` con GEMINI (sin Claude).
// Lee el issue y su "Prompt para implementar", le pide a Gemini las ediciones mínimas y correctas,
// y las aplica al árbol de trabajo. El workflow que lo invoca crea la rama + PR (nunca merge).
//
// Uso: node pipeline/radar_implement.mjs <numero_de_issue>
// Env: GEMINI_API_KEY(,2), GH_TOKEN (para `gh`), GITHUB_REPOSITORY (owner/repo).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const issueNo = (process.argv[2] || "").trim();
const REPO = process.env.RADAR_REPO || process.env.GITHUB_REPOSITORY || "";
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
if (!/^\d+$/.test(issueNo)) { console.error("Falta el número de issue."); process.exit(2); }
if (!KEYS.length) { console.error("Falta GEMINI_API_KEY."); process.exit(2); }
const tf = (u, o = {}, ms = 120000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();

// 1) Leer el issue (título + cuerpo).
const issue = JSON.parse(sh(`gh issue view ${issueNo} -R ${REPO} --json title,body`));
console.log(`Issue #${issueNo}: ${issue.title}`);

// 2) Contexto para Gemini: lista de archivos del repo (para que use rutas válidas) + contenido de los
// archivos que el issue menciona explícitamente (rutas entre backticks).
const tracked = sh(`git ls-files`).split("\n").filter(Boolean);
const mentioned = [...new Set((issue.body.match(/`([^`]+?\.[A-Za-z0-9]+)(?::\d+)?`/g) || [])
  .map((s) => s.replace(/`/g, "").replace(/:\d+$/, "")))]
  .filter((p) => tracked.includes(p));
const CTX_MAX = 48000; // Incluir el archivo aunque sea grande (recortado). Omitirlo hacía que Gemini
                       // inventara "find" que no existían en el archivo real -> ediciones que no aplican.
const fileCtx = mentioned.slice(0, 12).map((p) => {
  try {
    const c = fs.readFileSync(p, "utf8");
    return c.length <= CTX_MAX
      ? `### ${p}\n\`\`\`\n${c}\n\`\`\``
      : `### ${p} (grande: ${c.length} chars — recortado a los primeros ${CTX_MAX}; el "find" DEBE salir de esta porción)\n\`\`\`\n${c.slice(0, CTX_MAX)}\n\`\`\``;
  } catch { return ""; }
}).filter(Boolean).join("\n\n");

const prompt = `Eres un implementador de cambios de código, cuidadoso y mínimo. Te doy un GitHub Issue (con su sección "Prompt para implementar") y contexto del repositorio. Devuelve SOLO JSON con las ediciones EXACTAS y NECESARIAS para implementarlo. Nada de explicaciones fuera del JSON.

Formato de salida (JSON estricto):
{
  "branch": "radar/<slug-corto>",
  "commit_message": "<mensaje conciso>",
  "pr_title": "<título del PR>",
  "pr_body": "<cuerpo del PR en Markdown: qué cambia y por qué, cierra #${issueNo}>",
  "summary": "<1-2 líneas de qué hiciste>",
  "edits": [
    { "path": "<ruta o glob como .github/workflows/*.yml>", "find": "<substring EXACTO actual>", "replace": "<nuevo substring>" },
    { "path": "<ruta de archivo>", "content": "<contenido COMPLETO del archivo — solo para archivos pequeños o nuevos>" }
  ]
}

Reglas:
- Prefiere ediciones quirúrgicas con "find"/"replace" (substring exacto que existe hoy). Para cambios repetidos en muchos archivos, usa "path" con glob (p. ej. ".github/workflows/*.yml") y un "find" que se reemplaza en todos.
- Usa "content" (archivo completo) SOLO para archivos pequeños o nuevos; nunca para archivos grandes.
- Cambios MÍNIMOS: no toques lógica ni archivos no relacionados. Respeta las restricciones del issue.
- "find" debe coincidir literalmente con el contenido actual (respeta espacios, mayúsculas, @versiones).
- Para AGREGAR contenido nuevo (una sección, un bloque, un archivo): NO inventes un "find" que no exista hoy. Ancla en un texto que YA exista (cópialo tal cual) y en "replace" repítelo seguido del contenido nuevo; o entrega el archivo completo en "content". Un "find" inexistente hace que la edición NO aplique.

## Issue #${issueNo}: ${issue.title}
${issue.body}

## Archivos mencionados (contenido actual)
${fileCtx || "(ninguno adjuntado; usa las rutas del issue)"}

## Rutas válidas del repo (git ls-files, muestra)
${tracked.slice(0, 400).join("\n")}`;

// Descubre los modelos REALES de la key que soportan generateContent (evita adivinar nombres 404).
let MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest"];
async function discoverModels() {
  for (const k of KEYS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}&pageSize=200`, {}, 30000);
      if (!res.ok) continue;
      const j = await res.json();
      const names = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/embedding|aqa|imagen|-tts|vision|1\.5|2\.0/i.test(m.name)).map((m) => m.name.replace("models/", ""));
      if (names.length) {
        const rank = (n) => (/flash-latest/.test(n) ? 0 : /flash-lite-latest/.test(n) ? 1 : /flash-latest|flash-lite/.test(n) ? 2 : /flash/.test(n) ? 3 : /pro-latest/.test(n) ? 4 : /pro/.test(n) ? 5 : 6);
        MODELS = [...new Set(names)].sort((a, b) => rank(a) - rank(b)).slice(0, 6);
        console.log("Modelos vivos detectados:", MODELS.join(", "));
        return;
      }
    } catch {}
  }
  console.log("No pude listar modelos; uso la lista por defecto:", MODELS.join(", "));
}

async function callGemini(promptText) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let r = 0; r < 5; r++) {
    for (const k of KEYS) for (const m of MODELS) {
      try {
        const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }) });
        if (!res.ok) { console.error(`  ${m}: HTTP ${res.status}`); continue; }
        const j = await res.json();
        const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
        if (!t) continue;
        let p = null; try { p = JSON.parse(t); } catch { console.error(`  ${m}: JSON invalido`); continue; }
        if (p && Array.isArray(p.edits) && p.edits.length) { console.log(`  respuesta de ${m}`); return p; } // solo un plan valido (con edits) cuenta
      } catch (e) { console.error(`  ${m}: ${e.message}`); }
    }
    if (r < 4) { console.error(`  (ronda ${r + 1} sin éxito — espero y reintento; Google puede estar sobrecargado)`); await wait(8000); }
  }
  return null;
}

await discoverModels();
const plan = await callGemini(prompt);
if (!plan || !Array.isArray(plan.edits) || !plan.edits.length) { console.error("Gemini no devolvió un plan de ediciones usable."); process.exit(3); }

// 3) Aplicar las ediciones.
function expandGlob(p) {
  if (!p.includes("*")) return [p];
  const dir = path.dirname(p), base = path.basename(p); // soporta un solo * en el nombre
  const re = new RegExp("^" + base.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  try { return fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f).replace(/\\/g, "/")); } catch { return []; }
}
const changed = new Set();
function applyEdits(edits) {
  const failed = [];
  for (const e of edits) {
    if (!e || !e.path) continue;
    const targets = expandGlob(e.path);
    let applied = false;
    for (const p of targets) {
      if (typeof e.content === "string" && (e.find == null || e.find === "")) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, e.content); changed.add(p); console.log(`  escrito: ${p}`); applied = true; continue;
      }
      if (e.find != null && fs.existsSync(p)) {
        const before = fs.readFileSync(p, "utf8");
        if (before.includes(e.find)) { fs.writeFileSync(p, before.split(e.find).join(e.replace ?? "")); changed.add(p); console.log(`  editado: ${p} (${e.find.slice(0, 40)}…)`); applied = true; }
      }
    }
    if (!applied) { console.error(`  ❌ No aplicado: ${e.path} | find: ${e.find?.slice(0, 60) || 'N/A'}`); failed.push(e); }
  }
  return failed;
}
let missed = applyEdits(plan.edits);

// 3b) AUTOCORRECCIÓN (el motor "inteligente"): si un `find` no existió, NO nos rendimos. Le devolvemos a
// Gemini las ediciones fallidas + el contenido ACTUAL del archivo y le pedimos corregirlas (ancla real que
// exista, o archivo completo). Hasta 2 rondas. Así los issues de "AGREGAR contenido" dejan de fallar en seco.
function buildCorrectionPrompt(fails) {
  const files = [...new Set(fails.map((m) => m.path).filter((p) => !p.includes("*")))];
  const contents = files.map((p) => {
    try { const c = fs.readFileSync(p, "utf8"); return `### ${p}\n\`\`\`\n${c.slice(0, 48000)}\n\`\`\``; } catch { return `### ${p} (no existe aún — créalo con "content")`; }
  }).join("\n\n");
  return `Estas ediciones NO se aplicaron porque su "find" NO existe literalmente en el archivo actual. Corrígelas. Devuelve SOLO JSON: {"edits":[...]}.

REGLAS CLAVE:
- Si el objetivo es AGREGAR contenido nuevo (una sección/bloque): NO inventes un "find". Ancla en un texto que EXISTA de verdad (cópialo tal cual del contenido de abajo) y en "replace" repite ese texto ancla seguido del contenido nuevo. Si es un archivo pequeño o nuevo, entrega el archivo completo en "content".
- Si el objetivo es MODIFICAR: el "find" debe ser un substring EXACTO que exista hoy (cópialo del contenido de abajo, respetando espacios y mayúsculas).
- Corrige SOLO estas ediciones.

## Ediciones que fallaron (su find no existe)
${fails.map((m) => `- path: ${m.path}\n  find intentado (NO existe): ${JSON.stringify(m.find ?? null)}\n  intención: ${JSON.stringify(String(m.replace ?? m.content ?? "").slice(0, 500))}`).join("\n")}

## Contenido ACTUAL de esos archivos (copia el "find" de aquí)
${contents || "(sin contenido)"}

## Issue
#${issueNo}: ${issue.title}`;
}
for (let round = 1; missed.length && round <= 2; round++) {
  console.log(`🔁 Autocorrección ronda ${round}: reparando ${missed.length} edición(es) (find no encontrado)…`);
  const corr = await callGemini(buildCorrectionPrompt(missed));
  if (!corr || !Array.isArray(corr.edits) || !corr.edits.length) { console.error("  la autocorrección no devolvió ediciones; me detengo."); break; }
  applyEdits(corr.edits);
  missed = missed.filter((m) => !changed.has(m.path)); // resuelto si su archivo ya se modificó
}
if (missed.length > 0) { console.error(`Tras autocorrección, faltaron ${missed.length} edición(es).`); if (!changed.size) process.exit(3); }

// 4) Metadatos para el workflow (rama + PR).
// Un PR solo se marca "completo" (con `Closes #N`) si TODAS las ediciones aplicaron. Si faltó alguna,
// NO cerramos el issue con trabajo a medias: el PR se marca [INCOMPLETO] y el issue sigue abierto.
const slug = (plan.branch || `radar/issue-${issueNo}`).replace(/[^a-zA-Z0-9/_-]/g, "-");
const complete = missed.length === 0;
const closing = complete
  ? `\n\nCloses #${issueNo}`
  : `\n\n> ⚠️ **PR INCOMPLETO** — se aplicaron ${changed.size} cambio(s) pero faltaron ${missed.length} edición(es) (el \`find\` no coincidió con el archivo actual). Revisar y completar a mano. **Este PR NO cierra el issue #${issueNo}** (sigue abierto a propósito).`;
fs.writeFileSync("radar_complete.txt", complete ? "1" : "0");
const meta = { branch: slug.startsWith("radar/") ? slug : `radar/issue-${issueNo}`, commit_message: plan.commit_message || `radar: implementar #${issueNo}`, pr_title: (complete ? "" : "[INCOMPLETO] ") + (plan.pr_title || issue.title), pr_body: (plan.pr_body || "") + closing, summary: plan.summary || "", changed: [...changed], complete };
fs.writeFileSync("radar_pr.json", JSON.stringify(meta, null, 2));
fs.writeFileSync("radar_branch.txt", meta.branch);
fs.writeFileSync("radar_title.txt", meta.pr_title);
fs.writeFileSync("radar_commit.txt", meta.commit_message);
fs.writeFileSync("radar_body.md", meta.pr_body);
console.log(`Listo: ${changed.size} archivo(s) cambiados. Rama ${meta.branch}.`);
