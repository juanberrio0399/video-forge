// make_lut.mjs — genera un LUT 3D (.cube) cinematografico "teal-orange" filmico, SIN oscurecer
// (mantiene la luz que pide el auto-review). Se corre UNA vez; el .cube se commitea y ffmpeg lo
// aplica con lut3d en cada plano. Sin descargas externas -> reproducible y gratis.
// Uso: node pipeline/make_lut.mjs [out=assets/luts/cinematic.cube] [size=33]
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] || "assets/luts/cinematic.cube";
const N = parseInt(process.argv[3] || "33", 10);
const clamp = (x) => Math.max(0, Math.min(1, x));

function grade(r, g, b) {
  // 1) leve lift + contraste filmico suave (mantiene la luz)
  const contrast = (x) => { x = x * 1.02 + 0.008; return clamp(0.5 + (x - 0.5) * 1.12); };
  r = contrast(r); g = contrast(g); b = contrast(b);
  // 2) teal-orange por luminancia: sombras hacia teal, altas hacia naranja
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  const shadow = 1 - L, high = L, A = 0.05;
  r = clamp(r - A * shadow * 0.8 + A * high * 0.9);
  g = clamp(g + A * shadow * 0.15 + A * high * 0.12);
  b = clamp(b + A * shadow * 0.9 - A * high * 0.8);
  // 3) saturacion leve para dar cuerpo
  const L2 = 0.299 * r + 0.587 * g + 0.114 * b, sat = 1.06;
  r = clamp(L2 + (r - L2) * sat); g = clamp(L2 + (g - L2) * sat); b = clamp(L2 + (b - L2) * sat);
  return [r, g, b];
}

const lines = [`TITLE "The Data Lens Cinematic"`, `LUT_3D_SIZE ${N}`, ""];
// .cube: el indice R varia mas rapido, luego G, luego B.
for (let bi = 0; bi < N; bi++) {
  for (let gi = 0; gi < N; gi++) {
    for (let ri = 0; ri < N; ri++) {
      const [r, g, b] = grade(ri / (N - 1), gi / (N - 1), bi / (N - 1));
      lines.push(`${r.toFixed(6)} ${g.toFixed(6)} ${b.toFixed(6)}`);
    }
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(`LUT generado: ${out} (${N}x${N}x${N} = ${N ** 3} entradas)`);
