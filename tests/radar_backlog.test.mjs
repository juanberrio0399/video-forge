import { describe, it, expect } from "vitest";
import { cupo, cerradosQueCuentan, vencidos, ETIQUETA_VENCIDO } from "../pipeline/lib/radar_backlog.mjs";

const AHORA = Date.parse("2026-11-08T00:00:00Z");
const hace = (d) => new Date(AHORA - d * 864e5).toISOString();

describe("radar: no acumular", () => {
  it("cupo: maximo 3 por semana y nunca mas de 10 abiertas", () => {
    expect(cupo(0)).toBe(3);
    expect(cupo(8)).toBe(2);
    expect(cupo(10)).toBe(0);
    expect(cupo(14)).toBe(0);
    expect(cupo(-1)).toBe(3);
  });
  it("los vencidos pueden volver a proponerse; lo cerrado a mano no", () => {
    const c = [{ title: "A", labels: [{ name: "radar" }] }, { title: "B", labels: [{ name: "radar" }, { name: ETIQUETA_VENCIDO }] }, { title: "C" }];
    expect(cerradosQueCuentan(c)).toEqual(["A", "C"]);
  });
  it("vence lo que nadie toca en 6 semanas, salvo si un PR abierto lo menciona", () => {
    const issues = [
      { number: 7, updated_at: hace(50) },     // vencido
      { number: 8, updated_at: hace(50) },     // vencido pero tiene PR abierto
      { number: 9, updated_at: hace(10) },     // reciente
      { number: 70, updated_at: "" },          // sin fecha: no se toca
    ];
    expect(vencidos(issues, ["Closes #8", "Ref #80"], AHORA)).toEqual([7]);
    expect(vencidos(issues, ["Closes #70"], AHORA)).toEqual([7, 8]);
  });
});
