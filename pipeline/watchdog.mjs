// watchdog.mjs — detecta corridas COLGADAS (in_progress demasiado tiempo), las cancela,
// avisa a Telegram y auto-reintenta el render (con guarda para no hacer bucle).
const { GH_TOKEN, GITHUB_REPOSITORY: REPO, TELEGRAM_BOT_TOKEN, OWNER_CHAT_ID } = process.env;
const H = { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" };
const MAX_MIN = 100; // colgada si lleva mas de 100 min en marcha (todo deberia terminar antes)

async function tg(text) {
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text }) }); } catch {}
}

const now = Date.now();
const res = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?status=in_progress&per_page=40`, { headers: H });
const runs = (res.ok ? (await res.json()).workflow_runs : []) || [];
let acted = false;

for (const run of runs) {
  if (/watchdog/i.test(run.name || "")) continue; // no cancelarse a si mismo
  const mins = Math.round((now - Date.parse(run.run_started_at || run.created_at)) / 60000);
  if (mins < MAX_MIN) continue;
  acted = true;
  await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${run.id}/cancel`, { method: "POST", headers: H });
  console.log("cancelada colgada:", run.name, mins, "min");

  const isRender = /render|fase/i.test(run.name || "");
  let retried = false;
  if (isRender) {
    // Guarda anti-bucle: no reintentar si ya hay un render creado en los ultimos 30 min.
    const rr = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/render_phased.yml/runs?per_page=5`, { headers: H });
    const recent = ((rr.ok ? (await rr.json()).workflow_runs : []) || []).some((x) => x.id !== run.id && (now - Date.parse(x.created_at)) < 30 * 60000);
    if (!recent) {
      const d = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/render_phased.yml/dispatches`, { method: "POST", headers: H, body: JSON.stringify({ ref: "main" }) });
      retried = d.ok;
    }
  }
  await tg(`🛟 Watchdog: cancelé una corrida COLGADA (${run.name}, ${mins} min).${retried ? " Reintenté el render automáticamente." : (isRender ? " No reintenté (ya hay uno reciente)." : " Si hacía falta, dale reintentar.")}`);
}
console.log(acted ? "watchdog: actuó" : "watchdog: todo OK, nada colgado");
