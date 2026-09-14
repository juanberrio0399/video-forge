import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseHidden, readHiddenFile, backlogToSchedule } from "../pipeline/lib/hidden.mjs";

const NOW = Date.parse("2026-09-14T03:00:00Z");
const vids = [
  { id: "oculto1", status: { privacyStatus: "private" } },
  { id: "libre", status: { privacyStatus: "private" } },
  { id: "yaProgramado", status: { privacyStatus: "private", publishAt: "2026-09-14T20:00:00Z" } },
  { id: "publico", status: { privacyStatus: "public" } },
];

describe("videos ocultos: nunca se programan", () => {
  it("excluye ocultos, programados y públicos", () => {
    expect(backlogToSchedule(vids, new Set(["oculto1"]), NOW)).toEqual(["libre"]);
  });
  it("falla cerrado: sin lista válida no programa nada", () => {
    expect(backlogToSchedule(vids, null, NOW)).toEqual([]);
    expect(backlogToSchedule(vids, undefined, NOW)).toEqual([]);
  });
  it("una lista corrupta o con otra forma no cuenta como vacía", () => {
    expect(parseHidden("")).toBe(null);
    expect(parseHidden("{}")).toBe(null);
    expect(parseHidden("[1,2]")).toBe(null);
    expect(parseHidden("<html>error</html>")).toBe(null);
    expect([...parseHidden('["a","b"]')]).toEqual(["a", "b"]);
  });
  it("archivo ausente = null (no programar)", () => {
    expect(readHiddenFile(path.join(os.tmpdir(), "no-existe-" + Date.now() + ".json"))).toBe(null);
    const f = path.join(os.tmpdir(), "hidden-" + Date.now() + ".json");
    fs.writeFileSync(f, '["x"]');
    expect(readHiddenFile(f).has("x")).toBe(true);
    fs.unlinkSync(f);
  });
});
