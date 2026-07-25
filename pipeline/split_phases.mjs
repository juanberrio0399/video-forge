// split_phases.mjs — parte el video largo en FASES de ~3 min para renderizar cada una
// con su propia puerta de calidad (3 intentos, umbral 7.5) y luego unirlas. Renderizar
// 3 min x3 SI cabe en el runner gratis; 7-12 min x3 no. Cada fase es un video de 0 a su
// duracion (se re-basea el tiempo a 0), con su rebanada de narracion y su voicemap.
//
// Uso: node pipeline/split_phases.mjs <timing.json> <voicemap_full.json> <outDir=phases>
// Env: PHASE_SECONDS (default 180). Escribe phases/<k>/timing.json + voicemap.json y
// phases/manifest.json = [{k, absStart, absEnd, total, hook}]. Imprime el array de fases.
import fs from "node:fs";

const [timingPath, voicemapPath, outDir = "phases"] = process.argv.slice(2);
const PHASE = Math.max(60, parseInt(process.env.PHASE_SECONDS || "180", 10) || 180);
const MIN_TAIL = 60; // si la ultima fase es mas corta que esto, se pega a la anterior

const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const vm = voicemapPath && fs.existsSync(voicemapPath) ? JSON.parse(fs.readFileSync(voicemapPath, "utf8")) : { beats: [] };
const beats = timing.beats || [];
if (!beats.length) { console.error("split_phases: timing sin beats"); process.exit(1); }

// Agrupa beats contiguos hasta ~PHASE segundos por grupo.
const groups = [];
let cur = [];
let curDur = 0;
for (let i = 0; i < beats.length; i++) {
  cur.push(i);
  curDur += (beats[i].dur || (beats[i].end - beats[i].start) || 0);
  if (curDur >= PHASE) { groups.push(cur); cur = []; curDur = 0; }
}
if (cur.length) groups.push(cur);
// Si la ultima fase quedo muy corta, fusionala con la anterior.
if (groups.length >= 2) {
  const last = groups[groups.length - 1];
  const lastDur = last.reduce((a, i) => a + (beats[i].dur || 0), 0);
  if (lastDur < MIN_TAIL) {
    const prev = groups[groups.length - 2];
    groups[groups.length - 2] = prev.concat(last);
    groups.pop();
  }
}

fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
groups.forEach((idxs, k) => {
  const dir = `${outDir}/${k}`;
  fs.mkdirSync(dir, { recursive: true });
  const first = beats[idxs[0]];
  const lastB = beats[idxs[idxs.length - 1]];
  const offset = first.start || 0;
  const absStart = +(first.start || 0).toFixed(3);
  const absEnd = +(lastB.end || (lastB.start + lastB.dur) || 0).toFixed(3);
  // Beats re-baseados a 0 (para que la fase renderice como un video que empieza en 0).
  let t = 0;
  const pb = idxs.map((i, j) => {
    const b = beats[i];
    const dur = b.dur || (b.end - b.start) || 0;
    const beat = { index: j, tipo: b.tipo || "-", text: b.text || "", start: +t.toFixed(3), end: +(t + dur).toFixed(3), dur: +dur.toFixed(3) };
    t += dur;
    return beat;
  });
  fs.writeFileSync(`${dir}/timing.json`, JSON.stringify({ total: +t.toFixed(3), beats: pb }, null, 2));
  // Rebanada del voicemap (misma posicion/orden que los beats de timing).
  const vmSlice = { ...vm, beats: (vm.beats || []).slice(idxs[0], idxs[idxs.length - 1] + 1) };
  fs.writeFileSync(`${dir}/voicemap.json`, JSON.stringify(vmSlice, null, 2));
  manifest.push({ k, absStart, absEnd, total: +t.toFixed(3), hook: (pb[0] && pb[0].text || "").slice(0, 200) });
});

fs.writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
const phases = groups.map((_, k) => k);
fs.writeFileSync(`${outDir}/phases.json`, JSON.stringify(phases));
console.log(`Fases: ${phases.length} (~${PHASE}s c/u) de un total de ${timing.total || "?"}s`);
manifest.forEach((m) => console.log(`  fase ${m.k}: ${m.absStart}s -> ${m.absEnd}s (${m.total.toFixed(1)}s) hook="${m.hook.slice(0, 40)}..."`));
