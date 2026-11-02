// oddly_goal.mjs — META DEL AÑO de Oddly Loop y su estrategia (decisión de Juan, 2026-09-14). PURO.
// Meta: nivel intermedio del Partner Program (3 M de vistas de Shorts en 90 días y 500 suscriptores).
// Estrategia "hito intermedio con apuesta fuerte":
//   1) Mayoría de cupos para el nicho líder, solo si tiene muestra y rinde claramente sobre el canal.
//   2) Un par de ganchos distinto cada semana ISO en el nicho líder; cada video queda atado a su brazo por
//      su franja y se juzga con las vistas al día 7 (sin atribución no hay conclusión).
//   3) Revisión a 28 días en el ledger: el ritmo de Shorts de 28 días debe duplicarse.

const DAY = 86400000;

export const ODDLY_GOAL = {
  channel: "auto2",
  tier: "expanded",
  label: "Nivel intermedio",
  decided_at: "2026-09-14",
  decided_by: "Juan",
  deadline: "2026-12-31",
  strategy: { leader_share: 0.6, min_rel: 1.2, review_days: 28, pace_multiplier: 2, hook_min_n: 3, hook_min_lift_pct: 15 },
};

// HITO HONESTO (decisión de Juan, 2026-11-01). Al 1-nov el canal hace unas 1.000-1.600 vistas al
// día: el 3% de los 3 M en 90 días. Medirse solo contra los 3 M no dice si se va mejor o peor, así
// que hay un escalón intermedio de 300 mil en 90 días (3.334/día), que coincide con duplicar el ritmo.
// Y como las vistas de Shorts vienen de unos pocos videos que pegan (la mediana es de decenas, el
// mejor pasa de 2.000), lo que se sigue a diario son los HITS: Shorts de 28 días con 1.000+ vistas.
export const ODDLY_HITO = {
  label: "300 mil vistas en 90 días",
  views_90d: 300000,
  per_day: Math.ceil(300000 / 90),
  decided_at: "2026-11-01",
  hit_views: 1000,
  hit_days: 28,
  // El reparto de los lunes se decide por hits solo con al menos estos hits en el canal;
  // con menos, la tasa es ruido y se sigue con la mediana.
  min_hits: 5,
};

// Un video por id (el inventario llegó a traer repetidos, ver report_auto2).
function unicos(list) {
  const vistos = new Set();
  return (Array.isArray(list) ? list : []).filter((v) => v && v.video_id && !vistos.has(v.video_id) && vistos.add(v.video_id));
}

// Hits por nicho para el reparto de los lunes: Shorts públicos de 3 a 28 días (ya tuvieron tiempo de
// pegar), con nicho real (no inferido). rate = hits / n. Puro.
export function hitsByNiche(list, nowMs = Date.now(), { minAge = 3, maxAge = ODDLY_HITO.hit_days, threshold = ODDLY_HITO.hit_views } = {}) {
  const rows = {};
  let n = 0, hits = 0;
  for (const v of unicos(list)) {
    if (v.privacy !== "public" || !v.niche || v.niche_inferred) continue;
    const t = Date.parse(v.publish_at || v.pub_iso || v.published_at || "");
    const age = (nowMs - t) / DAY;
    if (!Number.isFinite(age) || age < minAge || age >= maxAge) continue;
    const r = (rows[v.niche] = rows[v.niche] || { n: 0, hits: 0 });
    const h = (Number(v.views) || 0) >= threshold;
    r.n++; n++; if (h) { r.hits++; hits++; }
  }
  for (const r of Object.values(rows)) r.rate = r.n ? r.hits / r.n : 0;
  return { n, hits, rate: n ? hits / n : 0, threshold, rows };
}

// Hits del canal: Shorts publicados en los últimos `days` días con `threshold` vistas o más.
// `list` es state.json -> list (inventario de Oddly). Puro.
export function hitsSummary(list, nowMs = Date.now(), { days = ODDLY_HITO.hit_days, threshold = ODDLY_HITO.hit_views } = {}) {
  const pubMs = (v) => Date.parse((v && (v.publish_at || v.pub_iso || v.published_at)) || "");
  const vids = unicos(list).filter((v) => {
    if (!v || v.privacy !== "public") return false;
    const t = pubMs(v);
    return Number.isFinite(t) && t <= nowMs && nowMs - t < days * DAY;
  });
  const hits = vids.filter((v) => (Number(v.views) || 0) >= threshold).sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  const best = vids.reduce((m, v) => (!m || (Number(v.views) || 0) > (Number(m.views) || 0) ? v : m), null);
  return {
    threshold, days, published: vids.length, hits: hits.length,
    rate_pct: vids.length ? Math.round((hits.length / vids.length) * 1000) / 10 : null,
    views_from_hits: hits.reduce((a, v) => a + (Number(v.views) || 0), 0),
    views_total: vids.reduce((a, v) => a + (Number(v.views) || 0), 0),
    best: best ? { video_id: best.video_id, title: best.title || "", views: Number(best.views) || 0, niche: best.niche || null } : null,
    top: hits.slice(0, 5).map((v) => ({ video_id: v.video_id, title: v.title || "", views: Number(v.views) || 0, niche: v.niche || null })),
  };
}

