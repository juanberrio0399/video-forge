import { describe, it, expect } from "vitest";
import { gatherEvidence } from "../pipeline/lib/evidence_rules.mjs";

describe("gatherEvidence (hipótesis hook-pregunta)", () => {
  const eps = [
    { video_id: "q1", title: "Why X?" },       // pregunta
    { video_id: "q2", title: "How Y works" },  // pregunta
    { video_id: "s1", title: "Cute animals" }, // statement -> no testea esta hipótesis
  ];
  const ret = {
    q1: { early_drop_pct: 5 },   // buena retención inicial
    q2: { early_drop_pct: 40 },  // mala
    s1: { early_drop_pct: 20 },
  };
  const ev = gatherEvidence(eps, ret);

  it("solo evidencia de videos con hook=pregunta", () => {
    expect(ev.length).toBe(2);
    expect(ev.every((e) => e.hypothesis_id === "global-question-hook")).toBe(true);
  });
  it("q1 (caída <= mediana=20) -> +1 ; q2 (caída > mediana) -> -1", () => {
    expect(ev.find((e) => e.episode_id === "q1").direction).toBe(1);
    expect(ev.find((e) => e.episode_id === "q2").direction).toBe(-1);
  });
  it("sin retención -> sin evidencia", () => expect(gatherEvidence(eps, {}).length).toBe(0));
});
