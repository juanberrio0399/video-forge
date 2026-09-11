// cross_validate.mjs — runner del protocolo de 2 agentes (Growth Fase 5). Cruza el Growth Radar
// (externo) con nuestra evidencia interna (hipótesis + A/B + outliers) de un canal y escribe
// cross_validation.json + el texto para Telegram. Solo lectura de datos.
// Uso: node pipeline/cross_validate.mjs <channel> <growth_radar.json> <hyps.json> <ab.json> <scores.json> <out.json>
import fs from "node:fs";
import { parseClaims, findingsFromHypotheses, findingsFromAB, findingFromOutliers, reconcile, formatCross } from "./lib/cross_validate.mjs";

const [channel, radarF, hypsF, abF, scoresF, outF] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const radar = read(radarF, {});
const claims = parseClaims(radar.report || "");
const findings = [
  ...findingsFromHypotheses(read(hypsF, [])),
  ...findingsFromAB(read(abF, {})),
  ...findingFromOutliers(read(scoresF, {})),
];

const { results, summary } = reconcile(claims, findings, { minOverlap: 1 });
const out = { at: new Date().toISOString(), channel, radar_at: radar.at || null, n_claims: claims.length, n_findings: findings.length, summary, results };
fs.writeFileSync(outF || "cross_validation.json", JSON.stringify(out, null, 2));

const NAME = channel === "auto2" ? "Oddly Loop" : channel === "data-lens" ? "The Data Lens" : channel;
const text = formatCross({ channel, results, summary }, NAME);
console.log(`cross ${channel}: ${claims.length} afirmaciones vs ${findings.length} findings -> ${JSON.stringify(summary)}`);
// Solo mandar por Telegram si hay algo que decir (contradicciones/confirmaciones/experimentos).
const actionable = results.some((r) => r.classification !== "INCIERTA");
if (claims.length && actionable) { try { fs.writeFileSync("cross_text.txt", text); } catch {} }
else { try { fs.unlinkSync("cross_text.txt"); } catch {} }
