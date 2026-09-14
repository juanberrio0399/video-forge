// brain_live.mjs — CEREBRO EN VIVO de Oddly Loop (corre cada 2 horas, 24/7).
// 1) Revisa las decisiones vencidas del ledger contra su propio criterio (autocrítica).
// 2) Rehace el plan de HOY (lo que queda) y de MAÑANA con lo último que sabe.
// 3) Elige qué producir AHORA con margen (nunca a última hora) y deja las órdenes en produce_now.txt.
// 4) Escribe la bitácora de lo que pensó y cambió.
// Entradas (las baja el workflow): decision.json, cadence.json, best_hours.json, bank.json, state.json,
//   aggr.json, views_at_age.json, monet.json, hyps.json, claims.json, lineup_prev.json, journal.json, ledger.json
// Salidas: lineup.json, journal.json, ledger.json, claims.json, produce_now.txt (niche|variant|slot|idea)
import fs from "node:fs";
import { buildLineup, pickToProduce, diffLineups, journalAppend, etDate } from "./lib/lineup.mjs";
import { dueEntries, applyReview, hitRate, trim, newEntry } from "./lib/ledger.mjs";
import { scaleGate, median } from "./lib/niche_rank.mjs";

const rj = (p, d) => { try { const v = JSON.parse(fs.readFileSync(p, "utf8")); return v == null ? d : v; } catch { return d; } };
const now = Date.now();
const HOUR = 3600000;

const decision = rj("decision.json", {});
const cadence = rj("cadence.json", {});
const bestHours = rj("best_hours.json", {});
const bankRaw = rj("bank.json", []);
const state = rj("state.json", {});
const aggr = rj("aggr.json", {});
const viewsAtAge = rj("views_at_age.json", {});
const monet = rj("monet.json", {});
const hyps = rj("hyps.json", []);
let claims = rj("claims.json", []); if (!Array.isArray(claims)) claims = [];
const prev = rj("lineup_prev.json", null);
let journal = rj("journal.json", []); if (!Array.isArray(journal)) journal = [];
let ledger = rj("ledger.json", []); if (!Array.isArray(ledger)) ledger = [];
const dlInv = rj("dl_inv.json", {});
const thoughts = [];

// Data Lens en PAUSA (decisión de Juan, 2026-09-14): videos publicados desde la pausa y su mejor resultado.
const DAY = 86400000;
const dlVideos = [...(dlInv.longs || []), ...(dlInv.shorts || [])].filter((v) => v && v.privacy === "public" && v.published_at);
function dlSince(sinceIso, minAgeDays) {
  const since = Date.parse(sinceIso);
  const vids = dlVideos.filter((v) => Date.parse(v.published_at) >= since && (now - Date.parse(v.published_at)) / DAY >= minAgeDays);
  return { n: vids.length, best: vids.length ? Math.max(...vids.map((v) => Number(v.views) || 0)) : null };
}

// ---------- 1) Autocrítica: revisar decisiones vencidas ----------
const rankRows = (state.niche_rank && state.niche_rank.rows) || [];
const gate = scaleGate(viewsAtAge, { nowMs: now });
function observe(entry) {
  if (entry.metric === "top_niche_rel") { const r = rankRows.find((x) => x.key === entry.subject); return r && r.sufficient ? r.rel : null; }
  if (entry.metric === "d7_change_pct") return gate.status === "sin_dato" ? null : gate.change_pct;
  if (entry.metric === "dl_best_views_7d") return dlVideos.length ? dlSince(entry.at, 7).best : null;
  return null;
}
const reviewed = [];
for (const e of dueEntries(ledger, now)) {
  const obs = observe(e);
  ledger = applyReview(ledger, e.id, obs, now);
  const after = ledger.find((x) => x.id === e.id);
  reviewed.push({ id: e.id, decision: e.decision, status: after.status, note: after.verdict_note });
  const word = { ACERTO: "acerté", FALLO: "me equivoqué", INCONCLUSO: "no puedo juzgar todavía" }[after.status];
  thoughts.push({ kind: "autocritica", text: `Revisé "${e.decision}": ${word} (${after.verdict_note}).` });
}
// Registro de la pausa de Data Lens (una sola vez), con criterio verificable y fecha de revisión.
if (!ledger.some((e) => e.type === "channel_pause" && e.channel === "data-lens")) {
  ledger.push(newEntry({
    type: "channel_pause", channel: "data-lens", subject: "produccion_diaria",
    decision: "Pausar la producción diaria de The Data Lens y dejar 1 experimento semanal",
    reason: "10 semanas con 0 suscriptores y unas 100 vistas por semana; los recursos rinden más en Oddly Loop",
    evidence: "historial semanal 2026-07-06 a 2026-09-07; medición YPP: 0 suscriptores y 1.504 vistas de Shorts en 90 días",
    action: "apagados el video diario y los Shorts de Historia; Data Shock pasa a 1 por semana (lunes 15:00 UTC)",
    metric: "dl_best_views_7d", criterion: { op: ">=", value: 500 }, confidence: "media", review_after_days: 21,
    next: "si un experimento supera 500 vistas a los 7 días se reanuda ese formato; si no, se evalúa cerrar el canal",
  }, now));
  thoughts.push({ kind: "plan", text: "Pausé la producción diaria de The Data Lens por tu decisión. Queda 1 experimento por semana y lo reviso en 21 días contra 500 vistas a los 7 días." });
}
ledger = trim(ledger);
const dlPause = ledger.find((e) => e.type === "channel_pause" && e.channel === "data-lens") || null;

