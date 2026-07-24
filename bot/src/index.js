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

  // Fase 7: si hay una foto en edicion esperando el "que cambiar", el texto es el prompt.
  if (cmd && !cmd.startsWith("/") && !(text in BTN)) {
    const st = await getEditState(env, chatId);
    if (st && st.awaiting) return runEditWithStoredSource(env, chatId, line);
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
      await env.R2.delete(editKey(chatId, "source"));
      await env.R2.delete(editKey(chatId, "result"));
      await putEditState(env, chatId, { awaiting: false, lastPrompt: "" });
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✅ Listo. Borre el original (solo te queda el resultado que te mande). Mandame otra foto cuando quieras.",
      });
    }
    case "edit_again": {
      const st = await getEditState(env, chatId);
      return runEditWithStoredSource(env, chatId, (st && st.lastPrompt) || "mejora la imagen, mas nitida y profesional");
    }
    case "edit_change": {
      await putEditState(env, chatId, { awaiting: true, lastPrompt: "" });
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✏️ Escribeme el nuevo cambio para la MISMA foto.",
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

// ---------- Fase 7: editor de fotos (Cloudflare Workers AI, gratis, dentro del Worker) ----------
// Mandas una foto (con un texto de que cambiar como pie de foto, o luego) -> la edita
// con img2img y te la devuelve. El ORIGEN se guarda en R2 SOLO mientras iteras; al
// dar "Guardar" se borra (regla de storage de Juan). Nada de esto usa GitHub Actions.

const IMG_MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";

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

async function handlePhotoEdit(message, env, chatId) {
  if (!env.AI || !env.R2) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "El editor de fotos aun no esta activo (falta redeploy con Workers AI + R2).",
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

  if (!caption) {
    await putEditState(env, chatId, { awaiting: true, lastPrompt: "" });
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text:
        "🖼️ Foto recibida. Ahora escribeme QUE cambiar. Ejemplos:\n" +
        "· \"fondo de playa al atardecer\"\n" +
        "· \"estilo poster de cine, cinematografico\"\n" +
        "· \"fondo blanco de estudio\"\n\n" +
        "Tip: funciona mejor en ingles, pero entiende español.",
    });
  }
  return runEdit(env, chatId, caption, bytes);
}

async function runEditWithStoredSource(env, chatId, prompt) {
  const obj = env.R2 && (await env.R2.get(editKey(chatId, "source")));
  if (!obj) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "No tengo una foto en edicion. Mandame una foto primero.",
    });
  }
  const bytes = new Uint8Array(await obj.arrayBuffer());
  return runEdit(env, chatId, prompt, bytes);
}

async function runEdit(env, chatId, prompt, bytes) {
  await tg(env, "sendChatAction", { chat_id: chatId, action: "upload_photo" });
  await putEditState(env, chatId, { awaiting: false, lastPrompt: prompt });

  let outBytes;
  try {
    const resp = await env.AI.run(IMG_MODEL, {
      prompt,
      image_b64: bytesToB64(bytes),
      strength: 0.65,
      num_steps: 20,
      guidance: 7.5,
    });
    outBytes = await aiImageToBytes(resp);
  } catch (e) {
    console.error("AI edit error", e);
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "❌ No pude editar la foto: " + (e && e.message ? e.message : e),
    });
  }

  await env.R2.put(editKey(chatId, "result"), outBytes, { httpMetadata: { contentType: "image/png" } });
  const kb = {
    inline_keyboard: [
      [
        { text: "✅ Guardar", callback_data: "edit_save" },
        { text: "🔁 Otra vez", callback_data: "edit_again" },
      ],
      [{ text: "✏️ Otro cambio", callback_data: "edit_change" }],
    ],
  };
  return sendPhotoBytes(env, chatId, outBytes, `✨ Editada: "${prompt}". ¿La guardo o hacemos otro cambio?`, kb);
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

// Envia una imagen (bytes) al chat con sendPhoto (multipart) + botones.
function sendPhotoBytes(env, chatId, bytes, caption, kb) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  if (kb) form.append("reply_markup", JSON.stringify(kb));
  form.append("photo", new Blob([bytes], { type: "image/png" }), "edit.png");
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
  });
}

// bytes -> base64 (por bloques para no reventar el stack).
function bytesToB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// La salida de Workers AI puede venir como ReadableStream, Response, o { image: base64 }.
async function aiImageToBytes(resp) {
  if (resp instanceof ReadableStream) {
    return new Uint8Array(await new Response(resp).arrayBuffer());
  }
  if (resp && typeof resp.arrayBuffer === "function") {
    return new Uint8Array(await resp.arrayBuffer());
  }
  if (resp && typeof resp.image === "string") {
    const bin = atob(resp.image);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  throw new Error("respuesta de imagen desconocida");
}
