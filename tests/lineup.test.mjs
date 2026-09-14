import { describe, it, expect } from "vitest";
import { etDate, daySlots, interleave, buildLineup, pickToProduce, diffLineups, journalAppend, buildKnowledge } from "../pipeline/lib/lineup.mjs";

const HOUR = 3600000;
const NOW = Date.parse("2026-09-14T00:30:00Z"); // domingo 20:30 ET
const niches = {
  animales_tiernos: { label: "Animales", median_vpd: 80, n: 20, rel: 1.4, why: "mediana alta" },
  satisfying: { label: "Satisfying", median_vpd: 40, n: 12, rel: 0.7, why: "segundo" },
};

describe("fechas y franjas", () => {
  it("mañana en ET", () => { expect(etDate(NOW, 1)).toBe("2026-09-14"); });
  it("franjas del día con horas dadas, ordenadas", () => {
    const s = daySlots("2026-09-14", [7, 14, 15, 17]);
    expect(s.length).toBe(4);
    expect(new Date(s[0]).toISOString()).toBe("2026-09-14T11:00:00.000Z");
  });
});

describe("interleave", () => {
  it("respeta el reparto y no agrupa el mismo nicho", () => {
    const seq = interleave({ a: 3, b: 3 });
    expect(seq.filter((x) => x === "a").length).toBe(3);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });
});

describe("buildLineup", () => {
  const base = { nowMs: NOW, date: "2026-09-14", hoursET: [7, 14, 15, 17], perSlot: 2, allocation: { animales_tiernos: 7, satisfying: 5 }, niches, channelMedianVpd: 57 };
  it("capacidad = franjas × cupos; recorta lo que no cabe", () => {
    const l = buildLineup(base);
    expect(l.capacity).toBe(8);
    expect(l.trimmed).toBe(4);
    expect(l.items.length).toBe(8);
  });
  it("cada pieza trae la cadena de decisión completa", () => {
    const it0 = buildLineup(base).items[0];
    for (const k of ["decision", "reason", "evidence", "action", "metric", "deadline", "criterion", "next"]) expect(it0.record[k]).toBeTruthy();
  });
  it("reconcilia lo ya programado cerca de la franja", () => {
    const l = buildLineup({ ...base, scheduled: [{ video_id: "v1", title: "T", publish_at: "2026-09-14T18:10:00Z", niche: "animales_tiernos" }] });
    const hit = l.items.find((i) => i.video_id === "v1");
    expect(hit.status).toBe("programado");
  });
  it("experimento cambia UNA variable y alterna brazos", () => {
    const l = buildLineup({ ...base, experiment: { id: "hook", variable: "hook", arms: ["question", "statement"], niche: "animales_tiernos", hypothesis: "h" } });
    const arms = l.items.filter((i) => i.experiment).map((i) => i.experiment.arm);
    expect(new Set(arms)).toEqual(new Set(["question", "statement"]));
    expect(l.items.filter((i) => i.niche === "satisfying").every((i) => !i.experiment)).toBe(true);
  });
  it("las ideas solo caen donde encajan y no repiten", () => {
    const bank = [
      { id: "t1", kind: "idea", text: "Cachorro vs espejo", state: "BACKLOG", priority: 20, niche: "animales_tiernos" },
      { id: "t2", kind: "idea", text: "Tema sin nicho", state: "BACKLOG", priority: 15 },
      { id: "h1", kind: "hook", text: "Gancho genérico", state: "BACKLOG", priority: 10 },
    ];
    const l = buildLineup({ ...base, bank });
    const withIdea = l.items.filter((i) => i.idea);
    expect(withIdea.filter((i) => i.idea.id === "t1").every((i) => i.niche === "animales_tiernos")).toBe(true);
    expect(withIdea.filter((i) => i.idea.id === "t2").every((i) => i.niche === "animales_tiernos")).toBe(true);
    expect(new Set(withIdea.map((i) => i.idea.id)).size).toBe(withIdea.length);
  });
  it("pieza en experimento de gancho no recibe ideas de gancho", () => {
    const bank = [{ id: "h1", kind: "hook", text: "Gancho", state: "BACKLOG", priority: 30 }];
    const l = buildLineup({ ...base, bank, experiment: { id: "e", variable: "hook", arms: ["question", "statement"], niche: "animales_tiernos" } });
    expect(l.items.filter((i) => i.experiment && i.idea && i.idea.id === "h1").length).toBe(0);
  });
  it("franja pasada sin video es vencida, no 'sin tiempo'", () => {
    const l = buildLineup({ ...base, nowMs: Date.parse("2026-09-15T02:00:00Z") });
    expect(l.items.every((i) => i.status === "vencido")).toBe(true);
    expect(l.summary.vencido).toBe(8);
  });
  it("franja sin margen no se fabrica a última hora", () => {
    const l = buildLineup({ ...base, nowMs: Date.parse("2026-09-14T10:00:00Z") });
    expect(l.items.filter((i) => i.slot_utc === "2026-09-14T11:00:00.000Z").every((i) => i.status === "sin_tiempo")).toBe(true);
  });
});

describe("pickToProduce", () => {
  it("toma lo planeado con margen, lo más cercano primero, con tope", () => {
    const l = buildLineup({ nowMs: NOW, date: "2026-09-14", hoursET: [7, 14, 15, 17], perSlot: 2, allocation: { animales_tiernos: 4, satisfying: 4 }, niches });
    const pick = pickToProduce([l], NOW, { max: 3 });
    expect(pick.length).toBe(3);
    expect(Date.parse(pick[0].slot_utc) - NOW).toBeGreaterThanOrEqual(3 * HOUR);
  });
});

describe("bitácora y conocimiento", () => {
  it("un plan nuevo produce pensamientos; los cambios se describen", () => {
    const a = buildLineup({ nowMs: NOW, date: "2026-09-14", hoursET: [7, 14], perSlot: 2, allocation: { animales_tiernos: 2, satisfying: 2 }, niches });
    const b = buildLineup({ nowMs: NOW, date: "2026-09-14", hoursET: [7, 14], perSlot: 2, allocation: { animales_tiernos: 3, satisfying: 1 }, niches });
    expect(diffLineups(null, a)[0]).toMatch(/Armé el plan/);
    expect(diffLineups(a, b)[0]).toMatch(/Ajusté/);
    expect(journalAppend([], ["x", "y"], NOW, 1).length).toBe(1);
  });
  it("separa sabe / cree / desconoce sin inventar", () => {
    const k = buildKnowledge({ channelMedianVpd: 50, missing: ["impressions_28d"] }, { ...niches, narrativas: { label: "Narrativas", n: 2 } });
    expect(k.sabe.length).toBeGreaterThan(0);
    expect(k.cree.some((x) => /Animales/.test(x))).toBe(true);
    expect(k.desconoce.some((x) => /Narrativas/.test(x))).toBe(true);
    expect(k.desconoce.some((x) => /impressions_28d/.test(x))).toBe(true);
  });
});
