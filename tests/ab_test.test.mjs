import { describe, it, expect } from "vitest";
import { groupByVariant, measure, decide, runExperiment } from "../pipeline/lib/ab_test.mjs";

// videos scoreados: { hook_type, vs_baseline_pct, mature }
function v(hook, pct, mature = true) { return { hook_type: hook, vs_baseline_pct: pct, mature }; }

describe("groupByVariant", () => {
  it("agrupa por variante, ignora inmaduros y variantes fuera de lista", () => {
    const vids = [v("question", 50), v("statement", -10), v("question", 30, false), v("number", 80)];
    const g = groupByVariant(vids, "hook_type", ["question", "statement"]);
    expect(g.question.length).toBe(1); // el inmaduro y el "number" fuera
    expect(g.statement.length).toBe(1);
  });
});

describe("measure", () => {
  it("n, media y mediana por variante", () => {
    const g = { question: [v("question", 40), v("question", 60)], statement: [v("statement", 0)] };
    const m = measure(g, "vs_baseline_pct");
    expect(m.question.n).toBe(2);
    expect(m.question.mean).toBe(50);
    expect(m.statement.mean).toBe(0);
  });
});

describe("decide", () => {
  it("muestra insuficiente -> RUNNING", () => {
    const m = { question: { n: 2, mean: 80, median: 80 }, statement: { n: 5, mean: 10, median: 10 } };
    expect(decide(m, { minPerVariant: 4, minLift: 20 }).verdict).toBe("RUNNING");
  });
  it("lift suficiente (por mediana) -> WINNER del líder", () => {
    const m = { question: { n: 6, mean: 90, median: 90 }, statement: { n: 6, mean: 20, median: 20 } };
    const d = decide(m, { minPerVariant: 4, minLift: 20 });
    expect(d.verdict).toBe("WINNER:question");
    expect(d.lift).toBe(70);
  });
  it("usa MEDIANA, no media (robusto a virales)", () => {
    // statement tiene media alta por un viral, pero mediana baja -> gana question por mediana.
    const m = { question: { n: 6, mean: 45, median: 50 }, statement: { n: 6, mean: 300, median: 10 } };
    expect(decide(m, { minPerVariant: 4, minLift: 20 }).verdict).toBe("WINNER:question");
  });
  it("diferencia pequeña -> INCONCLUSIVE", () => {
    const m = { question: { n: 6, mean: 30, median: 30 }, statement: { n: 6, mean: 22, median: 22 } };
    expect(decide(m, { minPerVariant: 4, minLift: 20 }).verdict).toBe("INCONCLUSIVE");
  });
});

describe("runExperiment (extremo a extremo)", () => {
  const exp = { id: "hook_q_vs_s", variable: "hook_type", metric: "vs_baseline_pct", variants: ["question", "statement"], min_per_variant: 4, min_lift: 20 };
  it("declara ganador con datos claros", () => {
    const vids = [
      ...Array(5).fill(0).map(() => v("question", 80)),
      ...Array(5).fill(0).map(() => v("statement", 10)),
    ];
    const r = runExperiment(vids, exp);
    expect(r.verdict).toBe("WINNER:question");
    expect(r.measured.question.n).toBe(5);
    expect(r.leader).toBe("question");
  });
  it("pocos datos -> RUNNING", () => {
    const r = runExperiment([v("question", 80), v("statement", 10)], exp);
    expect(r.verdict).toBe("RUNNING");
  });
});
