// video_scores.mjs — Score universal por video + Matriz de outliers (Growth Roadmap Fase 2).
// Lee los episodios (+ retención) de un canal, puntúa cada video con veredicto accionable y
// detecta los outliers propios -> escribe channel/<...>/scores.json (lo consume el reporte/Mini App).
// Uso: node pipeline/video_scores.mjs <episodes.json> <retention.json> <scoresOut.json>
import fs from "node:fs";
import { scoreVideo, findOutliers } from "./lib/video_score.mjs";

const [epFile, retFile, outFile] = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const episodes = (read(epFile, {}).episodes) || [];
const retById = {};
for (const v of (read(retFile, {}).videos) || []) retById[v.video_id] = v;

const scores = episodes.map((e) => scoreVideo(e, retById[e.video_id] || null));
const outliers = findOutliers(episodes);

// Conteo por veredicto + top por score (los maduros, para "qué escalar / qué cortar").
const counts = { SCALE: 0, ITERATE: 0, TEST_AGAIN: 0, STOP: 0 };
for (const s of scores) counts[s.verdict] = (counts[s.verdict] || 0) + 1;
const mature = scores.filter((s) => s.mature).sort((a, b) => b.overall - a.overall);
const toScale = scores.filter((s) => s.verdict === "SCALE").sort((a, b) => b.overall - a.overall);
const toStop = scores.filter((s) => s.verdict === "STOP").sort((a, b) => a.overall - b.overall);

const out = {
  at: new Date().toISOString(),
  n: scores.length, counts,
  top: mature.slice(0, 5),
  scale: toScale.slice(0, 5),
  stop: toStop.slice(0, 5),
  outliers,
  scores, // completo (por si la app lo pagina)
  note: "Score 0-100 + veredicto SCALE/ITERATE/TEST_AGAIN/STOP por video. FACT: vpd/vistas/retención. INFERENCE: score/veredicto/outliers (umbrales por datos).",
};
fs.writeFileSync(outFile || "scores.json", JSON.stringify(out, null, 2));
console.log(`scores: ${scores.length} videos · SCALE ${counts.SCALE} · ITERATE ${counts.ITERATE} · TEST ${counts.TEST_AGAIN} · STOP ${counts.STOP} · outliers ${outliers.count}`);
if (outliers.count) console.log(`  ${outliers.suggestion}`);
