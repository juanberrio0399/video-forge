import { describe, it, expect } from "vitest";
import { normalizarInventario } from "../pipeline/lib/inventario.mjs";
import { anotarVideos } from "../pipeline/lib/niche_map.mjs";
import { medianVpd, buildEpisode } from "../pipeline/lib/episode_calc.mjs";
import { scoreVideo } from "../pipeline/lib/video_score.mjs";
import { runExperiment } from "../pipeline/lib/ab_test.mjs";

// Por que existe: el A/B "formato_un_hecho_vs_lista" paso 12 dias en n0 vs n0 con videos ya
// maduros. Cada pieza tenia su test, pero la cadena estaba cortada en dos sitios: episodes.yml
// no le pasaba niche_map a episodes.mjs, y scoreVideo tiraba el campo `variant`. Este test
// recorre la cadena completa (inventario -> mapa -> episodio -> score -> A/B) como el workflow.

const DIA = 86400000;
const NOW = Date.parse("2026-10-16T00:00:00Z");
const EXP = { id: "formato_un_hecho_vs_lista", variable: "variant", metric: "vs_baseline_pct", variants: ["un_hecho", "narrado"], min_per_variant: 5, min_lift: 50 };

function cadena(state, nicheMap) {
  const videos = anotarVideos(normalizarInventario(state), nicheMap);
  const med = medianVpd(videos, NOW);
  const episodes = videos.map((v) => buildEpisode(v, med, NOW));
  return episodes.map((e) => scoreVideo(e, null));
}

// Forma real de channel/auto2/state.json: { list: [...] }; niche_map: { id: { n, v } }.
const list = [];
const nicheMap = {};
for (let i = 0; i < 6; i++) {
  list.push({ video_id: `uh${i}`, title: `Why Do Otters ${i}?`, seconds: 20, views: 900, published_at: new Date(NOW - 9 * DIA).toISOString() });
  nicheMap[`uh${i}`] = { n: "animales_tiernos", v: "un_hecho" };
  list.push({ video_id: `na${i}`, title: `14 Cute Animal Facts ${i}`, seconds: 60, views: 90, published_at: new Date(NOW - 9 * DIA).toISOString() });
  nicheMap[`na${i}`] = { n: "animales_tiernos", v: "narrado" };
}
list.push({ video_id: "viejo", title: "Old one", seconds: 50, views: 100, published_at: new Date(NOW - 40 * DIA).toISOString() });
nicheMap.viejo = "satisfying"; // forma vieja: solo el nicho, sin variante

describe("A/B de formato: la variante llega de punta a punta", () => {
  it("cada score trae la variante que registro la produccion", () => {
    const scores = cadena({ list }, nicheMap);
    expect(scores.find((s) => s.video_id === "uh0").variant).toBe("un_hecho");
    expect(scores.find((s) => s.video_id === "na0").variant).toBe("narrado");
    expect(scores.find((s) => s.video_id === "viejo").variant).toBe(null);
  });

  it("con 6 maduros por brazo el A/B mide (ya no n0) y decide", () => {
    const r = runExperiment(cadena({ list }, nicheMap), EXP);
    expect(r.measured.un_hecho.n).toBe(6);
    expect(r.measured.narrado.n).toBe(6);
    expect(r.verdict).toBe("WINNER:un_hecho");
  });

  it("sin el niche_map (como estaba el workflow) se queda en n0: es el bug", () => {
    const r = runExperiment(cadena({ list }, {}), EXP);
    expect(r.measured.un_hecho ? r.measured.un_hecho.n : 0).toBe(0);
    expect(r.verdict).toBe("RUNNING");
  });
});
