// channel_brain.mjs — EL CEREBRO de los canales. Revisa la salud de Oddly y Data Lens,
// mide QUE rinde (por direccion en Data Lens), y ESCALA a "reestructurar" si un canal sigue
// estancado tras suficientes PRUEBAS. Filosofia: probar en pequeno -> medir -> escalar al
// ganador -> si nada rinde, reestructurar (nunca producir masivo sin probar).
//
// Uso: node pipeline/channel_brain.mjs   (lee dl_state.json, oddly_state.json, channel/direction.json)
// Salida: brain.txt (resumen para Telegram) + brain.json (verdictos).
import fs from "node:fs";
import { MONET_GOALS } from "./lib/monetization.mjs";
import { decidirVolumen } from "./lib/volumen_util.mjs";
import { evaluarMuestra, cobertura, lineaAviso } from "./lib/muestra.mjs";
import { pausaDe, decideSobre, lineaPausa } from "./lib/enfoque.mjs";

const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const dl = rj("dl_state.json", {});
const od = rj("oddly_state.json", {});
const dir = rj("channel/direction.json", null) || rj("direction.json", null);

// ENFOQUE: el Cerebro decide solo sobre Oddly. La pausa de Data Lens ya estaba en el ledger
// (la escribe brain_live); aqui simplemente se respeta, en vez de seguir emitiendo veredictos
// y acciones de un canal pausado. Sus metricas se siguen mostrando.
const ledger = rj("ledger.json", []);
const dlPausa = pausaDe(ledger, "data-lens");
const dlDecide = decideSobre(ledger, "data-lens");

const now = Date.now();
const days = (iso) => (iso ? Math.max(1, (now - Date.parse(iso)) / 86400000) : 1);

// ---- TENDENCIA SEMANA A SEMANA (de weekly_stats.json; la llena weekly_stats.yml) ----
// El Cerebro ahora TAMBIEN mira vistas/likes/subs semana contra semana, usando solo
// semanas COMPLETAS (la semana en curso va parcial por el retraso de Analytics de 2-3 dias).
const weekly = rj("weekly_stats.json", null);
function weekTrend(chKey) {
  const c = weekly && weekly.channels && weekly.channels[chKey];
  if (!c || !Array.isArray(c.weeks) || c.weeks.length < 2) return null;
  const full = c.weeks.filter((w) => (w.days || 7) >= 7);
  const use = full.length >= 2 ? full : c.weeks;
  const last = use[use.length - 1], prev = use[use.length - 2];
  const dv = (last.views || 0) - (prev.views || 0);
  const pct = prev.views ? Math.round((dv / prev.views) * 100) : 0;
  const twoDown = use.length >= 3 && (use[use.length - 1].views || 0) < (use[use.length - 2].views || 0) && (use[use.length - 2].views || 0) < (use[use.length - 3].views || 0);
  const tag = pct <= -25 ? `⚠️ cayó ${Math.abs(pct)}%` : pct >= 25 ? `⬆️ subió ${pct}%` : `➡️ estable (${pct >= 0 ? "+" : ""}${pct}%)`;
  return { week: last.week, views: last.views || 0, prev_views: prev.views || 0, delta_pct: pct, likes: last.likes || 0, subs_net: (last.subs_net != null ? last.subs_net : null), two_down: twoDown, tag };
}
function trendLine(t) {
  if (!t) return "📈 semana a semana: (aún juntando historial, ~1 semana)";
  const eng = (t.likes ? ` · ❤ ${t.likes}` : "") + (t.subs_net != null ? ` · ${t.subs_net >= 0 ? "+" : ""}${t.subs_net} subs` : "");
  return `📈 última semana: ${t.views.toLocaleString()} vistas ${t.tag} (vs ${t.prev_views.toLocaleString()})${eng}${t.two_down ? " · 📉 2 semanas a la baja — REVISAR" : ""}`;
}
const odTrend = weekTrend("oddly");
const dlTrend = weekTrend("data_lens");

