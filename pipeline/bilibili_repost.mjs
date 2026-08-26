// bilibili_repost.mjs — FASE 2: repostea a Bilibili los Shorts de Oddly que quedaron en la cola
// (channel/oddly/bilibili_queue.json). Por cada uno: baja el MP4 de R2, lo sube a Bilibili con el
// uploader de Playwright (en la nube), y SI SALE BIEN: borra el MP4 de R2 (ya está en YouTube + Bilibili
// = "en todo lado", no llena R2) y lo saca de la cola. Si falla: lo deja en la cola para reintentar mañana.
// Avisa a Telegram el resultado de cada uno (detectar si funcionó o no).
//
// Lee (cwd): bilibili_queue.json, bilibili_posted.json. Escribe: bilibili_queue_new.json, bilibili_posted_new.json.
// Env: CLOUDFLARE_* (para wrangler), BILIBILI_COOKIE (lo usa el uploader), TELEGRAM_* (avisos).
import fs from "node:fs";
import { execSync } from "node:child_process";

const BUCKET = process.env.BUCKET || "video-forge";
const MAX_PER_RUN = 3; // subir de a pocos por corrida (Bilibili + tiempo)

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "pipe", ...opts });
const r2get = (key, file) => { try { sh(`npx --yes wrangler@4 r2 object get "${BUCKET}/${key}" --file="${file}" --remote`); return fs.existsSync(file) && fs.statSync(file).size > 1000; } catch { return false; } };
const r2del = (key) => { try { sh(`npx --yes wrangler@4 r2 object delete "${BUCKET}/${key}" --remote`); return true; } catch (e) { console.error("no pude borrar de R2:", key, e.message); return false; } };
const notify = (msg) => { try { execSync(`bash pipeline/notify_telegram.sh ${JSON.stringify(msg)}`, { stdio: "inherit" }); } catch {} };

let queue = rj("bilibili_queue.json", []);
if (!Array.isArray(queue)) queue = [];
const posted = new Set(rj("bilibili_posted.json", []));
let log = rj("bilibili_log.json", []);
if (!Array.isArray(log)) log = [];
const stamp = new Date().toISOString();

const pending = queue.filter((q) => q && q.video_id && !posted.has(q.video_id));
if (!pending.length) { console.log("Bilibili repost: nada pendiente en la cola."); process.exit(0); }
console.log(`Bilibili repost: ${pending.length} en cola, subo hasta ${MAX_PER_RUN}.`);

const toDo = pending.slice(0, MAX_PER_RUN);
let done = 0, failed = 0;

for (const item of toDo) {
  const key = item.r2_key || `channel/oddly/repost/${item.video_id}.mp4`;
  console.log(`\n▶ ${item.title} (${item.video_id})`);
  try { fs.rmSync("video.mp4", { force: true }); } catch {}
  if (!r2get(key, "video.mp4")) { console.log("  ⚠️ no está el MP4 en R2 (¿ya se borró?). Lo saco de la cola."); posted.add(item.video_id); continue; }
  // Subir a Bilibili con el uploader de Playwright (reusa el script probado). Título/tags por env.
  try { fs.rmSync("result.txt", { force: true }); } catch {}
  try {
    execSync("node pipeline/bilibili_playwright.mjs video.mp4", {
      stdio: "inherit",
      env: { ...process.env, BILI_TITLE: item.title || "Relaxing Space", BILI_DESC: item.desc || "Relaxing space visuals. Follow for more.", BILI_TAG: (item.tags || []).join(",") },
    });
  } catch { /* el exit!=0 lo evaluamos por result.txt */ }
  const ok = /^OK/.test(rj0("result.txt"));
  if (ok) {
    done++;
    r2del(key);                 // ← ya está en YouTube + Bilibili: limpiar R2 para no llenarlo
    posted.add(item.video_id);
    log.unshift({ video_id: item.video_id, title: item.title || "Short", at: stamp, ok: true });
    notify(`✅ Bilibili: reposteé «${item.title}» y limpié su copia de R2.`);
  } else {
    failed++;
    log.unshift({ video_id: item.video_id, title: item.title || "Short", at: stamp, ok: false });
    notify(`⚠️ Bilibili: no pude repostear «${item.title}». Queda en la cola para reintentar. Mira el artefacto de capturas.`);
  }
  try { fs.rmSync("video.mp4", { force: true }); } catch {}
}

// Nueva cola = lo que quedó (sacando lo ya posteado). Posted acotado.
const newQueue = queue.filter((q) => q && q.video_id && !posted.has(q.video_id));
fs.writeFileSync("bilibili_queue_new.json", JSON.stringify(newQueue));
fs.writeFileSync("bilibili_posted_new.json", JSON.stringify([...posted].slice(-800)));
fs.writeFileSync("bilibili_log_new.json", JSON.stringify(log.slice(0, 40))); // últimos 40 para la app
console.log(`\nBilibili repost: ${done} ok, ${failed} fallidos, ${newQueue.length} quedan en cola.`);

function rj0(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }
