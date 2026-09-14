// monetization_report.mjs — Monetization Readiness Dashboard + Brain Report (corregido por la auditoría).
// Lee el historial de métricas YPP por VENTANA (ypp_history.json, lo escribe ypp_metrics.mjs) de ambos
// canales -> readiness + War Room + niveles del programa (intermedio/completo) + viabilidad, y escribe
// channel/brain/monetization_report.json. Lo que no se pudo medir aparece como "sin dato".
// Uso: node pipeline/monetization_report.mjs <ypp_hist_datalens.json> <ypp_hist_oddly.json> <out.json> [ypp_dl.json] [ypp_od.json]
import fs from "node:fs";
import { MONET_GOALS, readiness, warRoom, reportChannel } from "./lib/monetization.mjs";
import { evaluateYpp } from "./lib/ypp.mjs";

const [dlFile, odFile, outFile, dlSnapFile, odSnapFile] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const now = Date.now();

function build(chKey, histFile, snapFile) {
  const hist = read(histFile, []);
  const snap = read(snapFile, null);
  const rd = readiness(hist, MONET_GOALS[chKey], now);
  const wr = warRoom(rd, { windowDays: 60 });
  const last = Array.isArray(hist) && hist.length ? hist[hist.length - 1] : {};
  const ypp = evaluateYpp(last, hist, { nowMs: now, deadline: MONET_GOALS[chKey].deadline });
  const quality = {
    snapshot_at: snap && snap.at || null,
    availability: snap && snap.availability || {},
    errors: snap && snap.errors || [],
    diagnostics: snap ? { traffic_28d: snap.traffic_28d, impressions_28d: snap.impressions_28d, ctr_28d: snap.ctr_28d } : null,
  };
  return { rd, wr, ypp, quality };
}

const dl = build("data-lens", dlFile, dlSnapFile);
const od = build("auto2", odFile, odSnapFile);

const report = {
  at: new Date().toISOString(),
  channels: {
    "data-lens": { readiness: dl.rd, war_room: dl.wr, ypp: dl.ypp, data_quality: dl.quality },
    "auto2": { readiness: od.rd, war_room: od.wr, ypp: od.ypp, data_quality: od.quality },
  },
  note: "Requisitos reales del YouTube Partner Program por ventana. HECHO: métricas de Analytics con su ventana. INFERENCIA: ritmo, viabilidad y foco. null = sin dato (no se inventa).",
};
fs.writeFileSync(outFile || "monetization_report.json", JSON.stringify(report, null, 2));

const FEAS = { cumplido: "✅ cumplido", en_camino: "🟢 en camino", midiendo: "🟡 midiendo", en_riesgo: "🟠 en riesgo", improbable: "🔴 improbable al ritmo actual", sin_dato: "⚪ sin dato" };
const tierLine = (y) => `  Nivel intermedio: ${FEAS[y.tiers.expanded.status]} · Completo: ${FEAS[y.tiers.full.status]}`;
const text = [
  "📊 Brain Report — Monetización (requisitos reales por ventana)",
  reportChannel("The Data Lens", dl.rd, dl.wr) + "\n" + tierLine(dl.ypp),
  reportChannel("Oddly Loop", od.rd, od.wr) + "\n" + tierLine(od.ypp),
].join("\n\n");
console.log(text);
try { fs.writeFileSync("brain_report.txt", text); } catch {}
