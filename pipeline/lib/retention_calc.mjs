// retention_calc.mjs — análisis PURO de la curva de retención de un video (Brain OS Fase 4, §6.4).
// curve = [{ ratio, watch }] donde ratio = elapsedVideoTimeRatio (0..1) y watch = audienceWatchRatio.
// Determinista y testeable. Convierte la curva en señales: caída inicial, punto más débil, hook.

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const rp = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x));

// watch del punto cuyo ratio está más cerca de r.
function watchAt(pts, r) {
  let best = pts[0];
  for (const p of pts) if (Math.abs(p.ratio - r) < Math.abs(best.ratio - r)) best = p;
  return best.watch;
}

export function analyzeRetention(curve) {
  const pts = (curve || [])
    .filter((p) => p && Number.isFinite(p.ratio) && Number.isFinite(p.watch))
    .sort((a, b) => a.ratio - b.ratio);
  if (pts.length < 2) {
    return { points: pts.length, start_watch: null, early_drop_pct: null, weakest_at: null, avg_watch: null, hook_score: null };
  }
  const base = pts[0].watch || 1;                 // retención al inicio (~ratio 0), normalmente 1
  const at3 = watchAt(pts, 0.03);                 // ~primeros segundos
  const early_drop_pct = base ? rp((1 - at3 / base) * 100) : null; // caída 0 -> 3%
  const avg = pts.reduce((s, p) => s + p.watch, 0) / pts.length;
  // punto más débil = mayor caída entre puntos consecutivos.
  let weakest = null, maxDrop = -Infinity;
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i - 1].watch - pts[i].watch;
    if (d > maxDrop) { maxDrop = d; weakest = pts[i].ratio; }
  }
  return {
    points: pts.length,
    start_watch: r3(base),
    early_drop_pct,
    weakest_at: r3(weakest),
    avg_watch: r3(avg),
    hook_score: r3(watchAt(pts, 0.1)), // retención al ~10% = fuerza del hook
  };
}
