import { describe, it, expect } from "vitest";
import { osUnifiedHtml, withOsBar, OS_UNIFIED_JS, OS_UNIFIED_CSS } from "../shared/os-unified.mjs";

describe("AI OS en un solo bot", () => {
  it("se sirve desde un Worker: sin backticks ni ${ y el cliente compila", () => {
    for (const [n, s] of Object.entries({ OS_UNIFIED_JS, OS_UNIFIED_CSS })) {
      expect(s.includes("`"), n).toBe(false);
      expect(s.includes("${"), n).toBe(false);
    }
    expect(() => new Function(OS_UNIFIED_JS)).not.toThrow();
  });
  it("abre en el cerebro con navegación y la API del bot", () => {
    const html = osUnifiedHtml({ build: "abc1234" });
    expect(html).toContain('<body data-sys="os">');
    expect(html).toContain('"api":"/api/os"');
    expect(html).toContain('"method":"POST"');
    expect(OS_UNIFIED_JS).toContain('var V={tab:"cerebro",sys:null};');
    for (const t of ["Cerebro", "Decisiones", "Sistemas", "Actividad"]) expect(OS_UNIFIED_JS).toContain(t);
    for (const p of ["/p/video-forge?from=os", "/p/radar?from=os", "/p/viento?from=os"]) expect(OS_UNIFIED_JS).toContain(p);
  });
  it("la configuración no inyecta HTML", () => {
    expect(osUnifiedHtml({ build: "</script><script>alert(1)" })).not.toContain("</script><script>alert(1)");
  });
  it("la barra de los paneles dice dónde estás y vuelve al cerebro, sin inyección", () => {
    const out = withOsBar('<html><body class="x"><main>panel</main></body></html>', 'Radar · Panel <b>');
    expect(out).toContain('<body class="x"><div id="os-bar"');
    expect(out).toContain('href="/os"');
    expect(out).toContain("Radar · Panel &lt;b&gt;");
    expect(out.indexOf("os-bar")).toBeLessThan(out.indexOf("<main>"));
  });
});
