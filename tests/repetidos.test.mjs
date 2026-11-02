import { describe, it, expect } from "vitest";
import { agruparRepetidos, hashtagsFinales, conHashtags } from "../pipeline/lib/repetidos.mjs";

const v = (id, title, views, publishedAt = "2026-10-01") => ({ id, title, views, publishedAt });

describe("grupos de títulos repetidos", () => {
  it("conserva el de más vistas y renombra el resto", () => {
    const g = agruparRepetidos([
      v("a", "Why Otters Hold Hands #Shorts", 10),
      v("b", "why otters hold hands", 900),
      v("c", "Why Otters Hold Hands?! 🦦", 3),
      v("d", "Something Else", 50),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].conserva.id).toBe("b");
    expect(g[0].renombrar.map((x) => x.id)).toEqual(["a", "c"]);
  });
  it("si empatan en vistas conserva el más viejo", () => {
    const [g] = agruparRepetidos([v("nuevo", "Same", 0, "2026-10-20"), v("viejo", "Same", 0, "2026-09-01")]);
    expect(g.conserva.id).toBe("viejo");
  });
  it("un id repetido por la paginación no crea un falso repetido", () => {
    expect(agruparRepetidos([v("a", "Only One", 5), v("a", "Only One", 5)])).toEqual([]);
  });
  it("ordena primero los grupos con más copias", () => {
    const g = agruparRepetidos([v("1", "X", 1), v("2", "X", 1), v("3", "Y", 1), v("4", "Y", 1), v("5", "Y", 1)]);
    expect(g.map((x) => x.titulo)).toEqual(["Y", "X"]);
  });
});

describe("hashtags", () => {
  it("lee los hashtags del final", () => {
    expect(hashtagsFinales("Why Sand Flows #Shorts #asmr")).toBe("#Shorts #asmr");
    expect(hashtagsFinales("No tags here")).toBe("");
  });
  it("el título nuevo conserva los hashtags del viejo y no los duplica", () => {
    expect(conHashtags("Why Does Sand Flow Like Water?", "Old Title #Shorts")).toBe("Why Does Sand Flow Like Water? #Shorts");
    expect(conHashtags("Why Does Sand Flow? #Shorts", "Old #Shorts")).toBe("Why Does Sand Flow? #Shorts");
  });
  it("nunca pasa de 100 caracteres", () => {
    const largo = "Why ".repeat(24) + "?";
    expect(conHashtags(largo, "Old #Shorts #asmr #satisfying").length).toBeLessThanOrEqual(100);
  });
});

describe("ajuste: visibles y parecidos", () => {
  it("un privado sin programar no cuenta; un programado sí", async () => {
    const { esVisible } = await import("../pipeline/lib/repetidos.mjs");
    expect(esVisible({ privacy: "private", publishAt: null })).toBe(false);
    expect(esVisible({ privacy: "private", publishAt: "2026-11-05T15:00:00Z" })).toBe(true);
    expect(esVisible({ privacy: "public" })).toBe(true);
  });
  it("frena títulos casi iguales y deja pasar ángulos distintos", async () => {
    const { muyParecido, parecido } = await import("../pipeline/lib/repetidos.mjs");
    const usados = ["Why Does Kinetic Sand Flow Like a Liquid? #Shorts"];
    expect(muyParecido("Why Does Kinetic Sand Flow Like a Liquid Under Pressure? #Shorts", usados)).toBe(usados[0]);
    expect(muyParecido("Why does kinetic sand behave like a solid and a liquid?", usados)).toBeNull();
    expect(parecido("Why does it?", "How do you?")).toBe(0);
  });
});