// ---------------- ODDLY LOOP ----------------
const odSubs = +od.subs || 0, odViews = +od.total_views || 0, odVids = +od.videos || 0;
const odRank = (od.niche_ranking || []).slice().sort((a, b) => (b.avg_vpd || 0) - (a.avg_vpd || 0));
const odTop = odRank[0] || null;
// El veredicto de Oddly sale del RENDIMIENTO, no de tener suscriptores.
//
// Antes la condicion de "sano" era `(odTop && odTop.avg_vpd >= 20) || odSubs > 0`. Ese
// `|| odSubs > 0` hacia que cualquier canal con UN suscriptor saliera 🟢 sano para siempre,
// y dejaba la rama de "estancado" inalcanzable. Por eso Oddly se reportaba sano con 67 subs
// y 46 vistas por video (2026-10-03).
//
// Tambien se exige MUESTRA: el nicho que "gana" no significa nada si se midio con 2 videos.
const odNicho = odTop ? evaluarMuestra(odTop.n ?? odTop.videos ?? 0, { que: "videos del nicho" }) : evaluarMuestra(0, { que: "videos del nicho" });
const odVistasPorVideo = odVids ? odViews / odVids : 0;
const VPV_SANO = 100;   // vistas acumuladas por video que separan "vivo" de "no lo ve nadie"

let odVerdict, odMsg;
if (odVids < 10) {
  odVerdict = "🟡 arrancando";
  odMsg = `${odVids} videos, faltan datos.`;
} else if (odTop && odTop.avg_vpd >= 20 && odNicho.suficiente) {
  odVerdict = "🟢 sano";
  odMsg = `${odSubs} subs · ${odViews.toLocaleString()} vistas · gana ${odTop.label} (${odTop.avg_vpd}/dia, n${odNicho.n}).`;
} else if (odTop && odTop.avg_vpd >= 20 && !odNicho.suficiente) {
  odVerdict = "🟡 sin muestra";
  odMsg = `${odSubs} subs · ${odViews.toLocaleString()} vistas · «${odTop.label}» va ${odTop.avg_vpd}/dia pero ${odNicho.aviso} — todavia no es un ganador.`;
} else {
  odVerdict = "🔴 estancado";
  odMsg = `${odSubs} subs · ${odVids} videos · ${Math.round(odVistasPorVideo)} vistas por video acumuladas — nada despega, revisar FORMATO.`;
}

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
// Oddly empuja contra SU meta del año (nivel intermedio desde 2026-09-14), no contra la completa.
const OD_T = Object.fromEntries(MONET_GOALS.auto2.targets.map((t) => [t.key, t.target]));
const OD_SUBS_T = OD_T.subs || 1000, OD_VIEWS_T = OD_T.shorts_views_90d || 10000000;
const dlViews = +((dl.channel_stats || {}).total_views ?? (dl.monetization || {}).views) || 0;
// ¿Mas volumen sirve, o hay que cambiar el formato? Antes esto era una regla fija
// ("Oddly va atras -> 12/dia"). Medido el 2026-10-03: 518 videos, 67 subs, mediana de
// 46 vistas por Short. A 12/dia faltaria ~200x para la meta, asi que subir la cadencia
// solo multiplica videos que nadie ve. La decision ahora sale de la aritmetica.
const odVol = decidirVolumen({
  vistasTotales: odViews, videos: odVids, metaVistas: OD_VIEWS_T, diasRestantes: daysLeft,
});

const monetLine = (subs, views, viewsTarget, subsTarget = 1000) => {
  const subPace = (Math.max(0, subsTarget - subs) / daysLeft).toFixed(1);
  const vPace = Math.ceil(Math.max(0, viewsTarget - views) / daysLeft);
  const ok = subs >= subsTarget && views >= viewsTarget;
  return `💰 meta fin-2026 (${daysLeft}d): subs ${subs}/${subsTarget} (~${subPace}/día) · vistas ${views.toLocaleString()}/${viewsTarget.toLocaleString()} (~${vPace.toLocaleString()}/día) ${ok ? "✅ elegible" : "🔴 hay que empujar"}`;
};

