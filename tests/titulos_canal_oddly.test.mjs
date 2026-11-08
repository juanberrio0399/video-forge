import { describe, it, expect } from "vitest";
import { unirTitulos, repetido } from "../pipeline/lib/titulo_unico.mjs";

describe("guion de Oddly: ve los títulos reales del canal antes de fabricar", () => {
  it("suma los del canal (privados y programados incluidos) al final, del más viejo al más nuevo, sin repetir", () => {
    const previos = ["Why Cats Purr #Shorts", "Why Sea Otters Hold Hands While Sleeping 🦦 #Shorts"];
    const canalNuevoPrimero = ["Why Red Pandas Wear Built-In Blankets #Shorts", "Why Sea Otters HOLD HANDS While Sleeping #Shorts", "Why Dogs Tilt Their Heads"];
    const u = unirTitulos(previos, canalNuevoPrimero);
    expect(u).toEqual(["Why Cats Purr #Shorts", "Why Dogs Tilt Their Heads", "Why Sea Otters HOLD HANDS While Sleeping #Shorts", "Why Red Pandas Wear Built-In Blankets #Shorts"]);
    expect(u.slice(-1)[0]).toMatch(/Red Pandas/);        // lo más reciente queda al final (lo que la IA ve primero)
  });
  it("con la lista completa, el título que antes se colaba ahora se detecta antes de fabricar", () => {
    const u = unirTitulos([], ["Why Sea Otters Hold Hands While Sleeping 🦦 #Shorts"]);
    expect(repetido("Why Sea Otters Hold Hands While Sleeping #Shorts", u)).toBeTruthy();
  });
  it("si YouTube no devuelve nada, queda lo que había", () => {
    expect(unirTitulos(["A b c"], [])).toEqual(["A b c"]);
    expect(unirTitulos(null, null)).toEqual([]);
  });
});
