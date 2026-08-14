// radar-bot — Worker de Telegram para CONTROLAR el Radar desde el chat.
// Flujo POR ETAPAS (los botones se activan a medida que avanzas), para NO mergear sin revisar:
//   1) Issue sin PR:      [⚙️ Ejecutar]  [🗑️ Descartar]
//   2) Ya hay PR:         [👀 Revisar PR] [🗑️ Descartar]   (aún NO hay Merge)
//   3) Al Revisar:        muestra el PR + [🔀 Merge (revisado)] [↩️ Volver]
// Muestra la PRIORIDAD (🔴 Alta / 🟡 Media / 🟢 Baja) y el REPO. Solo responde al dueño.

const GH = "https://api.github.com";
// Repos que controla el bot. Ampliar aquí cuando cada repo tenga su radar_implement.yml.
const REPOS = ["juanberrio0399/video-forge"];

const tg = (env, method, body) =>
  fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const gh = (env, path, opts = {}) =>
  fetch(`${GH}${path}`, { ...opts, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "radar-bot", ...(opts.headers || {}) } });

const PRIO = { alta: "🔴 Alta", media: "🟡 Media", baja: "🟢 Baja" };
const prioOf = (body) => { const m = (body || "").match(/Prioridad:\**\s*(Alta|Media|Baja)/i); return m ? m[1].toLowerCase() : ""; };
const rank = (p) => (p === "alta" ? 0 : p === "media" ? 1 : p === "baja" ? 2 : 3);
const short = (repo) => repo.split("/").pop();

async function listRadarIssues(env) {
  const byRepo = {};
  for (const repo of REPOS) {
    byRepo[repo] = [];
    try {
      const r = await gh(env, `/repos/${repo}/issues?labels=radar&state=open&per_page=50`);
      if (!r.ok) continue;
      for (const is of await r.json()) {
        if (is.pull_request) continue;
        byRepo[repo].push({ repo, number: is.number, title: is.title, url: is.html_url, prio: prioOf(is.body) });
      }
      byRepo[repo].sort((a, b) => rank(a.prio) - rank(b.prio));
    } catch {}
  }
  return byRepo;
}

async function findPR(env, repo, number) {
  const r = await gh(env, `/repos/${repo}/pulls?state=open&per_page=100`);
  if (!r.ok) return null;
  const prs = await r.json();
  return prs.find((p) => new RegExp(`closes #${number}\\b`, "i").test(p.body || "") || (p.head?.ref || "").includes(`-${number}`) || (p.head?.ref || "").includes(`issue-${number}`)) || null;
}

function issueKb(repo, number, hasPR) {
  const row = hasPR
    ? [{ text: "👀 Revisar PR", callback_data: `review:${repo}:${number}` }, { text: "🗑️ Descartar", callback_data: `close:${repo}:${number}` }]
    : [{ text: "⚙️ Ejecutar", callback_data: `run:${repo}:${number}` }, { text: "🗑️ Descartar", callback_data: `close:${repo}:${number}` }];
  return { inline_keyboard: [row] };
}

async function sendRadarList(env, chatId) {
  const byRepo = await listRadarIssues(env);
  const total = Object.values(byRepo).reduce((n, a) => n + a.length, 0);
  if (!total) { await tg(env, "sendMessage", { chat_id: chatId, text: "✅ No hay issues del radar abiertos. El barrido semanal irá dejando novedades aquí." }); return; }
  for (const repo of REPOS) {
    const issues = byRepo[repo] || [];
    if (!issues.length) continue;
    await tg(env, "sendMessage", { chat_id: chatId, text: `📦 *${short(repo)}* — ${issues.length} issue(s) del radar`, parse_mode: "Markdown" });
    for (const is of issues) {
      const pr = await findPR(env, repo, is.number);
      const prio = is.prio ? PRIO[is.prio] : "⚪ Sin prioridad";
      const estado = pr ? "\n🔧 PR listo — revísalo antes de mergear" : "";
      await tg(env, "sendMessage", { chat_id: chatId, text: `${prio} · #${is.number}\n${is.title}${estado}\n${is.url}`, disable_web_page_preview: true, reply_markup: issueKb(repo, is.number, !!pr) });
    }
  }
}

