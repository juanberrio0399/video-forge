// decide.mjs — DecisionNeuron (Brain OS Fase 5). Lee lo que las neuronas ya midieron para un
// canal y escribe un REGISTRO de decisión explicable (channel/brain/decision.json): candidatos
// con recompensa rica + score (expected_value/confidence/risk/learning_value) + el reparto de
// slots recomendado por el bandit Thompson, sembrado por ISO-week (estable dentro de la semana).
// Es la fuente que consumen el rebalance del canal, la Mini App y el dashboard (Fase 6).
// Uso: node pipeline/decide.mjs <state.json> <decisionOut.json> [total] [weekTag]
import fs from "node:fs";
import { richReward, scoreCandidate, proportionalByScore } from "./lib/decision.mjs";

const [stateFile, outFile, totalArg, weekArg] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

// ISO-week (misma semana -> misma semilla -> mismo reparto; no salta en cada corrida).
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const state = read(stateFile, {});
const week = weekArg || isoWeek(new Date());

// Construye candidatos desde el ranking de nichos (vistas/día + nº de videos = muestras).
// Soporta la forma de Oddly (niche_ranking:[{label,avg_vpd,videos}]) y una genérica (ranking:[{key,vpd,samples}]).
const rows = state.niche_ranking || state.ranking || [];
const rawCands = rows.map((r) => ({
  key: r.key || r.label,
  label: r.label || r.key,
  vpd: Math.max(0, +r.avg_vpd || +r.vpd || 0),
  samples: Math.max(0, +r.videos || +r.samples || 0),
})).filter((c) => c.key);

const refVpd = Math.max(1, ...rawCands.map((c) => c.vpd));
const candidates = rawCands.map((c) => {
  const reward = richReward({ vpd: c.vpd }, { vpd: refVpd });
  return { ...c, reward, ...scoreCandidate({ key: c.key, reward, samples: c.samples }) };
});

const total = Math.max(0, Math.floor(+totalArg || 0)) ||
  Object.values(state.cadence?.shorts_per_category || {}).reduce((a, b) => a + (+b || 0), 0) || 8;

const { alloc } = proportionalByScore(
  candidates.map((c) => ({ key: c.key, reward: c.reward, samples: c.samples })),
  total,
);

const decision = {
  at: new Date().toISOString(),
  week, engine: "score(reward*confidence)", total,
  ref: { vpd: refVpd },
  // FACT: vpd/samples medidos. INFERENCE: reward/score/alloc del motor (no opinión).
  candidates: candidates.sort((a, b) => b.score - a.score),
  recommended_allocation: alloc,
  note: "Reparto por confianza (score = vistas/dia * confianza), no proporcional-ciego. Nada de producción está obligado a seguirlo; el rebalance del canal lo consume con fallback.",
};

fs.writeFileSync(outFile || "decision.json", JSON.stringify(decision, null, 2));
const line = candidates.map((c) => `${c.key} r=${c.reward.toFixed(2)}(n${c.samples})->${alloc[c.key] || 0}`).join(" · ");
console.log(`decide[${week}] total=${total}: ${line}`);
