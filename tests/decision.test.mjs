import { describe, it, expect } from "vitest";
import {
  richReward, posterior, scoreCandidate, thompsonAllocate, proportionalByScore, seedFrom, rng,
} from "../pipeline/lib/decision.mjs";

describe("richReward", () => {
  it("vacío -> 0", () => expect(richReward({})).toBe(0));
  it("más vistas/día -> más recompensa", () => {
    const ref = { vpd: 50 };
    expect(richReward({ vpd: 100 }, ref)).toBeGreaterThan(richReward({ vpd: 10 }, ref));
  });
  it("la retención (hook) sube la recompensa", () => {
    const a = richReward({ vpd: 50, hook_score: 1.0 }, { vpd: 50 });
    const b = richReward({ vpd: 50, hook_score: 0.2 }, { vpd: 50 });
    expect(a).toBeGreaterThan(b);
  });
  it("siempre en [0,1]", () => {
    const r = richReward({ vpd: 9999, hook_score: 5, subs_per_day: 999 }, { vpd: 10, subs_per_day: 1 });
    expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1);
  });
});

describe("posterior", () => {
  it("sin muestras -> Beta(1,1) uniforme", () => {
    expect(posterior(0.8, 0)).toEqual({ alpha: 1, beta: 1 });
  });
  it("recompensa alta + muchas muestras -> alpha >> beta", () => {
    const p = posterior(0.9, 100);
    expect(p.alpha).toBeGreaterThan(p.beta);
  });
});

describe("scoreCandidate", () => {
  it("más muestras -> más confianza y menos learning_value", () => {
    const pocos = scoreCandidate({ key: "a", reward: 0.5, samples: 1 });
    const muchos = scoreCandidate({ key: "a", reward: 0.5, samples: 100 });
    expect(muchos.confidence).toBeGreaterThan(pocos.confidence);
    expect(muchos.learning_value).toBeLessThan(pocos.learning_value);
  });
  it("score = expected_value * confidence", () => {
    const s = scoreCandidate({ key: "a", reward: 0.6, samples: 10 });
    expect(s.score).toBeCloseTo(s.expected_value * s.confidence, 3);
  });
});

describe("thompsonAllocate", () => {
  const cands = [
    { key: "win", reward: 0.9, samples: 40 },
    { key: "mid", reward: 0.5, samples: 40 },
    { key: "low", reward: 0.1, samples: 40 },
  ];
  it("reparte exactamente `total` slots", () => {
    const { alloc } = thompsonAllocate(cands, 12, { seed: 7 });
    expect(Object.values(alloc).reduce((a, b) => a + b, 0)).toBe(12);
  });
  it("determinista con la misma semilla", () => {
    const a = thompsonAllocate(cands, 12, { seed: 7 }).alloc;
    const b = thompsonAllocate(cands, 12, { seed: 7 }).alloc;
    expect(a).toEqual(b);
  });
  it("el ganador claro se lleva la mayoría", () => {
    const { alloc } = thompsonAllocate(cands, 30, { seed: 3 });
    expect(alloc.win).toBeGreaterThan(alloc.mid);
    expect(alloc.win).toBeGreaterThan(alloc.low);
  });
  it("total 0 -> todo en 0", () => {
    const { alloc } = thompsonAllocate(cands, 0, { seed: 1 });
    expect(Object.values(alloc).every((v) => v === 0)).toBe(true);
  });
  it("excluye los no elegibles", () => {
    const c2 = [...cands, { key: "off", reward: 0.99, samples: 5, eligible: false }];
    const { alloc } = thompsonAllocate(c2, 10, { seed: 2 });
    expect(alloc.off).toBeUndefined();
  });
  it("explora: un brazo con pocos datos igual recibe slots", () => {
    const c = [
      { key: "known", reward: 0.5, samples: 200 },
      { key: "fresh", reward: 0.5, samples: 1 },
    ];
    const { alloc } = thompsonAllocate(c, 40, { seed: 5 });
    expect(alloc.fresh).toBeGreaterThan(0);
  });
});

describe("proportionalByScore (cartera de contenido)", () => {
  const cands = [
    { key: "win", reward: 1.0, samples: 43 },   // ganador probado
    { key: "mid", reward: 0.72, samples: 75 },  // #2 probado (muchos datos)
    { key: "low", reward: 0.28, samples: 14 },
  ];
  it("suma exactamente `total`", () => {
    const { alloc } = proportionalByScore(cands, 12);
    expect(Object.values(alloc).reduce((a, b) => a + b, 0)).toBe(12);
  });
  it("NO colapsa al #1: un #2 probado conserva cuota", () => {
    const { alloc } = proportionalByScore(cands, 12, { minPerArm: 1 });
    expect(alloc.mid).toBeGreaterThanOrEqual(3); // no queda en 0/1 como con Thompson argmax
    expect(alloc.win).toBeGreaterThan(alloc.mid);
  });
  it("determinista", () => {
    expect(proportionalByScore(cands, 12).alloc).toEqual(proportionalByScore(cands, 12).alloc);
  });
  it("misma recompensa: más muestras -> más cuota (confianza)", () => {
    const c = [
      { key: "solido", reward: 0.6, samples: 100 },
      { key: "dudoso", reward: 0.6, samples: 1 },
    ];
    const { alloc } = proportionalByScore(c, 20);
    expect(alloc.solido).toBeGreaterThan(alloc.dudoso);
  });
  it("total 0 -> todo en 0 ; excluye no elegibles", () => {
    expect(Object.values(proportionalByScore(cands, 0).alloc).every((v) => v === 0)).toBe(true);
    const c2 = [...cands, { key: "off", reward: 0.9, samples: 5, eligible: false }];
    expect(proportionalByScore(c2, 10).alloc.off).toBeUndefined();
  });
});

describe("seedFrom / rng", () => {
  it("mismo texto -> misma semilla y misma secuencia", () => {
    expect(seedFrom("2026-W37")).toBe(seedFrom("2026-W37"));
    const r1 = rng(seedFrom("x")), r2 = rng(seedFrom("x"));
    expect(r1()).toBe(r2());
  });
});