const lines = [
  "🧠 CEREBRO — salud de los canales",
  "",
  `📺 Oddly Loop: ${odVerdict}`,
  `   ${odMsg}`,
  `   ${trendLine(odTrend)}`,
  `   ${monetLine(odSubs, odViews, OD_VIEWS_T, OD_SUBS_T)}`,
  "",
  // Pausado: se muestran las METRICAS (Juan quiere verlas) pero sin veredicto, sin
  // direcciones a escalar y sin presion de meta — nada de eso aplica a un canal en pausa.
  ...(dlDecide
    ? [
        `📊 The Data Lens: ${dlVerdict}`,
        `   ${dlMsg}`,
        `   ${trendLine(dlTrend)}`,
        `   direcciones: ${dirLine}`,
        `   ${monetLine(dlSubs, dlViews, 200000)}`,
      ]
    : [
        `📊 The Data Lens (solo métricas, fuera del foco)`,
        `   ${dlSubs} subs · ${dlVids} videos · ${dlViews.toLocaleString()} vistas`,
        `   ${trendLine(dlTrend)}`,
        `   ${lineaPausa(dlPausa)}`,
      ]),
];
// Honestidad sobre cuanto se sabe: si la muestra no da, se dice ANTES de que alguien actue
// sobre un veredicto sacado de cuatro datos.
const ret = rj("retention_auto2.json", null);
const avisos = [];
if (!odNicho.suficiente && odVids >= 10) avisos.push(`ranking de nichos con ${odNicho.n} video(s) medidos`);
if (ret && Array.isArray(ret.videos)) {
  const cur = ret.videos.filter((v) => v && (v.curve || v.points || v.early_drop_pct != null)).length;
  const c = cobertura(cur, ret.videos.length, { que: "curva de retencion" });
  if (c.aviso) avisos.push(c.aviso);
}
const avisoMuestra = lineaAviso(avisos);
if (avisoMuestra) lines.push("", avisoMuestra);

if (odVol.reestructurar) lines.push("", `⚠️ ACCION: Oddly necesita REESTRUCTURA de formato, no mas volumen. ${odVol.razon}.`);
if (restructure && dlDecide) lines.push("", "⚠️ ACCION: The Data Lens necesita REESTRUCTURA. Dile a Claude: «reestructura Data Lens con direcciones nuevas».");

// REGLA DURA: la fecha NO se mueve. Si un canal va atrás, se ESCALA la agresividad (no se alarga el plazo).
// El ritmo/día necesario ya sube solo cada día que pasa (need / daysLeft con deadline fijo).
lines.push("", "🎯 Meta fin-2026 FIJA — no se alarga. Si un canal va atrás se ESCALA, pero el CÓMO sale de los datos: más volumen solo si las vistas POR VIDEO que ya tiene alcanzan la meta; si no alcanzan ni produciendo al máximo, el problema es el formato y se reestructura (hoy el foco del Cerebro es Oddly; Data Lens esta en pausa y solo se mide). El ritmo/día necesario sube solo con cada día que pasa.");
// Señal para el optimizador: cuánta agresividad de volumen empujar en Oddly (a mayor brecha vs meta, más).
const odSubsPerDay = +(Math.max(0, OD_SUBS_T - odSubs) / daysLeft).toFixed(2);
const odViewsPerDay = Math.ceil(Math.max(0, OD_VIEWS_T - odViews) / daysLeft);
const odGap = odSubs >= OD_SUBS_T && odViews >= OD_VIEWS_T ? 0 : 1;   // aún no elegible -> empujar

const aggressiveness = {
  at: new Date().toISOString(), deadline: "2026-12-31", deadline_fixed: true, days_left: daysLeft,
  oddly: { behind: !!odGap, subs: odSubs, subs_per_day_needed: odSubsPerDay, views_per_day_needed: odViewsPerDay,
           cadence_total: odVol.cadencia,
           views_per_video: +odVol.vistasPorVideo.toFixed(1),
           views_per_video_needed: Math.round(odVol.vistasPorVideoNecesarias),
           volume_works: odVol.volumenSirve,
           restructure: odVol.reestructurar,
           note: odVol.razon },
  data_lens: dlDecide
    ? { behind: dlSubs < 1000, note: restructure ? "reestructurar formato (el volumen no arregla 0 vistas)" : "medir" }
    // En pausa: ninguna accion. `paused` es la señal para quien consuma esto.
    : { paused: true, since: dlPausa && dlPausa.at, review_at: dlPausa && dlPausa.review_at, note: "fuera del foco del Cerebro; solo se miden metricas" },
};
fs.writeFileSync("aggressiveness.json", JSON.stringify(aggressiveness, null, 2));

fs.writeFileSync("brain.txt", lines.join("\n"));
fs.writeFileSync("brain.json", JSON.stringify({
  at: new Date().toISOString(),
  text: lines.join("\n"),
  oddly: { verdict: odVerdict, msg: odMsg, subs: odSubs, views: odViews, videos: odVids },
  data_lens: { verdict: dlVerdict, msg: dlMsg, restructure, subs: dlSubs, videos: dlVids, byDir },
  weekly: { oddly: odTrend, data_lens: dlTrend },
}, null, 2));
console.log(lines.join("\n"));
