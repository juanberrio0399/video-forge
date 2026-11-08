import { describe, it, expect } from "vitest";
import { tipoDe, nombreCorto, clasificar, registrar, marcarUso, ajustar, armarResumen, quizasResumen, volverAlMomento } from "../bot/src/avisos.js";

const OD = "Producir compilacion (Oddly Loop / canal auto)";
const t0 = Date.parse("2026-11-07T15:00:00Z");

describe("tipo y nombre", () => {
  it("lee el tipo por el emoji del comienzo", () => {
    expect(tipoDe("❌ Oddly Loop: fallo la subida")).toBe("falla");
    expect(tipoDe("⚠️ Herramientas con problema")).toBe("falla");
    expect(tipoDe("🎬 Oddly Loop: pieza lista")).toBe("listo");
    expect(tipoDe("⏸️ sin video en esta corrida")).toBe("pausa");
    expect(tipoDe("texto suelto")).toBe("info");
  });
  it("acorta el nombre del flujo", () => {
    expect(nombreCorto(OD)).toBe("Producir compilacion");
    expect(nombreCorto("Shorts FINALES (formato pro - voz)")).toBe("Shorts FINALES");
  });
});

describe("al momento o al resumen", () => {
  it("lo que trae botones o archivo llega ya", () => {
    expect(clasificar({ wf: OD, texto: "🎬 lista", botones: true }, {}).modo).toBe("ahora");
    expect(clasificar({ wf: OD, texto: "🎬 lista", archivo: true }, {}).modo).toBe("ahora");
  });
  it("lo informativo va al resumen", () => {
    expect(clasificar({ wf: OD, texto: "🎬 Oddly Loop: pieza lista" }, {}).modo).toBe("resumen");
    expect(clasificar({ wf: OD, texto: "⏸️ sin video" }, {}).modo).toBe("resumen");
  });
  it("la primera falla interrumpe, la repetida no", () => {
    const e = {};
    const a = { wf: OD, texto: "❌ fallo la subida" };
    const d1 = clasificar(a, e, t0);
    expect(d1.modo).toBe("ahora");
    registrar(e, a, d1, new Date(t0).toISOString());
    expect(clasificar(a, e, t0 + 3 * 3600e3).modo).toBe("resumen");
  });
  it("una falla diaria (cada 24 h) no interrumpe todos los dias y cuenta su racha", () => {
    const e = {};
    const a = { wf: "Repostear a Bilibili (Oddly) — Fase 2", texto: "❌ Bilibili fallo" };
    for (let dia = 0; dia < 4; dia++) {
      const t = t0 + dia * 24 * 3600e3;
      const d = clasificar(a, e, t);
      expect(d.modo).toBe(dia === 0 ? "ahora" : "resumen");
      registrar(e, a, d, new Date(t).toISOString());
    }
    expect(e.cat["Repostear a Bilibili:falla"].racha).toBe(4);
  });
  it("lo aprendido manda sobre la regla", () => {
    const e = { cat: { "Producir compilacion:listo": { modo: "ahora" }, "Producir compilacion:falla": { modo: "resumen" } } };
    expect(clasificar({ wf: OD, texto: "🎬 lista" }, e).modo).toBe("ahora");
    expect(clasificar({ wf: OD, texto: "❌ fallo" }, e).modo).toBe("resumen");
  });
});

describe("se ajusta solo", () => {
  it("lo que interrumpio 5 veces sin usarse pasa al resumen; lo usado se queda", () => {
    const e = {};
    for (let i = 0; i < 5; i++) {
      const a = { wf: "Watchdog", texto: "❌ x" + i, botones: true };
      registrar(e, a, { modo: "ahora", cat: "Watchdog:falla" }, new Date(t0 + i * 1000).toISOString());
      const b = { wf: "Pedidos", texto: "🎬 pedido", botones: true };
      registrar(e, b, { modo: "ahora", cat: "Pedidos:listo" }, new Date(t0 + i * 1000).toISOString());
    }
    e.recientes = e.recientes.filter((r) => r.cat === "Pedidos:listo");
    expect(marcarUso(e, t0 + 10000)).toBeGreaterThan(0);
    expect(ajustar(e)).toEqual(["Watchdog:falla"]);
    expect(e.cat["Watchdog:falla"].modo).toBe("resumen");
    expect(e.cat["Pedidos:listo"].modo).toBeUndefined();
    expect(e.cat["Pedidos:listo"].semana).toEqual({ ahora: 0, usados: 0 });
  });
});

describe("resumen", () => {
  const pend = [
    { wf: OD, texto: "🎬 pieza 1 lista" }, { wf: OD, texto: "🎬 pieza 2 lista" }, { wf: OD, texto: "⏸️ sin video" },
    { wf: OD, texto: "❌ Oddly Loop: fallo la subida. Revisa el log." },
    { wf: "Reporte del canal (seguimiento + programacion)", texto: "📊 reporte largo\ncon muchas lineas" },
  ];
  it("una linea por flujo con conteos y la ultima falla", () => {
    const r = armarResumen(pend, {}, [], new Date("2026-11-08T00:05:00Z"));
    expect(r).toContain("Producir compilacion: ✅ 2 · ❌ 1 · ⏸ 1");
    expect(r).toContain("↳ Oddly Loop: fallo la subida");
    expect(r).toContain("Reporte del canal: ✅ 1");
    expect(r.split("\n").length).toBeLessThan(12);
  });
  it("sin nada no manda", () => {
    expect(armarResumen([], {}, [])).toBeNull();
  });
  it("cuenta lo que dejo de avisar", () => {
    expect(armarResumen([], {}, ["Watchdog:falla"])).toContain("dejé de avisarte al momento: Watchdog · falla");
  });
});

function r2Falso() {
  const m = new Map();
  return {
    m,
    get: async (k) => (m.has(k) ? { json: async () => JSON.parse(m.get(k)) } : null),
    put: async (k, v) => { m.set(k, v); },
  };
}

describe("reloj", () => {
  it("manda el resumen una sola vez a las 7 pm y vacia la lista", async () => {
    const R2 = r2Falso();
    R2.m.set("os/avisos/pendientes.json", JSON.stringify([{ wf: OD, texto: "🎬 lista" }]));
    const enviados = [];
    const env = { R2 };
    expect(await quizasResumen(env, new Date("2026-11-07T15:00:00Z"), (p) => enviados.push(p), "u")).toBeNull();
    const r = await quizasResumen(env, new Date("2026-11-08T00:00:00Z"), (p) => enviados.push(p), "u");
    expect(r.enviado).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(JSON.parse(R2.m.get("os/avisos/pendientes.json"))).toEqual([]);
    expect(await quizasResumen(env, new Date("2026-11-08T00:15:00Z"), (p) => enviados.push(p), "u")).toBeNull();
  });
  it("el domingo ajusta y el boton revierte por numero", async () => {
    const R2 = r2Falso();
    R2.m.set("os/avisos/estado.json", JSON.stringify({ cat: { "Watchdog:falla": { semana: { ahora: 6, usados: 0 } } } }));
    const enviados = [];
    const r = await quizasResumen({ R2 }, new Date("2026-11-09T00:00:00Z"), (p) => enviados.push(p), "u");
    expect(r.movidas).toEqual(["Watchdog:falla"]);
    const boton = enviados[0].reply_markup.inline_keyboard[1][0];
    expect(boton.callback_data).toBe("av:on:0");
    expect(await volverAlMomento({ R2 }, "0")).toBe("Watchdog:falla");
    expect(JSON.parse(R2.m.get("os/avisos/estado.json")).cat["Watchdog:falla"].modo).toBe("ahora");
  });
});
