import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Por que existe: el 2026-10-04 un PR dejo un `fi` suelto dentro de un `run: |` de
// episodes.yml. El YAML seguia siendo VALIDO (lo comprobe), asi que nada lo detecto —
// pero el bash estaba roto y el paso reventaba al instante. El workflow fallo dos dias
// seguidos y con el se detuvo el A/B del experimento de formato, sin que nadie lo notara.
//
// Validar el YAML no basta: lo que se ejecuta dentro de `run:` es un script aparte.

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(RAIZ, ".github", "workflows");

/** Saca los bloques `run: |` de un workflow, ya desindentados. */
function bloquesRun(texto) {
  const out = [];
  const lineas = texto.split("\n");
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^(\s*)run: \|\s*$/);
    if (!m) continue;
    const sangria = m[1].length + 2;
    const cuerpo = [];
    for (let j = i + 1; j < lineas.length; j++) {
      const l = lineas[j];
      if (l.trim() === "") { cuerpo.push(""); continue; }
      if (l.search(/\S/) < sangria) break;
      cuerpo.push(l.slice(sangria));
    }
    if (cuerpo.length) out.push({ linea: i + 1, cuerpo: cuerpo.join("\n") });
  }
  return out;
}

const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

describe("el bash dentro de los workflows compila", () => {
  it("hay workflows que revisar", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  for (const f of archivos) {
    it(`${f}`, () => {
      const texto = fs.readFileSync(path.join(DIR, f), "utf8");
      const fallos = [];
      for (const b of bloquesRun(texto)) {
        // Las expresiones ${{ }} de Actions no son bash: se sustituyen por un literal
        // para poder validar la ESTRUCTURA (if/fi, for/done, comillas) sin falsos fallos.
        const limpio = b.cuerpo.replace(/\$\{\{[^}]*\}\}/g, "X");
        // El script va por stdin: sin archivo temporal en disco (nada que otro
        // proceso pueda leer o suplantar en el directorio temporal compartido).
        try {
          execFileSync("bash", ["-n"], { input: limpio, stdio: "pipe" });
        } catch (e) {
          const msg = String(e.stderr || e.message).split("\n")[0];
          fallos.push(`  linea ~${b.linea}: ${msg.replace(/^bash: /, "")}`);
        }
      }
      expect(fallos.join("\n"), `bash invalido en ${f}:\n${fallos.join("\n")}`).toBe("");
      // Un `bash` por bloque: en Windows y con la suite en paralelo pasa de los 5 s por defecto.
    }, 30_000);
  }
});