// Avance contra el hito con el ritmo de 28 días (lo que mide la medición de YPP).
export function hitoProgress(perDay28d) {
  const pace = Number(perDay28d);
  if (!Number.isFinite(pace) || pace <= 0) return null;
  return { ...ODDLY_HITO, pace_per_day: Math.round(pace), pct: Math.round((pace / ODDLY_HITO.per_day) * 100), projected_90d: Math.round(pace * 90) };
}

// Pares de ganchos que rotan por semana. Una sola variable: el primer segundo del Short.
export const HOOK_PAIRS = [
  { id: "pregunta-vs-afirmacion", arms: ["question", "statement"], labels: ["pregunta", "afirmación"],
    text: { question: "Gancho en forma de PREGUNTA en el primer segundo", statement: "Gancho en forma de AFIRMACIÓN rotunda en el primer segundo (sin pregunta)" },
    hypothesis: "Abrir con una pregunta retiene más que abrir con una afirmación",
    // DECIDIDO: ganó la pregunta (A/B por título, n16 vs n5, 2026-10-16) y desde #196 la
    // producción exige título en pregunta. Seguir rotándolo daba un brazo "afirmación" que salía
    // igual al otro (en Oddly 21 videos con pregunta contra 2): una semana de cada cuatro perdida
    // y un ganador al azar en el ledger. Ya no rota; las semanas desde `desde` no se juzgan.
    decided: { at: "2026-10-16", winner: "question", desde: "2026-W43" } },
  { id: "dato-vs-sensorial", arms: ["data", "sensory"], labels: ["dato", "sensorial"],
    text: { data: "Abre con un NÚMERO o dato concreto en pantalla en el primer segundo", sensory: "Abre con el sonido o la imagen más impactante, sin texto explicativo en el primer segundo" },
    hypothesis: "Un dato concreto al inicio retiene más que un arranque puramente sensorial" },
  { id: "espera-vs-directo", arms: ["wait", "payoff"], labels: ["espera al final", "resultado primero"],
    text: { wait: "Promete el desenlace al final en el primer segundo (espera al final)", payoff: "Muestra el resultado final en el primer segundo y luego cómo se llegó" },
    hypothesis: "Prometer el desenlace retiene más que mostrar el resultado primero" },
  { id: "tu-vs-observador", arms: ["you", "observer"], labels: ["segunda persona", "observador"],
    text: { you: "Habla al espectador en segunda persona (tú) en el primer segundo", observer: "Narra como observador, en tercera persona, en el primer segundo" },
    hypothesis: "Hablarle al espectador retiene más que narrar como observador" },
];

// Los que siguen abiertos: solo estos rotan por semana.
export const ACTIVE_HOOK_PAIRS = HOOK_PAIRS.filter((p) => !p.decided);

// Un experimento semanal de un par ya decidido, corrido cuando la producción ya forzaba al
// ganador: sus dos brazos recibieron el mismo tratamiento y no hay nada que juzgar.
export function hookContaminado(entry) {
  const id = String((entry && entry.subject) || "");
  const par = HOOK_PAIRS.find((p) => p.decided && id.endsWith(`-${p.id}`));
  return Boolean(par && entry.week && String(entry.week) >= par.decided.desde);
}

export function isoWeek(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThursday) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Experimento de gancho de la semana, en el nicho líder. Mismo par durante toda la semana ISO.
export function weeklyHookExperiment(week, leaderKey) {
  if (!leaderKey || !/^\d{4}-W\d{2}$/.test(String(week))) return null;
  const n = Number(String(week).slice(6));
  const pair = ACTIVE_HOOK_PAIRS[n % ACTIVE_HOOK_PAIRS.length];
  return { id: `hook-${week}-${pair.id}`, variable: "hook", arms: pair.arms.slice(), labels: pair.labels.slice(), arm_text: { ...pair.text }, niche: leaderKey, week, hypothesis: pair.hypothesis };
}

