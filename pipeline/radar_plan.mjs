// radar_plan.mjs — PLAN de implementación para un issue `radar`. NO edita código ni abre PR.
// Decisión 2026-09-14: 10 de 10 PRs del motor validado fallaron la revisión a fondo (versiones que bajan, código
// que nunca se llama, CSP que bloquea lo nuevo, afirmaciones legales falsas, apps que se caen). El modelo gratis
// no produce cambios mergeables, así que el motor investiga el repo real y deja un plan concreto en el issue;
// la implementación se hace con revisión y pruebas reales.
//
// Uso: RADAR_REPO=owner/repo node pipeline/radar_plan.mjs <issue>   (cwd = clon del repo objetivo)
// Salida: radar_plan.md (comentario) y radar_plan_labels.txt (etiquetas). Env: GH_TOKEN + keys de llm.mjs.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { genText } from "./llm.mjs";
import { normalizePlan, planMarkdown, planLabels, parsePlanJson, versionDowngrades } from "./lib/radar_plan_format.mjs";

const issueNo = (process.argv[2] || "").trim();
const REPO = process.env.RADAR_REPO || "";
if (!/^\d+$/.test(issueNo) || !REPO) { console.error("Uso: RADAR_REPO=owner/repo node pipeline/radar_plan.mjs <issue>"); process.exit(2); }
const run = (bin, args) => execFileSync(bin, args, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
const readSafe = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };

const issue = JSON.parse(run("gh", ["issue", "view", issueNo, "-R", REPO, "--json", "title,body"]));
console.log(`Issue #${issueNo}: ${issue.title}`);
const tracked = run("git", ["ls-files"]).split("\n").filter(Boolean);

// Contexto REAL del repo: lo que el issue menciona + lo que decide si un cambio funciona (manifiestos, lockfiles,
// CSP, Docker, despliegue, CI). Así el plan no propone bajar versiones, olvidar el lockfile ni chocar con la CSP.
const mentioned = [...new Set((String(issue.body).match(/`([^`\s]+?\.[A-Za-z0-9]+)(?::\d+)?`/g) || [])
  .map((s) => s.replace(/`/g, "").replace(/:\d+$/, "")))].filter((p) => tracked.includes(p));
const KEY_FILES = /(^|\/)(package\.json|requirements[^/]*\.(txt|lock|in)|pyproject\.toml|Dockerfile|\.dockerignore|_headers|wrangler\.(toml|jsonc?)|default\.project\.json|wally\.toml)$/i;
const keyFiles = tracked.filter((t) => KEY_FILES.test(t) && t.split("/").length <= 3).slice(0, 12);
const workflows = tracked.filter((t) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(t)).slice(0, 6);
let budget = 90000;
const ctx = [...new Set([...mentioned.slice(0, 10), ...keyFiles, ...workflows])].map((p) => {
  const c = readSafe(p);
  if (!c || budget <= 0) return "";
  const s = c.slice(0, Math.min(20000, budget));
  budget -= s.length;
  return `### ${p}${s.length < c.length ? " (recortado)" : ""}\n\`\`\`\n${s}\n\`\`\``;
}).filter(Boolean).join("\n\n");

// Quién usa hoy cada archivo mencionado: lo nuevo debe conectarse ahí, no quedar muerto.
const callers = mentioned.slice(0, 8).map((p) => {
  const base = p.split("/").pop().replace(/\.[^.]+$/, "");
  let hits = [];
  try { hits = run("git", ["grep", "-l", "-F", base]).split("\n").filter((x) => x && x !== p).slice(0, 8); } catch {}
  return `- ${p}: ${hits.length ? hits.join(", ") : "(ningún otro archivo lo referencia)"}`;
}).join("\n");

