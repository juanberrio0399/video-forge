import { describe, it, expect } from "vitest";
import { OS_CSS, OS_JS, OS_ICONS, OS_HEAD, OS_UI_VERSION } from "../shared/os-ui.mjs";

describe("design system del AI OS", () => {
  it("se puede incrustar en un template literal de un Worker (sin backticks ni ${)", () => {
    for (const [name, s] of Object.entries({ OS_CSS, OS_JS, OS_ICONS, OS_HEAD })) {
      expect(s.includes("`"), name).toBe(false);
      expect(s.includes("${"), name).toBe(false);
    }
  });
  it("el JS del cliente compila y expone OS", () => {
    const win = { Telegram: null };
    const doc = { documentElement: { setAttribute() {} }, getElementById: () => null, createElement: () => ({ classList: { add() {}, remove() {} }, addEventListener() {} }), body: { appendChild() {} } };
    const run = new Function("window", "document", "Date", OS_JS);
    run(win, doc, Date);
    expect(typeof win.OS.sparkline).toBe("function");
    expect(win.OS.sparkline([1, 3, 2, 5], { ref: 2 })).toMatch(/<svg class="os-spark"/);
    expect(win.OS.sparkline([1])).toBe("");
    expect(win.OS.num(60337)).toBe("60 mil");
    expect(win.OS.esc('<a href="x">')).toBe("&lt;a href=&quot;x&quot;&gt;");
  });
  it("define los tres acentos y los estados de la IA", () => {
    expect(OS_CSS).toMatch(/body\[data-sys="video-forge"\]\{--os-acc:#A594FF/);
    expect(OS_CSS).toMatch(/body\[data-sys="viento"\]\{--os-acc:#3DDBB0/);
    expect(OS_CSS).toMatch(/body\[data-sys="radar"\]\{--os-acc:#4CC9F0/);
    for (const s of ["observing", "thinking", "researching", "analyzing", "executing", "asking", "completed", "failed"]) expect(OS_CSS.includes(`data-s="${s}"`), s).toBe(true);
  });
  it("tiene los iconos base y versión", () => {
    for (const i of ["pulse", "pipeline", "learn", "ask", "needs", "growth", "commerce", "radar", "health", "pr", "shield"]) expect(OS_ICONS.includes(`id="i-${i}"`), i).toBe(true);
    expect(OS_UI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
