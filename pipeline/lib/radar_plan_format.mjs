// radar_plan_format.mjs — normaliza y da formato al PLAN que el motor de Radar deja en cada issue. PURO y testeable.
// Decisión 2026-09-14: los PRs automáticos se pausaron (10 de 10 fallaron la revisión a fondo); el motor solo planifica.
const VERDICTS = ["implementar", "manual", "descartar"];
const IMPACTS = ["alto", "medio", "bajo"];
const clean = (s, max = 600) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
// Una viñeta puede venir como texto o como objeto ({riesgo, mitigación}): se aplana a "valor — valor".
const item = (x) => (x && typeof x === "object" ? Object.values(x).filter((v) => v != null && v !== "").map(String).join(" — ") : x);
const list = (a, max = 12, len = 400) => (Array.isArray(a) ? a : []).map((x) => clean(item(x), len)).filter(Boolean).slice(0, max);

export function normalizePlan(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const impact = IMPACTS.includes(p.impact) ? p.impact : "bajo";
  let verdict = VERDICTS.includes(p.verdict) ? p.verdict : "manual";
  if (verdict === "implementar" && impact === "bajo") verdict = "descartar";   // solo cambios con impacto real
  const files = (Array.isArray(p.files) ? p.files : [])
    .map((f) => ({ path: clean(f && f.path, 200).replace(/`/g, ""), change: clean(f && f.change, 400) }))
    .filter((f) => f.path && f.change).slice(0, 15);
  return {
    verdict, impact,
    effort: ["S", "M", "L"].includes(p.effort) ? p.effort : null,
    summary: clean(p.summary, 500),
    premise_ok: p.premise_ok !== false,
    premise_note: clean(p.premise_note, 400),
    files,
    steps: list(p.steps),
    risks: list(p.risks, 8),
    tests: list(p.tests, 8),
    acceptance: list(p.acceptance, 8),
    manual_steps: list(p.manual_steps, 10),
  };
}

const TITLE = { implementar: "## 📋 Plan de implementación", manual: "## 🖐️ Requiere configuración manual", descartar: "## 🗑️ No vale la pena implementarlo" };

export function planMarkdown(plan) {
  const p = normalizePlan(plan);
  const out = [TITLE[p.verdict], "", `**Impacto:** ${p.impact}${p.effort ? ` · **Esfuerzo:** ${p.effort}` : ""}`];
  if (p.summary) out.push("", p.summary);
  if (!p.premise_ok) out.push("", `> ⚠️ **Premisa del issue a revisar:** ${p.premise_note || "el issue parte de un dato que no coincide con el repo."}`);
  const sec = (title, items, fmt) => { if (items.length) out.push("", `### ${title}`, ...items.map(fmt)); };
  sec("Archivos", p.files, (f) => `- \`${f.path}\`: ${f.change}`);
  sec("Pasos", p.steps, (x, i) => `${i + 1}. ${x}`);
  sec("Riesgos a cubrir", p.risks, (x) => `- ${x}`);
  sec("Pruebas", p.tests, (x) => `- [ ] ${x}`);
  sec("Criterios de aceptación", p.acceptance, (x) => `- [ ] ${x}`);
  sec("Pasos manuales", p.manual_steps, (x) => `- [ ] ${x}`);
  return out.join("\n").trim() + "\n";
}

// Etiquetas del issue según el veredicto (el bot las usa para ubicar la tarjeta).
export function planLabels(plan) {
  const p = normalizePlan(plan);
  return ["radar-plan", ...(p.verdict === "manual" ? ["manual"] : p.verdict === "descartar" ? ["radar-descartado"] : [])];
}

// ---------- Guarda de versiones: el plan nunca puede BAJAR una dependencia que el repo ya tiene más nueva ----------
// (caso dataforge #31: el issue pedía "actualizar a 1.1.x" con 1.5.3 en main y el modelo planeaba bajarla).
const cmpVer = (a, b) => {
  const pa = String(a).split(".").map((x) => parseInt(x, 10) || 0), pb = String(b).split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
};
export function versionPins(text) {
  const t = String(text || "").slice(0, 200000);
  const pins = [];
  const add = (name, ver) => pins.push({ pkg: name.toLowerCase().replace(/_/g, "-"), ver });
  for (const m of t.matchAll(/\b([A-Za-z0-9][A-Za-z0-9._-]{0,80})\s{0,3}(?:==|>=|~=)\s{0,3}(\d{1,5}(?:\.\d{1,5}){0,3})/g)) add(m[1], m[2]);
  for (const m of t.matchAll(/"(@?[a-z0-9][\w./-]{0,80})"\s{0,3}:\s{0,3}"[\^~]?(\d{1,5}(?:\.\d{1,5}){1,3})/gi)) add(m[1], m[2]);
  for (const m of t.matchAll(/(?:^|[\s'"`(])(@?[a-z0-9][\w./-]{0,80})@[\^~]?(\d{1,5}(?:\.\d{1,5}){1,3})/gi)) add(m[1], m[2]);
  return pins;
}
export function versionDowngrades(planText, manifestText) {
  const current = new Map();
  for (const p of versionPins(manifestText)) if (!current.has(p.pkg) || cmpVer(p.ver, current.get(p.pkg)) > 0) current.set(p.pkg, p.ver);
  const out = new Map();
  for (const p of versionPins(planText)) {
    const cur = current.get(p.pkg);
    if (cur && cmpVer(p.ver, cur) < 0 && !out.has(p.pkg)) out.set(p.pkg, { pkg: p.pkg, from: cur, to: p.ver });
  }
  return [...out.values()];
}

// Extrae el objeto JSON de la respuesta del modelo (tolera texto o fences alrededor).
export function parsePlanJson(text) {
  const t = String(text || "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}
