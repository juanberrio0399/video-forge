// hoy.mjs — la pantalla unica del bot: lo que te pide algo arriba, una linea por sistema y lo ultimo que paso.
// PURO y testeable. El Worker le pasa los pulses (Video Forge, Viento y Radar desde R2; Signal Halo en vivo
// por su canal interno) y esto arma exactamente lo que se pinta. No inventa datos: lo que falta sale como
// "sin señal" y cuenta para el estado.
import { applyStaleness } from "../pipeline/lib/os_contract.mjs";

export const HOY_SISTEMAS = [
  { id: "video-forge", name: "Video Forge", sigla: "VF", panel: "/p/video-forge" },
  { id: "signal-halo", name: "Signal Halo", sigla: "SH", panel: "/p/signal-halo" },
  { id: "viento", name: "Viento", sigla: "VI", panel: "/p/viento" },
  { id: "radar", name: "Radar", sigla: "RA", panel: "/p/radar" },
];
const RANK = { critical: 0, degraded: 1, attention: 2, normal: 3 };
const SEV = { critical: 0, warn: 1, info: 2 };
const corto = (x, n) => { const t = (x == null ? "" : String(x)).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

export function numero(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1e4) return Math.round(n / 1e3) + "k";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n * 10) / 10);
}

// Signal Halo publica su estado crudo (/api/pulso); aqui se vuelve un pulse con la misma forma que los demas.
export function pulsoSignalHalo(d, nowMs = Date.now()) {
  if (!d || !Array.isArray(d.videos)) return null;
  const vivos = d.videos.filter((v) => !v.borrado);
  const porUsar = vivos.filter((v) => v.estado === "listo");
  const pcs = (d.pcs || []).filter((p) => p.estado === "pendiente");
  const gb = (b) => Math.round((Number(b) || 0) / 1073741824 * 10) / 10;
  const needs = [];
  if (porUsar.length) needs.push({ id: "sh-por-usar", system: "signal-halo", title: porUsar.length === 1 ? "1 video por usar" : `${porUsar.length} videos por usar`, why: corto(porUsar[0].titulo, 60), severity: "warn", actions: [{ id: "abrir", label: "Ver", kind: "open" }], created_at: porUsar[porUsar.length - 1].subido });
  for (const p of pcs) needs.push({ id: `sh-pc-${p.id}`, system: "signal-halo", title: `${p.nombre} pide subir videos`, why: `Código ${String(p.codigo || "").slice(0, 3)} ${String(p.codigo || "").slice(3)}`, severity: "warn", actions: [{ id: "abrir", label: "Revisar", kind: "open" }], created_at: p.creado, ver: "pcs" });
  const lleno = d.limite ? d.uso / d.limite : 0;
  return {
    system: "signal-halo", name: "Signal Halo", at: new Date(nowMs).toISOString(),
    status: lleno >= 0.9 ? "critical" : needs.length ? "attention" : "normal",
    headline: porUsar.length ? (porUsar.length === 1 ? "1 por usar" : `${porUsar.length} por usar`) : "Nada por usar",
    needs,
    metrics: [{ key: "nube", label: "en la nube", value: gb(d.uso), unit: "GB", context: `de ${gb(d.limite)}` }],
    activity: vivos.slice(0, 6).map((v) => ({ at: v.subido, text: `subió “${corto(v.titulo, 46)}”` })),
  };
}

function lineaDe(id, p) {
  if (!p) return { linea: "Sin señal", der: "", derSub: "" };
  const m = (p.metrics || [])[0];
  return {
    linea: corto(p.headline || "Sin novedades", 46),
    der: m ? numero(m.value) + (m.unit ? " " + m.unit : "") : "",
    derSub: m ? corto(m.context || m.label || "", 18) : "",
  };
}

// pulses = { "video-forge": p, "signal-halo": p, viento: p, radar: p } (cualquiera puede faltar).
export function componerHoy(pulses, nowMs = Date.now()) {
  const sistemas = HOY_SISTEMAS.map((s) => {
    let p = pulses[s.id] || null;
    if (p && p.at && s.id !== "signal-halo") p = applyStaleness(p, nowMs);
    const status = !p ? "degraded" : p.stale ? "degraded" : p.status || "normal";
    return { ...s, status, stale: !p || !!p.stale, ...lineaDe(s.id, p), pulse: p };
  });
  const paraTi = sistemas.flatMap((s) => ((s.pulse && s.pulse.needs) || []).map((n) => ({
    id: n.id, system: s.id, sigla: s.sigla, title: corto(n.title, 60), detail: corto(n.why || n.evidence || "", 70),
    severity: n.severity || "warn", url: n.url || null, ver: n.ver || null,
    accion: ((n.actions || [])[0] || {}).label || "Ver", at: n.created_at || null,
  }))).sort((a, b) => (SEV[a.severity] - SEV[b.severity]) || (Date.parse(b.at || 0) - Date.parse(a.at || 0))).slice(0, 8);
  const sinSenal = sistemas.filter((s) => s.stale).map((s) => s.name);
  const peor = sistemas.map((s) => s.status).sort((a, b) => RANK[a] - RANK[b])[0] || "normal";
  const n = paraTi.length;
  const frase = n === 0 ? (sinSenal.length ? "Todo al día.\nSalvo un sistema callado." : "Todo al día.\nNada te espera.")
    : (n === 1 ? "1 cosa para ti." : `${n} cosas para ti.`) + (sinSenal.length ? "" : "\nLo demás va bien.");
  const funcionando = sistemas.length - sinSenal.length;
  const estado = sinSenal.length ? `Sin señal de ${sinSenal.join(", ")}` : `Los ${funcionando} sistemas funcionando`;
  const cifras = [];
  for (const s of sistemas) {
    const m = s.pulse && (s.pulse.metrics || [])[0];
    if (m && m.value != null && cifras.length < 3) cifras.push({ valor: numero(m.value) + (m.unit ? " " + m.unit : ""), label: corto(m.label, 20), sistema: s.sigla });
  }
  const actividad = sistemas.flatMap((s) => ((s.pulse && s.pulse.activity) || []).map((e) => ({ at: e.at, system: s.id, name: s.name, text: corto(e.text, 70) })))
    .filter((e) => Number.isFinite(Date.parse(e.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);
  const cuerpo = {
    status: peor, frase, estado, cifras, paraTi, actividad,
    sistemas: sistemas.map(({ pulse, ...s }) => ({ ...s, needs: ((pulse && pulse.needs) || []).length, metrics: (pulse && pulse.metrics) || [], headline: (pulse && pulse.headline) || "", sub: (pulse && pulse.sub) || "" })),
  };
  return { at: new Date(nowMs).toISOString(), version: huella(cuerpo), ...cuerpo };
}

// Huella corta del contenido: la app solo repinta si cambio algo (no parpadea con cada consulta).
export function huella(o) {
  const s = JSON.stringify(o);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
