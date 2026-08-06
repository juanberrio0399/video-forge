// compliance_check.mjs — PUERTA LEGAL del canal automático #2. Antes de publicar una
// compilación, verifica que TODO el material sea usable legalmente y que la pieza sea
// TRANSFORMADORA. Sale 1 (BLOQUEA la publicación) si algo no cumple. Sale 0 si es seguro.
//
// Uso: node pipeline/compliance_check.mjs <manifest.json> [sources.json]
// manifest.json = { niche, clips:[{clip_id,source,license,url,attribution}], transform:{narration,editing,original_script} }
import fs from "node:fs";

const [manifestPath, sourcesPath = "channel/auto2/sources.seed.json"] = process.argv.slice(2);

function readJSON(p, dflt) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return dflt; } }
const src = readJSON(sourcesPath, {});
const allow = new Set((src.allow_licenses || []).map((s) => String(s).toLowerCase()));
const deny = new Set((src.deny_sources || []).map((s) => String(s).toLowerCase()));
const denyLic = new Set((src.deny_licenses || []).map((s) => String(s).toLowerCase()));
const m = readJSON(manifestPath, null);

const fails = [];
if (!m || !Array.isArray(m.clips) || !m.clips.length) {
  fails.push("manifiesto vacío o sin clips");
} else {
  m.clips.forEach((c, i) => {
    const lic = String(c.license || "").toLowerCase();
    const source = String(c.source || "unknown").toLowerCase();
    const tag = c.clip_id || c.url || `clip#${i + 1}`;
    if (deny.has(source)) fails.push(`${tag}: fuente PROHIBIDA (${source})`);
    else if (denyLic.has(lic)) fails.push(`${tag}: licencia PROHIBIDA (${lic} — share-alike/no-comercial no sirven para monetizar)`);
    else if (!allow.has(lic)) fails.push(`${tag}: licencia no permitida (${lic || "sin licencia"})`);
    // CC-BY (y CC-BY-SA si se colara) exigen atribución.
    if ((lic === "cc-by") && !String(c.attribution || "").trim()) fails.push(`${tag}: CC-BY sin atribución`);
  });
}

// La pieza debe ser TRANSFORMADORA: narración original + edición (no solo re-subir clips).
const tr = (m && m.transform) || {};
if (!tr.narration) fails.push("falta narración original (transformación)");
if (!tr.editing && !tr.original_script) fails.push("falta edición/guion original (transformación)");

if (fails.length) {
  fs.writeFileSync("compliance_fail.txt", fails.join("\n"));
  console.error("🚫 COMPLIANCE FALLA — NO se publica:\n- " + fails.join("\n- "));
  process.exit(1);
}
console.log(`✅ Compliance OK: ${m.clips.length} clips con licencia + pieza transformadora. Seguro publicar.`);
process.exit(0);
