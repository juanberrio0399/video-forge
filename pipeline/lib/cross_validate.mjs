// cross_validate.mjs — Protocolo de 2 agentes (Growth Roadmap Fase 5). PURO y testeable.
// Cruza el AGENTE EXTERNO (Growth Radar: investigación web, afirmaciones tagueadas por evidencia)
// con el AGENTE INTERNO (nuestra data medida: hipótesis + A/B + outliers) y clasifica cada
// afirmación: CONFIRMADA / PROBABLE / CONTRADICTORIA / REQUIERE_EXPERIMENTO / INCIERTA.
// Regla de oro: nunca dar por cierto un "hack" externo sin cruzarlo con nuestros datos.

const STOP = new Set(["para","con","que","los","las","del","una","por","como","más","mas","the","and","for","with","your","you","este","esta","son","the","de","en","un","a","o","y","of","to","in","is","it","que"]);
// Normaliza: minúsculas, sin acentos.
export function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
// Sinónimos ES/EN de las palancas clave -> un token canónico (para que "pregunta" case con "question").
const SYN = { pregunta: "hook_question", question: "hook_question", questions: "hook_question", interrogacion: "hook_question",
  gancho: "hook", hook: "hook", hooks: "hook", titulo: "title", title: "title", titulos: "title",
  miniatura: "thumbnail", thumbnail: "thumbnail", thumb: "thumbnail", duracion: "duration", duration: "duration",
  short: "shorts", shorts: "shorts", retencion: "retention", retention: "retention", suscriptor: "subs", subs: "subs", suscriptores: "subs" };
export function tokenize(s) {
  const out = new Set();
  for (const w of norm(s).split(/[^a-z0-9]+/).filter(Boolean)) {
    if (SYN[w]) out.add(SYN[w]);
    if (w.length >= 4 && !STOP.has(w)) out.add(w);
  }
  return [...out];
}

const EV = ["OFICIAL", "FUERTE", "EXPERIMENTAL", "HIPOTESIS", "RUMOR"];
// Extrae afirmaciones del reporte del Radar: líneas que traen un tag de evidencia [OFICIAL]...[RUMOR].
export function parseClaims(reportText) {
  const claims = [];
  for (const raw of String(reportText || "").split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const m = norm(line).match(/\[(oficial|fuerte|experimental|hipotesis|rumor)\]/);
    if (!m) continue;
    const evidence = m[1].toUpperCase();
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    if (text.length < 6) continue;
    claims.push({ text, evidence, keywords: tokenize(text) });
  }
  return claims;
}

// --- AGENTE INTERNO: findings normalizados desde lo que YA medimos ---
// polarity: "supports" (nuestros datos apoyan la palanca) | "refutes" | "neutral". strength 0-1.
export function findingsFromHypotheses(hyps) {
  return (hyps || []).filter((h) => h && h.id).map((h) => {
    const support = Number(h.support) || 0;
    const polarity = ["WEAKENED", "REJECTED"].includes(h.status) || support < 0 ? "refutes"
      : (["SUPPORTED", "TESTING"].includes(h.status) && support > 0 ? "supports" : "neutral");
    return { topic: h.id, keywords: tokenize(h.id.replace(/[-_]/g, " ")), polarity, strength: Number(h.confidence) || 0, source: "hypothesis" };
  });
}
export function findingsFromAB(ab) {
  return (ab && ab.experiments ? ab.experiments : []).map((e) => {
    const win = String(e.verdict || "").startsWith("WINNER");
    return { topic: `ab:${e.variable}:${e.leader || ""}`, keywords: tokenize(`${e.variable} ${e.leader || ""}`),
      polarity: win ? "supports" : "neutral", strength: win ? (Number(e.confidence) || 0.5) : 0.2, source: "ab" };
  });
}
export function findingFromOutliers(scores) {
  const o = scores && scores.outliers; if (!o || !o.count || !o.pattern || !o.pattern.hook) return [];
  const hook = o.pattern.hook.value, fmt = o.pattern.format && o.pattern.format.value;
  return [{ topic: `outlier:${hook}`, keywords: tokenize(`${hook} ${fmt || ""}`), polarity: "supports", strength: Math.min(0.9, 0.4 + o.count * 0.05), source: "outlier" }];
}

// Cuenta keywords en común entre una afirmación y un finding.
function overlap(a, b) { const s = new Set(b); return a.filter((k) => s.has(k)).length; }

// Cruza afirmaciones externas con findings internos. minOverlap = keywords en común para "matchear".
export function reconcile(claims, findings, opts = {}) {
  const minOverlap = opts.minOverlap != null ? opts.minOverlap : 1;
  const results = (claims || []).map((c) => {
    let best = null, bestN = 0;
    for (const f of findings || []) { const n = overlap(c.keywords, f.keywords); if (n > bestN) { bestN = n; best = f; } }
    let classification, reason;
    if (!best || bestN < minOverlap) {
      classification = ["HIPOTESIS", "EXPERIMENTAL"].includes(c.evidence) ? "REQUIERE_EXPERIMENTO" : "INCIERTA";
      reason = "sin data interna que la cruce";
    } else if (best.polarity === "supports") {
      classification = best.strength >= 0.5 ? "CONFIRMADA" : "PROBABLE";
      reason = `nuestra data (${best.source}) la apoya (fuerza ${best.strength.toFixed(2)})`;
    } else if (best.polarity === "refutes") {
      classification = "CONTRADICTORIA";
      reason = `nuestra data (${best.source}) la contradice`;
    } else {
      classification = "REQUIERE_EXPERIMENTO";
      reason = `data interna aún neutral (${best.source})`;
    }
    return { claim: c.text, evidence: c.evidence, classification, matched: best ? best.topic : null, overlap: bestN, reason };
  });
  const summary = {};
  for (const r of results) summary[r.classification] = (summary[r.classification] || 0) + 1;
  return { results, summary };
}

// Texto para Telegram: prioriza contradicciones y confirmaciones.
export function formatCross(cross, name) {
  const r = (cross && cross.results) || [];
  const ORDER = { CONTRADICTORIA: 0, CONFIRMADA: 1, REQUIERE_EXPERIMENTO: 2, PROBABLE: 3, INCIERTA: 4 };
  const ICON = { CONFIRMADA: "✅", PROBABLE: "🟢", CONTRADICTORIA: "⛔", REQUIERE_EXPERIMENTO: "🧪", INCIERTA: "❔" };
  const top = r.slice().sort((a, b) => ORDER[a.classification] - ORDER[b.classification]).slice(0, 8);
  const L = [`🔬 Validación cruzada — ${name || cross.channel || ""}`];
  const s = cross.summary || {};
  L.push(Object.entries(s).map(([k, v]) => `${ICON[k] || ""}${k} ${v}`).join(" · ") || "(sin afirmaciones)");
  for (const x of top) if (x.classification !== "INCIERTA") L.push(`${ICON[x.classification] || "•"} ${x.claim.slice(0, 90)} — ${x.reason}`);
  return L.join("\n");
}
