import { describe, it, expect } from "vitest";
import { ODDLY_GOAL, HOOK_PAIRS, isoWeek, weeklyHookExperiment, pushLeader, attachHookVideos, hookLift, goalEntryFields } from "../pipeline/lib/oddly_goal.mjs";
import { newEntry, judge } from "../pipeline/lib/ledger.mjs";
import { evaluateYpp } from "../pipeline/lib/ypp.mjs";
import { MONET_GOALS } from "../pipeline/lib/monetization.mjs";

const NOW = Date.parse("2026-09-14T12:00:00Z");

describe("meta del año de Oddly", () => {
  it("es el nivel intermedio y la usan el reporte y la viabilidad", () => {
    expect(ODDLY_GOAL.tier).toBe("expanded");
    expect(MONET_GOALS.auto2.goal_tier).toBe("expanded");
    const t = Object.fromEntries(MONET_GOALS.auto2.targets.map((x) => [x.key, x.target]));
    expect(t.subs).toBe(500);
    expect(t.shorts_views_90d).toBe(3000000);
    const snap = { subs: 56, shorts_views_90d: 60337, uploads_90d: 382, shorts_views_per_day_28d: 1828, watch_hours_365d: 0 };
    const y = evaluateYpp(snap, [], { nowMs: NOW, deadline: "2026-12-31", goalTier: "expanded" });
    expect(y.goal_tier).toBe("expanded");
    expect(y.feasibility).toBe(y.tiers.expanded.status);
    expect(y.feasibility_full).toBe(y.tiers.full.status);
  });
  it("sin meta explícita se mantiene la completa (Data Lens)", () => {
    const y = evaluateYpp({ subs: 0 }, [], { nowMs: NOW });
    expect(y.goal_tier).toBe("full");
  });
  it("la entrada del ledger exige duplicar el ritmo real en 28 días", () => {
    const f = goalEntryFields({ shorts_views_per_day_28d: 1828 }, 33333);
    const e = newEntry(f, NOW);
    expect(e.id).toBe("goal-oddly-hito-intermedio");
    expect(e.criterion).toEqual({ op: ">=", value: 3656 });
    expect(Date.parse(e.review_at) - NOW).toBe(28 * 86400000);
    expect(judge(e, 4000).status).toBe("ACERTO");
    expect(judge(e, 2000).status).toBe("FALLO");
    expect(judge(e, null).status).toBe("INCONCLUSO");
  });
  it("sin ritmo medido no se inventa la meta", () => {
    expect(goalEntryFields({})).toBe(null);
    expect(goalEntryFields({ shorts_views_per_day_28d: null })).toBe(null);
  });
});

describe("mayoría de cupos al líder", () => {
  it("lleva al líder al 60% sin dejar a otro nicho en cero", () => {
    const r = pushLeader({ animales_tiernos: 5, satisfying: 4, narrativas: 3, ciencia_humor: 0 }, "animales_tiernos", 0.6, 1);
    expect(r.alloc.animales_tiernos).toBe(8);
    expect(r.alloc.satisfying + r.alloc.narrativas).toBe(4);
    expect(r.alloc.satisfying).toBeGreaterThanOrEqual(1);
    expect(r.alloc.narrativas).toBeGreaterThanOrEqual(1);
    expect(r.alloc.ciencia_humor).toBe(0);
    expect(Object.values(r.alloc).reduce((a, b) => a + b, 0)).toBe(12);
  });
  it("si ya tiene la mayoría no mueve nada", () => {
    expect(pushLeader({ a: 8, b: 2, c: 2 }, "a", 0.6).moved).toBe(0);
  });
  it("líder inexistente no cambia el reparto", () => {
    expect(pushLeader({ a: 3 }, "zzz").alloc).toEqual({ a: 3 });
  });
});

describe("ganchos semanales", () => {
  it("la semana ISO es estable y rota el par cada semana", () => {
    expect(isoWeek(NOW)).toBe("2026-W38");
    const a = weeklyHookExperiment("2026-W38", "animales_tiernos");
    const b = weeklyHookExperiment("2026-W39", "animales_tiernos");
    expect(a.id).not.toBe(b.id);
    expect(a.niche).toBe("animales_tiernos");
    expect(a.arms).toHaveLength(2);
    for (const arm of a.arms) expect(a.arm_text[arm]).toBeTruthy();
    expect(weeklyHookExperiment("2026-W42", "x").id).toContain(HOOK_PAIRS[42 % HOOK_PAIRS.length].id);
    expect(weeklyHookExperiment("2026-W38", null)).toBe(null);
  });
  it("ata cada video a su brazo por franja y nicho", () => {
    const e = { arms: ["data", "sensory"], videos: { data: [], sensory: [] }, pending: [
      { slot_utc: "2026-09-15T11:00:00Z", niche: "animales_tiernos", arm: "data" },
      { slot_utc: "2026-09-15T18:00:00Z", niche: "animales_tiernos", arm: "sensory" },
      { slot_utc: "2026-09-15T21:00:00Z", niche: "animales_tiernos", arm: "data" },
    ] };
    const scheduled = [
      { video_id: "v1", niche: "animales_tiernos", publish_at: "2026-09-15T11:05:00Z" },
      { video_id: "v2", niche: "satisfying", publish_at: "2026-09-15T18:00:00Z" },
    ];
    const out = attachHookVideos(e, scheduled, Date.parse("2026-09-15T12:00:00Z"));
    expect(out.videos.data).toEqual(["v1"]);
    expect(out.videos.sensory).toEqual([]);
    expect(out.pending).toHaveLength(2);
    const later = attachHookVideos(out, [], Date.parse("2026-09-18T12:00:00Z"));
    expect(later.pending).toHaveLength(0);
  });
  it("sin 3 videos medidos por brazo no concluye; con muestra elige ganador", () => {
    const e = { arms: ["data", "sensory"], videos: { data: ["a", "b", "c"], sensory: ["d", "e"] } };
    const v = { a: { d7: 300 }, b: { d7: 400 }, c: { d7: 500 }, d: { d7: 100 }, e: { d7: 200 }, f: { d7: 150 } };
    expect(hookLift(e, v)).toBe(null);
    const r = hookLift({ ...e, videos: { data: ["a", "b", "c"], sensory: ["d", "e", "f"] } }, v);
    expect(r.winner).toBe("data");
    expect(r.lift_pct).toBe(167);
    expect(r.a).toEqual({ arm: "data", n: 3, median: 400 });
  });
});
