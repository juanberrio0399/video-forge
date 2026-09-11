import { describe, it, expect } from "vitest";
import { createHypothesis, addEvidence, recompute, ensureSeeds, archive } from "../pipeline/lib/hypothesis.mjs";

describe("createHypothesis", () => {
  const h = createHypothesis("h1", "X funciona", { channel_scope: "oddly", now: "2026-01-01T00:00:00Z" });
  it("arranca NEW con 0 confianza y sin evidencia", () => {
    expect(h.status).toBe("NEW");
    expect(h.confidence).toBe(0);
    expect(h.evidence).toEqual([]);
    expect(h.channel_scope).toBe("oddly");
  });
});

describe("addEvidence / recompute (estados por balance de evidencia)", () => {
  it("1 evidencia -> TESTING (aún poca muestra)", () => {
    const h = addEvidence(createHypothesis("h", "x"), { direction: 1 });
    expect(h.status).toBe("TESTING");
    expect(h.evidence.length).toBe(1);
  });
  it("5 positivas -> TESTING todavía (confianza < 0.5 con n=5)", () => {
    let h = createHypothesis("h", "x");
    for (let i = 0; i < 5; i++) h = addEvidence(h, { direction: 1 });
    expect(h.support).toBe(1);
    expect(h.status).toBe("TESTING");
  });
  it("12 positivas -> SUPPORTED", () => {
    let h = createHypothesis("h", "x");
    for (let i = 0; i < 12; i++) h = addEvidence(h, { direction: 1 });
    expect(h.status).toBe("SUPPORTED");
    expect(h.confidence).toBeGreaterThanOrEqual(0.5);
  });
  it("12 negativas -> REJECTED", () => {
    let h = createHypothesis("h", "x");
    for (let i = 0; i < 12; i++) h = addEvidence(h, { direction: -1 });
    expect(h.support).toBe(-1);
    expect(h.status).toBe("REJECTED");
  });
  it("3 evidencias netas negativas -> WEAKENED", () => {
    let h = createHypothesis("h", "x");
    h = addEvidence(h, { direction: 1 });
    h = addEvidence(h, { direction: -1 });
    h = addEvidence(h, { direction: -1 });
    expect(h.support).toBeLessThan(0);
    expect(h.status).toBe("WEAKENED");
  });
  it("no muta el original", () => {
    const h0 = createHypothesis("h", "x");
    addEvidence(h0, { direction: 1 });
    expect(h0.evidence.length).toBe(0);
  });
});

describe("ensureSeeds", () => {
  it("agrega faltantes sin duplicar ni pisar existentes", () => {
    const existing = [createHypothesis("a", "A original")];
    const reg = ensureSeeds(existing, [{ id: "a", statement: "A nuevo" }, { id: "b", statement: "B" }]);
    expect(reg.length).toBe(2);
    expect(reg.find((h) => h.id === "a").statement).toBe("A original");
  });
});

describe("archive", () => {
  it("archivar fija ARCHIVED aun con evidencia", () => {
    let h = addEvidence(createHypothesis("h", "x"), { direction: 1 });
    h = recompute(archive(h));
    expect(h.status).toBe("ARCHIVED");
  });
});
