// radar_plan_format.mjs — normaliza y da formato al PLAN que el motor de Radar deja en cada issue. PURO y testeable.
// Decisión 2026-09-14: los PRs automáticos se pausaron (10 de 10 fallaron la revisión a fondo); el motor solo planifica.
const VERDICTS = ["implementar", "manual", "descartar"];
const IMPACTS = ["alto", "medio", "bajo"];
const clean = (s, max = 600) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (a, max = 12, len = 400) => (Array.isArray(a) ? a : []).map((x) => clean(x, len)).filter(Boolean).slice(0, max);

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

// Extrae el objeto JSON de la respuesta del modelo (tolera texto o fences alrededor).
export function parsePlanJson(text) {
  const t = String(text || "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}
