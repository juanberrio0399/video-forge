import { describe, it, expect } from "vitest";
import { osShellHtml, OS_SHELL_CSS, OS_APP_JS, OS_SYSTEMS_UI } from "../shared/os-shell.mjs";

describe("app común del AI OS", () => {
  it("se puede servir desde un Worker: sin backticks ni ${ y el cliente compila", () => {
    for (const [n, s] of Object.entries({ OS_SHELL_CSS, OS_APP_JS })) {
      expect(s.includes("`"), n).toBe(false);
      expect(s.includes("${"), n).toBe(false);
    }
    expect(() => new Function(OS_APP_JS)).not.toThrow();
  });
  it("cada sistema tiene su acento, su API y su panel", () => {
    for (const sys of Object.keys(OS_SYSTEMS_UI)) {
      const html = osShellHtml(sys, { build: "abc1234" });
      expect(html).toContain(`<body data-sys="${sys}">`);
      expect(html).toContain('"api":"/api/os"');
      expect(html).toContain(`"panel":"${OS_SYSTEMS_UI[sys].panel}"`);
      expect(html).toContain('"build":"abc1234"');
    }
    expect(osShellHtml("viento")).toContain('"method":"GET"');
    expect(osShellHtml("radar")).toContain('"method":"POST"');
  });
  it("no deja inyectar HTML por la configuración y rechaza sistemas inventados", () => {
    const html = osShellHtml("radar", { build: "</script><script>alert(1)" });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(() => osShellHtml("billiop")).toThrow();
  });
});
