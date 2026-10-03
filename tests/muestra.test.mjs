import { describe, it, expect } from "vitest";
import { evaluarMuestra, cobertura, lineaAviso, MINIMO } from "../pipeline/lib/muestra.mjs";

describe("evaluarMuestra", () => {
  it("con cero datos lo dice y no deja concluir", () => {
    const m = evaluarMuestra(0);
    expect(m.suficiente).toBe(false);
    expect(m.nivel).toBe("nula");
    expect(m.aviso).toMatch(/no se puede concluir/);
  });

  it("avisa cuando hay algo pero no alcanza", () => {
    const m = evaluarMuestra(2, { que: "videos" });
    expect(m.suficiente).toBe(false);
    expect(m.nivel).toBe("pobre");
    expect(m.aviso).toMatch(/solo 2 videos/);
    expect(m.aviso).toMatch(/ruido/);
  });

  it("a partir del minimo deja de avisar", () => {
    const m = evaluarMuestra(MINIMO);
    expect(m.suficiente).toBe(true);
    expect(m.aviso).toBe(null);
  });

  it("distingue suficiente de solida", () => {
    expect(evaluarMuestra(10).nivel).toBe("suficiente");
    expect(evaluarMuestra(50).nivel).toBe("solida");
  });

  it("la confianza crece con la muestra y nunca pasa de 1", () => {
    expect(evaluarMuestra(2).confianza).toBeLessThan(evaluarMuestra(20).confianza);
    expect(evaluarMuestra(100000).confianza).toBeLessThanOrEqual(1);
  });

  it("no revienta con basura", () => {
    for (const x of [null, undefined, -5, NaN, "siete", {}]) {
      const m = evaluarMuestra(x);
      expect(m.n).toBeGreaterThanOrEqual(0);
      expect(typeof m.suficiente).toBe("boolean");
    }
  });
});

describe("cobertura", () => {
  it("avisa con el caso REAL de Oddly: 6 curvas de retencion de 15 videos", () => {
    const c = cobertura(6, 15, { que: "curva de retencion" });
    expect(c.suficiente).toBe(false);
    expect(c.pct).toBe(0.4);
    expect(c.aviso).toMatch(/6 de 15/);
    expect(c.aviso).toMatch(/NO representa al canal/);
  });

  it("no avisa cuando la cobertura es buena", () => {
    const c = cobertura(14, 15, { que: "curva de retencion" });
    expect(c.suficiente).toBe(true);
    expect(c.aviso).toBe(null);
  });

  it("sin total lo dice en vez de dividir por cero", () => {
    const c = cobertura(0, 0);
    expect(c.pct).toBe(0);
    expect(c.suficiente).toBe(false);
    expect(c.aviso).toMatch(/no hay de donde leer/);
  });

  it("respeta un umbral propio", () => {
    expect(cobertura(5, 10, { minPct: 0.5 }).suficiente).toBe(true);
    expect(cobertura(4, 10, { minPct: 0.5 }).suficiente).toBe(false);
  });
});

describe("lineaAviso", () => {
  it("junta los avisos en una linea", () => {
    const l = lineaAviso(["a", null, "b", undefined]);
    expect(l).toMatch(/a · b/);
    expect(l).toMatch(/valen poco/);
  });

  it("devuelve null cuando no hay nada que avisar", () => {
    expect(lineaAviso([])).toBe(null);
    expect(lineaAviso([null, undefined])).toBe(null);
    expect(lineaAviso(null)).toBe(null);
  });
});
