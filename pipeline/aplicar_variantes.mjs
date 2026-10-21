// aplicar_variantes.mjs — reescribe en el sitio la cadencia y el experimento con el formato fijado.
// Uso: node pipeline/aplicar_variantes.mjs <cadence.json> <experiments.json> <variants.json>
import fs from "node:fs";
import { aplicarACadencia, aplicarAExperimento } from "./lib/variantes_fijas.mjs";

const [cadF, expF, fijF] = process.argv.slice(2);
const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const cad = rj(cadF, null);
if (!cad || !cad.shorts_per_category) { console.error("aplicar_variantes: la cadencia viva no se pudo leer; no se toca nada"); process.exit(1); }
const fijas = rj(fijF, {});
const nueva = aplicarACadencia(cad, fijas);
fs.writeFileSync(cadF, JSON.stringify(nueva, null, 2));
fs.writeFileSync(expF, JSON.stringify(aplicarAExperimento(rj(expF, {}), fijas), null, 2));
console.log("Reparto (sin cambios):", JSON.stringify(nueva.shorts_per_category));
console.log("Variantes:", JSON.stringify(nueva.variant));
