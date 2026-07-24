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

  // Fase 7: si manda una FOTO, entra al editor de imagenes (Workers AI, gratis).
  if (Array.isArray(message.photo) && message.photo.length) {
    return handlePhotoEdit(message, env, chatId);
  }

  // Botones del menu (reply keyboard) -> comando equivalente.
  const BTN = {
    "🎙️ Generar voz": "/voz",
    "🎬 Renderizar": "/render",
    "📊 Estado": "/estado",
    "🆕 Nuevo video": "/nuevo",
    "❓ Ayuda": "/help",
    "🏠 Menu": "/start",
  };
  const line = BTN[text] || text;
  const [cmd, ...rest] = line.split(/\s+/);
  const arg = rest.join(" ").trim();

  // Fase 7: si hay una foto en edicion esperando el "que cambiar", el texto es la instruccion.
  if (cmd && !cmd.startsWith("/") && !(text in BTN)) {
    const st = await getEditState(env, chatId);
    if (st && st.awaiting && env.R2 && (await env.R2.get(editKey(chatId, "source")))) {
      const { mode, prompt } = parseEdit(line);
      return dispatchEdit(env, chatId, mode, prompt);
    }
  }

  switch ((cmd || "").toLowerCase()) {
    case "/start":
    case "/help":
      return sendMenu(env, chatId);

    case "/nuevo": {
      // El pipeline completo (tema -> guion -> voz -> render) esta en construccion.
      // Por ahora dejamos claro que aun no hace el video solo.
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text:
          "🚧 /nuevo (video completo automatico) esta en construccion.\n\n" +
          "Por ahora hacemos los videos paso a paso:\n" +
          "🎙️ /voz — generar la narracion\n" +
          "🎬 /render — renderizar el video\n" +
          "📊 /estado — ver el progreso",
      });
    }

    case "/render": {
      const r = await ghDispatch(env, "render_video.yml", {});
      return ack(env, chatId, r, "Render del video (voz + subtitulos)");
    }

    case "/voz": {
      const r = await ghDispatch(env, "voice_parallel.yml", {});
      return ack(env, chatId, r, "Generacion de voz (rapida, en paralelo)");
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
  // Cierra el "relojito" del boton de inmediato.
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });

  switch (data) {
    case "voz": {
      const r = await ghDispatch(env, "voice_parallel.yml", {});
      return ack(env, chatId, r, "Generacion de voz (en paralelo)");
    }
    case "render": {
      const r = await ghDispatch(env, "render_video.yml", {});
      return ack(env, chatId, r, "Render del video (voz + subtitulos)");
    }
    case "estado":
      return sendStatus(env, chatId);
    case "nuevo":
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text:
          "🚧 Video completo automatico: en construccion.\n\n" +
          "Por ahora, paso a paso: 🎙️ Generar voz · 🎬 Renderizar · 📊 Estado.",
      });
    case "menu":
    case "help":
      return sendMenu(env, chatId);
    // ---- Fase 7: botones del editor de fotos ----
    case "edit_save": {
      // Regla de storage: al terminar, borrar el ORIGEN (el resultado ya se entrego).
      if (env.R2) {
        await env.R2.delete(editKey(chatId, "source"));
        await env.R2.delete(editKey(chatId, "result"));
        await env.R2.delete(editKey(chatId, "state"));
      }
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✅ Listo. Borre el original (solo te queda el resultado que te mande). Mandame otra foto cuando quieras.",
      });
    }
    case "edit_again":
      return reDispatchEdit(env, chatId);
    case "edit_change": {
      const st = await getEditState(env, chatId);
      await putEditState(env, chatId, { awaiting: true, mode: (st && st.mode) || "retoque", prompt: (st && st.prompt) || "" });
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✏️ Escribeme el nuevo cambio para la MISMA foto (ej: 'fondo blanco', 'mas luz', 'piel mas limpia').",
      });
    }

    default:
      // Botones de aprobacion que traen los resultados (voz/video).
      if (data.startsWith("approve:")) {
        return tg(env, "sendMessage", {
          chat_id: chatId,
          text: "✅ Aprobado. Siguiente paso: publicar a YouTube (Fase 5, pronto).",
        });
      }
      if (data.startsWith("regen:")) {
        const r = await ghDispatch(env, "render_video.yml", {});
        return ack(env, chatId, r, "Regenerando el video igual");
      }
      if (data.startsWith("change:")) {
        return tg(env, "sendMessage", {
          chat_id: chatId,
          text:
            "✏️ ¿Que quieres cambiar? Escribemelo (ej: 'subtitulos mas grandes', " +
            "'menos numeros', 'otro color') y lo ajusto para la proxima version.",
        });
      }
      return;
  }
}

