import { describe, it, expect } from "vitest";
import { mondayUTC, median, pctVsBaseline, sampleConfidence } from "../pipeline/lib/analytics_math.mjs";

describe("mondayUTC (semana ISO)", () => {
  it("un martes cae en el lunes de esa semana", () => expect(mondayUTC("2026-09-08")).toBe("2026-09-07"));
  it("un lunes se queda igual", () => expect(mondayUTC("2026-09-07")).toBe("2026-09-07"));
  it("un domingo cae en el lunes previo", () => expect(mondayUTC("2026-09-13")).toBe("2026-09-07"));
});

describe("median", () => {
  it("lista impar", () => expect(median([3, 1, 2])).toBe(2));
  it("lista par = promedio de los dos centrales", () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it("vacía -> null", () => expect(median([])).toBe(null));
  it("ignora no-finitos", () => expect(median([1, NaN, 3])).toBe(2));
});

describe("pctVsBaseline", () => {
  it("+50%", () => expect(pctVsBaseline(150, 100)).toBe(50));
  it("-20%", () => expect(pctVsBaseline(80, 100)).toBe(-20));
  it("base 0 -> null", () => expect(pctVsBaseline(10, 0)).toBe(null));
});

describe("sampleConfidence", () => {
  it("n=0 -> 0", () => expect(sampleConfidence(0)).toBe(0));
  it("crece con n", () => expect(sampleConfidence(30)).toBeGreaterThan(sampleConfidence(10)));
  it("acotada a <= 1", () => expect(sampleConfidence(1e6)).toBeLessThanOrEqual(1));
});
