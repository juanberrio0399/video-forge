/**
 * video-forge-bot — cerebro del canal en Telegram (Cloudflare Worker).
 *
 * Flujo: Telegram -> (webhook) este Worker -> dispara GitHub Actions.
 * Los resultados (audio/MP4) los manda cada workflow al chat via notify_telegram.sh.
 *
 * Seguridad:
 *  - Verifica el header secreto de Telegram (X-Telegram-Bot-Api-Secret-Token).
 *  - Solo responde al OWNER_CHAT_ID (Juan). Cualquier otro chat se ignora.
 *  - El GitHub token vive como secret del Worker, nunca en el codigo.
 */

export default {
  async fetch(request, env) {
    // Health check / raiz (GET): util para probar que el Worker esta vivo.
    if (request.method !== "POST") {
      return new Response("video-forge-bot OK");
    }

    // 1) Verificar que el POST viene de Telegram (header secreto).
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!env.TELEGRAM_WEBHOOK_SECRET || got !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    try {
      if (update.callback_query) {
        await handleCallback(update.callback_query, env);
      } else if (update.message) {
        await handleMessage(update.message, env);
      }
    } catch (err) {
      // Nunca reventamos el webhook (Telegram reintentaria); logueamos y seguimos.
      console.error("handler error", err);
    }
    // Siempre 200 para que Telegram no reintente.
    return new Response("ok");
  },
};

// ---------- Manejo de mensajes ----------

async function handleMessage(message, env) {
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();

  // /id funciona para cualquiera: ayuda a Juan a averiguar su chat id.
  if (text === "/id") {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: `Tu chat id es: ${chatId}\nPonlo como secret OWNER_CHAT_ID.`,
    });
  }

  // A partir de aqui, solo el dueño.
  if (!isOwner(chatId, env)) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "No autorizado. Este bot es privado.",
    });
  }

  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();

  switch ((cmd || "").toLowerCase()) {
    case "/start":
    case "/help":
      return sendMenu(env, chatId);

    case "/nuevo": {
      if (!arg) {
        return tg(env, "sendMessage", {
          chat_id: chatId,
          text: "Uso: /nuevo <tema del video>\nEj: /nuevo how much money does Netflix lose on password sharing",
        });
      }
      const r = await ghDispatch(env, env.GH_PRODUCE_WORKFLOW, { topic: arg });
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: r.ok
          ? `🎬 Nuevo video en cola:\n"${arg}"\nDispare el pipeline (${env.GH_PRODUCE_WORKFLOW}). Te aviso cuando haya preview.`
          : `❌ No pude disparar el pipeline (${r.status}). Revisa GH_TOKEN / workflow.`,
      });
    }

    case "/render": {
      const r = await ghDispatch(env, "render.yml", {});
      return ack(env, chatId, r, "Render en la nube");
    }

    case "/voz": {
      const r = await ghDispatch(env, "voice_directed.yml", {});
      return ack(env, chatId, r, "Generacion de voz");
    }

    case "/estado":
      return sendStatus(env, chatId);

    default:
      return sendMenu(env, chatId);
  }
}

async function handleCallback(cb, env) {
  const chatId = cb.message?.chat?.id;
  const data = cb.data || "";
  if (!isOwner(chatId, env)) {
    return tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "No autorizado" });
  }
  // Placeholder de aprobacion (se conecta a publish en Fase 5).
  if (data.startsWith("publish:")) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Publicando..." });
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "✅ Aprobado. (La publicacion a YouTube se conecta en la Fase 5.)",
    });
  }
  if (data.startsWith("discard:")) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Descartado" });
    return tg(env, "sendMessage", { chat_id: chatId, text: "❌ Descartado." });
  }
  return tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
}

// ---------- Vistas ----------

function sendMenu(env, chatId) {
  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "Markdown",
    text: [
      "*video-forge* 🎬 — centro de control del canal",
      "",
      "`/nuevo <tema>` — pedir un video nuevo",
      "`/render` — renderizar el video en la nube",
      "`/voz` — generar la narracion",
      "`/estado` — ver los ultimos procesos",
      "`/id` — ver tu chat id",
      "",
      "Todo corre en GitHub Actions; los resultados llegan aca.",
    ].join("\n"),
  });
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendStatus(env, chatId) {
  const res = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs?per_page=6`);
  if (!res.ok) {
    return tg(env, "sendMessage", { chat_id: chatId, text: `No pude leer el estado (${res.status}).` });
  }
  const data = await res.json();
  const runs = data.workflow_runs || [];
  const lines = runs.map((r) => {
    let icon = "⏳";
    let estado = "en curso";
    if (r.status === "completed") {
      icon = r.conclusion === "success" ? "✅" : (r.conclusion === "cancelled" ? "🚫" : "❌");
      estado = r.conclusion;
    } else if (r.status === "queued") {
      icon = "🕒";
      estado = "en cola";
    }
    // Nombre enlazado a la pagina del run (tocable para ver el progreso en vivo).
    return `${icon} <a href="${r.html_url}">${esc(r.name)}</a> — ${estado}`;
  });
  const running = runs.filter((r) => r.status !== "completed").length;
  const header = running
    ? `⏳ ${running} en proceso ahora:\n\n`
    : "Ultimos procesos:\n\n";
  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    text: lines.length ? header + lines.join("\n") : "Sin procesos recientes.",
  });
}

// ---------- Helpers ----------

function isOwner(chatId, env) {
  return env.OWNER_CHAT_ID && String(chatId) === String(env.OWNER_CHAT_ID);
}

function ack(env, chatId, r, label) {
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: r.ok ? `⏳ ${label} disparado. Te aviso al terminar.` : `❌ No pude disparar (${r.status}).`,
  });
}

function tg(env, method, payload) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function ghApi(env, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "video-forge-bot",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
}

function ghDispatch(env, workflow, inputs) {
  return ghApi(env, `/repos/${env.GH_REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
}
