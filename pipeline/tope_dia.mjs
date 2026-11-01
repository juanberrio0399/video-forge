// tope_dia.mjs (CLI) — el tope diario de Oddly para los pasos de bash de los workflows.
// El tope se lee de TOPE_FILE (channel/auto2/variants.json); sin TOPE_FILE no hay tope.
//
//   node pipeline/tope_dia.mjs cola "<ocupadas_csv>"          -> "1" si la cola ya cubre 2 dias (no producir)
//   node pipeline/tope_dia.mjs franja <iso> "<ocupadas_csv>"  -> "1" si el dia de esa franja ya esta lleno
import { colaLlena, diaLleno, leerTope } from "./lib/tope_dia.mjs";

const csv = (s) => String(s || "").split(",").filter(Boolean).map(Date.parse).filter(Number.isFinite);
const tope = leerTope(process.env.TOPE_FILE);
const [modo, a, b] = process.argv.slice(2);

if (modo === "cola") process.stdout.write(colaLlena(csv(a), tope) ? "1" : "0");
else if (modo === "franja") process.stdout.write(diaLleno(Date.parse(a), csv(b), tope) ? "1" : "0");
else { console.error("uso: tope_dia.mjs cola <csv> | franja <iso> <csv>"); process.exit(2); }
