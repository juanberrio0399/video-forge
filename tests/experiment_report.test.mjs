import { describe, it, expect } from "vitest";
import { buildReport, formatReport } from "../pipeline/lib/experiment_report.mjs";
import { newItem } from "../pipeline/lib/creative_bank.mjs";

const scores = {
  counts: { SCALE: 2, ITERATE: 1, TEST_AGAIN: 5, STOP: 3 },
  scale: [{ title: "Why X wins", overall: 88, vs_baseline_pct: 120, hook_type: "question" }],
  stop: [{ title: "Boring one", overall: 12, vs_baseline_pct: -70 }],
  outliers: { count: 4, pattern: { hook: { value: "question" }, format: { value: "short" } }, suggestion: "Replicar hook question en short" },
};
const monetization = { channels: { "data-lens": { readiness: { status: "behind", days_left: 100 }, war_room: { risk: "alto", focus_label: "Suscriptores", next_action: "Empuja subs" } } } };
const hypotheses = [{ id: "global-question-hook", status: "TESTING", support: 0.4, confidence: 0.5, evidence: [{}, {}] }];
const bank = [newItem({ text: "Probar hook pregunta", impact: 4, probability: 0.8, velocity: 4, cost: 2 })];

describe("buildReport", () => {
  const r = buildReport({ channel: "data-lens", scores, hypotheses, monetization, bank });
  it("resume veredictos", () => expect(r.verdicts).toEqual({ scale: 2, iterate: 1, test_again: 5, stop: 3 }));
  it("trae ganadores y outliers", () => {
    expect(r.winners[0].title).toBe("Why X wins");
    expect(r.outliers.count).toBe(4);
  });
  it("mapea monetización del canal", () => {
    expect(r.monetization.status).toBe("behind");
    expect(r.monetization.focus).toBe("Suscriptores");
  });
  it("plan accionable no vacío (monetización + outlier + probar + cortar)", () => {
    expect(r.plan.length).toBeGreaterThanOrEqual(3);
    expect(r.plan.join(" ")).toMatch(/Empuja subs/);
    expect(r.plan.join(" ")).toMatch(/STOP|Cortar/);
  });
  it("next_to_test viene del banco (BACKLOG)", () => {
    expect(r.next_to_test.length).toBe(1);
    expect(r.next_to_test[0].text).toBe("Probar hook pregunta");
  });
});

describe("formatReport", () => {
  it("texto con secciones clave", () => {
    const r = buildReport({ channel: "data-lens", scores, hypotheses, monetization, bank });
    const t = formatReport(r, "The Data Lens");
    expect(t).toMatch(/Reporte semanal/);
    expect(t).toMatch(/Veredictos/);
    expect(t).toMatch(/Plan/);
  });
  it("sin datos -> mensaje limpio", () => expect(formatReport(null, "X")).toMatch(/sin datos/));
});
