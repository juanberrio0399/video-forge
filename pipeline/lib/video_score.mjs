// video_score.mjs — Score universal por video + Matriz de outliers (Growth Roadmap Fase 2). PURO.
// Combina las señales que las neuronas ya miden (rendimiento vs baseline del canal, retención/hook,
// engagement, madurez) en un score 0-100 + un VEREDICTO accionable: SCALE / ITERATE / TEST_AGAIN /
// STOP. Y detecta OUTLIERS propios (videos que superan la mediana del canal) -> extrae su patrón
// para proponer un experimento. Reutiliza sampleConfidence/median y classifyHook. Sin dependencias.
import { sampleConfidence, median } from "./analytics_math.mjs";
import { classifyHook } from "./hook_calc.mjs";

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Umbrales del veredicto (por datos, no opinión). ratio = vpd del video / mediana del canal.
export const SCALE_RATIO = 1.3;   // >=30% sobre la mediana -> escalar el patrón
export const STOP_RATIO = 0.5;    // <50% de la mediana -> no repetir este patrón
const MATURE_DAYS = 5;            // Analytics va 2-3 días atrás; <5d aún no mide
const MIN_VIEWS = 50;            // muy pocas vistas -> sin señal

// ep: episodio (episode_calc) con vpd, vs_baseline_pct, age_days, views, likes.
// ret: retención opcional { hook_score, early_drop_pct }.
export function scoreVideo(ep = {}, ret = null, opts = {}) {
  const matureDays = opts.matureDays != null ? opts.matureDays : MATURE_DAYS;
  const minViews = opts.minViews != null ? opts.minViews : MIN_VIEWS;
  const views = Number(ep.views) || 0;
  const mature = ep.age_days != null && ep.age_days >= matureDays && views >= minViews;

  // Rendimiento relativo al canal: vs_baseline_pct (+30% => ratio 1.3).
  const ratio = ep.vs_baseline_pct == null ? null : (100 + Number(ep.vs_baseline_pct)) / 100;
  const perf = ratio == null ? null : clamp01(ratio / 2); // ratio 2 -> 1.0 ; 1 -> 0.5

  // Retención (si hay curva): hook alto + poca caída inicial.
  let retention = null;
  if (ret && (Number.isFinite(ret.hook_score) || Number.isFinite(ret.early_drop_pct))) {
    const hk = Number.isFinite(ret.hook_score) ? clamp01(ret.hook_score / 1.2) : 0.5;
    const drop = Number.isFinite(ret.early_drop_pct) ? clamp01(1 - ret.early_drop_pct / 100) : 0.5;
    retention = clamp01(0.6 * hk + 0.4 * drop);
  }

  // Engagement: likes/vistas (~5% = tope sano).
  const engagement = clamp01((views > 0 ? (Number(ep.likes) || 0) / views : 0) / 0.05);
  const confidence = sampleConfidence(views, opts.k != null ? opts.k : 200);

  // Score 0-100: pesos renormalizados entre las señales presentes.
  const parts = [];
  if (perf != null) parts.push([0.5, perf]);
  if (retention != null) parts.push([0.3, retention]);
  parts.push([0.2, engagement]);
  const wsum = parts.reduce((a, [w]) => a + w, 0) || 1;
  const overall = Math.round((parts.reduce((a, [w, v]) => a + w * v, 0) / wsum) * 100);

  // Veredicto.
  let verdict, reasons = [];
  if (!mature) {
    verdict = "TEST_AGAIN";
    reasons.push(ep.age_days != null && ep.age_days < matureDays ? `aún joven (${ep.age_days}d)` : `pocos datos (${views} vistas)`);
  } else if (ratio != null && ratio >= SCALE_RATIO && (retention == null || retention >= 0.5)) {
    verdict = "SCALE";
    reasons.push(`${Math.round((ratio - 1) * 100)}% sobre la mediana del canal`);
    if (retention != null && retention >= 0.5) reasons.push("retención sana");
  } else if (ratio != null && ratio < STOP_RATIO) {
    verdict = "STOP";
    reasons.push(`${Math.round((1 - ratio) * 100)}% bajo la mediana`);
  } else {
    verdict = "ITERATE";
    reasons.push(ratio != null ? `cerca de la mediana (${ratio.toFixed(2)}x)` : "sin baseline");
    if (retention != null && retention < 0.5) reasons.push("retención floja (mejora el hook)");
  }

  return {
    video_id: ep.video_id, title: ep.title || "",
    format: ep.format || null, hook_type: classifyHook(ep.title),
    vpd: ep.vpd != null ? ep.vpd : null, vs_baseline_pct: ep.vs_baseline_pct != null ? ep.vs_baseline_pct : null,
    perf_score: perf == null ? null : Math.round(perf * 100) / 100,
    retention_score: retention == null ? null : Math.round(retention * 100) / 100,
    engagement_score: Math.round(engagement * 100) / 100,
    confidence, overall, mature, verdict, reasons,
  };
}

// Matriz de OUTLIERS: videos maduros que superan la mediana por >= factor. Extrae el patrón
// dominante (formato + tipo de hook) para proponer un experimento (Fase 2 §22).
export function findOutliers(episodes, opts = {}) {
  const factor = opts.factor != null ? opts.factor : 1.5;
  const matureDays = opts.matureDays != null ? opts.matureDays : MATURE_DAYS;
  const eps = (episodes || []).filter((e) => e && e.age_days != null && e.age_days >= matureDays);
  const outliers = eps
    .filter((e) => e.vs_baseline_pct != null && (100 + Number(e.vs_baseline_pct)) / 100 >= factor)
    .map((e) => ({ video_id: e.video_id, title: e.title || "", format: e.format || null, hook_type: classifyHook(e.title), vpd: e.vpd != null ? e.vpd : null, vs_baseline_pct: e.vs_baseline_pct }))
    .sort((a, b) => (b.vs_baseline_pct || 0) - (a.vs_baseline_pct || 0));

  // Patrón dominante entre los outliers (moda de hook_type y de formato).
  const mode = (arr) => {
    const c = {}; for (const x of arr) if (x) c[x] = (c[x] || 0) + 1;
    const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return e ? { value: e[0], count: e[1] } : null;
  };
  const hookMode = mode(outliers.map((o) => o.hook_type));
  const fmtMode = mode(outliers.map((o) => o.format));
  const suggestion = outliers.length
    ? `Replicar el patrón de los outliers: hook "${hookMode ? hookMode.value : "?"}"${fmtMode ? ` en formato ${fmtMode.value}` : ""} (${outliers.length} video(s) superan ${Math.round((factor - 1) * 100)}% la mediana).`
    : "Aún sin outliers claros; seguir midiendo.";

  return { factor, count: outliers.length, outliers, pattern: { hook: hookMode, format: fmtMode }, suggestion };
}
