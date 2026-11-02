// renombrar_repetidos_oddly.mjs — renombra los títulos repetidos que ya están en Oddly Loop.
//
// Por defecto es un ENSAYO: lee el canal, arma el plan, escribe los títulos nuevos y no cambia
// nada en YouTube. Con APLICAR=1 los aplica (videos.update, 50 unidades de cuota cada uno).
//
// - En cada grupo conserva su título el video con más vistas; los demás reciben uno nuevo de la
//   IA, revisado con las mismas reglas del guionista (no repetido, en pregunta).
// - Solo cambia el título: descripción, tags, categoría e idiomas se reenvían tal cual.
// - MAX limita cuántos renombra por corrida (cuota diaria compartida con las subidas).
// - Cada cambio queda en HIST (renombres.json, el workflow lo guarda en R2) para poder deshacerlo.
//
// Uso: APLICAR=0|1 MAX=20 HIST=renombres.json node pipeline/renombrar_repetidos_oddly.mjs

import fs from "node:fs";
import { genText } from "./llm.mjs";
import { revisar } from "./lib/titulos.mjs";
import { agruparRepetidos, conHashtags } from "./lib/repetidos.mjs";

const APLICAR = process.env.APLICAR === "1";
const MAX = Math.max(0, parseInt(process.env.MAX || "20", 10) || 0);
const HIST = process.env.HIST || "renombres.json";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) { console.error("Faltan secrets YT_*"); process.exit(1); }

async function getAccessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error("token:", j.error || "sin access_token"); process.exit(1); }
  return j.access_token;
}
const token = await getAccessToken();

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
}

// 1) Todos los videos del canal, con vistas y snippet completo.
const ch = await api("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true");
const uploads = ch.items[0].contentDetails.relatedPlaylists.uploads;
const ids = [];
let page = "";
do {
  const j = await api(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&pageToken=${page}`);
  for (const it of j.items || []) ids.push(it.contentDetails.videoId);
  page = j.nextPageToken || "";
} while (page && ids.length < 5000);
const unicos = [...new Set(ids)];

const videos = [];
for (let i = 0; i < unicos.length; i += 50) {
  const j = await api(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${unicos.slice(i, i + 50).join(",")}`);
  for (const v of j.items || []) {
    videos.push({ id: v.id, title: v.snippet.title, views: Number(v.statistics?.viewCount || 0), publishedAt: v.status?.publishAt || v.snippet.publishedAt, privacy: v.status?.privacyStatus, snippet: v.snippet });
  }
}
const grupos = agruparRepetidos(videos);
const pendientes = grupos.reduce((n, g) => n + g.renombrar.length, 0);
console.log(`Canal: ${videos.length} videos. ${grupos.length} títulos repetidos en ${grupos.reduce((n, g) => n + g.renombrar.length + 1, 0)} videos; ${pendientes} por renombrar.`);

// 2) Título nuevo para cada uno (hasta MAX), sin chocar con ningún título del canal ni con los nuevos.
const usados = videos.map((v) => v.title);
const prompt = (v, otros, queja) => `You rename a YouTube Short on "Oddly Loop" (satisfying / cute animals / ASMR compilations).
Its current title is ALSO used by other videos on the channel, so it needs a NEW, DIFFERENT title for the SAME video.

Current title: ${v.title}
Description (start): ${String(v.snippet.description || "").slice(0, 500)}
Tags: ${(v.snippet.tags || []).slice(0, 15).join(", ")}

Rules:
- English, max 70 characters, no hashtags, no emojis.
- A concrete question about what the viewer sees ("Why does...?", "How do...?", "What happens when...?").
- Must NOT match any of these titles: ${otros.slice(0, 40).map((t) => JSON.stringify(t)).join("; ")}
- Honest: only claim what the description/tags support. No fake clickbait.
${queja ? `\nYour previous attempt was rejected: ${queja}\n` : ""}
Reply ONLY with JSON: {"title": "..."}`;

async function tituloNuevo(v, grupo) {
  const otros = [grupo.titulo, ...usados.filter((t) => t !== grupo.titulo).slice(-60)];
  let queja = null, ultimo = null;
  for (let intento = 0; intento < 3; intento++) {
    const raw = await genText(prompt(v, otros, queja));
    let t = null;
    try { t = JSON.parse(String(raw || "").replace(/^```(json)?|```$/g, "").trim()).title; } catch {}
    if (!t) { queja = "Reply with valid JSON only."; continue; }
    const nuevo = conHashtags(t, v.title);
    const c = revisar(nuevo, usados, { prohibirGenerico: false, exigirPregunta: true });
    if (c.ok) return nuevo;
    if (c.motivo === "no_pregunta") ultimo = nuevo;   // no es pregunta pero sí es nuevo: sirve de respaldo
    queja = c.queja;
  }
  return ultimo && revisar(ultimo, usados, { prohibirGenerico: false }).ok ? ultimo : null;
}

const plan = [];
for (const g of grupos) {
  for (const v of g.renombrar) {
    if (plan.length >= MAX) break;
    const nuevo = await tituloNuevo(v, g);
    plan.push({ id: v.id, privacy: v.privacy, views: v.views, antes: v.title, despues: nuevo, conserva: g.conserva.id });
    if (nuevo) usados.push(nuevo);
  }
}

// 3) Aplicar (o solo mostrar).
let hechos = 0;
const hist = (() => { try { return JSON.parse(fs.readFileSync(HIST, "utf8")); } catch { return []; } })();
for (const p of plan) {
  if (!p.despues) { p.estado = "sin título válido"; continue; }
  if (!APLICAR) { p.estado = "ensayo"; continue; }
  const v = videos.find((x) => x.id === p.id);
  const s = v.snippet;
  const snippet = { title: p.despues, description: s.description || "", tags: s.tags || [], categoryId: s.categoryId };
  if (s.defaultLanguage) snippet.defaultLanguage = s.defaultLanguage;
  if (s.defaultAudioLanguage) snippet.defaultAudioLanguage = s.defaultAudioLanguage;
  try {
    await api("https://www.googleapis.com/youtube/v3/videos?part=snippet", { method: "PUT", body: JSON.stringify({ id: p.id, snippet }) });
    p.estado = "renombrado";
    hechos++;
    hist.push({ id: p.id, antes: p.antes, despues: p.despues, at: new Date().toISOString() });
  } catch (e) {
    p.estado = `error: ${e.message.slice(0, 120)}`;
    if (/quota/i.test(e.message)) { console.error("Cuota de YouTube agotada: paro aquí."); break; }
  }
}
fs.writeFileSync(HIST, JSON.stringify(hist, null, 2));
fs.writeFileSync("renombres_plan.json", JSON.stringify({ at: new Date().toISOString(), aplicar: APLICAR, grupos: grupos.length, pendientes, plan }, null, 2));

const lineas = plan.map((p) => `- [${p.estado}] ${p.id} (${p.views} vistas, ${p.privacy}): "${p.antes}" → ${p.despues ? `"${p.despues}"` : "—"}`);
const resumen = `${APLICAR ? "Renombrados" : "ENSAYO, nada cambió en YouTube"}: ${APLICAR ? hechos : plan.filter((p) => p.despues).length} de ${plan.length} (quedan ${pendientes - (APLICAR ? hechos : 0)} repetidos por renombrar en ${grupos.length} grupos).`;
console.log(resumen + "\n" + lineas.join("\n"));
fs.writeFileSync("renombres_resumen.txt", resumen);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Títulos repetidos de Oddly\n\n${resumen}\n\n${lineas.join("\n")}\n`);
