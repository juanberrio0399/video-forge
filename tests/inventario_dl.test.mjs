import { describe, it, expect } from "vitest";
import { normalizarInventario } from "../pipeline/lib/inventario.mjs";
import { segundosISO, esLargo } from "../pipeline/lib/duracion.mjs";

// El resolvedor es un script (lee argv, escribe un archivo), pero su decision es pura y es
// lo que importa: cual de las dos fuentes manda. Se reproduce aqui sin lanzar procesos —
// lanzarlos ya nos costo un test inestable antes.
function resolver(cache, state) {
  const deCache = normalizarInventario(cache);
  const deState = normalizarInventario(state);
  const [list, fuente] = deCache.length ? [deCache, "cache del bot"] : [deState, "channel/state.json"];
  const longs = list.filter((v) => esLargo(v.seconds != null ? v.seconds : segundosISO(v.duration)));
  const shorts = list.filter((v) => !longs.includes(v));
  return { fuente, list, longs, shorts };
}

const corto = (id) => ({ video_id: id, seconds: 50, privacy: "public" });
const largo = (id) => ({ video_id: id, seconds: 838, privacy: "public" });

describe("resolver el inventario de Data Lens", () => {
  it("EL CASO QUE LO ORIGINO: cache borrado -> usa state.json en vez de quedarse en cero", () => {
    // Siete workflows borran el cache. Antes esto daba 0 videos y congelaba el analisis.
    const r = resolver({}, { published: [{ video_id: "a", stats: { views: 406 } }] });
    expect(r.fuente).toBe("channel/state.json");
    expect(r.list).toHaveLength(1);
    expect(r.list[0].views).toBe(406);
  });

  it("la forma REAL de state.json: `shorts` es un conteo, no una lista (rompio episodes el 2026-10-08)", () => {
    const state = { published: [{ video_id: "a", stats: { views: 406 } }], shorts: { total: 3, uploaded: 2, public: 1 } };
    const r = resolver({}, state);
    expect(r.fuente).toBe("channel/state.json");
    expect(r.list.map((v) => v.video_id)).toEqual(["a"]);
  });

  it("si el cache trae datos, manda el cache (es mas fresco)", () => {
    const r = resolver({ longs: [largo("c")] }, { published: [{ video_id: "s" }] });
    expect(r.fuente).toBe("cache del bot");
    expect(r.list.map((v) => v.video_id)).toEqual(["c"]);
  });

  it("si las dos estan vacias, lo dice en vez de fingir", () => {
    const r = resolver({}, {});
    expect(r.list).toHaveLength(0);
    expect(r.longs).toHaveLength(0);
  });

  it("reparte largos y shorts por DURACION, no por la etiqueta del origen", () => {
    // El cache podria llamar "longs" a cualquier cosa; aqui manda la duracion real.
    const r = resolver({ longs: [corto("mal_etiquetado"), largo("de_verdad")] }, {});
    expect(r.longs.map((v) => v.video_id)).toEqual(["de_verdad"]);
    expect(r.shorts.map((v) => v.video_id)).toEqual(["mal_etiquetado"]);
  });

  it("acepta la duracion en ISO cuando no viene en segundos", () => {
    const r = resolver({ list: [{ video_id: "x", duration: "PT13M58S" }, { video_id: "y", duration: "PT50S" }] }, {});
    expect(r.longs.map((v) => v.video_id)).toEqual(["x"]);
  });

  it("todo suma: cada video esta en longs o en shorts, nunca en los dos", () => {
    const r = resolver({ list: [corto("a"), largo("b"), corto("c")] }, {});
    expect(r.longs.length + r.shorts.length).toBe(r.list.length);
    const ids = new Set([...r.longs, ...r.shorts].map((v) => v.video_id));
    expect(ids.size).toBe(3);
  });

  it("aguanta fuentes corruptas sin reventar", () => {
    for (const mala of [null, undefined, "roto", 5, []]) {
      expect(() => resolver(mala, mala)).not.toThrow();
    }
  });
});