async function runImplement(env, repo, number) {
  const r = await gh(env, `/repos/${repo}/actions/workflows/radar_implement.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main", inputs: { issue: String(number) } }) });
  return r.ok || r.status === 204;
}

async function reviewCard(env, chatId, repo, number) {
  const pr = await findPR(env, repo, number);
  if (!pr) { await tg(env, "sendMessage", { chat_id: chatId, text: `🔎 Aún no hay PR para el #${number}. Corre ⚙️ Ejecutar y espera 1-2 min.` }); return; }
  let files = "?";
  try { const fr = await gh(env, `/repos/${repo}/pulls/${pr.number}/files?per_page=100`); if (fr.ok) files = (await fr.json()).length; } catch {}
  const txt = `👀 *Revisar antes de mergear*\nPR #${pr.number} · ${pr.title}\nArchivos cambiados: ${files}\n\nÁbrelo, revisa el diff y, si te convence, dale Merge.\n${pr.html_url}`;
  await tg(env, "sendMessage", { chat_id: chatId, text: txt, parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: "🔀 Merge (ya lo revisé)", callback_data: `merge:${repo}:${number}` }], [{ text: "🗑️ Descartar issue", callback_data: `close:${repo}:${number}` }]] } });
}

async function mergeIssuePR(env, repo, number) {
  const pr = await findPR(env, repo, number);
  if (!pr) return `🔎 No encontré un PR abierto para el #${number}.`;
  const m = await gh(env, `/repos/${repo}/pulls/${pr.number}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "squash" }) });
  if (m.ok) return `✅ PR #${pr.number} mergeado (${pr.title}). El issue #${number} se cierra solo.`;
  const e = await m.json().catch(() => ({}));
  return `❌ No pude mergear el PR #${pr.number}: ${e.message || m.status}. Revisa checks o conflictos.`;
}

async function closeIssue(env, repo, number) {
  const r = await gh(env, `/repos/${repo}/issues/${number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
  return r.ok;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/webhook" && request.method === "POST") {
      if (env.TELEGRAM_WEBHOOK_SECRET && request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });
      const upd = await request.json().catch(() => ({}));
      const owner = env.OWNER_CHAT_ID ? String(env.OWNER_CHAT_ID) : null;

      if (upd.message) {
        const chatId = String(upd.message.chat.id);
        if (owner && chatId !== owner) return new Response("ok");
        const text = (upd.message.text || "").trim();
        if (text === "/start" || text === "/radar" || text === "/novedades") await sendRadarList(env, chatId);
        else await tg(env, "sendMessage", { chat_id: chatId, text: "📡 Radar Bot. Comando: /radar — ver y controlar los issues (Ejecutar → Revisar → Merge). El Merge solo aparece después de Revisar." });
        return new Response("ok");
      }

      if (upd.callback_query) {
        const cq = upd.callback_query;
        const chatId = String(cq.message.chat.id);
        if (owner && chatId !== owner) { await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "No autorizado" }); return new Response("ok"); }
        const i = (cq.data || "").indexOf(":");
        const action = (cq.data || "").slice(0, i);
        const rest = (cq.data || "").slice(i + 1);
        const s = rest.lastIndexOf(":");
        const repo = rest.slice(0, s), number = rest.slice(s + 1);
        let toast = "";
        try {
          if (action === "run") { const ok = await runImplement(env, repo, number); toast = ok ? "⚙️ Motor lanzado" : "❌ no pude lanzar"; await tg(env, "sendMessage", { chat_id: chatId, text: ok ? `⚙️ Motor lanzado para #${number}. En 1-2 min estará el PR — vuelve a /radar y saldrá 👀 Revisar PR.` : "❌ No pude lanzar el motor." }); }
          else if (action === "review") { toast = "Abriendo revisión…"; await reviewCard(env, chatId, repo, number); }
          else if (action === "merge") { const msg = await mergeIssuePR(env, repo, number); toast = "Merge"; await tg(env, "sendMessage", { chat_id: chatId, text: msg }); }
          else if (action === "close") { const ok = await closeIssue(env, repo, number); toast = ok ? "Cerrado" : "Error"; await tg(env, "sendMessage", { chat_id: chatId, text: ok ? `🗑️ Issue #${number} cerrado.` : "❌ No pude cerrar." }); }
        } catch (e) { toast = "Error"; await tg(env, "sendMessage", { chat_id: chatId, text: "❌ Error: " + e.message }); }
        await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: toast.slice(0, 190) });
        return new Response("ok");
      }
      return new Response("ok");
    }
    return new Response("radar-bot up", { status: 200 });
  },
};
