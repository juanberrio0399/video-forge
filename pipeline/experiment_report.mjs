// experiment_report.mjs — runner del reporte semanal de experimentos (Growth Fase 3).
// Mantiene el BANCO de creativos (lo siembra desde los outliers de Fase 2) y ENSAMBLA el reporte
// del canal desde los registros que ya viven en R2. Escribe report + bank e imprime el texto.
// Uso: node pipeline/experiment_report.mjs <channel> <scores> <hyps> <monet> <decision> <bankIn> <reportOut> <bankOut>
import fs from "node:fs";
import { seedFromOutliers } from "./lib/creative_bank.mjs";
import { buildReport, formatReport } from "./lib/experiment_report.mjs";

const [channel, scoresF, hypsF, monetF, decisionF, bankInF, reportOutF, bankOutF] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const scores = read(scoresF, {});
const hypotheses = read(hypsF, []);
const monetization = read(monetF, {});
const decision = read(decisionF, {});
let bank = read(bankInF, []);
if (!Array.isArray(bank)) bank = bank.items || [];

// Sembrar el banco con el patrón ganador (idempotente).
bank = seedFromOutliers(bank, scores.outliers, channel);

const report = buildReport({ channel, scores, hypotheses, monetization, decision, bank });

if (reportOutF) fs.writeFileSync(reportOutF, JSON.stringify(report, null, 2));
if (bankOutF) fs.writeFileSync(bankOutF, JSON.stringify(bank, null, 2));

const NAME = channel === "auto2" ? "Oddly Loop" : channel === "data-lens" ? "The Data Lens" : channel;
const text = formatReport(report, NAME);
console.log(text);
try { fs.writeFileSync("report_text.txt", text); } catch {}
