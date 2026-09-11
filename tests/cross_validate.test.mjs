import { describe, it, expect } from "vitest";
import { tokenize, parseClaims, findingsFromHypotheses, findingsFromAB, findingFromOutliers, reconcile, formatCross } from "../pipeline/lib/cross_validate.mjs";

describe("tokenize", () => {
  it("normaliza y mapea sinónimos ES/EN a token canónico", () => {
    const a = tokenize("los hooks de PREGUNTA");
    expect(a).toContain("hook");
    expect(a).toContain("hook_question");
    const b = tokenize("question hook wins");
    expect(b).toContain("hook_question");
  });
});

describe("parseClaims", () => {
  it("extrae solo líneas con tag de evidencia", () => {
    const txt = [
      "Intro sin tag",
      "[OFICIAL] Los Shorts requieren 10M vistas en 90 dias",
      "- [HIPOTESIS] Los hooks de pregunta suben la retencion",
      "ruido",
    ].join("\n");
    const c = parseClaims(txt);
    expect(c.length).toBe(2);
    expect(c[0].evidence).toBe("OFICIAL");
    expect(c[1].evidence).toBe("HIPOTESIS");
  });
});

describe("findings internos", () => {
  it("hipótesis apoyada -> supports; débil -> refutes", () => {
    const f = findingsFromHypotheses([
      { id: "global-question-hook", status: "SUPPORTED", support: 0.6, confidence: 0.7 },
      { id: "long-format-good", status: "WEAKENED", support: -0.4, confidence: 0.4 },
    ]);
    expect(f[0].polarity).toBe("supports");
    expect(f[1].polarity).toBe("refutes");
  });
  it("A/B con ganador -> supports; outliers -> supports", () => {
    expect(findingsFromAB({ experiments: [{ variable: "hook_type", leader: "question", verdict: "WINNER:question", confidence: 0.6 }] })[0].polarity).toBe("supports");
    expect(findingFromOutliers({ outliers: { count: 5, pattern: { hook: { value: "question" }, format: { value: "short" } } } })[0].polarity).toBe("supports");
  });
});

describe("reconcile (cruce de agentes)", () => {
  const claims = parseClaims([
    "[HIPOTESIS] Los hooks de pregunta mejoran la retencion",   // matchea question-hook
    "[FUERTE] Publicar a mejor hora sube el alcance",           // sin data interna
    "[EXPERIMENTAL] Los titulos largos rinden mejor",           // matchea una hipótesis refutada
  ].join("\n"));
  const findings = [
    ...findingsFromHypotheses([
      { id: "global-question-hook", status: "SUPPORTED", support: 0.6, confidence: 0.7 },
      { id: "title-largo", status: "REJECTED", support: -0.5, confidence: 0.5 },
    ]),
  ];
  const { results, summary } = reconcile(claims, findings, { minOverlap: 1 });

  it("afirmación apoyada por data -> CONFIRMADA", () => {
    expect(results[0].classification).toBe("CONFIRMADA");
  });
  it("sin cruce y no-hipótesis -> INCIERTA", () => {
    expect(results[1].classification).toBe("INCIERTA");
  });
  it("data interna la contradice -> CONTRADICTORIA", () => {
    expect(results[2].classification).toBe("CONTRADICTORIA");
  });
  it("resume por clasificación", () => {
    expect(summary.CONFIRMADA).toBe(1);
    expect(summary.CONTRADICTORIA).toBe(1);
  });
});

describe("formatCross", () => {
  it("texto con encabezado y prioriza contradicciones/confirmaciones", () => {
    const cross = { channel: "auto2", results: [{ claim: "hooks de pregunta", classification: "CONFIRMADA", reason: "la apoya" }], summary: { CONFIRMADA: 1 } };
    const t = formatCross(cross, "Oddly Loop");
    expect(t).toMatch(/Validación cruzada/);
    expect(t).toMatch(/CONFIRMADA/);
  });
});
