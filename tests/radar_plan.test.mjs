import { describe, it, expect } from "vitest";
import { normalizePlan, planMarkdown, planLabels, parsePlanJson } from "../pipeline/lib/radar_plan_format.mjs";

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
  it("lee el JSON aunque venga con texto alrededor", () => {
    expect(parsePlanJson('```json\n{"verdict":"manual"}\n```')).toEqual({ verdict: "manual" });
    expect(parsePlanJson("sin json")).toBe(null);
    expect(parsePlanJson(null)).toBe(null);
  });
});
