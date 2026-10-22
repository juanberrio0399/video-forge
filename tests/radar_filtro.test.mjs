import { describe, it, expect } from "vitest";
import { esDuplicado, ubicacionValida, necesitaVerificacion, veredicto, promptVerificacion } from "../pipeline/lib/radar_filtro.mjs";

// Casos REALES de la limpieza del 2026-10-21: issues falsos o ya resueltos que el radar habia abierto.
describe("esDuplicado", () => {
  it("un tema ya CERRADO cuenta como duplicado (antes solo miraba los abiertos)", () => {
    const cerrados = ["Corregir versión inexistente de Wrangler en package.json"];
    expect(esDuplicado("Corregir version inexistente de wrangler en package.json", cerrados)).toBe(true);
  });
  it("un tema distinto no", () => {
    expect(esDuplicado("Streaming SSE en /ask", ["Corregir versión inexistente de Wrangler"])).toBe(false);
  });
});

describe("ubicacionValida", () => {
  const archivos = ["src/ingest.js", "src/index.js", ".github/workflows/ci.yml"];
  it("acepta un archivo o carpeta que existe, aunque traiga linea o backticks", () => {
    expect(ubicacionValida("`src/ingest.js:146`", archivos)).toBe("src/ingest.js");
    expect(ubicacionValida("./src/", archivos)).toBe("src");
  });
  it("rechaza una ruta inventada", () => {
    expect(ubicacionValida("src/security/ssrf.js", archivos)).toBe(null);
    expect(ubicacionValida("", archivos)).toBe(null);
  });
});

describe("verificacion contra el codigo", () => {
  it("se verifican los tipos que afirman algo del codigo; las ideas no", () => {
    expect(necesitaVerificacion("Seguridad")).toBe(true);
    expect(necesitaVerificacion("Dependencia")).toBe(true);
    expect(necesitaVerificacion("Predicción/Tendencia")).toBe(false);
    expect(necesitaVerificacion("Crecimiento")).toBe(false);
  });
  it("solo pasa con un 'existe: true' explicito; lo ilegible o vacio NO pasa", () => {
    expect(veredicto('```json\n{"existe": true, "evidencia": "fetch(url) sin validar"}\n```')).toEqual({ existe: true, evidencia: "fetch(url) sin validar" });
    expect(veredicto('{"existe": false, "evidencia": "parseTargetUrl ya bloquea IPs privadas"}').existe).toBe(false);
    expect(veredicto("no estoy seguro").existe).toBe(false);
    expect(veredicto("").existe).toBe(false);
  });
  it("el prompt lleva la fecha de hoy y el codigo real", () => {
    const p = promptVerificacion({ title: "t", description: "d", action: "a" }, "src/x.js", "const X = 1;", "2026-10-21");
    expect(p).toContain("Hoy es 2026-10-21");
    expect(p).toContain("const X = 1;");
    expect(p).toContain("src/x.js");
  });
});
