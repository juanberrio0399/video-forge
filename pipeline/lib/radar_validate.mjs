// radar_validate.mjs — VALIDACIÓN del motor de Radar antes de abrir un PR. PURO y testeable.
// La revisión de los PRs del 2026-09-14 mostró los fallos típicos de una IA editando repos ajenos:
//  - importa paquetes que no declara (el build revienta en CI),
//  - crea módulos que nadie importa (código muerto con CI verde),
//  - escribe JSON/TOML/YAML inválido,
//  - sube el árbol entero (diffs de miles de líneas).
// Este módulo detecta todo eso sin ejecutar nada; el motor corre además build/tests del proyecto.
import { builtinModules } from "node:module";

const NODE_BUILTINS = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
export const LIMITS = { maxFiles: 15, maxLines: 1200 };

// ---------- JavaScript / TypeScript ----------
export function jsImports(src) {
  const out = new Set();
  const text = String(src || "");
  const pats = [/\bfrom\s*["']([^"'\n]+)["']/g, /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g, /\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g, /^\s*import\s+["']([^"'\n]+)["']/gm];
  for (const re of pats) for (const m of text.matchAll(re)) out.add(m[1]);
  return [...out];
}
export function jsPackageName(spec) {
  const s = String(spec || "");
  if (!s || s.startsWith(".") || s.startsWith("/") || s.startsWith("#") || /^[a-z]+:/i.test(s) || s.startsWith("~") || s.startsWith("@/")) return null;
  if (NODE_BUILTINS.has(s) || NODE_BUILTINS.has(s.split("/")[0])) return null;
  const parts = s.split("/");
  return s.startsWith("@") ? (parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null) : parts[0];
}
export function declaredJsDeps(pkg) {
  const p = pkg || {};
  return new Set(Object.keys({ ...(p.dependencies || {}), ...(p.devDependencies || {}), ...(p.peerDependencies || {}), ...(p.optionalDependencies || {}) }));
}
// files: [{path, content}] cambiados; pkg: package.json más cercano (objeto) o null; aliases: prefijos de alias del bundler.
export function missingJsDeps(files, pkg, aliases = []) {
  const declared = declaredJsDeps(pkg);
  const missing = [];
  for (const f of files || []) {
    if (!/\.(m?js|cjs|jsx|ts|tsx|vue|svelte)$/i.test(f.path)) continue;
    for (const spec of jsImports(f.content)) {
      if (aliases.some((a) => spec.startsWith(a))) continue;
      const name = jsPackageName(spec);
      if (name && !declared.has(name) && !(name === "cloudflare" || name.startsWith("@types/"))) missing.push({ file: f.path, pkg: name });
    }
  }
  return dedupe(missing, (m) => `${m.file}|${m.pkg}`);
}

// ---------- Python ----------
const PY_DIST = { yaml: "pyyaml", sklearn: "scikit-learn", PIL: "pillow", cv2: "opencv-python", bs4: "beautifulsoup4", dotenv: "python-dotenv", dateutil: "python-dateutil", jwt: "pyjwt", google: "google" };
export function pyImports(src) {
  const out = new Set();
  for (const m of String(src || "").matchAll(/^[ \t]*(?:from[ \t]+([A-Za-z_]\w*)|import[ \t]+([A-Za-z_]\w*))/gm)) out.add(m[1] || m[2]);
  return [...out];
}
const norm = (s) => String(s).toLowerCase().replace(/[-_.]+/g, "-");
// reqText: requirements.txt + dependencias de pyproject en texto; stdlib: Set de módulos estándar; localModules: Set de módulos del repo.
export function missingPyDeps(files, reqText, stdlib, localModules) {
  const req = norm(reqText || "");
  const missing = [];
  for (const f of files || []) {
    if (!/\.py$/i.test(f.path)) continue;
    for (const mod of pyImports(f.content)) {
      if ((stdlib && stdlib.has(mod)) || (localModules && localModules.has(mod)) || mod === "__future__") continue;
      const dist = norm(PY_DIST[mod] || mod);
      const re = new RegExp(`(^|[^a-z0-9-])${dist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9-])`, "m");
      if (!re.test(req)) missing.push({ file: f.path, pkg: PY_DIST[mod] || mod });
    }
  }
  return dedupe(missing, (m) => `${m.file}|${m.pkg}`);
}

