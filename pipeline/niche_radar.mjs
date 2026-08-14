// niche_radar.mjs — RADAR DE NICHOS del canal automático #2.
// Cada semana agrupa los videos por NICHO, los ranquea por rendimiento (vistas/video +
// retención + subs) y recomienda por nicho: SEGUIR / ESCALAR / PIVOTAR — así sabemos si
// seguimos con lo mismo o cambiamos. Scaffolding: si el canal auto aún no publica (sin
// YT2 OAuth o sin niche_map), deja el portafolio y estado "recolectando datos".
//
// Uso: node pipeline/niche_radar.mjs <radar_in.json> <radar_out.json>
// Env: GEMINI_API_KEY (recomendación IA), YT2_CLIENT_ID/SECRET/REFRESH (canal auto, opcional)
//      niche_map.json (mapa video_id -> nicho, lo escribe la producción del canal auto)
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [inPath, outPath = "niche_radar.json"] = process.argv.slice(2);
const { GEMINI_API_KEY, YT2_CLIENT_ID, YT2_CLIENT_SECRET, YT2_REFRESH_TOKEN } = process.env;
const tf = (u, o = {}, ms = 10000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

let radar = {};
try { radar = JSON.parse(fs.readFileSync(inPath, "utf8")); } catch {}
radar.portfolio = Array.isArray(radar.portfolio) ? radar.portfolio : [];

// --- Recolectar rendimiento por nicho (requiere el canal auto: YT2 OAuth + niche_map) ---
async function collect() {
  if (!YT2_REFRESH_TOKEN || !fs.existsSync("niche_map.json")) return null;
  let map = {};
  try { map = JSON.parse(fs.readFileSync("niche_map.json", "utf8")); } catch { return null; }
  const ids = Object.keys(map);
  if (!ids.length) return null;
  try {
    const t = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT2_CLIENT_ID, client_secret: YT2_CLIENT_SECRET, refresh_token: YT2_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
    const token = t.access_token; if (!token) return null;
    const H = { Authorization: `Bearer ${token}` };
    const byNiche = {};
    for (let i = 0; i < ids.length; i += 50) {
      const j = await (await tf(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
      for (const v of j.items || []) {
        const nk = map[v.id]; if (!nk) continue;
        const b = byNiche[nk] || (byNiche[nk] = { key: nk, videos: 0, views: 0 });
        b.videos++; b.views += +((v.statistics || {}).viewCount || 0);
      }
    }
    const rows = Object.values(byNiche).map((b) => ({ ...b, avg_views: b.videos ? Math.round(b.views / b.videos) : 0 }));
    return rows.length ? rows.sort((a, b) => b.avg_views - a.avg_views) : null;
  } catch { return null; }
}

// --- Recomendación IA por nicho (SEGUIR/ESCALAR/PIVOTAR) ---
async function gemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  for (const m of TEXT_MODELS) {
    try {
      const r = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      if (!r.ok) continue;
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return t.trim();
    } catch {}
  }
  return null;
}

const perf = await collect();
if (!perf) {
  radar.ranking = [];
  radar.recommendation = "Aún sin datos del canal automático. El radar se activa cuando publique: ahí ranquea los nichos por vistas/video y recomienda seguir, escalar o pivotar cada semana.";
  radar.updated_at = new Date().toISOString();
  fs.writeFileSync(outPath, JSON.stringify(radar, null, 2));
  console.log("Radar de nichos: recolectando datos (scaffolding, sin publicaciones aún).");
  process.exit(0);
}

// Etiquetar cada nicho con su label del portafolio y ordenar.
const lbl = Object.fromEntries(radar.portfolio.map((p) => [p.key, p.label]));
radar.ranking = perf.map((r, i) => ({ rank: i + 1, key: r.key, label: lbl[r.key] || r.key, videos: r.videos, views: r.views, avg_views: r.avg_views }));

const brief = radar.ranking.map((r) => `${r.rank}. ${r.label}: ${r.avg_views} vistas/video (${r.videos} videos)`).join("\n");
const rec = await gemini(`Radar de nichos de un canal faceless automático. Rendimiento esta semana:\n${brief}\n\nEn 2-3 frases: ¿qué nicho ESCALAR (dobla esfuerzo), cuál MANTENER y cuál PIVOTAR (cambiar por uno nuevo)? Concreto y accionable.`);
radar.recommendation = rec || `El nicho líder es "${radar.ranking[0].label}". Escala ese; revisa el último.`;
radar.updated_at = new Date().toISOString();
fs.writeFileSync(outPath, JSON.stringify(radar, null, 2));
console.log("Radar de nichos actualizado:\n" + brief + "\n→ " + radar.recommendation);
