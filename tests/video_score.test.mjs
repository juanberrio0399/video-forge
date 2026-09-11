import { describe, it, expect } from "vitest";
import { scoreVideo, findOutliers, SCALE_RATIO, STOP_RATIO } from "../pipeline/lib/video_score.mjs";

describe("scoreVideo — veredicto", () => {
  it("joven / pocos datos -> TEST_AGAIN", () => {
    expect(scoreVideo({ video_id: "a", age_days: 1, views: 500, vs_baseline_pct: 200 }).verdict).toBe("TEST_AGAIN");
    expect(scoreVideo({ video_id: "b", age_days: 10, views: 5, vs_baseline_pct: 200 }).verdict).toBe("TEST_AGAIN");
  });
  it("maduro y muy por encima de la mediana -> SCALE", () => {
    const s = scoreVideo({ video_id: "c", age_days: 10, views: 5000, vs_baseline_pct: 80 }); // ratio 1.8
    expect(s.verdict).toBe("SCALE");
    expect(s.mature).toBe(true);
  });
  it("maduro y muy por debajo -> STOP", () => {
    const s = scoreVideo({ video_id: "d", age_days: 10, views: 5000, vs_baseline_pct: -70 }); // ratio 0.3
    expect(s.verdict).toBe("STOP");
  });
  it("maduro y cerca de la mediana -> ITERATE", () => {
    const s = scoreVideo({ video_id: "e", age_days: 10, views: 5000, vs_baseline_pct: 0 }); // ratio 1.0
    expect(s.verdict).toBe("ITERATE");
  });
  it("SCALE requiere que la retención no sea mala", () => {
    const good = scoreVideo({ video_id: "f", age_days: 10, views: 5000, vs_baseline_pct: 80 }, { hook_score: 1.1, early_drop_pct: 5 });
    const bad = scoreVideo({ video_id: "g", age_days: 10, views: 5000, vs_baseline_pct: 80 }, { hook_score: 0.1, early_drop_pct: 80 });
    expect(good.verdict).toBe("SCALE");
    expect(bad.verdict).toBe("ITERATE"); // buen rendimiento pero retención mala -> no escalar aún
  });
  it("overall en 0-100 y clasifica el hook", () => {
    const s = scoreVideo({ video_id: "h", title: "Why X?", age_days: 10, views: 5000, vs_baseline_pct: 50 });
    expect(s.overall).toBeGreaterThanOrEqual(0);
    expect(s.overall).toBeLessThanOrEqual(100);
    expect(s.hook_type).toBe("question");
  });
});

describe("findOutliers", () => {
  const eps = [
    { video_id: "o1", title: "Why this?", age_days: 10, vs_baseline_pct: 120, vpd: 22, format: "short" }, // ratio 2.2
    { video_id: "o2", title: "How that works", age_days: 10, vs_baseline_pct: 60, vpd: 16, format: "short" },  // ratio 1.6
    { video_id: "n1", title: "Cute animals", age_days: 10, vs_baseline_pct: -10, vpd: 9, format: "short" },   // ratio 0.9
    { video_id: "y1", title: "Big one", age_days: 1, vs_baseline_pct: 300, vpd: 40, format: "short" },        // joven -> excluido
  ];
  it("solo maduros que superan el factor", () => {
    const r = findOutliers(eps, { factor: 1.5 });
    expect(r.count).toBe(2);
    expect(r.outliers.map((o) => o.video_id)).toEqual(["o1", "o2"]);
  });
  it("ordena por vs_baseline_pct desc y extrae patrón + sugerencia", () => {
    const r = findOutliers(eps, { factor: 1.5 });
    expect(r.outliers[0].video_id).toBe("o1");
    expect(r.pattern.hook.value).toBe("question"); // ambos outliers son hook pregunta
    expect(r.suggestion).toMatch(/question/);
  });
  it("sin outliers -> sugerencia de seguir midiendo", () => {
    const r = findOutliers([{ video_id: "z", age_days: 10, vs_baseline_pct: 0 }], { factor: 1.5 });
    expect(r.count).toBe(0);
    expect(r.suggestion).toMatch(/sin outliers/i);
  });
});

describe("umbrales exportados", () => {
  it("SCALE_RATIO y STOP_RATIO coherentes", () => {
    expect(SCALE_RATIO).toBeGreaterThan(1);
    expect(STOP_RATIO).toBeLessThan(1);
  });
});
