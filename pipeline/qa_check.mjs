// qa_check.mjs — QA automático del video FINAL. Rechaza cortos, rotos, sin audio o de baja
// calidad, para que el sistema los rehaga solo y NUNCA se acepte un video malo.
// Uso: node pipeline/qa_check.mjs <video.mp4> <min_score> <out qa.json>
// Env: QA_MIN_DURATION (def 300s = 5min), QA_MIN_SCORE (def 7.0)
import { execSync } from "node:child_process";
import fs from "node:fs";

const [video, minScoreArg = "0", out = "qa.json"] = process.argv.slice(2);
const MIN_DUR = +(process.env.QA_MIN_DURATION || 300);
const MIN_SCORE = +(process.env.QA_MIN_SCORE || 7.0);
const minScore = parseFloat(minScoreArg) || 0;

function probe(args) { try { return execSync(`ffprobe -v error ${args}`).toString().trim(); } catch { return ""; } }

const reasons = [];
let hard = false; // fallo objetivo (corto/roto/sin audio) -> SIEMPRE rehacer

if (!fs.existsSync(video) || fs.statSync(video).size < 10000) { reasons.push("archivo inválido o vacío"); hard = true; }
const dur = parseFloat(probe(`-show_entries format=duration -of default=nw=1:nk=1 "${video}"`)) || 0;
const vtype = probe(`-select_streams v -show_entries stream=codec_type -of csv=p=0 "${video}"`);
const atype = probe(`-select_streams a -show_entries stream=codec_type -of csv=p=0 "${video}"`);
if (!vtype.includes("video")) { reasons.push("sin pista de video"); hard = true; }
if (!atype.includes("audio")) { reasons.push("sin audio"); hard = true; }
if (dur > 0 && dur < MIN_DUR) { reasons.push(`muy corto (${Math.round(dur)}s < ${MIN_DUR}s)`); hard = true; }

const scoreLow = minScore < MIN_SCORE;
if (scoreLow) reasons.push(`calidad baja (nota ${minScore} < ${MIN_SCORE})`);

// Pasa solo si NO hay fallo objetivo Y la nota alcanza el mínimo.
const passed = !hard && !scoreLow;

fs.writeFileSync(out, JSON.stringify({
  passed, hard_fail: hard, duration: Math.round(dur), min_score: minScore,
  min_duration: MIN_DUR, min_score_req: MIN_SCORE, reasons, at: new Date().toISOString(),
}, null, 2));
console.log(`QA: ${passed ? "PASA ✅" : "RECHAZA ❌"} · dur ${Math.round(dur)}s · nota ${minScore} · ${reasons.join("; ") || "todo ok"}`);
process.exit(0);
