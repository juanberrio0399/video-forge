import { describe, it, expect } from "vitest";
import { analyzeRetention } from "../pipeline/lib/retention_calc.mjs";

// Curva: caída inicial suave (10%), meseta, y una CAÍDA FUERTE en ratio 0.4.
const curve = [
  { ratio: 0.0, watch: 1.0 },
  { ratio: 0.03, watch: 0.9 },
  { ratio: 0.1, watch: 0.85 },
  { ratio: 0.3, watch: 0.8 },
  { ratio: 0.4, watch: 0.4 }, // mayor caída aquí
  { ratio: 1.0, watch: 0.35 },
];

describe("analyzeRetention", () => {
  const a = analyzeRetention(curve);
  it("cuenta los puntos", () => expect(a.points).toBe(6));
  it("caída inicial 0->3% = 10%", () => expect(a.early_drop_pct).toBe(10));
  it("hook_score = retención al ~10% (0.85)", () => expect(a.hook_score).toBe(0.85));
  it("punto más débil en el mayor salto (ratio 0.4)", () => expect(a.weakest_at).toBe(0.4));
  it("promedio de watch", () => expect(a.avg_watch).toBeCloseTo(0.717, 2));
  it("curva insuficiente (<2 puntos) -> nulls", () => {
    const e = analyzeRetention([{ ratio: 0, watch: 1 }]);
    expect(e.points).toBe(1);
    expect(e.hook_score).toBe(null);
    expect(e.weakest_at).toBe(null);
  });
});
