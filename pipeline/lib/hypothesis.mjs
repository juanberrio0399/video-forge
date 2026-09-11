// hypothesis.mjs — máquina PURA del registro de hipótesis (Brain OS Fase 3, §17).
// Cada video es un experimento; cada hipótesis acumula evidencia (+/-) y evoluciona de estado.
// Estados: NEW -> TESTING -> SUPPORTED | WEAKENED | REJECTED -> ARCHIVED.
// Anti-confirmation bias (§40): el estado sale del BALANCE de evidencia, no de la opinión.
import { sampleConfidence } from "./analytics_math.mjs";

export function createHypothesis(id, statement, opts = {}) {
  const now = opts.now || new Date().toISOString();
  return {
    id,
    statement,
    channel_scope: opts.channel_scope || "global", // global | data_lens | oddly
    evidence: [],                                   // [{direction:+1|-1, weight, episode_id, note, at}]
    support: 0,
    confidence: 0,
    status: "NEW",
    created_at: now,
    updated_at: now,
  };
}

// Recalcula support (-1..+1), confianza (0..1) y estado a partir de la evidencia. NO muta.
export function recompute(hyp) {
  const ev = hyp.evidence || [];
  const n = ev.length;
  const pos = ev.filter((e) => e.direction > 0).reduce((s, e) => s + e.weight, 0);
  const neg = ev.filter((e) => e.direction < 0).reduce((s, e) => s + e.weight, 0);
  const total = pos + neg;
  const support = total ? Math.round(((pos - neg) / total) * 100) / 100 : 0;
  const confidence = Math.round(sampleConfidence(n) * Math.abs(support) * 100) / 100;
  let status;
  if (hyp.status === "ARCHIVED") status = "ARCHIVED";
  else if (n === 0) status = "NEW";
  else if (n >= 5 && support >= 0.5 && confidence >= 0.5) status = "SUPPORTED";
  else if (n >= 5 && support <= -0.5 && confidence >= 0.5) status = "REJECTED";
  else if (n >= 3 && support < 0) status = "WEAKENED";
  else status = "TESTING";
  return { ...hyp, support, confidence, status };
}

// Añade una evidencia y recalcula. NO muta el original.
export function addEvidence(hyp, ev) {
  const item = {
    direction: (Number(ev.direction) || 0) >= 0 ? 1 : -1,
    weight: Math.max(0, Number(ev.weight) || 1),
    episode_id: ev.episode_id || null,
    note: ev.note || "",
    at: ev.at || new Date().toISOString(),
  };
  return recompute({ ...hyp, evidence: [...(hyp.evidence || []), item], updated_at: item.at });
}

export function archive(hyp) { return { ...hyp, status: "ARCHIVED" }; }

// Inserta hipótesis semilla que falten (por id), sin pisar las existentes. Devuelve el registro nuevo.
export function ensureSeeds(registry, seeds, opts = {}) {
  const byId = new Map((registry || []).map((h) => [h.id, h]));
  for (const s of seeds || []) {
    if (!byId.has(s.id)) byId.set(s.id, createHypothesis(s.id, s.statement, { channel_scope: s.channel_scope, now: opts.now }));
  }
  return [...byId.values()];
}
