// baseline.mjs — BaselineNeuron (Fase 1). Lee weekly_stats.json y escribe el baseline por canal:
//   baseline.json        (Data Lens)  -> el workflow lo sube a channel/baseline.json
//   baseline_auto2.json  (Oddly)      -> el workflow lo sube a channel/auto2/baseline.json
// Permite juzgar cada video/semana por rendimiento RELATIVO (+X% vs baseline) en vez de umbrales fijos.
// Uso: node pipeline/baseline.mjs [weekly_stats.json]
import fs from "node:fs";
import { computeBaseline } from "./lib/baseline_calc.mjs";

const src = process.argv[2] || "weekly_stats.json";
let data = {};
try { data = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error("baseline: no pude leer", src, "-", e.message); process.exit(0); }

const chans = (data && data.channels) || {};
function write(chKey, file) {
  const c = chans[chKey];
  if (!c) { console.log(`baseline: sin datos de ${chKey} (omito)`); return; }
  const b = { channel: c.name || chKey, at: new Date().toISOString(), ...computeBaseline(c.weeks || []) };
  fs.writeFileSync(file, JSON.stringify(b, null, 2));
  console.log(`baseline ${chKey}: mediana ${b.median_weekly_views} vistas/sem sobre ${b.weeks_used} sem -> ${file}`);
}
write("data_lens", "baseline.json");
write("oddly", "baseline_auto2.json");
