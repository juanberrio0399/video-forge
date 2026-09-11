// experiment_report.mjs — Reporte semanal de experimentos (Growth Roadmap Fase 3). PURO.
// NO recalcula nada: ENSAMBLA lo que las neuronas ya escribieron (scores/outliers, hipótesis,
// hooks, monetización, decisión, banco de creativos) en un reporte accionable + su texto para
// Telegram. Cada sección responde: qué ganó, qué cortar, qué probar y qué decidir. Sin deps.
import { rankBank, nextToTest, bucket } from "./creative_bank.mjs";

const arr = (x) => (Array.isArray(x) ? x : []);

// Construye el reporte de un canal a partir de los registros ya calculados (todos opcionales).
export function buildReport(input = {}) {
  const { channel, scores, hypotheses, monetization, decision, bank, ab } = input;
  const sc = scores || {};
  const counts = sc.counts || {};
  const outliers = sc.outliers || { count: 0 };

  const winners = arr(sc.scale).slice(0, 3).map((s) => ({ title: s.title, overall: s.overall, vs_baseline_pct: s.vs_baseline_pct, hook_type: s.hook_type }));
  const losers = arr(sc.stop).slice(0, 3).map((s) => ({ title: s.title, overall: s.overall, vs_baseline_pct: s.vs_baseline_pct }));

  const hyps = arr(hypotheses).filter((h) => h && h.id).map((h) => ({ id: h.id, status: h.status, support: h.support, confidence: h.confidence, n: (h.evidence || []).length }))
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 5);

  const toTest = nextToTest(arr(bank), 3).map((i) => ({ text: i.text, bucket: bucket(i), priority: i.priority, source: i.source }));

  // Monetización del canal (readiness + war room) si viene el reporte de ambos canales.
  let monet = null;
  if (monetization && monetization.channels && monetization.channels[channel]) {
    const c = monetization.channels[channel];
    monet = { status: c.readiness && c.readiness.status, days_left: c.readiness && c.readiness.days_left,
      risk: c.war_room && c.war_room.risk, focus: c.war_room && c.war_room.focus_label, next_action: c.war_room && c.war_room.next_action };
  }

  const alloc = decision && decision.recommended_allocation ? decision.recommended_allocation : null;

  // A/B: experimentos con veredicto (RUNNING / WINNER:x / INCONCLUSIVE).
  const abTests = arr(ab && ab.experiments).map((e) => ({ id: e.id, variable: e.variable, verdict: e.verdict, leader: e.leader, lift: e.lift, measured: e.measured }));
  const abWinners = abTests.filter((e) => String(e.verdict || "").startsWith("WINNER"));

  // Plan: acciones que salen de los datos (no opinión).
  const plan = [];
  if (monet && monet.next_action) plan.push(`Monetización: ${monet.next_action}`);
  for (const w of abWinners) plan.push(`A/B: gana "${w.leader}" en ${w.variable} (+${w.lift}). Estandarizarlo.`);
  if (outliers.count && outliers.suggestion) plan.push(outliers.suggestion);
  if (toTest[0]) plan.push(`Probar próximo: ${toTest[0].text} (${toTest[0].bucket}).`);
  if (counts.STOP) plan.push(`Cortar ${counts.STOP} video(s) con veredicto STOP (no repetir su patrón).`);

  return {
    channel,
    at: new Date().toISOString(),
    monetization: monet,
    verdicts: { scale: counts.SCALE || 0, iterate: counts.ITERATE || 0, test_again: counts.TEST_AGAIN || 0, stop: counts.STOP || 0 },
    winners, losers,
    outliers: { count: outliers.count || 0, pattern: outliers.pattern || null, suggestion: outliers.suggestion || null },
    hypotheses: hyps,
    ab_tests: abTests,
    next_to_test: toTest,
    cadence: alloc,
    plan,
  };
}

// Texto compacto para Telegram (un canal).
export function formatReport(r, name) {
  if (!r) return `${name || ""}: sin datos.`;
  const L = [`📈 ${name || r.channel} — Reporte semanal`];
  if (r.monetization) L.push(`💰 ${String(r.monetization.status || "").toUpperCase()} · ${r.monetization.days_left}d · riesgo ${r.monetization.risk} · foco: ${r.monetization.focus || "—"}`);
  L.push(`🎬 Veredictos: ${r.verdicts.scale} escalar · ${r.verdicts.iterate} iterar · ${r.verdicts.test_again} midiendo · ${r.verdicts.stop} cortar`);
  if (r.winners.length) L.push(`🏆 Gana: ${r.winners.map((w) => `“${String(w.title).slice(0, 34)}” (${w.overall})`).join(" · ")}`);
  if (r.outliers.count) L.push(`✨ Outliers: ${r.outliers.suggestion}`);
  const abLine = arr(r.ab_tests).filter((e) => e.verdict && e.verdict !== "RUNNING").map((e) => `${e.variable}: ${e.verdict.startsWith("WINNER") ? "🏆 " + e.leader + " (+" + e.lift + ")" : "empate"}`);
  if (abLine.length) L.push(`⚗️ A/B: ${abLine.join(" · ")}`);
  if (r.next_to_test.length) L.push(`🧪 Probar: ${r.next_to_test.map((t) => `${t.text} [${t.bucket}]`).join(" · ")}`);
  if (r.plan.length) L.push("📋 Plan:\n" + r.plan.map((p, i) => `  ${i + 1}. ${p}`).join("\n"));
  return L.join("\n");
}
