import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { componerHoy, pulsoSignalHalo, numero, huella, HOY_SISTEMAS } from "../shared/hoy.mjs";
import { hoyHtml, HOY_JS, HOY_CSS } from "../shared/hoy-ui.mjs";
import { withOsBar } from "../shared/os-unified.mjs";

const AHORA = Date.parse("2026-11-08T00:00:00Z");
const hace = (min) => new Date(AHORA - min * 60e3).toISOString();

const vf = { system: "video-forge", at: hace(20), status: "normal", headline: "Produciendo 2 piezas para mañana", sub: "Oddly y Data Lens",
  needs: [], metrics: [{ key: "shorts_views_90d", label: "Vistas de Shorts", value: 412345, context: "requisito 10M" }],
  activity: [{ at: hace(5), text: "Short publicado" }] };
const radar = { system: "radar", at: hace(30), status: "attention", headline: "2 mejoras listas para merge",
  needs: [{ id: "radar-merge-a-1", title: "Merge PR #1 · a", why: "arreglo", severity: "info", actions: [{ id: "review", label: "Revisar", kind: "open" }], url: "https://github.com/x/a/pull/1", created_at: hace(60) }],
  metrics: [{ key: "opportunities", label: "Oportunidades", value: 7 }], activity: [] };
const sh = { videos: [
  { id: "v1", titulo: "Norberto por fin entrevista a Don Jediondo", estado: "listo", subido: hace(3), bytes: 161e6 },
  { id: "v2", titulo: "Lucumí y el profe", estado: "usado", subido: hace(90), bytes: 49e6, borrar_en: hace(-600) },
  { id: "v3", titulo: "Viejo", estado: "usado", subido: hace(5000), borrado: hace(3000), bytes: 1e6 },
], pcs: [{ id: "pc1", nombre: "PC-OFICINA", estado: "pendiente", codigo: "918211", creado: hace(2) }], uso: 210e6, limite: 6 * 1073741824 };

describe("Signal Halo como sistema", () => {
  it("convierte su estado en un pulse con lo que espera de ti", () => {
    const p = pulsoSignalHalo(sh, AHORA);
    expect(p.status).toBe("attention");
    expect(p.headline).toBe("1 por usar");
    expect(p.needs.map((n) => n.title)).toEqual(["1 video por usar", "PC-OFICINA pide subir videos"]);
    expect(p.needs[1].why).toBe("Código 918 211");
    expect(p.metrics[0]).toMatchObject({ value: 0.2, unit: "GB" });
    expect(p.activity.some((a) => a.text.includes("Viejo"))).toBe(false);
  });
  it("sin datos no inventa nada", () => {
    expect(pulsoSignalHalo(null)).toBeNull();
    expect(pulsoSignalHalo({})).toBeNull();
  });
  it("casi lleno es critico", () => {
    expect(pulsoSignalHalo({ videos: [], pcs: [], uso: 95, limite: 100 }).status).toBe("critical");
  });
});

describe("pantalla de Inicio", () => {
  const hoy = componerHoy({ "video-forge": vf, radar, "signal-halo": pulsoSignalHalo(sh, AHORA), viento: null }, AHORA);

  it("los cuatro sistemas, en orden fijo, con su linea", () => {
    expect(hoy.sistemas.map((s) => s.sigla)).toEqual(["VF", "SH", "VI", "RA"]);
    expect(hoy.sistemas[0]).toMatchObject({ status: "normal", linea: "Produciendo 2 piezas para mañana", der: "412k" });
    expect(hoy.sistemas[1]).toMatchObject({ der: "0.2 GB", derSub: "de 6" });
  });
  it("lo que falta sale como sin señal y lo dice arriba", () => {
    expect(hoy.sistemas[2]).toMatchObject({ status: "degraded", stale: true, linea: "Sin señal" });
    expect(hoy.estado).toBe("Sin señal de Viento");
    expect(hoy.status).toBe("degraded");
  });
  it("para ti: lo urgente primero, con su accion", () => {
    expect(hoy.paraTi.map((n) => n.title)).toEqual(["PC-OFICINA pide subir videos", "1 video por usar", "Merge PR #1 · a"]);
    expect(hoy.paraTi[2]).toMatchObject({ accion: "Revisar", url: "https://github.com/x/a/pull/1", system: "radar" });
    expect(hoy.paraTi[0].ver).toBe("pcs");
    expect(hoy.frase).toBe("3 cosas para ti.");
  });
  it("cifras y ultimas horas salen de los datos", () => {
    expect(hoy.cifras.map((c) => c.valor)).toEqual(["412k", "0.2 GB", "7"]);
    expect(hoy.actividad[0]).toMatchObject({ name: "Signal Halo" });
    expect(hoy.actividad.length).toBeLessThanOrEqual(6);
  });
  it("un pulse viejo no se muestra como sano", () => {
    const viejo = componerHoy({ "video-forge": { ...vf, at: hace(60 * 30) } }, AHORA);
    expect(viejo.sistemas[0].stale).toBe(true);
    expect(viejo.sistemas[0].status).toBe("degraded");
  });
  it("todo al dia cuando nada espera y todos reportan", () => {
    const ok = componerHoy({ "video-forge": vf, radar: { ...radar, needs: [] }, viento: { system: "viento", at: hace(10), status: "normal", headline: "Sin pedidos", needs: [], metrics: [] }, "signal-halo": pulsoSignalHalo({ videos: [], pcs: [], uso: 0, limite: 1 }, AHORA) }, AHORA);
    expect(ok.frase).toBe("Todo al día.\nNada te espera.");
    expect(ok.estado).toBe("Los 4 sistemas funcionando");
  });
  it("la huella cambia solo si cambia el contenido", () => {
    const otra = componerHoy({ "video-forge": vf, radar, "signal-halo": pulsoSignalHalo(sh, AHORA), viento: null }, AHORA + 1000);
    expect(otra.version).toBe(hoy.version);
    expect(huella({ a: 1 })).not.toBe(huella({ a: 2 }));
  });
  it("numeros cortos y legibles", () => {
    expect([numero(5), numero(1234), numero(45678), numero(2.5e6), numero(null)]).toEqual(["5", "1.2k", "46k", "2.5M", "—"]);
  });
  it("cada sistema tiene panel", () => {
    expect(HOY_SISTEMAS.every((s) => s.panel.startsWith("/p/"))).toBe(true);
  });
});

