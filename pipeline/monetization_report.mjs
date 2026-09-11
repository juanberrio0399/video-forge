// monetization_report.mjs — Monetization Readiness Dashboard + Brain Report (Brain OS Fase 6).
// Lee el historial diario de ambos canales -> readiness + War Room 60 días -> escribe el registro
// del dashboard (channel/brain/monetization_report.json) e imprime un reporte para Telegram.
// Uso: node pipeline/monetization_report.mjs <hist_datalens.json> <hist_oddly.json> <out.json>
import fs from "node:fs";
import { MONET_GOALS, readiness, warRoom, reportChannel } from "./lib/monetization.mjs";

const [dlFile, odFile, outFile] = process.argv.slice(2);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; } };
const now = Date.now();

function build(chKey, histFile) {
  const hist = read(histFile);
  const rd = readiness(hist, MONET_GOALS[chKey], now);
  const wr = warRoom(rd, { windowDays: 60 });
  return { rd, wr };
}

const dl = build("data-lens", dlFile);
const od = build("auto2", odFile);

const report = {
  at: new Date().toISOString(),
  channels: {
    "data-lens": { readiness: dl.rd, war_room: dl.wr },
    "auto2": { readiness: od.rd, war_room: od.wr },
  },
  note: "Dashboard de monetización + War Room 60 días. FACT: métricas del historial. INFERENCE: proyección/riesgo/foco (mismo criterio que monetTrack, ahora puro y testeado).",
};

fs.writeFileSync(outFile || "monetization_report.json", JSON.stringify(report, null, 2));

const text = [
  "📊 Brain Report — Monetización",
  reportChannel("The Data Lens", dl.rd, dl.wr),
  reportChannel("Oddly Loop", od.rd, od.wr),
].join("\n\n");
console.log(text);
// Deja el texto en un archivo para que el workflow lo mande por Telegram.
try { fs.writeFileSync("brain_report.txt", text); } catch {}
