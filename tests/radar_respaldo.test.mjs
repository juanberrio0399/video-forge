import { describe, it, expect } from "vitest";
import { dependencias, consultas, bloqueFuentes } from "../pipeline/lib/radar_respaldo.mjs";

describe("dependencias", () => {
  it("lee package.json, requirements y wrangler, sin ruido de test/lint", () => {
    const deps = dependencias({
      "package.json": JSON.stringify({ dependencies: { react: "^19", "duckdb-wasm": "1" }, devDependencies: { vitest: "1", "@types/node": "1", wrangler: "4" } }),
      "requirements.txt": "pandas==2.2\nduckdb>=1.1\n# comentario\nboto3[crt]~=1.35\npytest\n",
      "wrangler.toml": 'name = "x"',
    });
    expect(deps).toEqual(["react", "duckdb-wasm", "wrangler", "pandas", "duckdb", "boto3", "Cloudflare Workers"]);
  });

  it("pyproject: dependencias, no las claves del proyecto", () => {
    const deps = dependencias({ "pyproject.toml": '[project]\nname = "app"\nversion = "1"\nrequires-python = ">=3.11"\ndependencies = [\n  "httpx>=0.27",\n  "pydantic",\n]\n' });
    expect(deps).toEqual(["httpx", "pydantic"]);
  });

  it("package.json roto no tumba nada", () => {
    expect(dependencias({ "package.json": "{no es json" })).toEqual([]);
  });
});

describe("consultas", () => {
  it("de a 2 dependencias por consulta + el lenguaje, con tope de 5", () => {
    const q = consultas(["a", "b", "c", "d", "e", "f", "g"], "Python", 2026);
    expect(q).toHaveLength(4);
    expect(q[0]).toBe("a b new release changelog security 2026");
    expect(q[3]).toContain("Python");
    expect(consultas([], "", 2026)).toEqual([]);
  });
});

describe("bloqueFuentes", () => {
  it("sin resultados no agrega nada", () => {
    expect(bloqueFuentes([])).toBe("");
  });
  it("quita URLs repetidas, recorta y exige citar", () => {
    const b = bloqueFuentes([
      { title: "React 19.2", url: "https://react.dev/blog", content: "x".repeat(900) },
      { title: "dup", url: "https://react.dev/blog", content: "otra" },
    ]);
    expect(b).toContain("SOLO si salen de estas fuentes");
    expect(b.match(/react\.dev\/blog/g)).toHaveLength(1);
    expect(b.length).toBeLessThan(700);
  });
});
