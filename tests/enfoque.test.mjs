import { describe, it, expect } from "vitest";
import { pausaDe, decideSobre, lineaPausa } from "../pipeline/lib/enfoque.mjs";

// Entrada real del ledger, tal como la escribe brain_live.mjs.
const PAUSA_DL = {
  type: "channel_pause", channel: "data-lens", at: "2026-09-14T00:00:00Z",
  review_at: "2026-10-05T00:00:00Z", metric: "dl_best_views_7d",
  criterion: { op: ">=", value: 500 }, status: "abierta",
};

describe("pausaDe", () => {
  it("encuentra la pausa de Data Lens", () => {
    expect(pausaDe([PAUSA_DL], "data-lens")).toBe(PAUSA_DL);
  });

  it("no confunde canales", () => {
    expect(pausaDe([PAUSA_DL], "oddly")).toBe(null);
  });

  it("ignora otras entradas del ledger", () => {
    const otras = [{ type: "hook_experiment", channel: "data-lens" }, { type: "goal", channel: "oddly" }];
    expect(pausaDe(otras, "data-lens")).toBe(null);
    expect(pausaDe([...otras, PAUSA_DL], "data-lens")).toBe(PAUSA_DL);
  });

  it("aguanta un ledger ausente o corrupto", () => {
    for (const x of [null, undefined, "roto", 5, {}]) expect(pausaDe(x, "data-lens")).toBe(null);
    expect(pausaDe([null, undefined, PAUSA_DL], "data-lens")).toBe(PAUSA_DL);
  });
});

describe("decideSobre", () => {
  it("un canal PAUSADO queda fuera de las decisiones del Cerebro", () => {
    expect(decideSobre([PAUSA_DL], "data-lens")).toBe(false);
  });

  it("Oddly sigue dentro: es donde esta el foco", () => {
    expect(decideSobre([PAUSA_DL], "oddly")).toBe(true);
  });

  it("sin ledger, el Cerebro decide (no se queda mudo por falta de archivo)", () => {
    // Importante: fallar ABIERTO aqui. Si el ledger no se pudo bajar, es peor dejar de
    // opinar sobre todo que seguir opinando de mas.
    expect(decideSobre([], "data-lens")).toBe(true);
    expect(decideSobre(null, "oddly")).toBe(true);
  });
});

describe("lineaPausa", () => {
  it("dice desde cuando, cuando se revisa y con que criterio se reanuda", () => {
    const l = lineaPausa(PAUSA_DL);
    expect(l).toMatch(/2026-09-14/);
    expect(l).toMatch(/2026-10-05/);
    expect(l).toMatch(/dl_best_views_7d >= 500/);
    // Y deja claro que las metricas NO se dejan de medir.
    expect(l).toMatch(/métricas se siguen midiendo/);
  });

  it("sin pausa no hay linea", () => {
    expect(lineaPausa(null)).toBe(null);
  });

  it("aguanta una pausa a medias", () => {
    const l = lineaPausa({ type: "channel_pause", channel: "data-lens" });
    expect(typeof l).toBe("string");
    expect(l).toMatch(/PAUSA/);
  });
});