// Sube al líder hasta `share` de los cupos quitando de a uno a los demás, sin dejar a nadie bajo `minOthers`.
export function pushLeader(alloc, leaderKey, share = 0.6, minOthers = 1) {
  const out = { ...(alloc || {}) };
  const total = Object.values(out).reduce((a, b) => a + (+b || 0), 0);
  if (!leaderKey || !(leaderKey in out) || total <= 0) return { alloc: out, moved: 0, target: null };
  const target = Math.min(total, Math.ceil(total * share));
  let moved = 0;
  while ((out[leaderKey] || 0) < target) {
    const donor = Object.entries(out).filter(([k, v]) => k !== leaderKey && v > minOthers).sort((a, b) => b[1] - a[1])[0];
    if (!donor) break;
    out[donor[0]]--; out[leaderKey]++; moved++;
  }
  return { alloc: out, moved, target };
}

// Resuelve las franjas producidas con brazo a video_id cuando el video ya está programado (misma franja y nicho).
export function attachHookVideos(entry, scheduled, nowMs = Date.now(), toleranceMin = 40) {
  const videos = {};
  for (const a of entry.arms || []) videos[a] = [...((entry.videos || {})[a] || [])];
  const used = new Set(Object.values(videos).flat());
  const pending = [];
  for (const p of entry.pending || []) {
    const slot = Date.parse(p.slot_utc);
    const match = (scheduled || []).find((v) => v && v.video_id && !used.has(v.video_id) && v.niche === p.niche && Math.abs(Date.parse(v.publish_at) - slot) <= toleranceMin * 60000);
    if (match && videos[p.arm]) { videos[p.arm].push(match.video_id); used.add(match.video_id); }
    else if (nowMs - slot < 2 * DAY) pending.push(p);   // si a los 2 días no apareció el video, se descarta
  }
  return { ...entry, videos, pending };
}

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Diferencia entre brazos con las vistas al día 7. Sin muestra mínima por brazo -> null (no se concluye).
export function hookLift(entry, viewsAtAge, minN = ODDLY_GOAL.strategy.hook_min_n) {
  const arms = entry && entry.arms;
  if (!Array.isArray(arms) || arms.length !== 2) return null;
  if (hookContaminado(entry)) return null;   // se revisa como "no puedo juzgar", sin ganador
  const vals = arms.map((a) => ((entry.videos || {})[a] || []).map((id) => viewsAtAge && viewsAtAge[id] && Number(viewsAtAge[id].d7)).filter((x) => Number.isFinite(x)));
  if (vals[0].length < minN || vals[1].length < minN) return null;
  const m = vals.map(median);
  const lo = Math.min(m[0], m[1]), hi = Math.max(m[0], m[1]);
  if (hi <= 0) return null;
  const w = m[0] >= m[1] ? 0 : 1;
  return {
    lift_pct: Math.round(((hi - lo) / Math.max(1, lo)) * 100),
    winner: arms[w],
    a: { arm: arms[0], n: vals[0].length, median: Math.round(m[0]) },
    b: { arm: arms[1], n: vals[1].length, median: Math.round(m[1]) },
  };
}

// Entrada del ledger de la meta: el ritmo de Shorts de 28 días debe duplicarse en 28 días.
export function goalEntryFields(yppSnap, neededPerDay = null) {
  const base = Number(yppSnap && yppSnap.shorts_views_per_day_28d);
  if (!Number.isFinite(base) || base <= 0) return null;
  const s = ODDLY_GOAL.strategy;
  const target = Math.round(base * s.pace_multiplier);
  return {
    id: "goal-oddly-hito-intermedio", type: "goal", channel: "auto2", subject: "hito_intermedio",
    decision: "Meta del año: nivel intermedio (3 millones de vistas de Shorts en 90 días y 500 suscriptores)",
    reason: "Decisión de Juan del 2026-09-14: la monetización completa iba unas 61 veces lejos del ritmo real",
    evidence: `ritmo de 28 días ${Math.round(base)}/día${Number.isFinite(Number(neededPerDay)) ? `; el nivel intermedio pide ${Math.round(neededPerDay)}/día hasta el ${ODDLY_GOAL.deadline}` : ""}`,
    action: "mayoría de cupos al nicho líder y un par de ganchos distinto cada semana",
    metric: "shorts_views_per_day_28d", baseline: Math.round(base), criterion: { op: ">=", value: target },
    confidence: "baja", review_after_days: s.review_days,
    next: "si el ritmo no se duplica en 28 días, el cerebro te pide en Decisiones cambiar de estrategia",
  };
}
