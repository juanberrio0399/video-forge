// alerts.mjs — runner de alertas de crecimiento (Growth Fase 4). Lee la memoria del canal en R2,
// corre las reglas y escribe alerts.json. Imprime SOLO las alertas accionables (warn/critical)
// para que el workflow las mande por Telegram (sin ruido cuando todo va bien).
// Uso: node pipeline/alerts.mjs <channel> <history> <episodes> <monetization_report> <decision> <alertsOut>
import fs from "node:fs";
import { evaluateAlerts, SEVERITY } from "./lib/alerts.mjs";

const [channel, histF, epF, monetF, decF, outF] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const history = read(histF, []);
const episodes = (read(epF, {}).episodes) || [];
const monet = read(monetF, {});
const decision = read(decF, {});
const ch = (monet.channels && monet.channels[channel]) || {};

const historyKeys = channel === "auto2"
  ? [{ key: "subs", label: "Suscriptores" }, { key: "shorts_views", label: "Vistas de Shorts" }]
  : [{ key: "subs", label: "Suscriptores" }, { key: "views", label: "Vistas" }];

const alerts = evaluateAlerts({
  channel,
  history: Array.isArray(history) ? history : [],
  historyKeys,
  episodes,
  allocation: decision.recommended_allocation || null,
  readiness: ch.readiness || null,
  warRoom: ch.war_room || null,
});

const out = { at: new Date().toISOString(), channel, count: alerts.length, alerts };
fs.writeFileSync(outF || "alerts.json", JSON.stringify(out, null, 2));

const NAME = channel === "auto2" ? "Oddly Loop" : channel === "data-lens" ? "The Data Lens" : channel;
const actionable = alerts.filter((a) => SEVERITY[a.severity] <= SEVERITY.warn);
const ICON = { critical: "🔴", warn: "🟡", info: "🔵" };
console.log(`alerts ${channel}: ${alerts.length} (${actionable.length} accionables)`);
if (actionable.length) {
  const text = `🚨 Alertas — ${NAME}\n` + actionable.map((a) => `${ICON[a.severity] || "•"} ${a.title}: ${a.detail}`).join("\n");
  try { fs.writeFileSync("alerts_text.txt", text); } catch {}
  console.log(text);
} else {
  try { fs.unlinkSync("alerts_text.txt"); } catch {}
}