// ---------- Vistas ----------

// Botones DENTRO del mensaje (inline): siempre visibles, se tocan y listo.
const MENU_INLINE = {
  inline_keyboard: [
    [{ text: "🎙️ Generar voz", callback_data: "voz" }],
    [{ text: "🎬 Renderizar video", callback_data: "render" }],
    [{ text: "📊 Estado (que se hace ahora)", callback_data: "estado" }],
    [{ text: "🆕 Nuevo video (pronto)", callback_data: "nuevo" }],
  ],
};

async function sendMenu(env, chatId) {
  // Registra el menu de comandos nativo de Telegram (el boton "/" y "Menu").
  await tg(env, "setMyCommands", {
    commands: [
      { command: "voz", description: "🎙️ Generar la narracion (tu voz)" },
      { command: "render", description: "🎬 Renderizar el video" },
      { command: "estado", description: "📊 Que se esta haciendo ahora" },
      { command: "nuevo", description: "🆕 Video completo (pronto)" },
      { command: "start", description: "🏠 Menu" },
    ],
  });

  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "Markdown",
    reply_markup: MENU_INLINE,
    text: [
      "*video-forge* 🎬 — centro de control del canal",
      "",
      "Toca un boton 👇",
      "",
      "🎙️ *Generar voz* — narracion con tu voz",
      "🎬 *Renderizar* — arma el video en la nube",
      "📊 *Estado* — que se hace AHORA + en que paso va",
      "🆕 *Nuevo video* — completo y solo (en construccion)",
      "",
      "🖼️ *Editar foto* — mandame una foto con un texto de que cambiar (fondo, luz, estilo). La edito gratis al instante.",
      "",
      "_Todo corre en la nube. Cuando algo termina, te llega aca._",
    ].join("\n"),
  });
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Muestra SOLO lo que se esta haciendo ahora (en curso o en cola), con el paso
// actual y los minutos que lleva. Nada de historial (seria muy largo).
async function sendStatus(env, chatId) {
  const res = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs?per_page=20`);
  if (!res.ok) {
    return tg(env, "sendMessage", { chat_id: chatId, text: `No pude leer el estado (${res.status}).` });
  }
  const active = ((await res.json()).workflow_runs || []).filter((r) => r.status !== "completed");

  if (!active.length) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "✅ Nada en proceso ahora.\n\nManda /voz o /render para empezar. El resultado llega aca al terminar.",
    });
  }

  const blocks = [];
  for (const r of active) {
    const mins = r.run_started_at
      ? Math.max(0, Math.round((Date.now() - Date.parse(r.run_started_at)) / 60000))
      : 0;

    let paso = r.status === "queued" ? "en cola…" : "iniciando…";
    const jr = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs/${r.id}/jobs`);
    if (jr.ok) {
      const job = ((await jr.json()).jobs || [])[0];
      const steps = (job && job.steps) || [];
      const total = steps.length;
      const done = steps.filter((s) => s.status === "completed").length;
      const cur = steps.find((s) => s.status === "in_progress");
      if (cur) paso = `paso ${Math.min(done + 1, total)}/${total}: ${esc(cur.name)}`;
      else if (total && done === total) paso = "cerrando…";
    }

    blocks.push(
      `⏳ <a href="${r.html_url}">${esc(r.name)}</a>\n     ${paso} · lleva ${mins} min`
    );
  }

  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    text:
      "⏳ <b>En proceso ahora</b>\n\n" +
      blocks.join("\n\n") +
      "\n\nToca el nombre para ver el detalle en vivo. Te aviso aca al terminar.",
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

