import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hitsByNiche, hitsSummary } from "../pipeline/lib/oddly_goal.mjs";
import { rankNiches } from "../pipeline/lib/niche_rank.mjs";

const REBALANCE = fileURLToPath(new URL("../pipeline/rebalance_oddly.mjs", import.meta.url));
const NOW = Date.now();
const DAY = 86400000;
let seq = 0;
const v = (niche, days, views, extra = {}) => {
  const iso = new Date(NOW - days * DAY).toISOString();
  return { video_id: `v${seq++}`, title: "t", privacy: "public", publish_at: iso, pub_iso: iso, published_at: iso.slice(0, 10), views, niche, niche_inferred: false, ...extra };
};

describe("hits por nicho", () => {
  it("cuenta Shorts públicos de 3 a 28 días con nicho real, una vez por video", () => {
    const a = v("animales_tiernos", 10, 1500);
    const list = [a, { ...a }, v("animales_tiernos", 10, 50), v("satisfying", 10, 2000),
      v("satisfying", 1, 5000),                             // muy nuevo
      v("satisfying", 40, 5000),                            // muy viejo
      v("satisfying", 10, 5000, { niche_inferred: true }),  // nicho adivinado
      v("satisfying", 10, 5000, { privacy: "private" })];
    const h = hitsByNiche(list, NOW);
    expect(h.n).toBe(3);
    expect(h.hits).toBe(2);
    expect(h.rows.animales_tiernos).toMatchObject({ n: 2, hits: 1, rate: 0.5 });
    expect(h.rows.satisfying).toMatchObject({ n: 1, hits: 1 });
  });
  it("hitsSummary tampoco cuenta dos veces un video repetido", () => {
    const a = v("animales_tiernos", 5, 1200);
    expect(hitsSummary([a, { ...a }], NOW)).toMatchObject({ published: 1, hits: 1 });
  });
});

function correr(list) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rebal-"));
  fs.mkdirSync(path.join(dir, "channel/auto2"), { recursive: true });
  fs.writeFileSync(path.join(dir, "channel/auto2/variants.json"), JSON.stringify({ tope_diario: 6 }));
  const niche_rank = rankNiches(list, { nowMs: NOW });
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ list, niche_rank }));
  fs.writeFileSync(path.join(dir, "cadence.json"), JSON.stringify({ shorts_per_category: { animales_tiernos: 3, satisfying: 3 } }));
  execFileSync(process.execPath, [REBALANCE], { cwd: dir, stdio: "pipe" });
  return JSON.parse(fs.readFileSync(path.join(dir, "decision.json"), "utf8"));
}

describe("reparto de los lunes", () => {
  // satisfying: mejor mediana (todos con 200 vistas) pero ningún hit. animales: mediana baja y 6 hits.
  const sat = Array.from({ length: 20 }, (_, i) => v("satisfying", 6 + (i % 20), 200));
  const ani = Array.from({ length: 20 }, (_, i) => v("animales_tiernos", 6 + (i % 20), i < 6 ? 3000 : 10));

  it("con 5+ hits decide por la tasa de hits, no por la mediana", () => {
    const d = correr([...sat, ...ani]);
    expect(d.hits).toMatchObject({ mode: true, total: 6 });
    expect(d.engine).toBe("tasa de hits 3-28d");
    expect(d.recommended_allocation.animales_tiernos).toBeGreaterThan(d.recommended_allocation.satisfying);
    expect(d.candidates.find((c) => c.key === "satisfying").why).toMatch(/cortado: 0 hits/);
  });

  it("con pocos hits sigue con la mediana", () => {
    const pocos = ani.map((x, i) => ({ ...x, views: i < 2 ? 3000 : 10 }));
    const d = correr([...sat, ...pocos]);
    expect(d.hits.mode).toBe(false);
    expect(d.recommended_allocation.satisfying).toBeGreaterThan(d.recommended_allocation.animales_tiernos);
  });
});
