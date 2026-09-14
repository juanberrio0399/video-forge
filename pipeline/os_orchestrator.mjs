// os_orchestrator.mjs — ORCHESTRATOR del AI OS. Normaliza con el contrato los pulses de Video Forge, Viento y
// Radar (lo que no cumple el contrato se descarta y se reporta), aplica "sin señal" a los viejos y arma el
// GLOBAL que ven las tres Mini Apps: estado, titular, decisiones, actividad, tareas vivas y prioridad del día.
// Uso: node pipeline/os_orchestrator.mjs <out_global.json> <pulse1.json> [pulse2.json ...]
//      Escribe además os_pulse_<system>.norm.json por cada pulse válido.
import fs from "node:fs";
import { makePulse, mergeGlobal, validatePulse } from "./lib/os_contract.mjs";

const [outF, ...pulseFiles] = process.argv.slice(2);
const now = Date.now();
const pulses = [], problems = [];
for (const f of pulseFiles) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { problems.push(`${f}: ilegible o ausente`); continue; }
  if (!raw || !raw.system) { problems.push(`${f}: sin sistema`); continue; }
  try {
    const p = makePulse(raw, Date.parse(raw.at) || now);
    const v = validatePulse(p);
    if (!v.ok) problems.push(`${p.system}: ${v.errors.join(", ")}`);
    pulses.push(p);
    fs.writeFileSync(`os_pulse_${p.system}.norm.json`, JSON.stringify(p, null, 2));
  } catch (e) { problems.push(`${f}: ${e.message}`); }
}
const global = mergeGlobal(pulses, now, { maxAgeMin: 180 });
global.orchestrator = { pulses_ok: pulses.length, problems };
fs.writeFileSync(outF || "os_global.json", JSON.stringify(global, null, 2));
console.log(`orchestrator: ${global.status} · sistemas ${global.systems.map((s) => `${s.system}=${s.status}${s.stale ? "(sin señal)" : ""}`).join(" ")} · decisiones ${global.counts.needs} · activos ${global.counts.active}`);
if (problems.length) console.log(`  problemas: ${problems.join(" | ")}`);
