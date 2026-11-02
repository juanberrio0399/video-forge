import { describe, it, expect } from "vitest";
import { titulosDelCanal, repetido } from "../pipeline/lib/titulo_unico.mjs";

describe("título repetido", () => {
  const usados = ["Why Sea Otters Never Drift Away While Sleeping #Shorts", "Why Kinetic Sand NEVER Dries Out 🤯 #Shorts"];
  it("detecta el mismo título aunque cambien emoji, hashtag o mayúsculas", () => {
    expect(repetido("why sea otters never drift away while sleeping", usados)).toBe(usados[0]);
    expect(repetido("Why Kinetic Sand Never Dries Out! #Shorts #asmr", usados)).toBe(usados[1]);
  });
  it("un título nuevo pasa", () => {
    expect(repetido("Why Sea Otters Hold Hands #Shorts", usados)).toBeNull();
    expect(repetido("", usados)).toBeNull();
  });
});

describe("títulos del canal", () => {
  it("lee todas las páginas de la playlist de subidas", async () => {
    const pages = {
      "": { items: [{ snippet: { title: "A" } }, { snippet: { title: "B" } }], nextPageToken: "p2" },
      p2: { items: [{ snippet: { title: "C" } }] },
    };
    const calls = [];
    const fake = async (url) => {
      calls.push(url);
      if (url.includes("/channels")) return { ok: true, json: async () => ({ items: [{ contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] }) };
      const tok = new URL(url).searchParams.get("pageToken") || "";
      return { ok: true, json: async () => pages[tok] };
    };
    expect(await titulosDelCanal("t", fake)).toEqual(["A", "B", "C"]);
    expect(calls.filter((u) => u.includes("playlistId=UU1"))).toHaveLength(2);
  });
  it("si YouTube falla, lanza (la subida avisa y sigue)", async () => {
    const fake = async () => ({ ok: false, status: 403, json: async () => ({}) });
    await expect(titulosDelCanal("t", fake)).rejects.toThrow("HTTP 403");
  });
});
