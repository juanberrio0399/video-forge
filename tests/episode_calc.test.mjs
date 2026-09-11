import { describe, it, expect } from "vitest";
import { vpd, medianVpd, buildEpisode } from "../pipeline/lib/episode_calc.mjs";

const NOW = Date.parse("2026-09-10T00:00:00Z");
const daysAgoISO = (d) => new Date(NOW - d * 86400000).toISOString().slice(0, 10);
const mk = (id, views, daysAgo, seconds = 60) => ({ video_id: id, title: id, views, seconds, published_at: daysAgoISO(daysAgo) });

describe("vpd", () => {
  it("100 vistas en 10 días = 10/día", () => expect(vpd(100, daysAgoISO(10), NOW)).toBeCloseTo(10, 5));
  it("fecha inválida -> 0", () => expect(vpd(100, "nope", NOW)).toBe(0));
  it("recién publicado no divide por menos de 1 día", () => expect(vpd(50, daysAgoISO(0), NOW)).toBe(50));
});

describe("medianVpd (solo videos maduros)", () => {
  it("ignora videos nuevos (<5 días) y saca mediana de vpd", () => {
    const vids = [mk("a", 100, 10), mk("b", 200, 10), mk("c", 9999, 1)]; // c es nuevo -> excluido
    expect(medianVpd(vids, NOW)).toBe(15); // vpd a=10, b=20 -> mediana 15
  });
});

describe("buildEpisode", () => {
  const ep = buildEpisode(mk("x", 300, 10, 45), 10, NOW);
  it("formato short si <= 90s", () => expect(ep.format).toBe("short"));
  it("vpd = 30", () => expect(ep.vpd).toBe(30));
  it("vs_baseline_pct = +200% (30 vs 10)", () => expect(ep.vs_baseline_pct).toBe(200));
  it("age_days = 10", () => expect(ep.age_days).toBe(10));
  it("campos cognitivos en null (para neuronas futuras)", () => {
    expect(ep.hook_type).toBe(null);
    expect(ep.hypothesis).toBe(null);
    expect(ep.result).toBe(null);
  });
});