describe("cliente de la pantalla", () => {
  it("se sirve desde un Worker: sin backticks ni ${ y el script compila", () => {
    expect(HOY_JS.includes("`")).toBe(false);
    expect(HOY_JS.includes("${")).toBe(false);
    expect(HOY_CSS.includes("${")).toBe(false);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoy-"));      // carpeta unica: nadie puede adelantarse al archivo
    const f = path.join(dir, "cliente.js");
    fs.writeFileSync(f, HOY_JS);
    expect(() => execFileSync(process.execPath, ["--check", f])).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("todo boton pasa por correr(): puntitos, tope y vuelve a su estado", () => {
    expect(HOY_JS).toContain("function correr(btn, fn, opciones)");
    expect(HOY_JS).toContain('btn.setAttribute("data-ocupado", "1")');
    expect(HOY_JS).toContain("btn.innerHTML = original");
    expect(HOY_JS).toContain("Tardó demasiado");
  });
  it("Signal Halo tiene su hoja: ver, bajar, copiar y marcar con correr(), sin cortar el video en vivo", () => {
    for (const x of ["function abrirSH(", "function pintarSH(", "function bajar(", "/v/signal-halo/api/marcar", "/v/signal-halo/api/enlace", "/v/signal-halo/api/pc", "tg.downloadFile"]) expect(HOY_JS).toContain(x);
    expect(HOY_JS).toContain('reproductor.getAttribute("data-id") === v.id');
    expect(HOY_JS).toContain('recargarSH(false).catch(function () {})');
    const usos = HOY_JS.match(/data-sh="(marcar|deshacer|pc|bajar|copiar|recargar)"/g) || [];
    expect(usos.length).toBeGreaterThanOrEqual(6);
  });
  it("Viento tiene su hoja: despachos con confirmacion, pausar, cuentas y contenido vigilado", () => {
    for (const x of ["function abrirVI(", "function pintarVI(", "function vigilarContenido(", "/v/viento/api/state", "/v/viento/api/app/pedido", "/v/viento/api/app/pausar", "/v/viento/api/app/tiktok-refresh", "/v/viento/api/app/dispatch", "tg.showConfirm"]) expect(HOY_JS).toContain(x);
    expect(HOY_JS).toContain('if (n.system === "viento") { abrirVI(false)');
    expect(HOY_JS).toContain("if (!si) return;");                       // aprobar/rechazar solo tras confirmar
    expect(HOY_JS).toContain("Date.now() - w.desde > 1800000");          // la vigilancia siempre termina
    const usos = HOY_JS.match(/data-vi="(pedido|pausar|tk|conectar|generar|recargar)"/g) || [];
    expect(usos.length).toBeGreaterThanOrEqual(6);
  });
  it("el html trae el build sin dejar inyectar nada", () => {
    const h = hoyHtml({ build: "abc1234</script><x>" });
    expect(h).toContain("Build abc1234scriptx");
    expect(h.match(/<script>window.HOY_CFG=/g)).toHaveLength(1);
    expect(h).not.toContain("</script><x>");
  });
  it("los paneles abiertos desde Inicio vuelven a Inicio", () => {
    const h = withOsBar("<html><body>x</body></html>", "Signal Halo · Videos", { href: "/hoy", texto: "Inicio", color: "#EDEDEF" });
    expect(h).toContain('href="/hoy"');
    expect(h).toContain("&#8249; Inicio");
    expect(withOsBar("<body>x</body>", "y")).toContain('href="/cerebro"');
    expect(withOsBar("<body>x</body>", "y", { href: "javascript:alert(1)", texto: "<b>", color: "red;x" })).toContain('href="/cerebro"');
  });
});
