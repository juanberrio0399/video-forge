import { describe, it, expect } from "vitest";
import { evaluateRequirement, evaluateTier, evaluateYpp, stockPace, worstStatus, YPP_TIERS } from "../pipeline/lib/ypp.mjs";

const DAY = 86400000;
const NOW = Date.parse("2026-09-14T12:00:00Z");
const d = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10);
const opts = { nowMs: NOW, deadline: "2026-12-31" };

describe("evaluateRequirement", () => {
  it("dato ausente es sin_dato, nunca cero", () => {
    const r = evaluateRequirement({ key: "shorts_views_90d", label: "x", target: 10000000, kind: "rolling", window: 90 }, {}, [], opts);
    expect(r.status).toBe("sin_dato");
    expect(r.cur).toBe(null);
    expect(r.pct).toBe(null);
  });
  it("ventana móvil: ritmo real = cur/ventana contra target/ventana", () => {
    const r = evaluateRequirement({ key: "shorts_views_90d", label: "x", target: 9000000, kind: "rolling", window: 90 }, { shorts_views_90d: 180000 }, [], opts);
    expect(r.per_day_actual).toBe(2000);
    expect(r.per_day_needed).toBe(100000);
    expect(r.status).toBe("improbable");
  });
  it("stock con ritmo suficiente queda en camino", () => {
    const hist = [{ date: d(10), subs: 100 }, { date: d(0), subs: 300 }];
    const r = evaluateRequirement({ key: "subs", label: "s", target: 1000, kind: "stock" }, { subs: 300 }, hist, opts);
    expect(r.per_day_actual).toBe(20);
    expect(r.status).toBe("en_camino");
  });
  it("stock sin tramo suficiente de historia -> midiendo", () => {
    const hist = [{ date: d(1), subs: 100 }, { date: d(0), subs: 120 }];
    const r = evaluateRequirement({ key: "subs", label: "s", target: 1000, kind: "stock" }, { subs: 120 }, hist, opts);
    expect(r.status).toBe("midiendo");
  });
  it("cumplido", () => {
    const r = evaluateRequirement({ key: "subs", label: "s", target: 500, kind: "stock" }, { subs: 700 }, [], opts);
    expect(r.status).toBe("cumplido");
  });
});

describe("stockPace", () => {
  it("ignora snapshots sin dato", () => {
    const hist = [{ date: d(9), subs: null }, { date: d(8), subs: 50 }, { date: d(0), subs: 90 }];
    expect(stockPace(hist, "subs", NOW)).toBe(5);
  });
});

describe("evaluateTier / evaluateYpp", () => {
  it("elige la mejor opción del 'either' (basta una)", () => {
    const snap = { subs: 1200, shorts_views_90d: 100, watch_hours_365d: 5000, uploads_90d: 10 };
    const t = evaluateTier(YPP_TIERS.full, snap, [], opts);
    expect(t.best_option).toBe("watch_hours_365d");
    expect(t.status).toBe("cumplido");
  });
  it("improbable manda sobre sin dato", () => {
    expect(worstStatus(["sin_dato", "improbable", "en_camino"])).toBe("improbable");
    expect(worstStatus(["sin_dato", "en_camino"])).toBe("sin_dato");
  });
  it("próximo hito es el nivel intermedio mientras no se cumpla", () => {
    const y = evaluateYpp({ subs: 56, shorts_views_90d: 200000, uploads_90d: 50 }, [], opts);
    expect(y.next_milestone).toBe("expanded");
    expect(y.feasibility).toBe("improbable");
    expect(y.missing).toContain("watch_hours_365d");
  });
});
