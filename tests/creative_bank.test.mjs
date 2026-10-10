import { describe, it, expect } from "vitest";
import { newItem, priorityScore, bucket, advance, rankBank, nextToTest, seedFromOutliers } from "../pipeline/lib/creative_bank.mjs";

const NOW = Date.parse("2026-09-14T00:00:00Z");

describe("priorityScore / bucket", () => {
  it("fórmula impacto×prob×vel÷coste", () => {
    expect(priorityScore({ impact: 5, probability: 1, velocity: 5, cost: 1 })).toBe(25);
    expect(priorityScore({ impact: 4, probability: 0.5, velocity: 4, cost: 2 })).toBe(4);
  });
  it("buckets por score", () => {
    expect(bucket({ impact: 5, probability: 1, velocity: 5, cost: 1 })).toBe("P0"); // 25
    expect(bucket({ impact: 4, probability: 0.5, velocity: 4, cost: 2 })).toBe("P2"); // 4
    expect(bucket({ impact: 1, probability: 0.1, velocity: 1, cost: 5 })).toBe("P3"); // ~0.02
  });
  it("KILLED -> bucket KILL sin importar el score", () => {
    expect(bucket({ impact: 5, probability: 1, velocity: 5, cost: 1, state: "KILLED" })).toBe("KILL");
  });
});

describe("newItem", () => {
  it("crea con defaults, prioridad y bucket", () => {
    const it0 = newItem({ text: "probar hook pregunta" }, NOW);
    expect(it0.state).toBe("BACKLOG");
    expect(it0.priority).toBeGreaterThan(0);
    expect(["P0", "P1", "P2", "P3"]).toContain(it0.bucket);
    expect(it0.id).toBeTruthy();
  });
});

describe("advance (máquina de estados)", () => {
  it("BACKLOG->TESTING->WINNER válido", () => {
    let it0 = newItem({ text: "x" }, NOW);
    it0 = advance(it0, "TESTING", NOW);
    expect(it0.state).toBe("TESTING");
    it0 = advance(it0, "WINNER", NOW);
    expect(it0.state).toBe("WINNER");
  });
  it("transición inválida lanza", () => {
    const it0 = newItem({ text: "x" }, NOW); // BACKLOG
    expect(() => advance(it0, "WINNER", NOW)).toThrow(); // BACKLOG no va directo a WINNER
  });
});

describe("rankBank / nextToTest", () => {
  const items = [
    newItem({ text: "baja", impact: 1, probability: 0.2, velocity: 1, cost: 5 }, NOW),   // P3
    newItem({ text: "alta", impact: 5, probability: 1, velocity: 5, cost: 1 }, NOW),      // P0
    { ...newItem({ text: "muerta", impact: 5, probability: 1, velocity: 5, cost: 1 }, NOW), state: "KILLED" },
    newItem({ text: "media", impact: 4, probability: 0.8, velocity: 4, cost: 2 }, NOW),   // P1 (6.4)
  ];
  it("ordena P0>P1>P3>KILL", () => {
    const r = rankBank(items);
    expect(r[0].text).toBe("alta");
    expect(r[r.length - 1].text).toBe("muerta");
  });
  it("nextToTest solo BACKLOG, mejor priorizado primero", () => {
    const n = nextToTest(items, 2);
    expect(n.map((i) => i.text)).toEqual(["alta", "media"]);
  });
});

describe("seedFromOutliers", () => {
  const outliers = { count: 6, pattern: { hook: { value: "question", count: 6 }, format: { value: "short", count: 6 } }, suggestion: "..." };
  it("agrega una idea BACKLOG desde el patrón", () => {
    const bank = seedFromOutliers([], outliers, "data-lens", NOW);
    expect(bank.length).toBe(1);
    expect(bank[0].source).toBe("outlier");
    expect(bank[0].text).toMatch(/question/);
    expect(bank[0].state).toBe("BACKLOG");
  });
  it("idempotente: no duplica si ya existe viva", () => {
    let bank = seedFromOutliers([], outliers, "data-lens", NOW);
    bank = seedFromOutliers(bank, outliers, "data-lens", NOW);
    expect(bank.length).toBe(1);
  });
  it("patron SIN lift sobre la tasa base: no siembra y caduca la idea vieja (caso Oddly 2026-10)", () => {
    const sinLift = { count: 49, pattern: { hook: { value: "number", count: 47, lift: 1.05 }, format: { value: "short", count: 49, lift: 1.0 }, lift_min: 1.3, base_rate_corrected: true } };
    const vieja = { id: "o1", channel: "auto2", source: "outlier", state: "BACKLOG", kind: "hook", text: 'Replicar patrón ganador: hook "number" en short' };
    const bank = seedFromOutliers([vieja], sinLift, "auto2", NOW);
    expect(bank.length).toBe(1);
    expect(bank[0].state).toBe("KILLED");
  });
  it("patron CON lift real: siembra", () => {
    const conLift = { count: 9, pattern: { hook: { value: "question", count: 6, lift: 2.1 }, format: null, lift_min: 1.3, base_rate_corrected: true } };
    const bank = seedFromOutliers([], conLift, "auto2", NOW);
    expect(bank.length).toBe(1);
    expect(bank[0].text).toMatch(/question/);
  });
  it("sin outliers -> banco intacto", () => {
    expect(seedFromOutliers([{ id: "a" }], { count: 0 }, "data-lens", NOW).length).toBe(1);
  });
});
