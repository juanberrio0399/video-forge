import { describe, it, expect } from "vitest";
import { normalizePlan, planMarkdown, planLabels, parsePlanJson, versionDowngrades } from "../pipeline/lib/radar_plan_format.mjs";

describe("guarda de versiones", () => {
  it("detecta un plan que baja una dependencia (caso dataforge #31: duckdb 1.5.3 -> 1.1.3)", () => {
    const manifests = 'dependencies = [\n  "duckdb==1.5.3",\n  "pandas>=2.2",\n]\nduckdb==1.5.3\n';
    const plan = "Cambiar 'duckdb==1.5.3' por 'duckdb==1.1.3' en pyproject.toml y subir pandas>=2.3";
    expect(versionDowngrades(plan, manifests)).toEqual([{ pkg: "duckdb", from: "1.5.3", to: "1.1.3" }]);
  });
  it("no marca subidas ni paquetes que el repo no tiene", () => {
    expect(versionDowngrades("pdfjs-dist@4.10.38 y vite==6.0.1", '"vite": "^5.4.2"')).toEqual([]);
  });
  it("entiende package.json y el formato paquete@versión", () => {
    expect(versionDowngrades("instalar @observablehq/plot@0.6.1", '"@observablehq/plot": "^0.6.16"')).toEqual([{ pkg: "@observablehq/plot", from: "0.6.16", to: "0.6.1" }]);
  });
});

describe("plan de Radar", () => {
  it("un plan de impacto bajo nunca queda para implementar", () => {
    expect(normalizePlan({ verdict: "implementar", impact: "bajo" }).verdict).toBe("descartar");
    expect(normalizePlan({ verdict: "implementar", impact: "alto" }).verdict).toBe("implementar");
  });
  it("valores desconocidos caen en lo conservador", () => {
    const p = normalizePlan({ verdict: "merge ya", impact: "enorme", effort: "XL" });
    expect(p).toMatchObject({ verdict: "manual", impact: "bajo", effort: null });
    expect(normalizePlan(null).steps).toEqual([]);
  });
  it("formatea secciones, checklist y aviso de premisa falsa (caso DuckDB 1.1.x con 1.5.3 en main)", () => {
    const md = planMarkdown({
      verdict: "implementar", impact: "medio", effort: "M", summary: "Aplicar ZSTD donde se generan los Parquet.",
      premise_ok: false, premise_note: "El repo ya usa duckdb 1.5.3; no hay que bajar la versión.",
      files: [{ path: "`scripts/ingest_informes.py`", change: "compression='zstd' en to_parquet" }, { path: "", change: "x" }],
      steps: ["Cambiar la compresión", "Regenerar"], tests: ["pytest pasa"], acceptance: ["Parquet del cron en ZSTD"],
    });
    expect(md).toMatch(/^## 📋 Plan de implementación/);
    expect(md).toContain("> ⚠️ **Premisa del issue a revisar:** El repo ya usa duckdb 1.5.3");
    expect(md).toContain("- `scripts/ingest_informes.py`: compression='zstd' en to_parquet");
    expect(md).toContain("2. Regenerar");
    expect(md).toContain("- [ ] Parquet del cron en ZSTD");
    expect(md).not.toContain("### Riesgos");
  });
  it("etiquetas por veredicto", () => {
    expect(planLabels({ verdict: "implementar", impact: "alto" })).toEqual(["radar-plan"]);
    expect(planLabels({ verdict: "manual", impact: "alto" })).toEqual(["radar-plan", "manual"]);
    expect(planLabels({ verdict: "implementar", impact: "bajo" })).toEqual(["radar-plan", "radar-descartado"]);
  });
  it("aplana viñetas que vienen como objetos (nunca [object Object])", () => {
    const md = planMarkdown({ verdict: "implementar", impact: "alto", risks: [{ riesgo: "El hash no es verificable", mitigacion: "Hashear solo el contenido canónico" }] });
    expect(md).toContain("- El hash no es verificable — Hashear solo el contenido canónico");
    expect(md).not.toContain("[object Object]");
  });
  it("lee el JSON aunque venga con texto alrededor", () => {
    expect(parsePlanJson('```json\n{"verdict":"manual"}\n```')).toEqual({ verdict: "manual" });
    expect(parsePlanJson("sin json")).toBe(null);
    expect(parsePlanJson(null)).toBe(null);
  });
});
