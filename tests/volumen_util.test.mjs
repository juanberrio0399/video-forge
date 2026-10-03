import { describe, it, expect } from "vitest";
import { decidirVolumen } from "../pipeline/lib/volumen_util.mjs";

// El caso que motivo todo esto: Oddly medido el 2026-10-03.
const ODDLY_REAL = {
  vistasTotales: 23828, // 518 videos x ~46 vistas de mediana
  videos: 518,
  metaVistas: 10_000_000,
  diasRestantes: 89,
};

describe("decidirVolumen", () => {
  it("con los numeros REALES de Oddly dice que mas volumen no sirve", () => {
    const d = decidirVolumen(ODDLY_REAL);
    expect(d.volumenSirve).toBe(false);
    expect(d.reestructurar).toBe(true);
    // Lo importante: NO sube la cadencia. Producir mas solo gasta computo.
    expect(d.cadencia).toBe(8);
    expect(d.factor).toBeGreaterThan(5);
  });

  it("no sube la cadencia justo cuando mas tentador seria (brecha enorme)", () => {
    // La regla vieja hacia justo lo contrario: a mayor brecha, mas volumen.
    const enorme = decidirVolumen({ ...ODDLY_REAL, metaVistas: 100_000_000 });
    const normal = decidirVolumen(ODDLY_REAL);
    expect(enorme.cadencia).toBe(normal.cadencia);
    expect(enorme.cadencia).toBe(8);
  });

  it("cuando el canal SI rinde, empuja volumen", () => {
    // 500 videos a 2.000 vistas cada uno: la meta esta al alcance produciendo mas.
    const d = decidirVolumen({
      vistasTotales: 1_000_000, videos: 500, metaVistas: 2_000_000, diasRestantes: 90,
    });
    expect(d.volumenSirve).toBe(true);
    expect(d.reestructurar).toBe(false);
    expect(d.cadencia).toBe(12);
  });

  it("empuja tambien cuando falta una mejora alcanzable (<=5x)", () => {
    // Cada video rinde 1.000 y harian falta ~2.800: 2,8x, duro pero no iluso.
    const d = decidirVolumen({
      vistasTotales: 500_000, videos: 500, metaVistas: 3_500_000, diasRestantes: 90,
    });
    expect(d.factor).toBeGreaterThan(1);
    expect(d.factor).toBeLessThanOrEqual(5);
    expect(d.cadencia).toBe(12);
    expect(d.reestructurar).toBe(false);
  });

  it("sin vistas medidas empuja, porque producir es lo que permite medir", () => {
    const d = decidirVolumen({ vistasTotales: 0, videos: 0, metaVistas: 1000, diasRestantes: 30 });
    expect(d.cadencia).toBe(12);
    expect(d.reestructurar).toBe(false);
  });

  it("con la meta cumplida vuelve a cadencia de crucero", () => {
    const d = decidirVolumen({
      vistasTotales: 11_000_000, videos: 500, metaVistas: 10_000_000, diasRestantes: 30,
    });
    expect(d.cadencia).toBe(8);
    expect(d.reestructurar).toBe(false);
  });

  it("no revienta con entradas vacias o basura", () => {
    for (const e of [{}, { videos: 0, diasRestantes: 0 }, { vistasTotales: null, videos: NaN }]) {
      const d = decidirVolumen(e);
      expect(Number.isFinite(d.cadencia)).toBe(true);
      expect(typeof d.razon).toBe("string");
    }
  });

  it("la frontera de 5x cae del lado de empujar, no de reestructurar", () => {
    // factor exactamente 5 -> todavia se considera alcanzable.
    const vpv = 100, cad = 12, dias = 10;
    const d = decidirVolumen({
      vistasTotales: vpv * 100, videos: 100,
      metaVistas: vpv * 100 + vpv * 5 * cad * dias, diasRestantes: dias,
    });
    expect(d.factor).toBeCloseTo(5, 5);
    expect(d.reestructurar).toBe(false);
  });
});
