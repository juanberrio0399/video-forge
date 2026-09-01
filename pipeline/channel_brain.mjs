// channel_brain.mjs — EL CEREBRO de los canales. Revisa la salud de Oddly y Data Lens,
// mide QUE rinde (por direccion en Data Lens), y ESCALA a "reestructurar" si un canal sigue
// estancado tras suficientes PRUEBAS. Filosofia: probar en pequeno -> medir -> escalar al
// ganador -> si nada rinde, reestructurar (nunca producir masivo sin probar).
//
// Uso: node pipeline/channel_brain.mjs   (lee dl_state.json, oddly_state.json, channel/direction.json)
// Salida: brain.txt (resumen para Telegram) + brain.json (verdictos).
import fs from "node:fs";

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const dl = rj("dl_state.json", {});
const od = rj("oddly_state.json", {});
const dir = rj("channel/direction.json", null) || rj("direction.json", null);

const now = Date.now();
const days = (iso) => (iso ? Math.max(1, (now - Date.parse(iso)) / 86400000) : 1);

// ---------------- ODDLY LOOP ----------------
const odSubs = +od.subs || 0, odViews = +od.total_views || 0, odVids = +od.videos || 0;
const odRank = (od.niche_ranking || []).slice().sort((a, b) => (b.avg_vpd || 0) - (a.avg_vpd || 0));
const odTop = odRank[0] || null;
let odVerdict, odMsg;
if (odVids < 10) { odVerdict = "🟡 arrancando"; odMsg = `${odVids} videos, faltan datos.`; }
else if ((odTop && odTop.avg_vpd >= 20) || odSubs > 0) { odVerdict = "🟢 sano"; odMsg = `${odSubs} subs · ${odViews.toLocaleString()} vistas · gana ${odTop ? odTop.label + " (" + odTop.avg_vpd + "/dia)" : "?"}.`; }
else { odVerdict = "🔴 estancado"; odMsg = `${odVids} videos y nada despega — revisar formato.`; }

// ---------------- THE DATA LENS (canal de HISTORIA) ----------------
// Mide por CATEGORIA (guerras/inventos/personajes) con stats EN VIVO de los video_id del mapa
// (channel/history_map.json). Solo cuentan los Shorts PUBLICOS (los privados no tienen vistas).
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const histMap = rj("history_map.json", []);
const dlSubs = +((dl.channel_stats || {}).subs ?? (dl.monetization || {}).subs) || 0;
const dlVids = +((dl.channel_stats || {}).videos) || (dl.published || []).length;

