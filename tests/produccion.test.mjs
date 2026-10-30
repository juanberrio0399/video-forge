import { describe, it, expect } from "vitest";
import { clasificar, resumir, mensaje } from "../pipeline/lib/produccion.mjs";

const VIDEO = { conclusion: "success", subida: "success" };
const SIN = (motivo) => ({ conclusion: "success", subida: "skipped", motivo });
const ROJA = { conclusion: "failure", subida: "skipped" };

describe("clasificar", () => {
  it("verde con la subida saltada es 'sin_video' (el caso que nadie veia)", () => {
    expect(clasificar(SIN("x"))).toBe("sin_video");
  });
  it("subida ok es video; roja es fallida; cancelada aparte", () => {
    expect(clasificar(VIDEO)).toBe("video");
    expect(clasificar(ROJA)).toBe("fallida");
    expect(clasificar({ conclusion: "cancelled", subida: null })).toBe("cancelada");
  });
});

describe("resumir", () => {
  it("el dia real del error (30-oct): 2 videos de 24 -> alerta, con el motivo agrupado", () => {
    const corridas = [VIDEO, VIDEO, ...Array(22).fill(SIN("TITULO REPETIDO tras reintentar"))];
    const r = resumir(corridas);
    expect(r).toMatchObject({ corridas: 24, videos: 2, sin_video: 22, fallidas: 0, alerta: true });
    expect(r.motivos).toEqual({ "TITULO REPETIDO tras reintentar": 22 });
  });

  it("dia sano o pocas corridas: sin alerta", () => {
    expect(resumir([VIDEO, VIDEO, VIDEO, SIN("x")]).alerta).toBe(false);   // 3 de 4
    expect(resumir([SIN("x"), SIN("x"), SIN("x")]).alerta).toBe(false);    // menos de 4 corridas
    expect(resumir([]).alerta).toBe(false);
  });

  it("justo la mitad no alerta; menos de la mitad si", () => {
    expect(resumir([VIDEO, VIDEO, SIN("a"), SIN("b")]).alerta).toBe(false);
    expect(resumir([VIDEO, SIN("a"), SIN("b"), ROJA]).alerta).toBe(true);
  });

  it("las canceladas no cuentan como corridas", () => {
    const r = resumir([VIDEO, VIDEO, { conclusion: "cancelled" }, { conclusion: "cancelled" }]);
    expect(r).toMatchObject({ corridas: 2, canceladas: 2 });
  });

  it("sin advertencia el motivo queda registrado como tal", () => {
    expect(resumir([SIN("")]).motivos).toEqual({ "sin motivo registrado": 1 });
  });
});

describe("mensaje", () => {
  it("dice cuantos videos, cuantas sin video y por que", () => {
    const m = mensaje(resumir([VIDEO, SIN("TITULO REPETIDO"), SIN("TITULO REPETIDO"), ROJA]));
    expect(m).toContain("solo 1 video(s) en 4 corridas");
    expect(m).toContain("2x TITULO REPETIDO");
    expect(m).toContain("1 fallida(s)");
  });
});
