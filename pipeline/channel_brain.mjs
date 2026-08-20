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

// ---------------- THE DATA LENS ----------------
// Direccion del experimento por heuristica de titulo (para medir cual jala).
function dlDir(t) {
  t = (t || "").toLowerCase();
  if (/ranked|ranking| vs |compared/.test(t)) return "rankings";
  if (/average person|you'll (spend|waste)|your daily|how many hours you|of your life|checks their phone/.test(t)) return "relatable";
  if (/trillion|actually looks like|drained|to scale|how (big|much|fast|far) is/.test(t)) return "escala";
  return "otros";
}
const dlSubs = +((dl.channel_stats || {}).subs ?? (dl.monetization || {}).subs) || 0;
const dlVids = +((dl.channel_stats || {}).videos) || (dl.published || []).length;
const pivotAt = dir && dir.pivot_at ? Date.parse(dir.pivot_at) : null;
const pubs = (dl.published || []).filter((v) => v.privacy === "public");
const post = pivotAt ? pubs.filter((v) => v.published_at && Date.parse(v.published_at) >= pivotAt) : [];
const byDir = {};
for (const v of post) {
  const d = dlDir(v.title);
  const vpd = ((v.stats && v.stats.views) || v.views || 0) / days(v.published_at);
  byDir[d] = byDir[d] || { n: 0, vpd: 0 };
  byDir[d].n++; byDir[d].vpd += vpd;
}
const dirLine = Object.entries(byDir).map(([k, d]) => `${k} ${(d.vpd / d.n).toFixed(1)}/d (${d.n})`).join(" · ") || "(sin videos del experimento aun)";

let dlVerdict, dlMsg, restructure = false;
const MIN_TEST = 6;    // videos minimos del experimento antes de juzgar
const VETA = 10;       // vpd que consideramos "hay veta"
if (!pivotAt || post.length < MIN_TEST) {
  dlVerdict = "🟡 en prueba";
  dlMsg = `pivote nuevo · ${post.length}/${MIN_TEST} videos del experimento — esperando datos (~1-2 semanas). No producir masivo hasta ver que jala.`;
} else {
  const best = Object.entries(byDir).map(([k, d]) => ({ k, vpd: d.vpd / d.n })).sort((a, b) => b.vpd - a.vpd)[0];
  if (best && best.vpd >= VETA) {
    dlVerdict = "🟢 encontro veta";
    dlMsg = `gana «${best.k}» (${best.vpd.toFixed(1)}/dia) — hay que ESCALAR esa direccion y cortar las otras.`;
  } else {
    dlVerdict = "🔴 REESTRUCTURAR";
    dlMsg = `probamos las 3 direcciones y NINGUNA despega. Toca reestructurar con formatos nuevos.`;
    restructure = true;
  }
}

const lines = [
  "🧠 CEREBRO — salud de los canales",
  "",
  `📺 Oddly Loop: ${odVerdict}`,
  `   ${odMsg}`,
  "",
  `📊 The Data Lens: ${dlVerdict}`,
  `   ${dlMsg}`,
  `   direcciones: ${dirLine}`,
];
if (restructure) lines.push("", "⚠️ ACCION: The Data Lens necesita REESTRUCTURA. Dile a Claude: «reestructura Data Lens con direcciones nuevas».");

fs.writeFileSync("brain.txt", lines.join("\n"));
fs.writeFileSync("brain.json", JSON.stringify({
  oddly: { verdict: odVerdict, subs: odSubs, views: odViews },
  data_lens: { verdict: dlVerdict, restructure, subs: dlSubs, videos: dlVids, byDir },
}, null, 2));
console.log(lines.join("\n"));
