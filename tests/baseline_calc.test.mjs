import { describe, it, expect } from "vitest";
import { computeBaseline } from "../pipeline/lib/baseline_calc.mjs";

const weeks = [
  { week: "2026-07-06", views: 0, likes: 0, subs_net: 0, days: 7 },   // sin señal -> excluida
  { week: "2026-08-03", views: 300, likes: 5, subs_net: 2, days: 7 },
  { week: "2026-08-10", views: 100, likes: 3, subs_net: 1, days: 7 },
  { week: "2026-08-17", views: 200, likes: 4, subs_net: 3, days: 7 },
  { week: "2026-08-24", views: 500, likes: 10, subs_net: 5, days: 7 }, // mejor
  { week: "2026-08-31", views: 150, likes: 2, subs_net: 1, days: 5 },  // parcial -> excluida
];

describe("computeBaseline", () => {
  const b = computeBaseline(weeks);
  it("usa solo semanas completas y con señal", () => expect(b.weeks_used).toBe(4));
  it("mediana de vistas semanales = 250", () => expect(b.median_weekly_views).toBe(250));
  it("mejor semana = 500", () => expect(b.best_week.views).toBe(500));
  it("semana reciente = última completa (24/08)", () => expect(b.recent_week.week).toBe("2026-08-24"));
  it("delta reciente vs mediana = +100%", () => expect(b.recent_week.vs_median_pct).toBe(100));
  it("lista vacía -> mediana null y sin recent", () => {
    const e = computeBaseline([]);
    expect(e.median_weekly_views).toBe(null);
    expect(e.recent_week).toBe(null);
  });
});
