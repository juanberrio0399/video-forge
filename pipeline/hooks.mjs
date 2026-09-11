// hooks.mjs — HookNeuron + alimentar el registro de hipótesis (Brain OS Fase 4b).
// Lee episodios + retención de un canal -> construye la memoria de hooks y AÑADE evidencia real
// al registro de hipótesis (idempotente por episodio+hipótesis).
// Uso: node pipeline/hooks.mjs <episodes.json> <retention.json> <hypotheses.json> <hooksOut.json>
import fs from "node:fs";
import { summarizeHooks } from "./lib/hook_calc.mjs";
import { gatherEvidence } from "./lib/evidence_rules.mjs";
import { addEvidence, recompute } from "./lib/hypothesis.mjs";

const [epFile, retFile, hypFile, hooksOut] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const episodes = (read(epFile, {}).episodes) || [];
const retById = {};
for (const v of (read(retFile, {}).videos) || []) retById[v.video_id] = v;

// 1) Memoria de hooks (ganadores vs fallidos por tipo).
const hookMemory = { at: new Date().toISOString(), by_type: summarizeHooks(episodes, retById) };
fs.writeFileSync(hooksOut || "hooks.json", JSON.stringify(hookMemory, null, 2));

// 2) Evidencia -> registro de hipótesis (no re-añade la del mismo episodio+hipótesis).
let reg = read(hypFile, []);
if (!Array.isArray(reg)) reg = reg.hypotheses || [];
const byId = new Map(reg.map((h) => [h.id, h]));
let added = 0;
for (const e of gatherEvidence(episodes, retById)) {
  const h = byId.get(e.hypothesis_id);
  if (!h) continue;
  if ((h.evidence || []).some((x) => x.episode_id === e.episode_id)) continue; // idempotente
  byId.set(h.id, addEvidence(h, e));
  added++;
}
const outReg = [...byId.values()].map(recompute);
if (hypFile) fs.writeFileSync(hypFile, JSON.stringify(outReg, null, 2));
console.log(`hooks: ${Object.keys(hookMemory.by_type).length} tipos en memoria; evidencia añadida al registro: ${added}`);
