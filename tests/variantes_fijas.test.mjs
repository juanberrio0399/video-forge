import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { aplicarACadencia, aplicarAExperimento } from "../pipeline/lib/variantes_fijas.mjs";
import { elegirVariante } from "../pipeline/lib/lineup.mjs";
import { runExperiment } from "../pipeline/lib/ab_test.mjs";

const viva = { shorts_per_category: { animales_tiernos: 8, satisfying: 4 }, long_per_day: 0, variant: { animales_tiernos: ["un_hecho", "narrado"], satisfying: "puro" } };
const fijas = JSON.parse(fs.readFileSync(new URL("../channel/auto2/variants.json", import.meta.url), "utf8"));

describe("variantes fijas por Juan", () => {
  it("cambian el formato y NO tocan el reparto de cupos", () => {
    const c = aplicarACadencia(viva, fijas);
    expect(c.shorts_per_category).toEqual(viva.shorts_per_category);
    expect(c.long_per_day).toBe(0);
    expect(c.variant.satisfying).toEqual(["un_hecho", "puro"]);
  });

  it("animales: 3 de cada 4 franjas un_hecho y 1 de control con la lista", () => {
    const c = aplicarACadencia(viva, fijas);
    const ocho = Array.from({ length: 8 }, (_, t) => elegirVariante(c.variant, "animales_tiernos", t));
    expect(ocho.filter((v) => v === "un_hecho").length).toBe(6);
    expect(ocho.filter((v) => v === "narrado").length).toBe(2);
  });

  it("el experimento activo de un nicho fijado no puede pisar el formato", () => {
    const exp = { active: { key: "animales_tiernos", variant: ["un_hecho", "narrado"] }, queue: [] };
    expect(aplicarAExperimento(exp, fijas).active.variant).toEqual(fijas.variant.animales_tiernos);
    const otro = { active: { key: "ciencia_humor", variant: "narrado" } };
    expect(aplicarAExperimento(otro, fijas)).toEqual(otro);
  });

  it("sin archivo de variantes no cambia nada", () => {
    expect(aplicarACadencia(viva, {})).toEqual(viva);
  });
});

describe("A/B por nicho", () => {
  const v = (niche, variant, pct) => ({ niche, variant, vs_baseline_pct: pct, mature: true });
  it("un_hecho de satisfying no contamina el A/B de animales", () => {
    const vids = [...Array(5)].flatMap(() => [v("animales_tiernos", "un_hecho", 100), v("animales_tiernos", "narrado", 10), v("satisfying", "un_hecho", -500)]);
    const r = runExperiment(vids, { id: "x", niche: "animales_tiernos", variable: "variant", metric: "vs_baseline_pct", variants: ["un_hecho", "narrado"], min_per_variant: 5, min_lift: 50 });
    expect(r.measured.un_hecho.n).toBe(5);
    expect(r.verdict).toBe("WINNER:un_hecho");
  });
});
