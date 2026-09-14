// radar_implement.mjs — MOTOR del radar: implementa un GitHub Issue `radar` con GEMINI (sin Claude).
// Flujo VALIDADO (v2, 2026-09-14): la revisión de 46 PRs mostró código muerto, paquetes sin declarar,
// APIs inventadas, archivos rotos y diffs gigantes. Ahora el motor NO abre un PR hasta que el cambio pasa:
//   1) sintaxis de cada archivo tocado (JSON, JS, Python, TOML, YAML)
//   2) dependencias declaradas (package.json / requirements / pyproject)
//   3) todo archivo de código nuevo queda en uso (nada muerto)
//   4) tamaño acotado
//   5) build/tests del proyecto, contando solo fallas NUEVAS frente a main
//   6) revisión estricta por un segundo modelo (APIs reales, cambio conectado, sin afirmaciones falsas)
// Si algo falla, el motor le devuelve los errores a Gemini y repara (hasta 2 rondas). Resultados:
//   ok -> PR listo · sin revisión -> PR borrador · no valida -> sin PR y el issue explica por qué ·
//   rechazado -> sin PR y el issue queda marcado como descartado. El workflow crea rama + PR (nunca merge).
//
// Uso: node pipeline/radar_implement.mjs <numero_de_issue>
// Env: GEMINI_API_KEY(,2), GH_TOKEN (para `gh`), RADAR_REPO (owner/repo), CLOUDFLARE_* (respaldo gratis).
import fs from "node:fs";
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";
import { missingJsDeps, missingPyDeps, unreferencedNewFiles, syntaxCheckCommand, projectCommands, sizeProblem } from "./lib/radar_validate.mjs";

const issueNo = (process.argv[2] || "").trim();
const REPO = process.env.RADAR_REPO || process.env.GITHUB_REPOSITORY || "";
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
if (!/^\d+$/.test(issueNo)) { console.error("Falta el número de issue."); process.exit(2); }
if (!KEYS.length) { console.error("Falta GEMINI_API_KEY."); process.exit(2); }
const tf = (u, o = {}, ms = 120000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
// Todo lo que lleva rutas o datos va SIN shell (argumentos separados): las rutas las propone el modelo.
const run = (bin, args) => execFileSync(bin, args, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
const readSafe = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };

// 1) Leer el issue (título + cuerpo).
const issue = JSON.parse(run("gh", ["issue", "view", issueNo, "-R", REPO, "--json", "title,body"]));
console.log(`Issue #${issueNo}: ${issue.title}`);

// 2) Contexto para Gemini.
const tracked = run("git", ["ls-files"]).split("\n").filter(Boolean);
const mentioned = [...new Set((issue.body.match(/`([^`]+?\.[A-Za-z0-9]+)(?::\d+)?`/g) || [])
  .map((s) => s.replace(/`/g, "").replace(/:\d+$/, "")))]
  .filter((p) => tracked.includes(p));
const CTX_MAX = 48000;
const manifests = ["package.json", "requirements.txt", "pyproject.toml", "wally.toml", "Cargo.toml", "go.mod"].filter((p) => tracked.includes(p));
const fileCtx = [...new Set([...mentioned.slice(0, 12), ...manifests])].map((p) => {
  const c = readSafe(p);
  if (!c) return "";
  return c.length <= CTX_MAX
    ? `### ${p}\n\`\`\`\n${c}\n\`\`\``
    : `### ${p} (grande: ${c.length} chars — recortado a los primeros ${CTX_MAX}; el "find" DEBE salir de esta porción)\n\`\`\`\n${c.slice(0, CTX_MAX)}\n\`\`\``;
}).filter(Boolean).join("\n\n");

