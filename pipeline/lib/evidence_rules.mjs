// evidence_rules.mjs — genera EVIDENCIA para el registro de hipótesis (Brain OS Fase 4b, §18).
// Honesto: cada regla compara una señal del video contra el baseline del canal (no opinión).
// PURO y testeable. Cierra el loop retención -> evidencia -> hipótesis.
import { classifyHook } from "./hook_calc.mjs";

function median(xs) {
  const a = (xs || []).filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// episodes: [{video_id, title, ...}] · retentionById: {video_id -> {early_drop_pct, hook_score, ...}}
// Devuelve [{hypothesis_id, direction:+1|-1, weight, episode_id, note}].
export function gatherEvidence(episodes, retentionById) {
  const eps = episodes || [];
  const ret = retentionById || {};
  const ev = [];
  // Baseline: mediana de la caída inicial (solo videos con curva).
  const medDrop = median(eps.map((e) => (ret[e.video_id] || {}).early_drop_pct));
  if (medDrop == null) return ev;
  for (const e of eps) {
    const r = ret[e.video_id];
    if (!r || !Number.isFinite(r.early_drop_pct)) continue;
    // Hipótesis: los hooks con PREGUNTA mejoran la retención inicial.
    // Evidencia +1 si su caída inicial es <= la mediana del canal; -1 si es peor.
    if (classifyHook(e.title) === "question") {
      ev.push({
        hypothesis_id: "global-question-hook",
        direction: r.early_drop_pct <= medDrop ? 1 : -1,
        weight: 1,
        episode_id: e.video_id,
        note: `hook=pregunta · caída inicial ${r.early_drop_pct}% vs mediana ${medDrop}%`,
      });
    }
  }
  return ev;
}
