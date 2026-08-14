// tools_health.mjs — valida a DIARIO las herramientas/APIs GRATIS que usa la fabrica (guion, voz,
// b-roll, miniaturas, subir, metricas) y guarda el estado para verlo en la app y avisar si algo cae.
// Uso: node pipeline/tools_health.mjs <out.json>
// Env: GEMINI_API_KEY, PEXELS_API_KEY, YT_CLIENT_ID/SECRET/REFRESH
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const out = process.argv[2] || "tools_health.json";
const { GEMINI_API_KEY, GEMINI_API_KEY2, PEXELS_API_KEY, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, GH_TOKEN, GITHUB_REPOSITORY } = process.env;
const tools = [];
const add = (name, ok, detail, critical = false) => tools.push({ name, ok, detail, critical });
// fetch con timeout: una API LENTA (no caida) no cuelga el job entero.
const tf = (u, o = {}, ms = 8000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

async function checkGeminiText() {
  // Prueba CADA llave (multi-llave = mas cuota). Cada llave prueba varios modelos (evita 404 de un nombre).
  const keys = [GEMINI_API_KEY, GEMINI_API_KEY2].filter(Boolean);
  if (!keys.length) return add("Gemini (guion/SEO/IA)", false, "sin API key", true);
  const models = TEXT_MODELS;
  let okCount = 0; const bad = [];
  for (let i = 0; i < keys.length; i++) {
    let ok = false, why = "no responde";
    for (const m of models) {
      try {
        const r = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${keys[i]}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }) });
        if (r.ok) { ok = true; break; }
        if (r.status === 429) why = "429 cuota";
      } catch {}
    }
    if (ok) okCount++; else bad.push(`llave${i + 1}:${why}`);
  }
  const total = keys.length;
  add("Gemini (guion/SEO/IA)", okCount > 0, okCount === total ? `${okCount}/${total} llaves OK` : `${okCount}/${total} OK (${bad.join(", ")})`, true);
}
async function checkPollinations() {
  try { const r = await fetch("https://image.pollinations.ai/prompt/test?width=64&height=64&nologo=true&model=flux", { method: "GET" }); add("Pollinations (b-roll/miniaturas IA)", r.ok, r.ok ? "OK" : `HTTP ${r.status}`, false); }
  catch (e) { add("Pollinations (b-roll/miniaturas IA)", false, e.message, false); }
}
async function checkPexels() {
  if (!PEXELS_API_KEY) return add("Pexels (footage real)", false, "sin API key (cae a imágenes IA)", false);
  try { const r = await fetch("https://api.pexels.com/videos/search?query=money&per_page=1", { headers: { Authorization: PEXELS_API_KEY } }); add("Pexels (footage real)", r.ok, r.ok ? "OK" : `HTTP ${r.status}`, false); }
  catch (e) { add("Pexels (footage real)", false, e.message, false); }
}
async function checkKokoro() {
  try { const r = await fetch("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin", { method: "HEAD", redirect: "follow" }); const ok = r.ok || r.status === 302; add("Kokoro TTS (voz, local)", ok, ok ? "modelos accesibles" : `HTTP ${r.status}`, true); }
  catch (e) { add("Kokoro TTS (voz, local)", false, e.message, true); }
}
async function checkYouTube() {
  if (!YT_REFRESH_TOKEN) return add("YouTube API", false, "sin OAuth", true);
  let token = null;
  try {
    const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
    token = t.access_token;
  } catch {}
  if (!token) return add("YouTube Data API (subir/publicar)", false, "no pude renovar el token OAuth", true);
  try { const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", { headers: { Authorization: `Bearer ${token}` } }); add("YouTube Data API (subir/publicar)", r.ok, r.ok ? "OK" : `HTTP ${r.status}`, true); }
  catch (e) { add("YouTube Data API (subir/publicar)", false, e.message, true); }
  try { const r = await fetch("https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2024-01-01&endDate=2035-01-01&metrics=views", { headers: { Authorization: `Bearer ${token}` } }); add("YouTube Analytics (métricas)", r.ok, r.ok ? "OK" : `HTTP ${r.status}${r.status === 403 ? " — falta scope yt-analytics" : ""}`, false); }
  catch (e) { add("YouTube Analytics (métricas)", false, e.message, false); }
}

async function checkGitHub() {
  // El PAT del que cuelga TODA la orquestacion (un workflow dispara al siguiente con gh workflow run).
  if (!GH_TOKEN) return add("GitHub Actions (orquestacion)", false, "sin GH_TOKEN", true);
  const repo = GITHUB_REPOSITORY || "juanberrio0399/video-forge";
  try {
    const r = await tf(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" } });
    if (r.status === 401) return add("GitHub Actions (orquestacion)", false, "PAT invalido/expirado — renuevalo (GH_TOKEN)", true);
    add("GitHub Actions (orquestacion)", r.ok, r.ok ? "PAT OK" : `HTTP ${r.status}`, true);
  } catch (e) { add("GitHub Actions (orquestacion)", false, e.name === "TimeoutError" ? "timeout" : e.message, true); }
}

await Promise.all([checkGeminiText(), checkPollinations(), checkPexels(), checkKokoro(), checkYouTube(), checkGitHub()]);
const down = tools.filter((t) => !t.ok);
fs.writeFileSync(out, JSON.stringify({ tools, ok: tools.length - down.length, total: tools.length, down: down.length, critical_down: down.filter((t) => t.critical).length, at: new Date().toISOString() }, null, 2));
console.log(`Herramientas: ${tools.length - down.length}/${tools.length} OK.`);
tools.forEach((t) => console.log(`  ${t.ok ? "✅" : "❌"} ${t.name}: ${t.detail}`));
if (down.length) fs.writeFileSync("tools_down.txt", down.map((t) => `${t.critical ? "🔴" : "🟡"} ${t.name}: ${t.detail}`).join("\n"));