const prompt = `Eres un implementador de cambios de código, cuidadoso y mínimo. Te doy un GitHub Issue (con su sección "Prompt para implementar") y contexto del repositorio. Devuelve SOLO JSON con las ediciones EXACTAS y NECESARIAS para implementarlo. Nada de explicaciones fuera del JSON.

⛔ SOLO GRATIS: nunca introduzcas dependencias, APIs, servicios o SDKs de PAGO (ni planes premium/pro, suscripciones, o cosas que pidan tarjeta). Usa solo open-source o free tier sin tarjeta. Si el issue exige algo de pago para funcionar, NO lo implementes: devuelve el JSON de "skip" con skip_reason "paid".

⚙️ NADA QUE REQUIERA CONFIGURACIÓN MANUAL EXTERNA: si implementar el issue exige un paso MANUAL fuera del código —conectar un servidor MCP, obtener y pegar una API key/token/secret, crear/configurar una cuenta o servicio externo, autorizar OAuth, aceptar una licencia de un modelo, o cambiar workflows de CI (.github/) o archivos de despliegue (wrangler.toml)— NO lo implementes. Devuelve EXACTAMENTE:
{ "skip": true, "skip_reason": "manual" | "paid", "skip_note": "<1 frase: qué config manual/pago hace falta>", "steps": ["<paso 1 accionable que el DUEÑO del repo debe hacer a mano>", "<paso 2>", "..."] }
NO es manual (hazlo tú con ediciones): agregar o actualizar dependencias en package.json/requirements.txt/pyproject.toml, editar o crear código, tests, documentación o configuración dentro del repo (salvo .github/ y wrangler.toml). Si todos tus pasos serían editar archivos del repo, NO uses skip: implementa.
Cuando skip_reason es "manual", "steps" es OBLIGATORIO: el paso a paso EXACTO en español, imperativo y claro; NUNCA menciones IA/motor/Gemini/automático.

🎯 NIVEL PROFESIONAL: implementa como un ingeniero senior que entrega una mejora que el usuario NOTA. Completa de punta a punta: lógica + integración con la UI o el flujo real + manejo de errores y estados vacíos + tests si el repo tiene tests. Nada de versiones a medias, demos ni "base para después". Cambios pequeños: edita solo lo necesario con find/replace; no reescribas archivos existentes completos.

✅ CALIDAD OBLIGATORIA (se valida antes de abrir el PR; si falla, el cambio se descarta):
- Todo paquete que importes DEBE quedar declarado en el manifiesto (package.json, requirements.txt o pyproject.toml) con una versión que EXISTA. Si el repo usa package-lock.json igual edita package.json: el lockfile se regenera solo.
- Todo archivo de código NUEVO debe quedar CONECTADO: impórtalo y úsalo desde el código existente (o desde la UI). Nada de módulos que nadie llama.
- No inventes APIs, endpoints, datasets, modelos, funciones de librerías, versiones ni valores legales/numéricos. Si no puedes asegurar que algo existe tal cual, usa "skip" con skip_reason "manual" y explica qué hay que verificar.
- No afirmes en el PR algo que el código no hace. Nada de "auditorías", "checklists" o "cumplimiento" simulados.
- Sin placeholders (tu-usuario, TODO, lorem, esquemas vacíos). Sin borrar funcionalidad existente.
- Respeta el estilo y el linter del repo; no reformatees archivos enteros; tests con el framework que el repo YA usa.
- Cambio pequeño: como máximo 15 archivos y 1200 líneas.

Formato de salida (JSON estricto):
{
  "branch": "radar/<slug-corto>",
  "commit_message": "<Conventional Commit: 'tipo(ámbito): resumen' en imperativo, <=72 chars, minúscula al inicio; tipos: feat|fix|refactor|perf|docs|chore|test|ci|build|style. Sin emoji, sin punto final, sin mención de IA/herramienta>",
  "pr_title": "<título del PR conciso en imperativo, estilo profesional; sin emoji, sin mención de IA>",
  "pr_body": "<cuerpo del PR en Markdown profesional y conciso: '## Summary' (qué cambia y por qué, 1-3 líneas) y '## Changes' (viñetas). Termina con 'Closes #${issueNo}'. Sin emoji, sin mención de IA/herramienta>",
  "summary": "<1-2 líneas de qué hiciste>",
  "edits": [
    { "path": "<ruta o glob>", "find": "<substring EXACTO actual>", "replace": "<nuevo substring>" },
    { "path": "<ruta de archivo>", "content": "<contenido COMPLETO del archivo — solo para archivos pequeños o nuevos>" }
  ]
}

Reglas de edición:
- Prefiere ediciones quirúrgicas con "find"/"replace" (substring exacto que existe hoy).
- Usa "content" (archivo completo) SOLO para archivos pequeños o nuevos; nunca para archivos grandes.
- "find" debe coincidir literalmente con el contenido actual (espacios, mayúsculas, @versiones).
- Para AGREGAR contenido: ancla en un texto que YA exista (cópialo tal cual) y en "replace" repítelo seguido del contenido nuevo; o entrega el archivo completo en "content".
- ESTILO PROFESIONAL: commit_message, pr_title y pr_body como un ingeniero senior. NUNCA menciones IA, "motor", "radar", "Gemini", "generado" ni "automático". Sin emoji.

## Issue #${issueNo}: ${issue.title}
${issue.body}

## Archivos mencionados y manifiestos (contenido actual)
${fileCtx || "(ninguno adjuntado; usa las rutas del issue)"}

## Rutas válidas del repo (git ls-files, muestra)
${tracked.slice(0, 400).join("\n")}`;

