import { describe, expect, it } from "vitest";
import { elegir, puntuar } from "../pipeline/trend_topics.mjs";

describe("temas en tendencia de otros paises", () => {
  it("entiende titulos en varios idiomas y suma por pais y posicion", () => {
    const r = puntuar([
      { pais: "RU", titulos: ["Щенок танцует под музыку", "Закат над морем"] },
      { pais: "JP", titulos: ["子犬が踊る", "ニュース"] },
      { pais: "KR", titulos: ["강아지 산책", "노을 타임랩스"] },
      { pais: "BR", titulos: ["Pôr do sol na praia"] },
    ]);
    expect(r[0].tema).toBe("perros");
    expect(r[0].paises).toEqual(["RU", "JP", "KR"]);
    expect(r.map((x) => x.tema)).toContain("atardeceres");
    expect(r.find((x) => x.tema === "atardeceres").query).toBe("sunset timelapse");
  });

  it("no confunde palabras parecidas", () => {
    const r = puntuar([{ pais: "US", titulos: ["Catch me at the train station, category hundred", "Колесо который город"] }]);
    expect(r).toEqual([]);
  });

  it("no repite un tema usado hace poco", () => {
    const ranking = [{ tema: "perros" }, { tema: "gatos" }, { tema: "nieve" }];
    const hoy = new Date("2026-11-27T12:00:00Z");
    expect(elegir(ranking, { perros: "2026-11-25" }, 2, hoy).map((x) => x.tema)).toEqual(["gatos", "nieve"]);
    expect(elegir(ranking, { perros: "2026-11-10" }, 1, hoy).map((x) => x.tema)).toEqual(["perros"]);
  });
});
