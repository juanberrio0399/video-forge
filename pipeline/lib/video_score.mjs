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
  const minViews = opts.minViews != null ? opts.minViews : MIN_VIEWS; // piso de vistas: evita "outliers" de baseline casi-cero
  const eps = (episodes || []).filter((e) => e && e.age_days != null && e.age_days >= matureDays && (Number(e.views) || 0) >= minViews);
  const outliers = eps
    .filter((e) => e.vs_baseline_pct != null && (100 + Number(e.vs_baseline_pct)) / 100 >= factor)
    .map((e) => ({ video_id: e.video_id, title: e.title || "", format: e.format || null, hook_type: classifyHook(e.title), vpd: e.vpd != null ? e.vpd : null, vs_baseline_pct: e.vs_baseline_pct }))
    .sort((a, b) => (b.vs_baseline_pct || 0) - (a.vs_baseline_pct || 0));

  // PATRON ENTRE LOS OUTLIERS, CORREGIDO POR TASA BASE.
  //
  // Antes esto tomaba la MODA del hook entre los outliers y la proponia como patron a
  // replicar. Eso es la falacia de la tasa base: si el 91% del canal usa hooks de tipo
  // "number", el ~91% de los outliers seran "number" aunque ese hook sea neutro o malo.
  // Peor: la sugerencia hace producir mas de lo mismo, la proporcion sube, y la proxima
  // corrida lo "confirma". Un bucle que encierra al canal en el formato que ya tiene.
  // (Visto en Oddly el 2026-10-03: "replicar hook number", con 47 de 49 outliers... sobre
  // un canal hecho casi entero de listicles.)
  //
  // Ahora se compara la proporcion DENTRO de los outliers contra la proporcion en toda la
  // poblacion madura. Solo es patron lo que esta SOBRE-representado (lift) y con muestra.
  const cuenta = (arr, f) => { const c = {}; for (const x of arr) { const k = f(x); if (k) c[k] = (c[k] || 0) + 1; } return c; };
  const conHook = eps.map((e) => ({ ...e, hook_type: classifyHook(e.title) }));

  function patron(campo) {
    const enOut = cuenta(outliers, (o) => o[campo]);
    const enTodo = cuenta(conHook, (e) => e[campo]);
    const nOut = outliers.length, nTodo = conHook.length;
    if (!nOut || !nTodo) return null;
    const filas = Object.entries(enOut).map(([valor, k]) => {
      const base = (enTodo[valor] || 0) / nTodo;      // proporcion en el canal
      const share = k / nOut;                          // proporcion entre los ganadores
      return { value: valor, count: k, share: +share.toFixed(3), base_rate: +base.toFixed(3), lift: base > 0 ? +(share / base).toFixed(2) : null };
    }).sort((a, b) => (b.lift || 0) - (a.lift || 0));
    return filas[0] || null;
  }

  const hookTop = patron("hook_type");
  const fmtTop = patron("format");

  // Umbrales: sobre-representado al menos 30% y con al menos 3 ganadores detras.
  const LIFT_MIN = 1.3, MIN_GANADORES = 3;
  const real = (p) => !!(p && p.lift != null && p.lift >= LIFT_MIN && p.count >= MIN_GANADORES);

  let suggestion;
  if (!outliers.length) {
    suggestion = "Aún sin outliers claros; seguir midiendo.";
  } else if (real(hookTop) || real(fmtTop)) {
    const partes = [];
    if (real(hookTop)) partes.push(`hook "${hookTop.value}" (${Math.round(hookTop.share * 100)}% de los ganadores vs ${Math.round(hookTop.base_rate * 100)}% del canal, ×${hookTop.lift})`);
    if (real(fmtTop)) partes.push(`formato ${fmtTop.value} (×${fmtTop.lift})`);
    suggestion = `Replicar lo que está SOBRE-representado entre los ganadores: ${partes.join(" · ")} — ${outliers.length} video(s) superan ${Math.round((factor - 1) * 100)}% la mediana.`;
  } else {
    // Honesto: hay ganadores, pero se parecen al resto del canal. No hay nada que replicar.
    const dom = hookTop ? ` El más común entre ellos ("${hookTop.value}") lo es porque ya es ${Math.round(hookTop.base_rate * 100)}% del canal, no porque funcione (×${hookTop.lift}).` : "";
    suggestion = `${outliers.length} video(s) superan ${Math.round((factor - 1) * 100)}% la mediana, pero NINGÚN patrón está sobre-representado: lo que ganó se parece al resto.${dom} Hace falta PROBAR algo distinto, no replicar.`;
  }

  return { factor, count: outliers.length, outliers, pattern: { hook: hookTop, format: fmtTop, lift_min: LIFT_MIN, base_rate_corrected: true }, suggestion };
}
