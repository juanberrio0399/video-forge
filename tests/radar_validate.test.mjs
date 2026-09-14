import { describe, it, expect } from "vitest";
import { jsImports, jsPackageName, missingJsDeps, pyImports, missingPyDeps, unreferencedNewFiles, syntaxCheckCommand, projectCommands, sizeProblem } from "../pipeline/lib/radar_validate.mjs";

describe("dependencias no declaradas (caso ugpp #54: pdfjs-dist)", () => {
  it("detecta un paquete importado que no está en package.json", () => {
    const files = [{ path: "src/js/core/fileReader.js", content: 'import * as pdfjs from "pdfjs-dist";\nimport { x } from "./util.js";\nimport fs from "node:fs";' }];
    expect(missingJsDeps(files, { dependencies: { vite: "5" } })).toEqual([{ file: "src/js/core/fileReader.js", pkg: "pdfjs-dist" }]);
    expect(missingJsDeps(files, { dependencies: { "pdfjs-dist": "4" } })).toEqual([]);
  });
  it("entiende scopes, subrutas, require e import dinámico", () => {
    const src = 'const a = require("lodash/merge"); import("@orama/orama/components"); export { b } from "hono";';
    expect(jsImports(src).sort()).toEqual(["@orama/orama/components", "hono", "lodash/merge"]);
    expect(jsPackageName("@orama/orama/components")).toBe("@orama/orama");
    expect(jsPackageName("cloudflare:workers")).toBe(null);
    expect(jsPackageName("node:path")).toBe(null);
    expect(jsPackageName("fs")).toBe(null);
  });
});

describe("Python", () => {
  it("detecta imports sin requirements (caso Presidio)", () => {
    const files = [{ path: "src/quality.py", content: "import os\nfrom presidio_analyzer import AnalyzerEngine\nimport yaml\nfrom . import helpers" }];
    const std = new Set(["os"]);
    expect(missingPyDeps(files, "pyyaml==6.0\nduckdb", std, new Set()).map((m) => m.pkg)).toEqual(["presidio_analyzer"]);
    expect(missingPyDeps(files, "presidio-analyzer\npyyaml", std, new Set())).toEqual([]);
    expect(pyImports("from pandas import DataFrame\n  import polars as pl")).toEqual(["pandas", "polars"]);
  });
});

describe("código muerto (caso ugpp #57/#58: módulos que nadie importa)", () => {
  it("marca un módulo nuevo que ningún archivo usa", () => {
    const corpus = [{ path: "src/main.js", content: 'import { run } from "./engine.js";' }];
    expect(unreferencedNewFiles(["src/js/core/aiAdvisor.js"], corpus)).toEqual(["src/js/core/aiAdvisor.js"]);
    expect(unreferencedNewFiles(["src/engine.js"], corpus)).toEqual([]);
  });
  it("no exige uso a tests, scripts ni puntos de entrada", () => {
    expect(unreferencedNewFiles(["tests/a.test.js", "scripts/gen.py", "src/index.ts"], [])).toEqual([]);
  });
});

describe("sintaxis y comandos del proyecto", () => {
  it("elige el validador por tipo de archivo", () => {
    expect(syntaxCheckCommand("pyproject.toml")).toMatch(/tomllib/);
    expect(syntaxCheckCommand("a/b.json")).toMatch(/JSON\.parse/);
    expect(syntaxCheckCommand("x.mjs")).toMatch(/node --check/);
    expect(syntaxCheckCommand("README.md")).toBe(null);
  });
  it("corre install, build y test, nunca modos watch", () => {
    const c = projectCommands([{ dir: "app", pkg: { scripts: { build: "vite build", dev: "vite", test: "vitest --watch" } }, hasLock: true }], null);
    expect(c.map((x) => x.label)).toEqual(["instalar dependencias", "npm run build"]);
    expect(c[0].cmd).toMatch(/npm ci/);
    expect(c[0].cwd).toBe("app");
  });
  it("Python con ruff y pytest", () => {
    expect(projectCommands([], { hasReq: true, usesRuff: true, hasTests: true }).map((x) => x.label)).toEqual(["instalar dependencias Python", "compilar Python", "ruff", "pytest"]);
  });
});

describe("tamaño (caso dataforge #40/#41: 100 archivos, 34 mil líneas)", () => {
  it("frena diffs gigantes", () => {
    const big = Array.from({ length: 100 }, (_, i) => `120\t200\tf${i}.js`).join("\n");
    expect(sizeProblem(big)).toMatch(/100 archivos/);
    expect(sizeProblem("10\t2\ta.js\n3\t0\tb.js")).toBe(null);
    expect(sizeProblem("900\t400\ta.js")).toMatch(/1300 líneas/);
  });
});
