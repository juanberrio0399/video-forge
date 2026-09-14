import { describe, it, expect } from "vitest";
import { makePulse, validatePulse, applyStaleness, worstStatus, mergeGlobal, normConfidence, confidenceLabel, canAutoExecute } from "../pipeline/lib/os_contract.mjs";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const ago = (min) => new Date(NOW - min * 60000).toISOString();

describe("makePulse", () => {
  it("rechaza sistemas o estados inventados", () => {
    expect(() => makePulse({ system: "billi0p" }, NOW)).toThrow();
    expect(() => makePulse({ system: "radar", status: "genial" }, NOW)).toThrow();
  });
  it("normaliza y descarta lo incompleto", () => {
    const p = makePulse({
      system: "video-forge", headline: "Todo está corriendo",
      agents: [{ id: "content", name: "Content Agent", state: "thinking" }, { name: "sin id" }],
      activity: [{ at: ago(5), agent: "Content", text: "Armé el plan" }, { text: "" }],
      needs: [{ id: "n1", title: "Estrategia", actions: [{ id: "open", label: "Ver", kind: "open" }] }, { id: "n2", title: "Sin acciones" }],
    }, NOW);
    expect(p.agents.length).toBe(1);
    expect(p.activity.length).toBe(1);
    expect(p.needs.length).toBe(2);
    expect(validatePulse(p).ok).toBe(false); // una decisión sin acciones no es válida
  });
});

describe("confianza honesta", () => {
  it("sin base no hay porcentaje", () => {
    expect(normConfidence({ value: 0.94 })).toBe(null);
    expect(confidenceLabel(null)).toMatch(/datos insuficientes/);
    expect(confidenceLabel({ value: 0.91, basis: "29 videos" })).toBe("Confianza 91% · 29 videos");
  });
});

describe("staleness", () => {
  it("un pulse viejo pasa a degraded con sin señal", () => {
    const p = applyStaleness(makePulse({ system: "radar", at: ago(300), headline: "ok" }, NOW), NOW, 180);
    expect(p.stale).toBe(true);
    expect(p.status).toBe("degraded");
    expect(p.headline).toMatch(/Sin señal de Radar/);
  });
  it("un crítico viejo sigue crítico", () => {
    const p = applyStaleness(makePulse({ system: "radar", at: ago(300), status: "critical", headline: "x" }, NOW), NOW, 180);
    expect(p.status).toBe("critical");
  });
});

describe("mergeGlobal", () => {
  const vf = makePulse({ system: "video-forge", at: ago(10), headline: "Todo está corriendo", agents: [{ id: "a", name: "Content", state: "thinking" }], activity: [{ at: ago(3), agent: "Content", text: "Plan listo" }] }, NOW);
  const ra = makePulse({ system: "radar", at: ago(20), status: "attention", headline: "1 PR listo", needs: [{ id: "pr88", title: "Merge PR #88", severity: "warn", autonomy: "APPROVAL", actions: [{ id: "merge", label: "Merge", kind: "approve" }] }], activity: [{ at: ago(1), agent: "Code", text: "PR abierto" }] }, NOW);
  it("falta un sistema -> degraded y se nombra", () => {
    const g = mergeGlobal([vf, ra], NOW);
    expect(g.systems.find((s) => s.system === "viento").stale).toBe(true);
    expect(g.status).toBe("degraded");
  });
  it("decisiones mandan en el titular y la prioridad", () => {
    const vi = makePulse({ system: "viento", at: ago(5), headline: "Sin ventas" }, NOW);
    const g = mergeGlobal([vf, ra, vi], NOW);
    expect(g.headline).toBe("1 decisión te espera");
    expect(g.priority.title).toBe("Merge PR #88");
    expect(g.activity[0].text).toBe("PR abierto");
    expect(g.counts.needs).toBe(1);
  });
  it("todo sano y sin decisiones", () => {
    const vi = makePulse({ system: "viento", at: ago(5), headline: "ok" }, NOW);
    const ra2 = makePulse({ system: "radar", at: ago(5), headline: "ok" }, NOW);
    expect(mergeGlobal([vf, vi, ra2], NOW).headline).toBe("Todo está corriendo");
  });
  it("peor estado y autonomía", () => {
    expect(worstStatus(["normal", "critical", "attention"])).toBe("critical");
    expect(canAutoExecute("AUTO")).toBe(true);
    expect(canAutoExecute("CRITICAL")).toBe(false);
  });
});
