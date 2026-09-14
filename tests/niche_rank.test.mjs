import { describe, it, expect } from "vitest";
import { rankNiches, cohort, scaleGate, median } from "../pipeline/lib/niche_rank.mjs";

const DAY = 86400000;
const NOW = Date.parse("2026-09-14T12:00:00Z");
const pub = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const vid = (niche, daysAgo, views, extra = {}) => ({ video_id: `${niche}${daysAgo}${views}`, niche, niche_label: niche, privacy: "public", pub_iso: pub(daysAgo), views, ...extra });

describe("cohort", () => {
  it("excluye privados, fuera de ventana e inferidos", () => {
    const list = [vid("a", 10, 100), vid("a", 2, 100), vid("a", 40, 100), vid("a", 10, 100, { privacy: "private" }), vid("a", 10, 100, { niche_inferred: true })];
    const c = cohort(list, { nowMs: NOW });
    expect(c.videos.length).toBe(1);
    expect(c.excluded_inferred).toBe(1);
  });
});

describe("rankNiches", () => {
  it("usa mediana: un viral no arrastra el nicho", () => {
    const list = [
      ...[1, 2, 3, 4].map((i) => vid("viral", 10, 100 + i)), vid("viral", 10, 1000000),
      ...[1, 2, 3, 4, 5].map((i) => vid("estable", 10, 500 + i)),
    ];
    const r = rankNiches(list, { nowMs: NOW });
    expect(r.rows[0].key).toBe("estable");
  });
  it("nicho con poca muestra queda como insuficiente y detrás", () => {
    const list = [...[1, 2, 3, 4, 5].map((i) => vid("a", 10, 100 + i)), vid("b", 10, 99999)];
    const r = rankNiches(list, { nowMs: NOW });
    expect(r.rows[0].key).toBe("a");
    expect(r.rows.find((x) => x.key === "b").sufficient).toBe(false);
  });
  it("median sin datos es null", () => { expect(median([])).toBe(null); });
});

describe("scaleGate", () => {
  const rec = (daysAgo, d7) => ({ published_at: pub(daysAgo), d7 });
  it("sin muestra -> no escala", () => {
    const g = scaleGate({ a: rec(8, 100) }, { nowMs: NOW });
    expect(g.allow).toBe(false);
    expect(g.status).toBe("sin_dato");
  });
  it("cohorte reciente estable -> permite", () => {
    const va = {};
    [8, 9, 10, 11, 12].forEach((a, i) => { va[`r${i}`] = rec(a, 1000); });
    [15, 16, 17, 18, 19].forEach((a, i) => { va[`p${i}`] = rec(a, 1100); });
    expect(scaleGate(va, { nowMs: NOW }).allow).toBe(true);
  });
  it("cohorte reciente cae >25% -> bloquea", () => {
    const va = {};
    [8, 9, 10, 11, 12].forEach((a, i) => { va[`r${i}`] = rec(a, 500); });
    [15, 16, 17, 18, 19].forEach((a, i) => { va[`p${i}`] = rec(a, 1000); });
    const g = scaleGate(va, { nowMs: NOW });
    expect(g.allow).toBe(false);
    expect(g.change_pct).toBe(-50);
  });
});