// ---------- Código muerto: archivos NUEVOS de código que ningún otro archivo usa ----------
const CODE_EXT = /\.(m?js|cjs|jsx|ts|tsx|py|luau|lua)$/i;
const EXEMPT = /(^|\/)(tests?|__tests__|spec|scripts|bin|cli|migrations|\.github)(\/|$)|\.(test|spec)\.[a-z]+$|(^|\/)(index|main|app|server|worker|cli)\.[a-z]+$|config\.[a-z]+$/i;
// newFiles: [paths]; corpus: [{path, content}] del repo (sin los nuevos); entryHints: texto de package.json/manifiestos.
export function unreferencedNewFiles(newFiles, corpus, entryHints = "") {
  const out = [];
  for (const p of newFiles || []) {
    if (!CODE_EXT.test(p) || EXEMPT.test(p)) continue;
    const base = p.split("/").pop().replace(/\.[^.]+$/, "");
    const used = (corpus || []).some((f) => f.path !== p && String(f.content).includes(base)) || String(entryHints).includes(base);
    if (!used) out.push(p);
  }
  return out;
}

// ---------- Sintaxis por tipo de archivo (comando a correr en el runner) ----------
export function syntaxCheckCommand(p) {
  const q = JSON.stringify(p);
  if (/\.json$/i.test(p) && !/tsconfig|jsconfig/i.test(p)) return `node -e "JSON.parse(require('fs').readFileSync(${q},'utf8'))"`;
  if (/\.(mjs|cjs|js)$/i.test(p)) return `node --check ${q}`;
  if (/\.py$/i.test(p)) return `python3 -m py_compile ${q}`;
  if (/\.toml$/i.test(p)) return `python3 -c "import tomllib,sys;tomllib.load(open(sys.argv[1],'rb'))" ${q}`;
  if (/\.ya?ml$/i.test(p)) return `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" ${q}`;
  return null;
}

// ---------- Build/tests del proyecto ----------
// pkgs: [{dir, pkg, hasLock}] package.json relevantes; py: {hasReq, hasPyproject, hasTests, usesRuff}
export function projectCommands(pkgs, py) {
  const cmds = [];
  for (const { dir, pkg, hasLock } of pkgs || []) {
    const scripts = (pkg && pkg.scripts) || {};
    const cwd = dir || ".";
    cmds.push({ cwd, label: "instalar dependencias", cmd: hasLock ? "npm ci --no-audit --no-fund --ignore-scripts" : "npm install --no-audit --no-fund --ignore-scripts" });
    for (const s of ["build", "typecheck", "lint", "test"]) {
      if (!scripts[s] || /\b(watch|dev|serve|--watch)\b/.test(scripts[s])) continue;
      cmds.push({ cwd, label: `npm run ${s}`, cmd: `npm run ${s} --if-present` });
    }
  }
  if (py && (py.hasReq || py.hasPyproject)) {
    if (py.hasReq) cmds.push({ cwd: ".", label: "instalar dependencias Python", cmd: "python3 -m pip install -q -r requirements.txt" });
    cmds.push({ cwd: ".", label: "compilar Python", cmd: "python3 -m compileall -q -x '(\\.venv|node_modules|site-packages)' ." });
    if (py.usesRuff) cmds.push({ cwd: ".", label: "ruff", cmd: "python3 -m pip install -q ruff && python3 -m ruff check ." });
    if (py.hasTests) cmds.push({ cwd: ".", label: "pytest", cmd: "python3 -m pip install -q pytest && python3 -m pytest -q -x" });
  }
  return cmds;
}

// ---------- Tamaño del cambio ----------
export function sizeProblem(numstat, limits = LIMITS) {
  const rows = String(numstat || "").split("\n").map((l) => l.trim().split(/\s+/)).filter((r) => r.length >= 3);
  const files = rows.length;
  const lines = rows.reduce((a, r) => a + (+r[0] || 0) + (+r[1] || 0), 0);
  if (files > limits.maxFiles) return `cambia ${files} archivos (máximo ${limits.maxFiles})`;
  if (lines > limits.maxLines) return `cambia ${lines} líneas (máximo ${limits.maxLines})`;
  return null;
}

function dedupe(arr, key) { const seen = new Set(); return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); }
