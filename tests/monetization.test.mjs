import { describe, it, expect } from "vitest";
import { readiness, warRoom, MONET_GOALS } from "../pipeline/lib/monetization.mjs";

const DAY = 86400000;
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
// Genera un historial lineal de 8 días para un objetivo (crecimiento perDay).
function hist(key, start, perDay, nowMs, extra = {}) {
  const out = [];
  for (let i = 7; i >= 0; i--) {
    out.push({ date: dstr(nowMs - i * DAY), [key]: Math.round(start + perDay * (7 - i)), ...extra });
  }
  return out;
}

const NOW = Date.parse("2026-11-01T00:00:00Z"); // ~60 días del deadline 2026-12-31
const goal = { path: "test", deadline: "2026-12-31", targets: [{ key: "subs", label: "Suscriptores", target: 1000 }] };

describe("readiness", () => {
  it("objetivo cumplido -> done", () => {
    const rd = readiness(hist("subs", 1000, 0, NOW), goal, NOW);
    expect(rd.reqs[0].done).toBe(true);
    expect(rd.status).toBe("done");
  });
  it("ritmo suficiente -> ontrack, con proyección", () => {
    // faltan ~600 subs en ~60 días -> ~10/día. Le doy 20/día.
    const rd = readiness(hist("subs", 400, 20, NOW), goal, NOW);
    const r = rd.reqs[0];
    expect(r.on_track).toBe(true);
    expect(r.proj_date).toBeTruthy();
    expect(rd.status).toBe("ontrack");
  });
  it("ritmo insuficiente -> behind", () => {
    const rd = readiness(hist("subs", 400, 1, NOW), goal, NOW); // 1/día << ~10/día necesario
    expect(rd.reqs[0].on_track).toBe(false);
    expect(rd.status).toBe("behind");
  });
  it("sin datos suficientes para el ritmo -> measuring (on_track null)", () => {
    const rd = readiness([{ date: dstr(NOW), subs: 400 }], goal, NOW); // 1 solo snapshot
    expect(rd.reqs[0].on_track).toBe(null);
    expect(rd.status).toBe("measuring");
  });
});

describe("warRoom (60 días)", () => {
  it("activo cuando quedan <=60 días", () => {
    const rd = readiness(hist("subs", 400, 20, NOW), goal, NOW);
    const wr = warRoom(rd, { windowDays: 60 });
    expect(wr.active).toBe(true);
    expect(wr.window_days).toBe(60);
  });
  it("canal atrasado -> riesgo alto y foco en el métrico atrasado", () => {
    const rd = readiness(hist("subs", 200, 0, NOW), goal, NOW); // 0/día, muy atrás, <=30 no; behind sí
    const wr = warRoom(rd, { windowDays: 60 });
    expect(rd.status).toBe("behind");
    expect(wr.focus).toBe("subs");
    expect(wr.next_action).toMatch(/suscriptor/i);
    expect(["alto", "medio"]).toContain(wr.risk);
  });
  it("meta cumplida -> no activo, riesgo ninguno", () => {
    const rd = readiness(hist("subs", 1000, 0, NOW), goal, NOW);
    const wr = warRoom(rd, { windowDays: 60 });
    expect(wr.active).toBe(false);
    expect(wr.risk).toBe("ninguno");
  });
});

describe("MONET_GOALS", () => {
  it("define ambos canales con deadline y targets", () => {
    expect(MONET_GOALS["data-lens"].targets.length).toBeGreaterThan(0);
    expect(MONET_GOALS["auto2"].targets.some((t) => t.key === "shorts_views")).toBe(true);
  });
});
