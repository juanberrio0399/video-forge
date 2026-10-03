import { describe, it, expect } from "vitest";
import { leerEntrada, nuevaEntrada, anotarVideos, conVariante } from "../pipeline/lib/niche_map.mjs";

describe("niche_map", () => {
  it("lee el formato VIEJO (string) sin romperse", () => {
    // Los ~518 videos ya publicados estan guardados asi.
    expect(leerEntrada("animales_tiernos")).toEqual({ niche: "animales_tiernos", variant: null });
  });

  it("lee el formato NUEVO con la variante", () => {
    expect(leerEntrada({ n: "animales_tiernos", v: "un_hecho" }))
      .toEqual({ niche: "animales_tiernos", variant: "un_hecho" });
  });

  it("acepta tambien las claves largas", () => {
    expect(leerEntrada({ niche: "satisfying", variant: "narrado" }))
      .toEqual({ niche: "satisfying", variant: "narrado" });
  });

  it("no revienta con entradas ausentes o basura", () => {
    for (const e of [undefined, null, "", 0, [], true]) {
      expect(leerEntrada(e)).toEqual({ niche: null, variant: null });
    }
  });

  it("anota los videos del inventario con nicho y variante", () => {
    const videos = [{ video_id: "a" }, { video_id: "b" }, { video_id: "c" }];
    const mapa = { a: { n: "animales_tiernos", v: "un_hecho" }, b: "satisfying" };
    const out = anotarVideos(videos, mapa);
    expect(out[0]).toMatchObject({ niche: "animales_tiernos", variant: "un_hecho" });
    // Video viejo: tiene nicho pero NO variante. Es lo correcto: no sabemos con que
    // formato se hizo, asi que no debe entrar en el A/B.
    expect(out[1]).toMatchObject({ niche: "satisfying", variant: null });
    // Video que no esta en el mapa: ninguno de los dos.
    expect(out[2]).toMatchObject({ niche: null, variant: null });
  });

  it("no pisa lo que el video ya trae", () => {
    const out = anotarVideos([{ video_id: "a", niche: "ya_resuelto" }], { a: "del_mapa" });
    expect(out[0].niche).toBe("ya_resuelto");
  });

  it("sobrevive a un mapa ausente", () => {
    const videos = [{ video_id: "a" }];
    for (const m of [undefined, null, "roto", 5]) {
      expect(anotarVideos(videos, m)[0]).toMatchObject({ niche: null, variant: null });
    }
    expect(anotarVideos(null, {})).toEqual([]);
  });

  it("nuevaEntrada guarda las dos cosas", () => {
    expect(nuevaEntrada("satisfying", "un_hecho")).toEqual({ n: "satisfying", v: "un_hecho" });
    expect(nuevaEntrada("satisfying")).toEqual({ n: "satisfying", v: null });
  });

  it("cuenta cuantos videos ya tienen variante (para saber si el A/B puede medir)", () => {
    const mapa = {
      a: { n: "x", v: "un_hecho" }, b: { n: "x", v: "narrado" },
      c: "viejo", d: { n: "x", v: null },
    };
    expect(conVariante(mapa)).toBe(2);
    expect(conVariante(null)).toBe(0);
  });
});

// --- Alternancia de variantes dentro de un mismo nicho (lo que hace medible el A/B) ---
import { elegirVariante } from "../pipeline/lib/lineup.mjs";

describe("elegirVariante", () => {
  it("con un string devuelve siempre la misma variante (comportamiento de siempre)", () => {
    const v = { satisfying: "puro" };
    expect(elegirVariante(v, "satisfying", 0)).toBe("puro");
    expect(elegirVariante(v, "satisfying", 7)).toBe("puro");
  });

  it("con una LISTA alterna entre los brazos", () => {
    const v = { animales_tiernos: ["un_hecho", "narrado"] };
    const salida = [0, 1, 2, 3, 4, 5].map((i) => elegirVariante(v, "animales_tiernos", i));
    expect(salida).toEqual(["un_hecho", "narrado", "un_hecho", "narrado", "un_hecho", "narrado"]);
  });

  it("reparte parejo: en 6 franjas salen 3 y 3", () => {
    const v = { animales_tiernos: ["un_hecho", "narrado"] };
    const conteo = {};
    for (let i = 0; i < 6; i++) {
      const x = elegirVariante(v, "animales_tiernos", i);
      conteo[x] = (conteo[x] || 0) + 1;
    }
    expect(conteo).toEqual({ un_hecho: 3, narrado: 3 });
  });

  it("no afecta a los nichos que no estan en la lista", () => {
    expect(elegirVariante({ a: ["x", "y"] }, "b", 0)).toBe(null);
    expect(elegirVariante({}, "a", 3)).toBe(null);
    expect(elegirVariante(null, "a", 0)).toBe(null);
  });

  it("aguanta listas vacias, con huecos, y turnos raros", () => {
    expect(elegirVariante({ a: [] }, "a", 0)).toBe(null);
    expect(elegirVariante({ a: [null, "x"] }, "a", 0)).toBe("x");
    expect(elegirVariante({ a: ["x", "y"] }, "a", -1)).toBe("y");
    expect(elegirVariante({ a: ["x", "y"] }, "a", undefined)).toBe("x");
  });
});