// ---------- 2) Plan de hoy (lo que queda) y de mañana ----------
const allocation = decision.recommended_allocation && Object.keys(decision.recommended_allocation).length ? decision.recommended_allocation : (cadence.shorts_per_category || {});
const niches = {};
for (const c of decision.candidates || []) niches[c.key] = { label: c.label, median_vpd: c.median_vpd, n: c.n, rel: c.rel, why: c.why };
for (const r of rankRows) if (!niches[r.key]) niches[r.key] = { label: r.label, median_vpd: r.median_vpd, n: r.n, rel: r.rel, why: r.sufficient ? `mediana ${r.median_vpd}/día` : "muestra insuficiente" };

const perSlot = aggr && aggr.oddly && aggr.oddly.behind ? 2 : 1;
const hoursET = Array.isArray(bestHours.hours) && bestHours.hours.length ? bestHours.hours : null;
// Oddly es solo Shorts: se descartan ideas del banco que proponen formato largo (sembradas cuando el
// inventario clasificaba todo como "long" por falta de duración; auditoría BR-12).
const bankAll = Array.isArray(bankRaw) ? bankRaw : (bankRaw.items || []);
const bank = bankAll.filter((b) => !/\blong\b|formato largo|video largo/i.test(String((b && b.text) || "")));
if (bankAll.length - bank.length > 0) thoughts.push({ kind: "plan", text: `Descarté ${bankAll.length - bank.length} idea(s) del banco que proponían formato largo: este canal es solo Shorts.` });
const d7vals = Object.values(viewsAtAge).map((r) => r && r.d7).filter((x) => Number.isFinite(Number(x)));
const d7Median = d7vals.length >= 5 ? median(d7vals) : null;

// Experimento de UNA variable (gancho) mientras la hipótesis siga abierta; solo en el nicho líder.
const leader = Object.entries(allocation).sort((a, b) => b[1] - a[1])[0];
const hq = (Array.isArray(hyps) ? hyps : []).find((h) => h.id === "global-question-hook" && ["NEW", "TESTING", "WEAKENED"].includes(h.status));
const experiment = hq && leader ? { id: "hook-question-vs-statement", variable: "hook", arms: ["question", "statement"], niche: leader[0], hypothesis: hq.statement } : null;

// Programados/publicados reales (para reconciliar el plan con lo que ya existe).
const scheduled = (state.list || [])
  .map((v) => ({ video_id: v.video_id, title: v.title, niche: v.niche, publish_at: v.publish_at || (v.privacy === "public" ? v.pub_iso : null) }))
  .filter((v) => v.publish_at);

// Reclamos de producción: vencen a las 3 horas si no apareció el video programado.
claims = claims.filter((c) => now - Date.parse(c.claimed_at) < 3 * HOUR);

const ch = (monet.channels && monet.channels.auto2) || {};
const missing = (ch.ypp && ch.ypp.missing) || [];
const common = { nowMs: now, hoursET, perSlot, allocation, niches, channelMedianVpd: decision.channel_median_vpd ?? (state.niche_rank && state.niche_rank.channel_median_vpd), variants: cadence.variant || {}, bank, experiment, scheduled, producing: claims, missing, d7Median, channel: "auto2" };
const today = buildLineup({ ...common, date: etDate(now, 0) });
const tomorrow = buildLineup({ ...common, date: etDate(now, 1) });

const prevTomorrow = prev && prev.tomorrow;
const prevToday = prev && prev.today;
const diffT = diffLineups(prevTomorrow && prevTomorrow.date === tomorrow.date ? prevTomorrow : (prevToday && prevToday.date === tomorrow.date ? prevToday : null), tomorrow);
diffT.forEach((t) => thoughts.push({ kind: "plan", text: t }));
if (prevToday && prevToday.date === today.date) diffLineups(prevToday, today).forEach((t) => thoughts.push({ kind: "plan", text: t }));

