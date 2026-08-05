// experiment_step.mjs — registra el resultado de un video y decide si SUBIR la duracion objetivo.
// La idea (pedida por Juan): ir aumentando la duracion de los videos POCO A POCO, midiendo si aguanta.
// Opera sobre un archivo local exp.json (el workflow lo baja/sube de R2 con wrangler).
//
// Uso: node pipeline/experiment_step.mjs <actual_sec> <qa_score> <qa_passed 1|0> <n>
import fs from "node:fs";

const [, , actualSec, qaScore, qaPassed, n] = process.argv;
const F = "exp.json";
let e = {};
try { e = JSON.parse(fs.readFileSync(F, "utf8")); } catch {}
const d = (e.duration = e.duration || { enabled: true, target_min: 8, beats_per_min: 7, ramp: [8, 10, 12, 15], step: 0, streak: 0, history: [] });
if (!Array.isArray(d.ramp) || !d.ramp.length) d.ramp = [8, 10, 12, 15];
if (typeof d.step !== "number") d.step = 0;

const targetMin = d.ramp[d.step] || d.target_min || 8;
const rec = {
  n: +n || null,
  target_min: targetMin,
  actual_sec: Math.round(+actualSec || 0),
  actual_min: +(((+actualSec || 0) / 60).toFixed(1)),
  qa_score: +qaScore || 0,
  qa_passed: qaPassed === "1",
  at: new Date().toISOString(),
};
d.history = (d.history || []).concat([rec]).slice(-40);

// Avanzar la rampa: el video debe HABER PASADO QA y llegar al objetivo (>=90% de la duracion).
// (Que haya renderizado ya prueba que la duracion cabe en el timeout del job.)
const hitTarget = rec.qa_passed && rec.actual_sec >= targetMin * 60 * 0.9;
d.streak = hitTarget ? (d.streak || 0) + 1 : 0;

let msg = "";
if (d.streak >= 2 && d.step < d.ramp.length - 1) {
  d.step++;
  d.streak = 0;
  d.target_min = d.ramp[d.step];
  msg = `SUBE la duracion objetivo a ${d.target_min} min (escalon ${d.step + 1}/${d.ramp.length}).`;
} else {
  d.target_min = targetMin;
  msg = `Objetivo ${d.target_min} min · racha ${d.streak}/2 · ultimo ${rec.actual_min} min (QA ${rec.qa_passed ? "ok" : "no"}).`;
}
fs.writeFileSync(F, JSON.stringify(e, null, 2));
console.log(msg);
// Exportar el mensaje para que el workflow avise por Telegram.
try { fs.writeFileSync("experiment_msg.txt", msg); } catch {}
