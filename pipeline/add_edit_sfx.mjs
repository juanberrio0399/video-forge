// add_edit_sfx.mjs — POST-PROCESO de edición del canal principal. Sobre un video YA rendido,
// superpone whooshes SUTILES en las transiciones (según timing.json) para dar terminación PRO,
// sin tocar el render de HyperFrames. Usa el pack CC0 en sfx_edit/ (bajado de R2). NO reusa
// material ajeno (solo CC0). Best-effort: si no hay pack o falla, deja el video igual.
//
// Uso: node pipeline/add_edit_sfx.mjs <in.mp4> <timing.json> <out.mp4>
import fs from "node:fs";
import { execSync } from "node:child_process";

const [inPath, timingPath, outPath] = process.argv.slice(2);
const keep = () => { if (inPath && outPath && inPath !== outPath) { try { fs.copyFileSync(inPath, outPath); } catch {} } };
function readJSON(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } }

if (!inPath || !fs.existsSync(inPath)) { console.error("sin video de entrada"); process.exit(0); }
const beats = (readJSON(timingPath, {}).beats) || [];
const man = readJSON("sfx_edit/manifest.json", null);
const whooshes = ((man && man.whoosh) || []).filter((f) => fs.existsSync(f));
if (!whooshes.length || !beats.length) { keep(); console.log("Sin pack de SFX o sin timing -> dejo el video igual."); process.exit(0); }

// Tiempos de whoosh: al inicio de un beat, espaciados >=12s (tasteful, no saturar) y máx 20.
const times = []; let last = -99;
for (const b of beats) {
  const t = +b.start || 0;
  if (t >= 1.5 && (t - last) >= 12) { times.push(+t.toFixed(2)); last = t; if (times.length >= 20) break; }
}
if (!times.length) { keep(); console.log("Sin transiciones útiles -> video igual."); process.exit(0); }

try {
  // Un input de whoosh por golpe (rota variantes), adelay al tiempo, volumen sutil, amix con el audio.
  const ins = [`-i "${inPath}"`]; let fc = ""; const mix = ["[0:a]"];
  times.forEach((t, i) => {
    const w = whooshes[i % whooshes.length];
    ins.push(`-i "${w}"`);
    const ms = Math.round(t * 1000);
    fc += `[${i + 1}:a]adelay=${ms}|${ms},volume=0.22[w${i}];`;
    mix.push(`[w${i}]`);
  });
  fc += `${mix.join("")}amix=inputs=${mix.length}:duration=first:dropout_transition=0:normalize=0[a]`;
  execSync(`ffmpeg -y ${ins.join(" ")} -filter_complex "${fc}" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k "${outPath}"`, { stdio: "ignore" });
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) { keep(); console.log("SFX no produjo salida válida -> video igual."); }
  else console.log(`Edición: ${times.length} whooshes CC0 en transiciones -> ${outPath}`);
} catch (e) { keep(); console.log("SFX de edición falló, dejo el video igual: " + e.message); }