// ---------- 3) Qué producir ahora ----------
const pick = pickToProduce([today, tomorrow], now, { max: 3, minLeadHours: 3, maxLeadHours: 40 });
const lines = [];
for (const it of pick) {
  const ideaParts = [];
  if (it.idea) ideaParts.push(it.idea.text);
  if (it.experiment) ideaParts.push(it.experiment.arm === "question" ? "Gancho en forma de PREGUNTA en el primer segundo" : "Gancho en forma de AFIRMACIÓN rotunda en el primer segundo (sin pregunta)");
  const idea = ideaParts.join(" · ").replace(/[|\n\r]/g, " ").slice(0, 280);
  lines.push([it.niche, it.variant || "narrado", it.slot_utc, idea].join("|"));
  claims.push({ slot_utc: it.slot_utc, niche: it.niche, claimed_at: new Date(now).toISOString() });
  thoughts.push({ kind: "produccion", text: `Empiezo a producir ${it.niche_label} para las ${it.slot_et} ET del ${etDate(Date.parse(it.slot_utc), 0)}${it.experiment ? ` (brazo "${it.experiment.arm}" del experimento de gancho)` : ""}${it.idea ? `: ${it.idea.text}` : ""}.` });
}
// Se reflejan los reclamos nuevos en los planes que se publican.
const mark = (l) => { l.items.forEach((i) => { if (i.status === "planeado" && pick.some((p) => p.slot_utc === i.slot_utc && p.niche === i.niche)) { i.status = "produciendo"; i.record.action = "En producción ahora; se programa en esta franja al terminar"; } }); const c = (s) => l.items.filter((x) => x.status === s).length; l.summary = { planeado: c("planeado"), produciendo: c("produciendo"), programado: c("programado"), publicado: c("publicado"), sin_tiempo: c("sin_tiempo"), vencido: c("vencido") }; };
mark(today); mark(tomorrow);

if (!thoughts.length) thoughts.push({ kind: "ciclo", text: `Ciclo sin cambios: plan del ${tomorrow.date} estable (${tomorrow.summary.programado} programadas, ${tomorrow.summary.planeado} por producir).` });
for (const t of thoughts) journal = journalAppend(journal, [t.text], now, 150, t.kind);

const out = {
  at: new Date(now).toISOString(), channel: "auto2", cycle_hours: 2,
  next_cycle_at: new Date(now + 2 * HOUR).toISOString(),
  today, tomorrow,
  producing_now: pick.map((p) => ({ slot_utc: p.slot_utc, slot_et: p.slot_et, niche: p.niche, niche_label: p.niche_label, experiment: p.experiment, idea: p.idea })),
  scale_gate: gate,
  ledger: { pending: ledger.filter((e) => e.status === "PENDIENTE").length, hit_rate: hitRate(ledger), reviewed_now: reviewed, recent: ledger.slice(-12).reverse() },
  goal: ch.ypp ? { feasibility: ch.ypp.feasibility, next_milestone: ch.ypp.next_milestone, tiers: ch.ypp.tiers, days_left: ch.ypp.days_left, missing } : null,
  data_lens: dlPause ? {
    paused: true, since: dlPause.at, review_at: dlPause.review_at, status: dlPause.status, verdict_note: dlPause.verdict_note,
    experiment: "1 Short Data Shock por semana (lunes 15:00 UTC)",
    criterion: "Un experimento con 500 vistas o más a los 7 días",
    target_views_7d: dlPause.criterion.value,
    experiments_since: dlVideos.length ? dlSince(dlPause.at, 0).n : null,
    best_views_so_far: dlVideos.length ? dlSince(dlPause.at, 0).best : null,
    inventory_loaded: dlVideos.length > 0,
  } : null,
};
fs.writeFileSync("lineup.json", JSON.stringify(out, null, 2));
fs.writeFileSync("journal.json", JSON.stringify(journal));
fs.writeFileSync("ledger.json", JSON.stringify(ledger, null, 2));
fs.writeFileSync("claims.json", JSON.stringify(claims));
fs.writeFileSync("produce_now.txt", lines.join("\n") + (lines.length ? "\n" : ""));
console.log(`brain_live: hoy ${today.date} ${JSON.stringify(today.summary)} · mañana ${tomorrow.date} ${JSON.stringify(tomorrow.summary)} · produzco ahora ${pick.length} · revisé ${reviewed.length} decisiones`);
thoughts.forEach((t) => console.log(`  🧠 ${t.text}`));
