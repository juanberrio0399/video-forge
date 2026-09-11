import { describe, it, expect } from "vitest";
import { growthDrop, formatFatigue, concentration, pipelineStalled, behindGoal, evaluateAlerts } from "../pipeline/lib/alerts.mjs";

const DAY = 86400000;
const NOW = Date.parse("2026-09-20T00:00:00Z");
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
// historial acumulado: subs en d-14, d-7, hoy
function hist(v14, v7, v0) {
  return [
    { date: dstr(NOW - 14 * DAY), subs: v14 },
    { date: dstr(NOW - 7 * DAY), subs: v7 },
    { date: dstr(NOW), subs: v0 },
  ];
}

describe("growthDrop", () => {
  it("estancado (ganó 0 esta semana tras ganar antes) -> critical", () => {
    const a = growthDrop(hist(100, 150, 150), "subs", "Suscriptores", NOW);
    expect(a.severity).toBe("critical");
  });
  it("desacelera (menos de la mitad) -> warn", () => {
    const a = growthDrop(hist(100, 200, 220), "subs", "Suscriptores", NOW); // prior +100, recent +20
    expect(a.severity).toBe("warn");
  });
  it("crecimiento sano -> sin alerta", () => {
    expect(growthDrop(hist(100, 150, 210), "subs", "Suscriptores", NOW)).toBe(null); // +50 -> +60
  });
});

describe("formatFatigue", () => {
  it("cohorte reciente rinde <60% de la vieja -> warn", () => {
    const eps = [
      ...Array(3).fill(0).map(() => ({ format: "short", vpd: 20, age_days: 30, views: 500 })),
      ...Array(3).fill(0).map(() => ({ format: "short", vpd: 5, age_days: 3, views: 500 })),
    ];
    const a = formatFatigue(eps);
    expect(a.length).toBe(1);
    expect(a[0].id).toBe("fatigue_short");
  });
  it("sin caída -> sin alerta", () => {
    const eps = [
      ...Array(3).fill(0).map(() => ({ format: "short", vpd: 20, age_days: 30, views: 500 })),
      ...Array(3).fill(0).map(() => ({ format: "short", vpd: 22, age_days: 3, views: 500 })),
    ];
    expect(formatFatigue(eps).length).toBe(0);
  });
});

describe("concentration", () => {
  it("un nicho >=70% -> warn", () => {
    expect(concentration({ a: 8, b: 2 }).severity).toBe("warn");
  });
  it("repartido -> sin alerta", () => {
    expect(concentration({ a: 5, b: 5 })).toBe(null);
  });
});

describe("pipelineStalled", () => {
  it("sin publicar hace > maxDays -> critical", () => {
    const eps = [{ published_at: dstr(NOW - 10 * DAY) }];
    expect(pipelineStalled(eps, { nowMs: NOW, maxDays: 4 }).severity).toBe("critical");
  });
  it("publicado reciente -> sin alerta", () => {
    expect(pipelineStalled([{ published_at: dstr(NOW - 1 * DAY) }], { nowMs: NOW, maxDays: 4 })).toBe(null);
  });
});

describe("behindGoal", () => {
  it("behind -> warn con foco", () => {
    const a = behindGoal({ status: "behind", days_left: 90 }, { focus_label: "Suscriptores" });
    expect(a.severity).toBe("warn");
    expect(a.detail).toMatch(/Suscriptores/);
  });
  it("ontrack -> null", () => expect(behindGoal({ status: "ontrack" })).toBe(null));
});

describe("evaluateAlerts", () => {
  it("agrega, etiqueta canal y ordena critical primero", () => {
    const alerts = evaluateAlerts({
      channel: "auto2",
      history: hist(100, 150, 150), historyKeys: [{ key: "subs", label: "Suscriptores" }],
      episodes: [{ published_at: dstr(NOW - 10 * DAY) }],
      allocation: { a: 9, b: 1 },
      readiness: { status: "behind", days_left: 90 }, warRoom: { focus_label: "Vistas" },
      nowMs: NOW,
    });
    expect(alerts.length).toBeGreaterThanOrEqual(3);
    expect(alerts[0].severity).toBe("critical"); // estancado o pipeline parado primero
    expect(alerts.every((a) => a.channel === "auto2")).toBe(true);
  });
});