const prompt = `Eres un tech lead senior. Te doy un GitHub Issue y el contexto REAL del repositorio. NO escribas código: devuelve un PLAN de implementación verificable, en español, que otro ingeniero pueda ejecutar sin sorpresas. Responde SOLO JSON:
{
  "verdict": "implementar" | "manual" | "descartar",
  "impact": "alto" | "medio" | "bajo",
  "effort": "S" | "M" | "L",
  "summary": "<2-3 líneas: qué mejora concreta obtiene el usuario o el negocio>",
  "premise_ok": true | false,
  "premise_note": "<si la premisa del issue no coincide con el repo (versión, feature que ya existe, API que no existe), explica qué es lo real>",
  "files": [{ "path": "<ruta existente o nueva>", "change": "<qué cambia exactamente y dónde se conecta>" }],
  "steps": ["<paso concreto en orden>"],
  "risks": ["<riesgo concreto y cómo se cubre>"],
  "tests": ["<prueba concreta: comando o caso con datos reales del repo>"],
  "acceptance": ["<criterio observable de terminado>"],
  "manual_steps": ["<solo si verdict=manual: lo que el dueño debe hacer fuera del código>"]
}

Reglas (errores reales que ya pasaron y NO se pueden repetir):
1. Verifica la premisa contra el contexto: versiones en manifiestos y lockfiles (nunca propongas bajar una versión), features que ya existen, datos y columnas reales (p. ej. el CSV de ejemplo).
2. Todo código nuevo debe tener un punto de uso concreto (quién lo importa y lo LLAMA, qué ve el usuario). Nombra el archivo y la función que lo invoca.
3. Dependencias: indica en qué manifiesto Y en qué lockfile va (si CI instala desde requirements.lock o package-lock.json, hay que actualizarlo), con una versión actual sin vulnerabilidades conocidas.
4. Revisa restricciones del despliegue: CSP en _headers o en el Worker, .dockerignore, usuario non-root, permisos, límites de Workers AI, licencias de modelos que exigen aceptación previa.
5. Seguridad: autenticación y rate limiting en endpoints nuevos, validación de entradas, topes de tamaño, SSRF.
6. Nada de afirmaciones falsas: un hash no es una firma digital con validez legal; no cites leyes sin que el cambio las cumpla.
7. Pruebas con el framework que el repo YA usa y con sus datos reales; incluye cómo comprobarlo a mano si no hay CI.
8. "manual" SOLO si hace falta algo fuera del repo (cuenta o servicio externo, API key, OAuth, aceptar una licencia) o cambiar .github/workflows o wrangler.toml. Editar código, dependencias o tests del repo NO es manual.
9. "descartar" si el impacto es bajo (cosmético, solo texto, micro-ajuste), si la idea no aplica a este repo o si no es verificable. Sé honesto con el impacto.
10. SOLO GRATIS: nada de servicios o APIs de pago; si lo exige, "descartar" y explica por qué.

## Issue #${issueNo}: ${issue.title}
${String(issue.body).slice(0, 12000)}

## Quién usa los archivos mencionados
${callers || "(el issue no menciona archivos existentes)"}

## Contexto del repositorio
${ctx || "(sin archivos de contexto)"}

## Archivos del repo (muestra)
${tracked.slice(0, 300).join("\n")}`;

// Planificar pide razonamiento, no creatividad: Gemini Pro primero y temperatura baja; respaldo = cadena gratis de llm.mjs.
const GKEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
async function ask(text) {
  for (const k of GKEYS) for (const m of ["gemini-pro-latest", "gemini-flash-latest"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }), signal: AbortSignal.timeout(180000) });
      if (!res.ok) { console.error(`  ${m}: HTTP ${res.status}`); continue; }
      const j = await res.json();
      const out = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (out) { console.log(`  plan por ${m}`); return out; }
    } catch (e) { console.error(`  ${m}: ${e.message}`); }
  }
  return genText(text, { json: true });
}

const manifestText = keyFiles.map(readSafe).join("\n");
let plan = null, feedback = "", downsTxt = "";
for (let i = 0; i < 3; i++) {
  const raw = parsePlanJson(await ask(prompt + feedback));
  if (!raw || !(raw.verdict || raw.steps)) continue;
  plan = normalizePlan(raw);
  // Guarda determinista SOLO sobre lo accionable (archivos, pasos, pruebas): la nota de premisa puede citar la versión vieja a propósito.
  const downs = versionDowngrades(JSON.stringify({ files: raw.files, steps: raw.steps, tests: raw.tests }), manifestText);
  downsTxt = downs.map((d) => `${d.pkg} ${d.from} → ${d.to}`).join(", ");
  if (!downs.length) break;
  console.log(`  el plan bajaba versiones (${downsTxt}); replantear`);
  feedback = `\n\n## ERROR EN TU PLAN ANTERIOR\nBajabas versiones que el repo ya tiene más nuevas: ${downsTxt}. Está PROHIBIDO bajar versiones. Marca premise_ok=false, explica la versión real en premise_note y replantea el plan sin tocar esas versiones (o "descartar" si no queda nada útil).`;
}
if (!plan) { console.error("La IA no devolvió un plan usable."); process.exit(3); }
if (downsTxt) { plan.verdict = "descartar"; plan.premise_ok = false; plan.premise_note = `El plan propuesto bajaba versiones que el repo ya tiene más nuevas (${downsTxt}); no se debe implementar así.`; }
fs.writeFileSync("radar_plan.md", planMarkdown(plan));
fs.writeFileSync("radar_plan_labels.txt", planLabels(plan).join("\n") + "\n");
console.log(`Plan: ${plan.verdict} · impacto ${plan.impact} · ${plan.files.length} archivo(s) · premisa ${plan.premise_ok ? "ok" : "a revisar"}`);
