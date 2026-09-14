// niche_rank.mjs — Ranking de nichos ROBUSTO (auditoría BR-07/BR-09). PURO.
// Antes: MEDIA de vistas/día acumuladas de TODOS los videos (un viral viejo arrastraba el nicho) y nichos
// adivinados por palabras del título. Ahora: MEDIANA de vistas/día de una COHORTE comparable (videos
// públicos de 5 a 30 días), mínimo de muestra por nicho, y los nichos inferidos quedan fuera del ranking.
// Además: la regla de ESCALADO de volumen solo se habilita si la cohorte reciente no rinde peor que la
// anterior medida a la MISMA edad (vistas al día 7), nunca por vistas acumuladas de edades distintas.

const DAY = 86400000;

export function median(values) {
  const xs = (values || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

const ageDays = (v, nowMs) => {
  const t = Date.parse(v && (v.pub_iso || v.published_at));
  return Number.isFinite(t) ? (nowMs - t) / DAY : null;
};

// Videos elegibles para medir un nicho: públicos, con nicho REAL (no inferido) y edad dentro de la ventana.
export function cohort(list, opts = {}) {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const minAge = opts.minAge != null ? opts.minAge : 5;
  const maxAge = opts.maxAge != null ? opts.maxAge : 30;
  const excludeInferred = opts.excludeInferred !== false;
  const out = [];
  let inferred = 0;
  for (const v of list || []) {
    if (!v || v.privacy !== "public" || !v.niche) continue;
    const age = ageDays(v, nowMs);
    if (age === null || age < minAge || age > maxAge) continue;
    if (excludeInferred && v.niche_inferred) { inferred++; continue; }
    out.push({ ...v, _age: age, _vpd: (Number(v.views) || 0) / Math.max(1, age) });
  }
  return { videos: out, excluded_inferred: inferred };
}

// Ranking por mediana de la cohorte. sufficient = hay muestra para decidir (si no, solo exploración).
export function rankNiches(list, opts = {}) {
  const minN = opts.minN != null ? opts.minN : 5;
  const { videos, excluded_inferred } = cohort(list, opts);
  const channelMedian = median(videos.map((v) => v._vpd));
  const by = {};
  for (const v of videos) (by[v.niche] = by[v.niche] || { label: v.niche_label || v.niche, vals: [] }).vals.push(v._vpd);
  const rows = Object.entries(by).map(([key, g]) => {
    const med = median(g.vals);
    return {
      key, label: g.label, n: g.vals.length,
      median_vpd: med === null ? null : Math.round(med * 10) / 10,
      rel: channelMedian ? Math.round((med / channelMedian) * 100) / 100 : null,
      sufficient: g.vals.length >= minN,
    };
  }).sort((a, b) => (Number(b.sufficient) - Number(a.sufficient)) || ((b.median_vpd || 0) - (a.median_vpd || 0)));
  return {
    window_days: [opts.minAge != null ? opts.minAge : 5, opts.maxAge != null ? opts.maxAge : 30],
    min_n: minN, channel_median_vpd: channelMedian === null ? null : Math.round(channelMedian * 10) / 10,
    cohort_size: videos.length, excluded_inferred, rows,
  };
}

// Regla de escalado: compara vistas al día 7 de la cohorte reciente (publicada hace 7-14 días) vs la
// anterior (14-21 días). Sin muestra suficiente -> NO escala ("sin_dato"), nunca asume.
// viewsAtAge: { video_id: { d7: views, published_at } }
export function scaleGate(viewsAtAge, opts = {}) {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const minN = opts.minN != null ? opts.minN : 5;
  const maxDrop = opts.maxDrop != null ? opts.maxDrop : 0.25;
  const recent = [], prior = [];
  for (const rec of Object.values(viewsAtAge || {})) {
    if (!rec || !Number.isFinite(Number(rec.d7))) continue;
    const age = ageDays(rec, nowMs);
    if (age === null) continue;
    if (age >= 7 && age < 14) recent.push(Number(rec.d7));
    else if (age >= 14 && age < 21) prior.push(Number(rec.d7));
  }
  if (recent.length < minN || prior.length < minN) {
    return { allow: false, status: "sin_dato", recent_n: recent.length, prior_n: prior.length, reason: `muestra insuficiente de vistas al día 7 (reciente ${recent.length}, anterior ${prior.length}; mínimo ${minN})` };
  }
  const mr = median(recent), mp = median(prior);
  const change = mp > 0 ? (mr - mp) / mp : 0;
  const allow = change >= -maxDrop;
  return {
    allow, status: allow ? "permitido" : "bloqueado", recent_n: recent.length, prior_n: prior.length,
    recent_median_d7: Math.round(mr), prior_median_d7: Math.round(mp), change_pct: Math.round(change * 100),
    reason: allow ? `la cohorte reciente rinde ${Math.round(change * 100)}% vs la anterior (tope de caída ${maxDrop * 100}%)` : `la cohorte reciente cae ${Math.round(-change * 100)}% vs la anterior: más volumen diluye`,
  };
}
