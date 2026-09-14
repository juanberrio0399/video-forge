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

// Pares de ganchos que rotan por semana. Una sola variable: el primer segundo del Short.
export const HOOK_PAIRS = [
  { id: "pregunta-vs-afirmacion", arms: ["question", "statement"], labels: ["pregunta", "afirmación"],
    text: { question: "Gancho en forma de PREGUNTA en el primer segundo", statement: "Gancho en forma de AFIRMACIÓN rotunda en el primer segundo (sin pregunta)" },
    hypothesis: "Abrir con una pregunta retiene más que abrir con una afirmación" },
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
  const pair = HOOK_PAIRS[n % HOOK_PAIRS.length];
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
