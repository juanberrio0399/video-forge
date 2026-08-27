// opencut_watch.mjs — Vigila OpenCut-app/OpenCut por señales de que llega lo que interesa para
// integrarlo a video-forge: modo HEADLESS/AUTOMATIZACIÓN + MCP server + Editor API + scripting/CLI.
// Avisa a Telegram SOLO cuando aparece una señal NUEVA (anti-repetición vía estado en R2).
// Primera corrida = solo fija la línea base (no avisa), para no llenar de ruido con menciones ya existentes.
//
// Lee (cwd): opencut_watch.json (estado previo). Escribe: opencut_watch_new.json + opencut_alert.txt (si hay señal).
// Env: GH_TOKEN (o GITHUB_TOKEN) para la API de GitHub.
import fs from "node:fs";

const REPO = "OpenCut-app/OpenCut";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const H = { Accept: "application/vnd.github+json", "User-Agent": "opencut-watch" };
if (TOKEN) H.Authorization = `Bearer ${TOKEN}`;

// Señales fuertes de automatización/integración (evito términos ambiguos para no dar falsos positivos).
const KW = /\b(mcp server|mcp\b|headless|editor api|render api|node api|programmatic|batch render|automation mode|scripting api|\bcli\b|command[- ]line)\b/i;

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const state = rj("opencut_watch.json", { releases: [], commits: [], paths: [] });
const seen = { releases: new Set(state.releases || []), commits: new Set(state.commits || []), paths: new Set(state.paths || []) };
const firstRun = !seen.releases.size && !seen.commits.size && !seen.paths.size;

const jget = async (url) => { const r = await fetch(url, { headers: H }); if (!r.ok) throw new Error(url.split("/").slice(-1)[0] + " " + r.status); return r.json(); };
const hits = [];

// 1) Releases con keyword.
try {
  for (const rel of await jget(`https://api.github.com/repos/${REPO}/releases?per_page=8`)) {
    const text = `${rel.tag_name} ${rel.name || ""} ${rel.body || ""}`;
    if (KW.test(text) && !seen.releases.has(rel.tag_name)) { if (!firstRun) hits.push(`🏷️ Release ${rel.tag_name} — ${rel.html_url}`); seen.releases.add(rel.tag_name); }
  }
} catch (e) { console.error("releases:", e.message); }

// 2) Commits recientes (main) con keyword en el mensaje.
try {
  for (const c of await jget(`https://api.github.com/repos/${REPO}/commits?per_page=50`)) {
    const msg = c.commit?.message || "";
    if (KW.test(msg) && !seen.commits.has(c.sha)) { if (!firstRun) hits.push(`💬 ${msg.split("\n")[0].slice(0, 72)} — ${c.html_url}`); seen.commits.add(c.sha); }
  }
} catch (e) { console.error("commits:", e.message); }

// 3) Paths reveladores (que aparezca un dir/archivo de mcp, headless, cli, editor-api…).
try {
  const tree = await jget(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`);
  for (const p of (tree.tree || []).map((t) => t.path)) {
    if (/(^|\/)(mcp|headless)(\/|\.|-|$)|editor-?api|render-?api|(^|\/)cli(\/|\.|$)/i.test(p) && !seen.paths.has(p)) {
      if (!firstRun) hits.push(`📁 Nuevo en el repo: ${p}`); seen.paths.add(p);
    }
  }
} catch (e) { console.error("tree:", e.message); }

fs.writeFileSync("opencut_watch_new.json", JSON.stringify({ releases: [...seen.releases].slice(-60), commits: [...seen.commits].slice(-250), paths: [...seen.paths].slice(-300) }));

if (firstRun) {
  console.log(`OpenCut watch: línea base fijada (releases ${seen.releases.size}, commits ${seen.commits.size}, paths ${seen.paths.size}). No aviso en la 1ª corrida.`);
} else if (hits.length) {
  const msg = "🎬 OpenCut — ¡señal de AUTOMATIZACIÓN/MCP! (posible integración a video-forge):\n" + hits.slice(0, 8).map((h) => "• " + h).join("\n") + "\n\nRevísalo: puede que ya haya modo headless/MCP/Editor API para automatizar edición.";
  fs.writeFileSync("opencut_alert.txt", msg);
  console.log(msg);
} else {
  console.log("OpenCut watch: sin señales nuevas de automatización/MCP.");
}