async function ytToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  return (await r.json()).access_token;
}
const MATURE_DAYS = 5; // un Short necesita varios días publicos para medir de verdad (YouTube Analytics va 2-3 dias atras)
const byDir = {};
let nTest = 0, inmaduros = 0;
if (Array.isArray(histMap) && histMap.length && YT_REFRESH_TOKEN) {
  try {
    const token = await ytToken();
    const ids = [...new Set(histMap.map((x) => x.video_id).filter(Boolean))];
    const st = {};
    for (let i = 0; i < ids.length; i += 50) {
      const j = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,status&id=${ids.slice(i, i + 50).join(",")}`, { headers: { Authorization: `Bearer ${token}` } })).json();
      for (const v of j.items || []) st[v.id] = { views: +((v.statistics || {}).viewCount) || 0, pub: (v.snippet || {}).publishedAt, priv: (v.status || {}).privacyStatus };
    }
    for (const m of histMap) {
      const s = st[m.video_id]; if (!s || s.priv !== "public" || !s.pub) continue;
      const age = (now - Date.parse(s.pub)) / 86400000;
      if (age < MATURE_DAYS) { inmaduros++; continue; } // muy nuevo -> aún no mide (Analytics va 2-3 días atrás); no cuenta para el veredicto
      const k = m.direction || "otros";
      byDir[k] = byDir[k] || { n: 0, vpd: 0, views: 0 };
      byDir[k].n++; byDir[k].vpd += s.views / days(s.pub); byDir[k].views += s.views;
    }
    nTest = Object.values(byDir).reduce((s, d) => s + d.n, 0);
  } catch (e) { console.error("stats historia:", e.message); }
}
const dirLabel = { guerras_imperios: "Guerras/Imperios", inventos_ideas: "Inventos/Ideas", personajes_momentos: "Personajes/Momentos" };
const dirLine = Object.entries(byDir).map(([k, d]) => `${dirLabel[k] || k} ${(d.vpd / d.n).toFixed(1)}/d (${d.n})`).join(" · ") || "(sin Shorts publicos del experimento aun)";

let dlVerdict, dlMsg, restructure = false;
const MIN_TEST = 9;    // ~3 por categoria antes de juzgar
const VETA = 8;        // vpd que consideramos "hay veta" en Shorts nuevos
if (nTest < MIN_TEST) {
  dlVerdict = "🟡 en prueba";
  dlMsg = `experimento de Historia · ${nTest}/${MIN_TEST} Shorts MADUROS (≥${MATURE_DAYS}d) medidos${inmaduros ? ` · ${inmaduros} aun nuevos, madurando` : ""} — juntando datos (~1-2 semanas). Los recien publicados necesitan varios dias antes de contar (Analytics va 2-3 dias atras).`;
} else {
  const best = Object.entries(byDir).map(([k, d]) => ({ k, vpd: d.vpd / d.n })).sort((a, b) => b.vpd - a.vpd)[0];
  if (best && best.vpd >= VETA) {
    dlVerdict = "🟢 encontro veta";
    dlMsg = `gana «${dirLabel[best.k] || best.k}» (${best.vpd.toFixed(1)}/dia) — ESCALAR esa categoria y cortar las otras.`;
  } else {
    dlVerdict = "🔴 REESTRUCTURAR";
    dlMsg = `probamos las categorias y NINGUNA despega. Toca cambiar el formato/gancho.`;
    restructure = true;
  }
}

// ---- META DE MONETIZACION (fin 2026) + AGRESIVIDAD ----
// Cuánto/día hace falta de subs y vistas para cumplir YPP antes del 31-dic → qué tan fuerte empujar.
const DEADLINE = Date.parse("2026-12-31T23:59:59Z");
const daysLeft = Math.max(1, Math.ceil((DEADLINE - now) / 86400000));
const dlViews = +((dl.channel_stats || {}).total_views ?? (dl.monetization || {}).views) || 0;
const monetLine = (subs, views, viewsTarget) => {
  const subPace = (Math.max(0, 1000 - subs) / daysLeft).toFixed(1);
  const vPace = Math.ceil(Math.max(0, viewsTarget - views) / daysLeft);
  const ok = subs >= 1000 && views >= viewsTarget;
  return `💰 meta fin-2026 (${daysLeft}d): subs ${subs}/1000 (~${subPace}/día) · vistas ${views.toLocaleString()}/${viewsTarget.toLocaleString()} (~${vPace.toLocaleString()}/día) ${ok ? "✅ elegible" : "🔴 hay que empujar"}`;
};

const lines = [
  "🧠 CEREBRO — salud de los canales",
  "",
  `📺 Oddly Loop: ${odVerdict}`,
  `   ${odMsg}`,
  `   ${monetLine(odSubs, odViews, 10000000)}`,
  "",
  `📊 The Data Lens: ${dlVerdict}`,
  `   ${dlMsg}`,
  `   direcciones: ${dirLine}`,
  `   ${monetLine(dlSubs, dlViews, 200000)}`,
];
if (restructure) lines.push("", "⚠️ ACCION: The Data Lens necesita REESTRUCTURA. Dile a Claude: «reestructura Data Lens con direcciones nuevas».");

fs.writeFileSync("brain.txt", lines.join("\n"));
fs.writeFileSync("brain.json", JSON.stringify({
  at: new Date().toISOString(),
  text: lines.join("\n"),
  oddly: { verdict: odVerdict, msg: odMsg, subs: odSubs, views: odViews, videos: odVids },
  data_lens: { verdict: dlVerdict, msg: dlMsg, restructure, subs: dlSubs, videos: dlVids, byDir },
}, null, 2));
console.log(lines.join("\n"));