// ---------- Fase 7: editor de fotos (retoque PRO que preserva identidad) ----------
// Mandas una foto -> el Worker guarda el ORIGEN en R2 y dispara `photo_edit.yml`
// (GitHub Actions), que la retoca SIN cambiar facciones (GFPGAN + Real-ESRGAN) o
// le cambia el fondo (rembg) y la devuelve al chat con botones. El ORIGEN vive en
// R2 SOLO mientras iteras; al "Guardar" se borra (regla de storage de Juan).
// (No se hace en el Worker porque img2img re-genera la cara; queremos identidad.)

function editKey(chatId, kind) {
  return `edit/${chatId}/${kind}`;
}

async function getEditState(env, chatId) {
  if (!env.R2) return null;
  const o = await env.R2.get(editKey(chatId, "state"));
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch { return null; }
}

function putEditState(env, chatId, st) {
  return env.R2.put(editKey(chatId, "state"), JSON.stringify(st), {
    httpMetadata: { contentType: "application/json" },
  });
}

// De lo que escribe el usuario deduce el modo: "fondo/background" -> cambiar fondo.
function parseEdit(caption) {
  const c = (caption || "").toLowerCase();
  if (/\bfondo\b|\bfondos\b|\bbackground\b/.test(c)) return { mode: "fondo", prompt: caption || "" };
  return { mode: "retoque", prompt: caption || "" };
}

async function handlePhotoEdit(message, env, chatId) {
  if (!env.R2) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "El editor de fotos aun no esta activo (falta redeploy con R2).",
    });
  }
  const photos = message.photo;
  const fileId = photos[photos.length - 1].file_id; // el tamaño mas grande
  const caption = (message.caption || "").trim();

  const bytes = await tgDownloadFile(env, fileId);
  if (!bytes) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "No pude bajar la foto, reintenta." });
  }
  // Guarda el ORIGEN en R2 (para poder iterar). Se borra al dar Guardar.
  await env.R2.put(editKey(chatId, "source"), bytes, { httpMetadata: { contentType: "image/jpeg" } });

  const { mode, prompt } = parseEdit(caption);
  return dispatchEdit(env, chatId, mode, prompt);
}

// Dispara el workflow de retoque con el ORIGEN que ya esta en R2.
async function dispatchEdit(env, chatId, mode, prompt) {
  await putEditState(env, chatId, { awaiting: false, mode, prompt });
  const r = await ghDispatch(env, "photo_edit.yml", {
    chat_id: String(chatId),
    mode,
    prompt: prompt || "",
  });
  if (!r.ok) {
    return tg(env, "sendMessage", { chat_id: chatId, text: `❌ No pude iniciar el retoque (${r.status}).` });
  }
  const txt = mode === "fondo"
    ? "🖼️ Cambiando el fondo y puliendo, sin tocar tu rostro. Tarda ~5-7 min y te la mando aca."
    : "🖼️ Retoque pro en proceso (piel mas limpia + textura, MISMA cara). Tarda ~5-7 min y te la mando aca.";
  return tg(env, "sendMessage", { chat_id: chatId, text: txt });
}

// "Otra vez": re-dispara con el mismo origen (sigue en R2) y el ultimo modo/prompt.
async function reDispatchEdit(env, chatId) {
  const src = env.R2 && (await env.R2.get(editKey(chatId, "source")));
  if (!src) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "No tengo una foto en edicion. Mandame una foto primero." });
  }
  const st = await getEditState(env, chatId);
  return dispatchEdit(env, chatId, (st && st.mode) || "retoque", (st && st.prompt) || "");
}

// Descarga un archivo de Telegram por file_id -> Uint8Array.
async function tgDownloadFile(env, fileId) {
  const r = await tg(env, "getFile", { file_id: fileId });
  const j = await r.json();
  const fp = j && j.result && j.result.file_path;
  if (!fp) return null;
  const fr = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fp}`);
  if (!fr.ok) return null;
  return new Uint8Array(await fr.arrayBuffer());
}
