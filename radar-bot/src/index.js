// radar-bot — Worker de Telegram para CONTROLAR el Radar desde el chat.
// Lista los Issues `radar` de tus repos y por cada uno: ⚙️ Ejecutar (dispara radar_implement.yml
// -> rama + PR), 🔀 Merge (mergea el PR del issue), 🗑️ Descartar (cierra el issue). Solo el dueño.
// Sin merge automático de nada: cada acción la disparas tú desde el botón.

const GH = "https://api.github.com";
// Repos que controla el bot. Ampliar aquí cuando cada repo tenga su radar_implement.yml.
const REPOS = ["juanberrio0399/video-forge"];

const tg = (env, method, body) =>
  fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const gh = (env, path, opts = {}) =>
  fetch(`${GH}${path}`, { ...opts, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "radar-bot", ...(opts.headers || {}) } });

async function listRadarIssues(env) {
  const out = [];
  for (const repo of REPOS) {
    try {
      const r = await gh(env, `/repos/${repo}/issues?labels=radar&state=open&per_page=30`);
      if (!r.ok) continue;
      for (const is of await r.json()) { if (is.pull_request) continue; out.push({ repo, number: is.number, title: is.title, url: is.html_url }); }
    } catch {}
  }
  return out;
}

const kb = (repo, number) => ({
  inline_keyboard: [[
    { text: "⚙️ Ejecutar", callback_data: `run:${repo}:${number}` },
    { text: "🔀 Merge", callback_data: `merge:${repo}:${number}` },
    { text: "🗑️ Descartar", callback_data: `close:${repo}:${number}` },
  ]],
});

async function sendRadarList(env, chatId) {
  const issues = await listRadarIssues(env);
  if (!issues.length) { await tg(env, "sendMessage", { chat_id: chatId, text: "✅ No hay issues del radar abiertos. El barrido semanal irá dejando novedades aquí." }); return; }
  await tg(env, "sendMessage", { chat_id: chatId, text: `📡 Radar — ${issues.length} issue(s) por trabajar:` });
  for (const is of issues) {
    const repoShort = is.repo.split("/").pop();
    await tg(env, "sendMessage", { chat_id: chatId, text: `📦 ${repoShort} · #${is.number}\n${is.title}\n${is.url}`, disable_web_page_preview: true, reply_markup: kb(is.repo, is.number) });
  }
}

async function runImplement(env, repo, number) {
  const r = await gh(env, `/repos/${repo}/actions/workflows/radar_implement.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main", inputs: { issue: String(number) } }) });
  return r.ok || r.status === 204;
}

async function mergeIssuePR(env, repo, number) {
  const r = await gh(env, `/repos/${repo}/pulls?state=open&per_page=100`);
  if (!r.ok) return "❌ No pude listar los PRs.";
  const prs = await r.json();
  const pr = prs.find((p) => new RegExp(`closes #${number}\\b`, "i").test(p.body || "") || (p.head && p.head.ref && p.head.ref.includes(`issue-${number}`)) || (p.head && p.head.ref && p.head.ref.includes(`-${number}`)));
  if (!pr) return `🔎 No encontré un PR abierto para el #${number}. ¿Ya corriste ⚙️ Ejecutar?`;
  const m = await gh(env, `/repos/${repo}/pulls/${pr.number}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "squash" }) });
  if (m.ok) return `✅ PR #${pr.number} mergeado (${pr.title}).`;
  const e = await m.json().catch(() => ({}));
  return `❌ No pude mergear el PR #${pr.number}: ${e.message || m.status}. Revisa si hay checks pendientes o conflictos.`;
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
        else await tg(env, "sendMessage", { chat_id: chatId, text: "📡 Radar Bot. Comandos:\n/radar — ver y controlar los issues del radar (Ejecutar · Merge · Descartar)." });
        return new Response("ok");
      }

      if (upd.callback_query) {
        const cq = upd.callback_query;
        const chatId = String(cq.message.chat.id);
        if (owner && chatId !== owner) { await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "No autorizado" }); return new Response("ok"); }
        const idx = (cq.data || "").indexOf(":");
        const action = (cq.data || "").slice(0, idx);
        const rest = (cq.data || "").slice(idx + 1);
        const sep = rest.lastIndexOf(":");
        const repo = rest.slice(0, sep), number = rest.slice(sep + 1);
        let msg = "";
        try {
          if (action === "run") msg = (await runImplement(env, repo, number)) ? `⚙️ Motor lanzado para #${number}. En 1-2 min queda el PR — vuelve a /radar y usa 🔀 Merge.` : "❌ No pude lanzar el motor.";
          else if (action === "merge") msg = await mergeIssuePR(env, repo, number);
          else if (action === "close") msg = (await closeIssue(env, repo, number)) ? `🗑️ Issue #${number} cerrado.` : "❌ No pude cerrar el issue.";
          else msg = "Acción desconocida.";
        } catch (e) { msg = "❌ Error: " + e.message; }
        await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: msg.slice(0, 190) });
        await tg(env, "sendMessage", { chat_id: chatId, text: msg });
        return new Response("ok");
      }
      return new Response("ok");
    }
    return new Response("radar-bot up", { status: 200 });
  },
};
