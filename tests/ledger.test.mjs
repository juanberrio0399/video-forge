import { describe, it, expect } from "vitest";
import { newEntry, dueEntries, judge, applyReview, consecutiveFailures, shouldRevert, hitRate, trim } from "../pipeline/lib/ledger.mjs";

const DAY = 86400000;
const NOW = Date.parse("2026-09-14T12:00:00Z");
const base = { type: "niche_allocation", channel: "auto2", metric: "top_niche_rel", criterion: { op: ">=", value: 1 }, review_after_days: 7 };

describe("newEntry", () => {
  it("exige métrica y criterio válidos", () => {
    expect(() => newEntry({ metric: "x", criterion: { op: "~", value: 1 } }, NOW)).toThrow();
    expect(() => newEntry({ criterion: { op: ">=", value: 1 } }, NOW)).toThrow();
  });
  it("programa la revisión y nace pendiente", () => {
    const e = newEntry(base, NOW);
    expect(e.status).toBe("PENDIENTE");
    expect(Date.parse(e.review_at)).toBe(NOW + 7 * DAY);
  });
});

describe("revisión", () => {
  it("solo vence en su fecha", () => {
    const l = [newEntry(base, NOW)];
    expect(dueEntries(l, NOW + DAY).length).toBe(0);
    expect(dueEntries(l, NOW + 8 * DAY).length).toBe(1);
  });
  it("sin dato -> INCONCLUSO, nunca acierto", () => {
    expect(judge(newEntry(base, NOW), null).status).toBe("INCONCLUSO");
  });
  it("juzga contra su propio criterio", () => {
    const e = newEntry(base, NOW);
    expect(judge(e, 1.2).status).toBe("ACERTO");
    expect(judge(e, 0.8).status).toBe("FALLO");
  });
  it("dos fallos seguidos piden revertir; un acierto corta la racha", () => {
    let l = [newEntry({ ...base, id: "a" }, NOW), newEntry({ ...base, id: "b" }, NOW + DAY), newEntry({ ...base, id: "c" }, NOW + 2 * DAY)];
    l = applyReview(l, "a", 1.5, NOW + 10 * DAY);
    l = applyReview(l, "b", 0.5, NOW + 11 * DAY);
    expect(shouldRevert(l, "niche_allocation", "auto2")).toBe(false);
    l = applyReview(l, "c", 0.4, NOW + 12 * DAY);
    expect(consecutiveFailures(l, "niche_allocation", "auto2")).toBe(2);
    expect(shouldRevert(l, "niche_allocation", "auto2")).toBe(true);
    expect(hitRate(l).rate).toBe(0.33);
  });
  it("trim conserva pendientes", () => {
    const l = [newEntry({ ...base, id: "p" }, NOW), ...Array.from({ length: 5 }, (_, i) => ({ ...newEntry({ ...base, id: `d${i}` }, NOW), status: "ACERTO", reviewed_at: new Date(NOW + i * DAY).toISOString() }))];
    const t = trim(l, 2);
    expect(t.some((e) => e.id === "p")).toBe(true);
    expect(t.length).toBe(3);
  });
});
