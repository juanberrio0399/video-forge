import { describe, it, expect } from "vitest";
import { makePulse, osStateFrom } from "../pipeline/lib/os_contract.mjs";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const pulse = (system, minAgo, extra = {}) => makePulse({ system, at: new Date(NOW - minAgo * 60000).toISOString(), headline: "ok", ...extra }, NOW);

describe("estado del OS al leer (/api/os)", () => {
  it("une los pulses guardados y devuelve el propio", async () => {
    const store = { "os/pulse/video-forge.json": pulse("video-forge", 10), "os/pulse/radar.json": pulse("radar", 20), "os/pulse/viento.json": pulse("viento", 5) };
    const s = await osStateFrom((k) => store[k] || null, "radar", NOW);
    expect(s.system).toBe("radar");
    expect(s.pulse.system).toBe("radar");
    expect(s.global.status).toBe("normal");
    expect(s.global.headline).toBe("Todo está corriendo");
  });
  it("un sistema sin pulse o viejo sale sin señal, nunca sano", async () => {
    const store = { "os/pulse/video-forge.json": pulse("video-forge", 400) };
    const s = await osStateFrom((k) => store[k] || null, "video-forge", NOW);
    expect(s.pulse.stale).toBe(true);
    expect(s.pulse.status).toBe("degraded");
    expect(s.global.status).toBe("degraded");
    expect(s.global.systems.find((x) => x.system === "viento").headline).toBe("Sin señal de Viento");
  });
  it("una lectura que falla o un JSON basura no rompe el estado", async () => {
    const s = await osStateFrom(async (k) => { if (k.includes("radar")) throw new Error("R2 caído"); return { system: "otro" }; }, "viento", NOW);
    expect(s.pulse).toBe(null);
    expect(s.global.systems).toHaveLength(3);
    expect(s.global.status).toBe("degraded");
  });
  it("las decisiones de todos los sistemas llegan a la app", async () => {
    const need = { id: "n1", title: "Aprobar despacho", actions: [{ id: "open", label: "Revisar", kind: "open" }] };
    const store = { "os/pulse/viento.json": pulse("viento", 1, { status: "attention", needs: [need] }) };
    const s = await osStateFrom((k) => store[k] || null, "video-forge", NOW);
    expect(s.global.counts.needs).toBe(1);
    expect(s.global.priority.system).toBe("viento");
  });
});
