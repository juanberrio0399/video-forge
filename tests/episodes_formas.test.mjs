import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// episodes.mjs es un script, no un modulo: se ejecuta de verdad y se lee su salida.
// Es la forma honesta de probarlo, porque el bug estaba en COMO normaliza la entrada.
function correr(entrada) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eps-"));
  const src = path.join(dir, "in.json");
  const out = path.join(dir, "out.json");
  fs.writeFileSync(src, JSON.stringify(entrada));
  execFileSync(process.execPath, ["pipeline/episodes.mjs", src, out], { stdio: "pipe" });
  const r = JSON.parse(fs.readFileSync(out, "utf8"));
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}

const ayer = new Date(Date.now() - 20 * 86400000).toISOString();

describe("episodes.mjs: las tres formas de inventario", () => {
  it("cache del bot: { longs, shorts }", () => {
    const r = correr({ longs: [{ video_id: "a", title: "A", published_at: ayer, views: 100 }], shorts: [] });
    expect(r.count).toBe(1);
    expect(r.episodes[0].views).toBe(100);
  });

  it("Oddly: { list }", () => {
    const r = correr({ list: [{ video_id: "b", title: "B", published_at: ayer, views: 50 }] });
    expect(r.count).toBe(1);
  });

  it("Data Lens: { published } con los stats ANIDADOS — la forma que no entendia", () => {
    // Esta es la forma real de channel/state.json, y es la que devolvia 0 episodios.
    const r = correr({
      published: [
        { video_id: "c", title: "C", privacy: "public", published_at: ayer, stats: { views: 406, likes: 9, comments: 1 } },
        { video_id: "d", title: "D", privacy: "public", published_at: ayer, stats: { views: 321, likes: 4 } },
      ],
    });
    expect(r.count).toBe(2);
    // Lo importante: las vistas salen de stats.views, no quedan en 0.
    expect(r.episodes.map((e) => e.views).sort((a, b) => b - a)).toEqual([406, 321]);
    expect(r.episodes[0].likes).toBe(9);
  });

  it("no cuenta dos veces un video que esta en published Y en shorts", () => {
    const v = { video_id: "e", title: "E", published_at: ayer, stats: { views: 10 } };
    const r = correr({ published: [v], shorts: [v] });
    expect(r.count).toBe(1);
  });

  it("un inventario vacio da 0 y no revienta (asi se detecta el problema)", () => {
    expect(correr({}).count).toBe(0);
    expect(correr({ published: [] }).count).toBe(0);
  });

  it("descarta entradas sin video_id", () => {
    const r = correr({ published: [{ title: "sin id" }, { video_id: "f", published_at: ayer, stats: { views: 1 } }] });
    expect(r.count).toBe(1);
  });

  it("respeta views planas si ya vienen (no las pisa con stats)", () => {
    const r = correr({ published: [{ video_id: "g", published_at: ayer, views: 7, stats: { views: 999 } }] });
    expect(r.episodes[0].views).toBe(7);
  });
});
