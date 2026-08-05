// watchdog.mjs — vigila la fabrica y la ARREGLA sola (NUNCA la deja en limbo):
//  1) Cancela corridas COLGADAS (in_progress demasiado tiempo).
//  2) REANUDA el render si se detuvo sin terminar: FALLÓ, se CANCELÓ, o quedó una CADENA ROTA
//     (voz lista pero sin render). Con cortacircuitos (max 3 fallos / 5 renders en 2h) para no loopear.
const { GH_TOKEN, GITHUB_REPOSITORY: REPO, TELEGRAM_BOT_TOKEN, OWNER_CHAT_ID } = process.env;
const H = { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" };
const MAX_MIN = 140; // colgada si pasa de 140 min (un render legitimo puede durar ~120: 2 intentos x 55 min)
const now = Date.now();
// fetch con timeout: una API de GitHub LENTA no debe consumir todo el job del watchdog.
const tf = (u, o = {}, ms = 8000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

async function tg(text) {
  try { await tf(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text }) }); } catch {}
}
async function dispatchRender() {
  const d = await tf(`https://api.github.com/repos/${REPO}/actions/workflows/render_phased.yml/dispatches`, { method: "POST", headers: H, body: JSON.stringify({ ref: "main" }) });
  return d.ok;
}

// 1) COLGADAS
const res = await tf(`https://api.github.com/repos/${REPO}/actions/runs?status=in_progress&per_page=40`, { headers: H });
const inProgRuns = (res.ok ? (await res.json()).workflow_runs : []) || [];
let cancelledHungRender = false;
for (const run of inProgRuns) {
  if (/watchdog/i.test(run.name || "")) continue;
  const mins = Math.round((now - Date.parse(run.run_started_at || run.created_at)) / 60000);
  if (mins < MAX_MIN) continue;
  await tf(`https://api.github.com/repos/${REPO}/actions/runs/${run.id}/cancel`, { method: "POST", headers: H });
  console.log("cancelada colgada:", run.name, mins, "min");
  if (/render|fase/i.test(run.name || "")) cancelledHungRender = true;
  else await tg(`🛟 Watchdog: cancelé una corrida colgada (${run.name}, ${mins} min).`);
}

// 2) RENDER: reanudar si se DETUVO sin terminar (cancelado, fallado o cadena rota) -> NUNCA limbo.
const rr = await tf(`https://api.github.com/repos/${REPO}/actions/workflows/render_phased.yml/runs?per_page=10`, { headers: H });
const rruns = ((rr.ok ? (await rr.json()).workflow_runs : []) || []);
const renderInProgress = rruns.some((x) => x.status !== "completed");
const latest = rruns[0];
const fails2h = rruns.filter((x) => x.conclusion === "failure" && (now - Date.parse(x.updated_at)) < 2 * 3600 * 1000).length;
// CORTACIRCUITOS global: total de renders (de cualquier origen) en las ultimas 2h. Nunca loop.
const renders2h = rruns.filter((x) => (now - Date.parse(x.created_at)) < 2 * 3600 * 1000).length;

// (a) El ULTIMO render se detuvo sin terminar: FALLÓ o se CANCELÓ (esto era el limbo — el cancel no se reanudaba).
// Ventana amplia (4h) para que un cron atrasado no deje el video sin rescate.
const stopped = latest && (latest.conclusion === "failure" || latest.conclusion === "cancelled") && (now - Date.parse(latest.updated_at)) < 240 * 60000;

// (b) CADENA ROTA: la voz mas reciente terminó OK pero NO arrancó ningun render despues (produccion a medias).
let chainBroken = false, voiceReason = "";
try {
  const vr = await tf(`https://api.github.com/repos/${REPO}/actions/workflows/voice_parallel.yml/runs?per_page=5`, { headers: H });
  const vruns = ((vr.ok ? (await vr.json()).workflow_runs : []) || []);
  const lastVoice = vruns.find((x) => x.status === "completed" && x.conclusion === "success");
  if (lastVoice) {
    const vt = Date.parse(lastVoice.updated_at);
    const noRenderAfter = !latest || Date.parse(latest.created_at) < vt; // ningun render creado despues de la voz
    const age = now - vt;
    // Ventana 8 min – 6 h: no abandonar un video "voz lista sin render" solo porque un cron llegó tarde.
    if (noRenderAfter && age > 8 * 60000 && age < 360 * 60000) { chainBroken = true; voiceReason = "cadena rota (voz lista sin render)"; }
  }
} catch {}

if (!renderInProgress && (cancelledHungRender || stopped || chainBroken)) {
  if (fails2h < 3 && renders2h < 5) {
    const ok = await dispatchRender();
    const reason = cancelledHungRender ? "se colgó" : stopped ? (latest.conclusion === "cancelled" ? "se canceló" : "falló") : voiceReason;
    await tg(`🛟 Watchdog: el render ${reason}. Lo REANUDÉ automáticamente${ok ? "" : " (no pude disparar)"} — no quedará en limbo.`);
    console.log("render reanudado:", reason);
  } else {
    await tg(`🛑 Watchdog: corté los reintentos de render (${fails2h} fallos / ${renders2h} renders en 2h) — para NO entrar en bucle. Revísalo manual en la app.`);
    console.log("render: cortacircuitos activo (limite 2h)");
  }
} else {
  console.log(renderInProgress ? "render en curso, no toco" : "watchdog: todo OK");
}
