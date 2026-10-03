import { describe, it, expect } from "vitest";
import { normalizar, esDuplicado, esGenerico, revisar } from "../pipeline/lib/titulos.mjs";

// Titulos REALES del canal, con sus vistas reales (2026-10-03).
const GENERICOS = [
  "The Deadliest Siege in Human History #Shorts",      // x7 veces, mediana 2 vistas
  "The Deadliest Volcano Eruption in History #Shorts", // x6 veces
  "The Deadliest Gamble in Human History #Shorts",
  "The Worst British Military Defeat in History #Shorts",
  "The Deadliest Volcano Eruption in Recorded History #Shorts",
];
const CONCRETOS = [
  "The Single Signature That Destroyed German Democracy #Shorts", // 406 vistas
  "The Single Key That Doomed The Titanic #Shorts",               // 321
  "The Lab Accident That Saved Millions of Lives #Shorts",        // 105
  "The Failed Glue That Conquered the World #Shorts",             // 80
  "The Soviet officer who ignored a nuclear apocalypse #Shorts",  // 48
  "The 75-Day Siege That Erased an Empire #Shorts",
  "The Candy Bar That Invented the Modern Kitchen #Shorts",
];

describe("esGenerico", () => {
  it("marca los titulos genericos reales que rindieron 2 vistas", () => {
    for (const t of GENERICOS) expect(esGenerico(t), t).toBe(true);
  });

  it("NO marca los titulos concretos que rindieron 48-406 vistas", () => {
    for (const t of CONCRETOS) expect(esGenerico(t), t).toBe(false);
  });

  it("hace falta el superlativo Y el 'in History': uno solo no basta", () => {
    // "Deadliest" sin la coletilla no es la plantilla.
    expect(esGenerico("The Deadliest Day of the Chernobyl Cleanup")).toBe(false);
    // "in history" sin superlativo tampoco.
    expect(esGenerico("The Strangest Bet in History")).toBe(false);
  });

  it("no revienta con basura", () => {
    for (const x of [null, undefined, "", 123, {}]) expect(esGenerico(x)).toBe(false);
  });
});

describe("esDuplicado", () => {
  it("caza el repetido aunque cambien hashtags, puntuacion o mayusculas", () => {
    const usados = ["The Deadliest Siege in Human History"];
    expect(esDuplicado("The Deadliest Siege in Human History #Shorts", usados)).toBe(true);
    expect(esDuplicado("THE DEADLIEST SIEGE IN HUMAN HISTORY!", usados)).toBe(true);
    expect(esDuplicado("the deadliest siege in human history.", usados)).toBe(true);
  });

  it("no confunde titulos distintos", () => {
    const usados = ["The Deadliest Siege in Human History"];
    expect(esDuplicado("The Deadliest Siege in History", usados)).toBe(false);
    expect(esDuplicado("The Single Key That Doomed The Titanic", usados)).toBe(false);
  });

  it("sin lista de usados no marca nada", () => {
    expect(esDuplicado("Lo que sea", [])).toBe(false);
    expect(esDuplicado("Lo que sea", null)).toBe(false);
  });
});

describe("revisar", () => {
  it("rechaza el duplicado y le dice al modelo por que", () => {
    const r = revisar("The Deadliest Siege in Human History", ["The Deadliest Siege in Human History"]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("duplicado");
    expect(r.queja).toMatch(/YA SE USO/);
  });

  it("rechaza el generico aunque sea nuevo, con el dato del canal", () => {
    const r = revisar("The Biggest Disaster in Human History", []);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("generico");
    expect(r.queja).toMatch(/6 veces menos/);
  });

  it("acepta los que de verdad funcionaron", () => {
    for (const t of CONCRETOS) expect(revisar(t, []).ok, t).toBe(true);
  });

  it("rechaza el vacio", () => {
    expect(revisar("", []).motivo).toBe("vacio");
    expect(revisar(null, []).motivo).toBe("vacio");
  });

  it("el duplicado gana al generico cuando es las dos cosas", () => {
    const r = revisar("The Deadliest Siege in Human History", ["The Deadliest Siege in Human History"]);
    expect(r.motivo).toBe("duplicado");
  });
});

describe("normalizar", () => {
  it("deja comparables los titulos", () => {
    expect(normalizar("  The  TITANIC's Key! #Shorts ")).toBe("the titanic s key");
  });
  it("aguanta entradas raras", () => {
    for (const x of [null, undefined, 0, {}]) expect(typeof normalizar(x)).toBe("string");
  });
});
