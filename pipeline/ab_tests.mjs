// ab_tests.mjs — corre los A/B por cohortes sobre los videos ya scoreados (Growth Fase 3).
// Lee scores.json (cada video trae hook_type + vs_baseline_pct + mature) y decide el ganador de
// cada experimento -> ab_tests.json. Nada de producción cambia; es medición + veredicto.
// Uso: node pipeline/ab_tests.mjs <scores.json> <abOut.json>
import fs from "node:fs";
import { runExperiment } from "./lib/ab_test.mjs";

const [scoresF, outF] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const videos = (read(scoresF, {}).scores) || [];

// Experimentos activos: UNA variable a la vez. Métrica = rendimiento vs baseline del canal (%).
const EXPERIMENTS = [
  { id: "hook_question_vs_statement", variable: "hook_type", metric: "vs_baseline_pct", variants: ["question", "statement"], min_per_variant: 4, min_lift: 20 },
  { id: "hook_curiosity_vs_statement", variable: "hook_type", metric: "vs_baseline_pct", variants: ["curiosity", "statement"], min_per_variant: 4, min_lift: 20 },
  // EXPERIMENTO DEL FORMATO (2026-10-03). Hipotesis: un HECHO concreto sobre UN sujeto, corto
  // y con metraje real de ese sujeto, rinde mas que una LISTA de 10-14 hechos genericos.
  // De donde sale: auditoria del canal. 41 Shorts maduros medidos a mano dan mediana de 46
  // vistas; el unico que desperto fue "Why Baby Otters Hold Hands" con 918 (20x), que es
  // justo ese formato. Es n=1, o sea una hipotesis, no una conclusion: por eso se mide.
  // min_lift alto (50%) a proposito: con 46 de mediana, una mejora chica es ruido.
  { id: "formato_un_hecho_vs_lista", variable: "variant", metric: "vs_baseline_pct", variants: ["un_hecho", "narrado"], min_per_variant: 5, min_lift: 50 },
];

const experiments = EXPERIMENTS.map((e) => runExperiment(videos, e));
const out = { at: new Date().toISOString(), n_videos: videos.length, experiments };
fs.writeFileSync(outF || "ab_tests.json", JSON.stringify(out, null, 2));

for (const r of experiments) {
  const parts = r.variants.map((v) => `${v}: n${r.measured[v] ? r.measured[v].n : 0} μ${r.measured[v] ? r.measured[v].mean : "—"}`).join(" vs ");
  console.log(`AB ${r.id}: ${parts} -> ${r.verdict}${r.lift != null ? ` (lift ${r.lift})` : ""}`);
}
