import { describe, it, expect } from "vitest";
import { classifyHook, summarizeHooks } from "../pipeline/lib/hook_calc.mjs";

describe("classifyHook", () => {
  it("pregunta con ?", () => expect(classifyHook("Is this real?")).toBe("question"));
  it("pregunta por palabra inicial", () => expect(classifyHook("Why your brain loves this")).toBe("question"));
  it("número al inicio", () => expect(classifyHook("5 things about X")).toBe("number"));
  it("$ número", () => expect(classifyHook("$70,000,000 Death Threat")).toBe("number"));
  it("curiosity", () => expect(classifyHook("The hidden truth about X")).toBe("curiosity"));
  it("contrast", () => expect(classifyHook("Cats vs dogs")).toBe("contrast"));
  it("statement por defecto", () => expect(classifyHook("Cute animals compilation")).toBe("statement"));
  it("vacío -> unknown", () => expect(classifyHook("")).toBe("unknown"));
});

describe("summarizeHooks", () => {
  it("agrupa por tipo solo videos con curva de retención", () => {
    const eps = [{ video_id: "a", title: "Why X?" }, { video_id: "b", title: "5 things" }, { video_id: "c", title: "No curve here" }];
    const ret = { a: { hook_score: 0.8, early_drop_pct: 10 }, b: { hook_score: 0.5, early_drop_pct: 30 } }; // c sin curva
    const s = summarizeHooks(eps, ret);
    expect(s.question.count).toBe(1);
    expect(s.question.avg_hook_score).toBe(0.8);
    expect(s.number.count).toBe(1);
    expect(s.statement).toBeUndefined();
  });
});