// ---------- Modelos ----------
let MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest"];
async function discoverModels() {
  for (const k of KEYS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}&pageSize=200`, {}, 30000);
      if (!res.ok) continue;
      const j = await res.json();
      const names = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/embedding|aqa|imagen|-tts|vision|1\.5|2\.0/i.test(m.name)).map((m) => m.name.replace("models/", ""));
      if (names.length) {
        const rank = (n) => (/flash-latest/.test(n) ? 0 : /flash-lite-latest/.test(n) ? 1 : /flash/.test(n) ? 3 : /pro-latest/.test(n) ? 4 : /pro/.test(n) ? 5 : 6);
        MODELS = [...new Set(names)].sort((a, b) => rank(a) - rank(b)).slice(0, 6);
        console.log("Modelos vivos detectados:", MODELS.join(", "));
        return;
      }
    } catch {}
  }
  console.log("No pude listar modelos; uso la lista por defecto:", MODELS.join(", "));
}

// Llama al LLM y devuelve el primer JSON que cumpla `accept`. Espera creciente ante 429 y respaldo en Workers AI.
async function callLLM(promptText, accept, label = "") {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let r = 0; r < 5; r++) {
    let saw429 = false;
    for (const k of KEYS) for (const m of MODELS) {
      try {
        const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }) });
        if (!res.ok) { if (res.status === 429) saw429 = true; console.error(`  ${label}${m}: HTTP ${res.status}`); continue; }
        const j = await res.json();
        const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
        if (!t) continue;
        let p = null; try { p = JSON.parse(t); } catch { console.error(`  ${label}${m}: JSON inválido`); continue; }
        if (p && accept(p)) { console.log(`  ${label}respuesta de ${m}`); return p; }
      } catch (e) { console.error(`  ${label}${m}: ${e.message}`); }
    }
    if (r < 4) { const ms = saw429 ? 30000 * (r + 1) : 8000; console.error(`  ${label}(ronda ${r + 1} sin éxito — espero ${ms / 1000}s y reintento)`); await wait(ms); }
  }
  const CF_ACCT = process.env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  if (CF_ACCT && CF_TOKEN) {
    for (const m of ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"]) {
      try {
        const res = await tf(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/ai/run/${m}`, { method: "POST", headers: { Authorization: `Bearer ${CF_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: "Respond ONLY with a single valid, minified JSON object matching the requested schema. No markdown, no code fences, no prose." }, { role: "user", content: promptText }], temperature: 0.1, max_tokens: 4096 }) }, 90000);
        if (!res.ok) { console.error(`  ${label}CF ${m}: HTTP ${res.status}`); continue; }
        const j = await res.json();
        let t = (j?.result?.response || "").replace(/```json|```/g, "").trim();
        const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) t = t.slice(a, b + 1);
        let p = null; try { p = JSON.parse(t); } catch { continue; }
        if (p && accept(p)) { console.log(`  ${label}respuesta de Cloudflare Workers AI (${m})`); return p; }
      } catch (e) { console.error(`  ${label}CF ${m}: ${e.message}`); }
    }
  }
  return null;
}
const isPlan = (p) => p.skip === true || (Array.isArray(p.edits) && p.edits.length > 0);
const callGemini = (t) => callLLM(t, isPlan);

function writeSkip(kind, reason, note, steps) {
  fs.writeFileSync("radar_skip.txt", `${reason}${note ? ": " + note : ""}`);
  fs.writeFileSync("radar_skip_reason.txt", kind);
  fs.writeFileSync("radar_steps.json", JSON.stringify((steps || []).map((s) => String(s || "").trim()).filter(Boolean).slice(0, 12)));
}

await discoverModels();
const plan = await callGemini(prompt);
if (plan && plan.skip === true) {
  const reason = plan.skip_reason === "paid" ? "es de pago" : "requiere configuración manual";
  writeSkip(plan.skip_reason === "paid" ? "paid" : "manual", reason, String(plan.skip_note || "").slice(0, 300), plan.steps);
  console.log(`PENDIENTE (no se implementa): ${reason}`);
  process.exit(0);
}
if (!plan || !Array.isArray(plan.edits) || !plan.edits.length) { console.error("Gemini no devolvió un plan de ediciones usable."); process.exit(3); }

// ---------- 3) Aplicar ediciones ----------
function expandGlob(p) {
  if (!p.includes("*")) return [p];
  const dir = path.dirname(p), base = path.basename(p);
  const re = new RegExp("^" + base.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  try { return fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f).replace(/\\/g, "/")); } catch { return []; }
}
const changed = new Set();
const created = new Set();
const blocked = [];
// GUARDA DE RUTAS (seguridad): solo dentro del repo y nunca CI, git, secretos, lockfiles ni despliegue.
const REPO_ROOT = path.resolve(".");
const DENY = [/^\.github(\/|$)/i, /^\.git(\/|$)/i, /(^|\/)\.env(\.|$)/i, /(^|\/)\.npmrc$/i, /(^|\/)wrangler\.toml$/i, /(^|\/)\.dev\.vars$/i, /\.(pem|key|p12|pfx)$/i, /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i];
function safePath(p) {
  const raw = String(p || "").replace(/\\/g, "/").trim();
  if (!raw || raw.startsWith("/") || /^[a-zA-Z]:/.test(raw) || raw.split("/").includes("..")) return null;
  if (!/^[\w@.\/+*\- ]+$/.test(raw)) return null;   // solo caracteres normales de ruta (sin $ ` ; | " etc.)
  const abs = path.resolve(REPO_ROOT, raw);
  if (abs !== REPO_ROOT && !abs.startsWith(REPO_ROOT + path.sep)) return null;
  const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
  if (DENY.some((re) => re.test(rel))) return null;
  return rel;
}
// ÚNICO punto donde el contenido propuesto por el modelo llega a disco (ruta ya pasada por safePath).
function writeModelFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  changed.add(p);
}
function applyEdits(edits) {
  const failed = [];
  for (const e of edits) {
    if (!e || !e.path) continue;
    if (!safePath(e.path)) { console.error(`  🚫 Ruta protegida o fuera del repo: ${e.path}`); blocked.push(e); failed.push(e); continue; }
    const targets = expandGlob(safePath(e.path)).filter((t) => safePath(t));
    let applied = false;
    for (const p of targets) {
      if (typeof e.content === "string" && (e.find == null || e.find === "")) {
        if (!tracked.includes(p) && !changed.has(p)) created.add(p);
        writeModelFile(p, e.content);
        console.log(`  escrito: ${p}`); applied = true; continue;
      }
      if (e.find != null) {
        let before;
        try { before = fs.readFileSync(p, "utf8"); } catch { continue; }
        if (before.includes(e.find)) { writeModelFile(p, before.split(e.find).join(e.replace ?? "")); console.log(`  editado: ${p}`); applied = true; }
      }
    }
    if (!applied && !blocked.includes(e)) { console.error(`  ❌ No aplicado: ${e.path} | find: ${e.find?.slice(0, 60) || "N/A"}`); failed.push(e); }
  }
  return failed;
}
let missed = applyEdits(plan.edits);

// Si TODO lo que pidió tocar son archivos protegidos (CI/despliegue), no es un fallo: es configuración manual.
if (!changed.size && blocked.length && missed.every((m) => blocked.includes(m))) {
  writeSkip("manual", "requiere cambiar archivos protegidos (CI o despliegue)", blocked.map((b) => b.path).join(", "),
    blocked.map((b) => `Edita a mano ${b.path}: ${String(b.replace ?? b.content ?? "").slice(0, 160).replace(/\s+/g, " ")}`));
  console.log("PENDIENTE: el cambio solo toca archivos protegidos; queda como configuración manual.");
  process.exit(0);
}

// 3b) Autocorrección de "find" inexistentes (hasta 2 rondas).
function contentsOf(paths) {
  return [...new Set(paths)].filter((p) => p && !p.includes("*")).map((p) => {
    const c = readSafe(p); return c ? `### ${p}\n\`\`\`\n${c.slice(0, 48000)}\n\`\`\`` : `### ${p} (no existe aún — créalo con "content")`;
  }).join("\n\n");
}
for (let round = 1; missed.filter((m) => !blocked.includes(m)).length && round <= 2; round++) {
  const fails = missed.filter((m) => !blocked.includes(m));
  console.log(`🔁 Autocorrección ronda ${round}: ${fails.length} edición(es) con "find" inexistente…`);
  const corr = await callGemini(`Estas ediciones NO se aplicaron porque su "find" NO existe literalmente en el archivo actual. Corrígelas. Devuelve SOLO JSON: {"edits":[...]}.
- Para AGREGAR: ancla en un texto que EXISTA (cópialo del contenido de abajo) y repítelo en "replace" seguido de lo nuevo; o "content" completo si es pequeño o nuevo.
- Para MODIFICAR: "find" debe ser un substring EXACTO de hoy.
## Ediciones que fallaron
${fails.map((m) => `- path: ${m.path}\n  find (NO existe): ${JSON.stringify(m.find ?? null)}\n  intención: ${JSON.stringify(String(m.replace ?? m.content ?? "").slice(0, 500))}`).join("\n")}
## Contenido ACTUAL
${contentsOf(fails.map((m) => m.path)) || "(sin contenido)"}
## Issue
#${issueNo}: ${issue.title}`);
  if (!corr || !Array.isArray(corr.edits) || !corr.edits.length) break;
  applyEdits(corr.edits);
  missed = missed.filter((m) => !changed.has(m.path));
}
if (!changed.size) { console.error("No quedó ningún cambio aplicado."); process.exit(3); }

// ---------- 4) Validación ----------
const STDLIB = (() => { try { return new Set(JSON.parse(run("python3", ["-c", "import sys,json;print(json.dumps(sorted(sys.stdlib_module_names)))"]))); } catch { return new Set(); } })();
function runFile(bin, args, cwd, timeoutMs) {
  try { execFileSync(bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }); return { ok: true, out: "" }; }
  catch (e) { return { ok: false, out: `${e.stdout || ""}\n${e.stderr || ""}`.toString().split("\n").filter(Boolean).slice(-20).join("\n") || String(e.message) }; }
}
const gitAddIntent = () => { if (created.size) { try { run("git", ["add", "-N", "--", ...created]); } catch {} } };
function runCmd(cmd, cwd, timeoutMs) {
  try { const out = execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: "true", HUSKY: "0" } }).toString(); return { ok: true, out }; }
  catch (e) { const out = `${e.stdout || ""}\n${e.stderr || ""}`.toString(); return { ok: false, out: out.split("\n").filter(Boolean).slice(-40).join("\n") || String(e.message) }; }
}
function nearestPkgDir(file) {
  let d = path.dirname(file).replace(/\\/g, "/");
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, "package.json"))) return d;
    if (d === "." || d === "" || d === "/") break;
    d = path.dirname(d).replace(/\\/g, "/");
  }
  return fs.existsSync("package.json") ? "." : null;
}
const pkgOf = (d) => { try { return JSON.parse(readSafe(path.join(d, "package.json"))); } catch { return null; } };
// Si cambió un package.json con lockfile, el motor regenera el lockfile (Gemini no puede tocarlo).
function syncLockfiles() {
  for (const p of [...changed].filter((x) => /(^|\/)package\.json$/.test(x))) {
    const d = path.dirname(p) || ".";
    if (!fs.existsSync(path.join(d, "package-lock.json"))) continue;
    const r = runCmd("npm install --package-lock-only --ignore-scripts --no-audit --no-fund", d, 4 * 60000);
    if (r.ok) { changed.add(path.join(d, "package-lock.json").replace(/\\/g, "/")); console.log(`  lockfile regenerado: ${d}/package-lock.json`); }
  }
}
function staticProblems() {
  const problems = [];
  const files = [...changed].map((p) => ({ path: p, content: readSafe(p) }));
  gitAddIntent();
  let numstat = "";
  try { numstat = run("git", ["diff", "--numstat", "--", ...changed]); } catch {}
  const size = sizeProblem(numstat);
  if (size) problems.push({ kind: "tamaño", detail: `el cambio ${size}` });
  for (const f of files) {
    const c = syntaxCheckCommand(f.path);
    if (!c) continue;
    const r = runFile(c[0], c[1], ".", 60000);
    if (!r.ok) problems.push({ kind: "sintaxis", file: f.path, detail: r.out.slice(-800) });
  }
  const byPkg = {};
  for (const f of files) { const d = nearestPkgDir(f.path); if (d != null) (byPkg[d] = byPkg[d] || []).push(f); }
  for (const [d, list] of Object.entries(byPkg)) {
    for (const m of missingJsDeps(list, pkgOf(d), ["@/", "~/", "$lib", "$app", "virtual:"])) problems.push({ kind: "dependencia", file: m.file, detail: `importa "${m.pkg}" pero no está declarado en ${d}/package.json` });
  }
  const py = files.filter((f) => /\.py$/.test(f.path));
  if (py.length) {
    const reqText = `${readSafe("requirements.txt")}\n${readSafe("pyproject.toml")}`;
    const local = new Set([...tracked, ...changed].flatMap((t) => [t.split("/")[0].replace(/\.py$/, ""), t.split("/").pop().replace(/\.py$/, "")]));
    for (const m of missingPyDeps(py, reqText, STDLIB, local)) problems.push({ kind: "dependencia", file: m.file, detail: `importa "${m.pkg}" pero no está en requirements.txt ni pyproject.toml` });
  }
  const corpus = [...new Set([...tracked, ...changed])].filter((t) => /\.(m?js|cjs|jsx|ts|tsx|py|luau|lua|html|vue|svelte|json|toml)$/i.test(t)).slice(0, 4000).map((p) => ({ path: p, content: readSafe(p) }));
  for (const p of unreferencedNewFiles([...created], corpus, `${readSafe("package.json")}\n${readSafe("default.project.json")}`)) problems.push({ kind: "código muerto", file: p, detail: "archivo nuevo que ningún otro archivo importa ni usa" });
  const pkgs = Object.keys(byPkg).map((d) => ({ dir: d, pkg: pkgOf(d), hasLock: fs.existsSync(path.join(d, "package-lock.json")) })).filter((x) => x.pkg);
  const touchesPy = py.length > 0 || files.some((f) => /(^|\/)(requirements\.txt|pyproject\.toml)$/.test(f.path));
  const pyInfo = touchesPy ? {
    hasReq: fs.existsSync("requirements.txt"), hasPyproject: fs.existsSync("pyproject.toml"),
    hasTests: fs.existsSync("tests") || tracked.some((t) => /(^|\/)test_[^/]*\.py$/.test(t)),
    usesRuff: fs.existsSync("ruff.toml") || /\[tool\.ruff/.test(readSafe("pyproject.toml")) || tracked.some((t) => t.startsWith(".github/workflows/") && /ruff/.test(readSafe(t))),
  } : null;
  return { problems, cmds: projectCommands(pkgs, pyInfo) };
}
function runProject(cmds) {
  const fails = [];
  for (const c of cmds) {
    const r = runCmd(c.cmd, c.cwd, 6 * 60000);
    if (!r.ok) { fails.push({ key: `${c.cwd}|${c.label}`, label: c.label, cwd: c.cwd, out: r.out }); if (/instalar/.test(c.label)) break; }
  }
  return fails;
}
let baseline = null;
const ran = [];
function projectProblems(cmds) {
  if (!cmds.length) return [];
  if (baseline === null) {
    // Estado de main SIN el cambio: solo cuentan las fallas que el cambio introduce.
    // Se mide en un worktree limpio de HEAD (no stash: los archivos nuevos del cambio no se tocan).
    baseline = new Set();
    const baseDir = path.resolve(REPO_ROOT, "..", "radar_base");
    try {
      if (!fs.existsSync(baseDir)) run("git", ["worktree", "add", "--detach", baseDir, "HEAD"]);
      baseline = new Set(runProject(cmds.map((c) => ({ ...c, cwd: path.join(baseDir, c.cwd) }))).map((f) => `${path.relative(baseDir, f.cwd).replace(/\\/g, "/") || "."}|${f.label}`));
    } catch (e) { console.error("  no pude medir main:", String(e.message).slice(0, 120)); }
    if (baseline.size) console.log(`  en main ya fallaban: ${[...baseline].join(", ")}`);
  }
  const fails = runProject(cmds);
  ran.splice(0, ran.length, ...cmds.map((c) => ({ label: c.label, cwd: c.cwd, ok: !fails.some((f) => f.key === `${c.cwd}|${c.label}`), preexisting: baseline.has(`${c.cwd}|${c.label}`) })));
  return fails.filter((f) => !baseline.has(f.key)).map((f) => ({ kind: "build/tests", detail: `${f.label} (${f.cwd}) falla con el cambio:\n${f.out.slice(-1500)}` }));
}
async function reviewGate() {
  let diff = "";
  gitAddIntent();
  try { diff = run("git", ["diff", "--", ...changed]).slice(0, 60000); } catch {}
  return callLLM(`Eres un tech lead senior, MUY estricto, que solo acepta cambios profesionales con impacto real para el producto. Revisa este cambio que pretende resolver el issue. Responde SOLO JSON:
{"verdict":"APROBAR"|"ARREGLAR"|"RECHAZAR","impact":"alto"|"medio"|"bajo","problems":["<problema concreto con archivo y qué corregir>"],"summary":"<1 línea: qué mejora para el usuario o el negocio>"}
RECHAZAR si: usa APIs, paquetes, modelos, datasets, endpoints o funciones que no existen o no puedes confirmar; afirma algo que el código no hace (auditorías, firmas, seguridad simulada); cambia valores legales o numéricos sin fuente verificable; contradice al repo; o su impacto es BAJO (cosmético, solo texto o README, micro-ajuste de estilo, try/catch aislado, refactor sin beneficio medible).
ARREGLAR si la idea tiene impacto pero la ejecución no es de nivel profesional: código nuevo no conectado a la experiencia real, feature a medias (lógica sin UI o UI sin lógica), sin manejo de errores o estados vacíos, sin tests cuando el repo tiene tests, placeholders, validaciones faltantes, errores de lógica, borra funcionalidad, rompe estilo o seguridad, textos o archivos cortados.
APROBAR solo si es correcto, completo de punta a punta, conectado, seguro y con impacto medio o alto.
## Issue #${issueNo}: ${issue.title}
${String(issue.body).slice(0, 6000)}
## Diff
${diff || "(sin diff)"}`, (p) => ["APROBAR", "ARREGLAR", "RECHAZAR"].includes(p.verdict), "revisión: ");
}

let outcome = "ok", finalProblems = [], review = null;
for (let round = 0; round <= 2; round++) {
  syncLockfiles();
  const { problems, cmds } = staticProblems();
  const all = problems.length ? problems : projectProblems(cmds);
  if (!all.length) {
    review = await reviewGate();
    if (!review) { outcome = "sin_revision"; finalProblems = []; break; }
    if (review.verdict === "APROBAR") { outcome = "ok"; finalProblems = []; break; }
    if (review.verdict === "RECHAZAR") { outcome = "rechazado"; finalProblems = (review.problems || []).map((d) => ({ kind: "revisión", detail: String(d) })); break; }
    all.push(...(review.problems || []).map((d) => ({ kind: "revisión", detail: String(d) })));
  }
  finalProblems = all;
  if (round === 2) { outcome = "no_valida"; break; }
  console.log(`🔧 Reparación ${round + 1}: ${all.length} problema(s): ${all.map((a) => a.kind).join(", ")}`);
  const fix = await callGemini(`El cambio NO pasó la validación. Corrige TODOS los problemas con ediciones mínimas. Devuelve SOLO JSON {"edits":[...]} (mismo formato: find/replace exacto o content completo). Si el issue no se puede implementar correctamente sin inventar nada, devuelve {"skip":true,"skip_reason":"manual","skip_note":"<por qué>","steps":["<qué verificar o hacer a mano>"]}.
Reglas: declara en el manifiesto todo paquete importado; conecta todo archivo nuevo al código existente; no inventes APIs; no toques .github, wrangler.toml ni lockfiles.
## Problemas
${all.map((a, i) => `${i + 1}. [${a.kind}]${a.file ? " " + a.file : ""}: ${a.detail}`).join("\n")}
## Contenido ACTUAL de los archivos cambiados y manifiestos
${contentsOf([...changed, ...Object.keys({ "package.json": 1, "requirements.txt": 1, "pyproject.toml": 1 }).filter((p) => tracked.includes(p))])}
## Issue #${issueNo}: ${issue.title}
${String(issue.body).slice(0, 4000)}`);
  if (!fix) { outcome = "no_valida"; break; }
  if (fix.skip === true) { writeSkip("manual", "requiere verificación o configuración manual", String(fix.skip_note || "").slice(0, 300), fix.steps); console.log("PENDIENTE tras validar: requiere verificación manual."); process.exit(0); }
  applyEdits(fix.edits);
}

// ---------- 5) Resultado para el workflow ----------
if (outcome === "no_valida" || outcome === "rechazado") {
  const report = { outcome, problems: finalProblems.slice(0, 12).map((p) => ({ kind: p.kind, file: p.file || null, detail: String(p.detail).slice(0, 700) })), review: review ? review.summary || null : null, impact: review ? review.impact || null : null };
  fs.writeFileSync(outcome === "rechazado" ? "radar_rejected.json" : "radar_invalid.json", JSON.stringify(report, null, 2));
  console.log(outcome === "rechazado" ? "RECHAZADO por la revisión: no se abre PR." : `NO VALIDA tras reparar: ${finalProblems.length} problema(s). No se abre PR.`);
  process.exit(0);
}

const slug = (plan.branch || `radar/issue-${issueNo}`).replace(/[^a-zA-Z0-9/_-]/g, "-");
const pending = missed.filter((m) => !changed.has(m.path));
const complete = pending.length === 0;
const checks = [
  "- [x] Syntax of every changed file",
  "- [x] Imported packages are declared in the manifest",
  "- [x] New code is referenced by existing code",
  "- [x] Change size within limits",
  ...ran.map((r) => `- [${r.ok ? "x" : " "}] \`${r.label}\`${r.cwd && r.cwd !== "." ? ` in \`${r.cwd}\`` : ""}${!r.ok && r.preexisting ? " (already failing on the base branch)" : ""}`),
  outcome === "ok" ? "- [x] Strict code review" : "- [ ] Strict code review (unavailable: opened as draft)",
].join("\n");
const closing = complete
  ? `\n\nCloses #${issueNo}`
  : `\n\n> ⚠️ **INCOMPLETE** — ${pending.length} edit(s) could not be applied. This PR does not close #${issueNo}.`;
fs.writeFileSync("radar_complete.txt", complete ? "1" : "0");
if (outcome === "sin_revision") fs.writeFileSync("radar_draft.txt", "1");
fs.writeFileSync("radar_changed.txt", [...changed].join("\n") + "\n");
const meta = { branch: slug.startsWith("radar/") ? slug : `radar/issue-${issueNo}`, commit_message: plan.commit_message || `feat: implement #${issueNo}`, pr_title: (complete ? "" : "[INCOMPLETO] ") + (plan.pr_title || issue.title), pr_body: `${plan.pr_body || ""}\n\n## Validation\n${checks}${closing}`, summary: plan.summary || "", changed: [...changed], complete, outcome };
fs.writeFileSync("radar_pr.json", JSON.stringify(meta, null, 2));
fs.writeFileSync("radar_branch.txt", meta.branch);
fs.writeFileSync("radar_title.txt", meta.pr_title);
fs.writeFileSync("radar_commit.txt", meta.commit_message);
fs.writeFileSync("radar_body.md", meta.pr_body);
console.log(`Listo y validado (${outcome}): ${changed.size} archivo(s). Rama ${meta.branch}.`);
