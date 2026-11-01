import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { diaET, porDia, diaLleno, colaLlena, leerTope } from "../pipeline/lib/tope_dia.mjs";

const VARIANTS = fileURLToPath(new URL("../channel/auto2/variants.json", import.meta.url));
const BEST_SLOT = fileURLToPath(new URL("../pipeline/best_slot.mjs", import.meta.url));
const H = 3600 * 1000;

describe("dia en hora de Nueva York", () => {
  it("las 02:00 UTC todavia son el dia anterior en ET", () => {
    expect(diaET(Date.parse("2026-11-03T02:00:00Z"))).toBe("2026-11-02");
    expect(diaET(Date.parse("2026-11-03T15:00:00Z"))).toBe("2026-11-03");
  });
  it("cuenta por dia", () => {
    const d = porDia(["2026-11-03T15:00:00Z", "2026-11-03T20:00:00Z", "2026-11-04T15:00:00Z"].map(Date.parse));
    expect(d).toEqual({ "2026-11-03": 2, "2026-11-04": 1 });
  });
});

describe("tope diario", () => {
  const ocupados = [10, 12, 14, 16, 18, 20].map((h) => Date.parse(`2026-11-03T${h}:00:00Z`));
  it("un dia con el tope cubierto esta lleno; el siguiente no", () => {
    expect(diaLleno(Date.parse("2026-11-03T22:00:00Z"), ocupados, 6)).toBe(true);
    expect(diaLleno(Date.parse("2026-11-04T15:00:00Z"), ocupados, 6)).toBe(false);
  });
  it("sin tope nunca esta lleno", () => {
    expect(diaLleno(Date.parse("2026-11-03T22:00:00Z"), ocupados, 0)).toBe(false);
    expect(colaLlena(ocupados.concat(ocupados), 0)).toBe(false);
  });
  it("la cola se llena con 2 dias de tope", () => {
    expect(colaLlena(ocupados, 6)).toBe(false);
    expect(colaLlena(ocupados.concat(ocupados.map((t) => t + 24 * H)), 6)).toBe(true);
  });
  it("lee el tope del variants.json del repo", () => {
    expect(leerTope(VARIANTS)).toBeGreaterThan(0);
    expect(leerTope("no-existe.json")).toBe(0);
    expect(leerTope(undefined)).toBe(0);
  });
});

describe("best_slot respeta el tope (lo que usan TODOS los workflows de Oddly)", () => {
  const run = (occ, env = {}) =>
    execFileSync(process.execPath, [BEST_SLOT, occ.map((t) => new Date(t).toISOString()).join(",")], {
      env: { ...process.env, ...env }, cwd: fileURLToPath(new URL("..", import.meta.url)),
    }).toString();

  it("con el dia de la proxima franja lleno, programa en otro dia", () => {
    const sinTope = Date.parse(run([]));
    const llenoEseDia = Array.from({ length: 6 }, (_, i) => sinTope + i * 60 * 1000);
    const conTope = Date.parse(run(llenoEseDia, { TOPE_FILE: VARIANTS }));
    expect(diaET(conTope)).not.toBe(diaET(sinTope));
    expect(conTope).toBeGreaterThan(sinTope);
  });
  it("sin TOPE_FILE (The Data Lens) no cambia nada", () => {
    const sinTope = Date.parse(run([]));
    const llenoEseDia = Array.from({ length: 6 }, (_, i) => sinTope + 2 * H + i * 60 * 1000);
    expect(diaET(Date.parse(run(llenoEseDia)))).toBe(diaET(sinTope));
  });
});
