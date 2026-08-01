// watchdog.mjs — vigila la fabrica y la ARREGLA sola:
//  1) Cancela corridas COLGADAS (in_progress demasiado tiempo).
//  2) Reintenta el render si FALLÓ (con guarda: max 3 fallos en 2h -> avisa y no insiste).
const { GH_TOKEN, GITHUB_REPOSITORY: REPO, TELEGRAM_BOT_TOKEN, OWNER_CHAT_ID } = process.env;
const H = { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" };
const MAX_MIN = 100; // colgada si lleva mas de 100 min
const now = Date.now();

async function tg(text) {
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text }) }); } catch {}
}
async function dispatchRender() {
  const d = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/render_phased.yml/dispatches`, { method: "POST", headers: H, body: JSON.stringify({ ref: "main" }) });
  return d.ok;
}

// 1) COLGADAS
const res = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?status=in_progress&per_page=40`, { headers: H });
const inProgRuns = (res.ok ? (await res.json()).workflow_runs : []) || [];
let cancelledHungRender = false;
for (const run of inProgRuns) {
  if (/watchdog/i.test(run.name || "")) continue;
  const mins = Math.round((now - Date.parse(run.run_started_at || run.created_at)) / 60000);
  if (mins < MAX_MIN) continue;
  await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${run.id}/cancel`, { method: "POST", headers: H });
  console.log("cancelada colgada:", run.name, mins, "min");
  if (/render|fase/i.test(run.name || "")) cancelledHungRender = true;
  else await tg(`🛟 Watchdog: cancelé una corrida colgada (${run.name}, ${mins} min).`);
}

// 2) RENDER: colgado-cancelado o fallido -> reintentar con guarda
const rr = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/render_phased.yml/runs?per_page=10`, { headers: H });
const rruns = ((rr.ok ? (await rr.json()).workflow_runs : []) || []);
const renderInProgress = rruns.some((x) => x.status !== "completed");
const latest = rruns[0];
const fails2h = rruns.filter((x) => x.conclusion === "failure" && (now - Date.parse(x.updated_at)) < 2 * 3600 * 1000).length;

if (!renderInProgress && (cancelledHungRender || (latest && latest.conclusion === "failure" && (now - Date.parse(latest.updated_at)) < 45 * 60000))) {
  if (fails2h < 3) {
    const ok = await dispatchRender();
    await tg(`🛟 Watchdog: el render ${cancelledHungRender ? "se colgó" : "falló"}. Reintenté automáticamente${ok ? "" : " (no pude disparar)"}. (fallo ${fails2h + 1}/3)`);
    console.log("render reintentado");
  } else {
    await tg(`⚠️ Watchdog: el render falló ${fails2h} veces seguidas — necesita revisión manual. No reintento más (para no gastar). Escríbeme y lo miro.`);
    console.log("render: se alcanzo el limite de reintentos");
  }
} else {
  console.log(renderInProgress ? "render en curso, no toco" : "watchdog: todo OK");
}
