// mark_stage.mjs — marca etapas hechas por video en un registro (channel/videos.json).
// Solo rastrea lo que NO se deduce de YouTube: miniatura y shorts. (guion/voz/render/seo
// se dan por hechos si el video ya esta subido; publicado se lee en vivo del canal.)
// Uso: node pipeline/mark_stage.mjs <videos.json> <video_id> "<title>" <etapas,csv>
import fs from "node:fs";

const [path, videoId, title = "", stagesCSV = ""] = process.argv.slice(2);
if (!videoId) process.exit(0);
let db = {};
try { db = JSON.parse(fs.readFileSync(path, "utf8")) || {}; } catch {}
const e = db[videoId] || { stages: {} };
if (title) e.title = title;
e.stages = e.stages || {};
for (const s of stagesCSV.split(",").map((x) => x.trim()).filter(Boolean)) e.stages[s] = true;
e.updated_at = new Date().toISOString();
db[videoId] = e;
fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log("registro:", videoId, "->", stagesCSV);
