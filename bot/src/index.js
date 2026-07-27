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
    const url = new URL(request.url);
    // Ver el video por link (streaming desde R2). Telegram por bot no deja mandar
    // archivos >50MB; el video del canal pesa ~250MB, asi que se ve por aqui.
    if (request.method === "GET" && url.pathname.startsWith("/watch/")) {
      const key = decodeURIComponent(url.pathname.slice("/watch/".length));
      return handleWatch(request, env, key);
    }
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

// Sirve un video desde R2 por HTTP con soporte de Range (streaming + seek en el
// navegador). Solo expone los prefijos seguros (video/ y recipe/); NUNCA voice/ ni
// estados. Asi Juan ve el resultado sin el limite de 50MB de Telegram.
async function handleWatch(request, env, key) {
  if (!env.R2) return new Response("sin almacenamiento", { status: 500 });
  if (!/^(video|recipe)\/[^?]+\.(mp4|mov|webm)$/.test(key)) {
    return new Response("no permitido", { status: 403 });
  }
  const rangeHeader = request.headers.get("Range");
  let opts = {};
  const m = rangeHeader && /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (m) {
    const offset = parseInt(m[1], 10);
    opts.range = m[2] ? { offset, length: parseInt(m[2], 10) - offset + 1 } : { offset };
  }
  const obj = await env.R2.get(key, opts);
  if (!obj) return new Response("no encontrado", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", (obj.httpMetadata && obj.httpMetadata.contentType) || "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-store");
  const size = obj.size;
  if (m && obj.range) {
    const start = obj.range.offset || 0;
    const len = obj.range.length != null ? obj.range.length : size - start;
    headers.set("Content-Range", `bytes ${start}-${start + len - 1}/${size}`);
    headers.set("Content-Length", String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(obj.body, { status: 200, headers });
}

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

  // Fase 8 — MODO RECETA: si esta recolectando una receta, TODO (fotos/videos/texto) entra a
  // la RECETA (en orden), NO al retoque. Se sale con /listo (arma el reel) o /cancelar.
  {
    const rs = await getRecipeState(env, chatId);
    if (rs && rs.active) {
      const t = (message.text || "").trim();
      if (t === "/cancelar") return recipeCancel(env, chatId);
      if (t === "/listo") return recipeBuild(env, chatId, rs);
      if (Array.isArray(message.photo) && message.photo.length) return recipeAddMedia(message, env, chatId, rs, "photo");
      if (message.video) return recipeAddMedia(message, env, chatId, rs, "video");
      if (t && !t.startsWith("/")) return recipeAddText(env, chatId, rs, t);
      return tg(env, "sendMessage", { chat_id: chatId, text: "🍳 En modo receta. Manda fotos/videos + el texto. Al terminar: /listo (o /cancelar)." });
    }
  }

  // Fase 7: si manda una FOTO, entra al editor de imagenes.
  if (Array.isArray(message.photo) && message.photo.length) {
    return handlePhotoEdit(message, env, chatId);
  }

  // Fase 8: si manda un AUDIO / nota de voz, lo registra como una voz seleccionable.
  if (message.voice || message.audio) {
    return handleVoiceRegister(message, env, chatId);
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

  // Fase 8: si esta esperando el NOMBRE de una voz recien enviada, el texto es el nombre.
  if (cmd && !cmd.startsWith("/") && !(text in BTN) && env.R2) {
    const vpend = await env.R2.get(`voice/pending/${chatId}.json`);
    if (vpend) return finalizeVoice(env, chatId, line);
  }

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
          "🚧 /nuevo (video completo automático) está en construcción.\n\n" +
          "Por ahora hacemos los videos paso a paso:\n" +
          "🎙️ /voz — generar la narración\n" +
          "🎬 /render — renderizar el video\n" +
          "📊 /estado — ver el progreso",
      });
    }

    case "/render": {
      if (await busyGuard(env, chatId)) return;
      // Por fases: cada tramo de ~3 min pasa su prueba (7.5) y al final se unen.
      const r = await ghDispatch(env, "render_phased.yml", {});
      return ack(env, chatId, r, "Render por fases (cada tramo pasa la prueba, luego se unen)");
    }

    case "/voz": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "voice_parallel.yml", {});
      return ack(env, chatId, r, "Generación de voz (rápida, en paralelo)");
    }

    case "/estado":
      return sendStatus(env, chatId);

    case "/receta":
      return recipeStart(env, chatId);

    case "/listo":
      // Solo tiene sentido en modo receta; si llega aca es que no habia receta activa.
      return tg(env, "sendMessage", { chat_id: chatId, text: "No hay una receta activa. Empieza con /receta." });

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

  // Navegacion de menus/submenus (cambia el mismo mensaje).
  if (data.startsWith("menu:")) return showMenu(env, cb, data.slice(5));
  if (data === "voces:list") return listVoices(env, cb);

  switch (data) {
    case "voz": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "voice_parallel.yml", {});
      return ack(env, chatId, r, "Generación de voz (en paralelo)");
    }
    case "render": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "render_phased.yml", {});
      return ack(env, chatId, r, "Render por fases (cada tramo pasa la prueba, luego se unen)");
    }
    case "estado":
      return sendStatus(env, chatId);
    case "receta":
      return recipeStart(env, chatId);
    case "nuevo":
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text:
          "🚧 Video completo automático: en construcción.\n\n" +
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
        text: "✅ Listo, guardado. Borré el original (solo te queda el resultado que te mandé). Mándame otra foto cuando quieras.",
      });
    }
    case "edit_again":
      return reDispatchEdit(env, chatId);
    case "edit_softer":
      return reEditStrength(env, chatId, "suave");
    case "edit_stronger":
      return reEditStrength(env, chatId, "fuerte");
    case "edit_change": {
      const st = await getEditState(env, chatId);
      await putEditState(env, chatId, { awaiting: true, mode: (st && st.mode) || "retoque", prompt: (st && st.prompt) || "" });
      return tg(env, "sendMessage", {
        chat_id: chatId,
        text: "✏️ Escríbeme el nuevo cambio para la MISMA foto (ej: 'fondo blanco', 'más luz', 'piel más limpia').",
      });
    }

    default:
      // Botones de aprobacion que traen los resultados (voz/video).
      if (data.startsWith("approve:")) {
        if (await busyGuard(env, chatId)) return;
        // Publica a YouTube como PRIVADO (para que Juan lo revise antes de hacerlo publico).
        const r = await ghDispatch(env, "publish_youtube.yml", {});
        return ack(env, chatId, r, "Publicando en YouTube (privado, para tu revisión)");
      }
      if (data.startsWith("regen:")) {
        if (await busyGuard(env, chatId)) return;
        const r = await ghDispatch(env, "render_phased.yml", {});
        return ack(env, chatId, r, "Regenerando por fases");
      }
      if (data.startsWith("change:")) {
        return tg(env, "sendMessage", {
          chat_id: chatId,
          text:
            "✏️ ¿Qué quieres cambiar? Escríbemelo (ej: 'subtítulos más grandes', " +
            "'menos números', 'otro color') y lo ajusto para la próxima versión.",
        });
      }
      return;
  }
}

// ---------- Vistas ----------

// Menu de dos niveles: inicio (secciones) + un submenu por seccion. Directo y minimo.
const KB = {
  home: {
    inline_keyboard: [
      [{ text: "🎬 Video", callback_data: "menu:video" }],
      [{ text: "🖼️ Foto", callback_data: "menu:foto" }, { text: "🎤 Voces", callback_data: "menu:voces" }],
      [{ text: "🍳 Recetas", callback_data: "menu:recetas" }, { text: "❓ Ayuda", callback_data: "menu:ayuda" }],
    ],
  },
  video: {
    inline_keyboard: [
      [{ text: "🎙️ Generar voz", callback_data: "voz" }],
      [{ text: "🎬 Renderizar", callback_data: "render" }],
      [{ text: "📊 Estado", callback_data: "estado" }],
      [{ text: "⬅️ Volver", callback_data: "menu:home" }],
    ],
  },
  foto: { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "menu:home" }]] },
  voces: {
    inline_keyboard: [
      [{ text: "📋 Ver voces guardadas", callback_data: "voces:list" }],
      [{ text: "⬅️ Volver", callback_data: "menu:home" }],
    ],
  },
  recetas: {
    inline_keyboard: [
      [{ text: "🍳 Nueva receta", callback_data: "receta" }],
      [{ text: "⬅️ Volver", callback_data: "menu:home" }],
    ],
  },
  ayuda: { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "menu:home" }]] },
};

const TXT = {
  home: "*video-forge* — centro de control\n\nElige una sección:",
  video: "*🎬 Video*\n\n🎙️ Generar voz — narración del canal, con tu voz.\n🎬 Renderizar — arma el video POR FASES (cada tramo de ~3 min pasa la prueba 7.5 y al final se unen).\n📊 Estado — qué se está haciendo ahora.",
  foto: "*🖼️ Foto*\n\nMándame una foto: limpio la piel y subo la textura, sin cambiar tu cara (~5-7 min).\nPara el fondo, escribe *fondo ...* al enviarla (ej: fondo blanco).",
  voces: "*🎤 Voces*\n\nMándame una nota de voz y le pongo nombre. Sirve para narrar (tu voz o la de tu esposa).",
  recetas: "*🍳 Recetas*\n\nMándame las *fotos/videos* de tu receta (en el orden que quieres el reel) + el *texto* de la preparación. Yo mejoro tus tomas, completo lo que falte con clips/imágenes relacionados, narro con tu voz y pongo los subtítulos de los pasos.\n\nToca *Nueva receta* para empezar.",
  ayuda: "*❓ Ayuda* — qué puedes hacer:\n\n• *Foto* → mándala y te la retoco (piel/luz/color, sin cambiar tu cara).\n• *Nota de voz* → la guardo con nombre para narrar (tu voz o la de tu esposa).\n• *Video* → genero la voz y renderizo el video del canal POR FASES (cada tramo pasa 7.5).\n• *Receta* → /receta, mandas fotos/videos + el texto y armo un reel 9:16 con voz y subtítulos.\n\nTodo corre en la nube; te aviso aquí cuando termine. Solo tú puedes usar el bot.",
};

async function sendMenu(env, chatId) {
  await tg(env, "setMyCommands", {
    commands: [
      { command: "start", description: "🏠 Menú" },
      { command: "voz", description: "🎙️ Generar la narración" },
      { command: "render", description: "🎬 Renderizar el video (por fases)" },
      { command: "receta", description: "🍳 Armar un reel de receta" },
      { command: "estado", description: "📊 Qué se hace ahora" },
    ],
  });
  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "Markdown",
    reply_markup: KB.home,
    text: TXT.home,
  });
}

// Cambia el mensaje actual al submenu pedido (sin abrir un mensaje nuevo).
function showMenu(env, cb, key) {
  const k = KB[key] ? key : "home";
  return tg(env, "editMessageText", {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    parse_mode: "Markdown",
    reply_markup: KB[k],
    text: TXT[k],
  });
}

async function listVoices(env, cb) {
  let reg = {};
  if (env.R2) {
    const r = await env.R2.get("voice/registry.json");
    if (r) { try { reg = JSON.parse(await r.text()); } catch {} }
  }
  const names = Object.values(reg).map((v) => "• " + (v.label || "")).join("\n") || "_(ninguna aun)_";
  return tg(env, "editMessageText", {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    parse_mode: "Markdown",
    reply_markup: KB.voces,
    text: "*🎤 Voces guardadas*\n\n" + names + "\n\nMándame una nota de voz para agregar otra.",
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
      text: "✅ Nada en proceso ahora.\n\nManda /voz o /render para empezar. El resultado llega acá al terminar.",
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

    const exp = expectedMin(r.name);
    const pct = r.status === "queued" ? 0 : Math.min(99, Math.round((mins / exp) * 100));
    const eta = Math.max(0, exp - mins);
    blocks.push(
      `⏳ <a href="${r.html_url}">${esc(r.name)}</a>\n     ${paso}\n     ${pct}% · faltan ~${eta} min (lleva ${mins})`
    );
  }

  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    text:
      "⏳ <b>En proceso ahora</b>\n\n" +
      blocks.join("\n\n") +
      "\n\nToca el nombre para ver el detalle en vivo. Te aviso acá al terminar.",
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

// Minutos esperados por tipo de trabajo (para el % y el ETA aproximados).
function expectedMin(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("fases") || n.includes("phased")) return 90;  // fases en paralelo, cada una 3 intentos
  if (n.includes("render")) return 40;   // render del video completo (hasta 3 intentos)
  if (n.includes("receta")) return 25;
  if (n.includes("voiceover") || n.includes("voz")) return 18;
  if (n.includes("foto")) return 7;
  return 12;
}

// Corridas activas (en curso o en cola). null = no pude leer GitHub.
async function activeRuns(env) {
  const res = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs?per_page=20`);
  if (!res.ok) return null;
  return ((await res.json()).workflow_runs || []).filter((r) => r.status !== "completed");
}

function runProgress(r) {
  const mins = r.run_started_at ? Math.max(0, Math.round((Date.now() - Date.parse(r.run_started_at)) / 60000)) : 0;
  const exp = expectedMin(r.name);
  const pct = r.status === "queued" ? 0 : Math.min(99, Math.round((mins / exp) * 100));
  return { mins, pct, eta: Math.max(0, exp - mins) };
}

// Si hay algo pesado en proceso, avisa (con % y ETA) y devuelve true (ocupado).
async function busyGuard(env, chatId) {
  const act = await activeRuns(env);
  if (!act || !act.length) return false;
  const r = act[0];
  const p = runProgress(r);
  await tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    text: `⏳ Espera: hay algo en proceso.\n<b>${esc(r.name)}</b> — ${p.pct}%${p.eta ? ` · faltan ~${p.eta} min` : ""}\n\nTe aviso aquí al terminar. Toca 📊 Estado para el detalle.`,
  });
  return true;
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
      text: "El editor de fotos aún no está activo (falta redeploy con R2).",
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
async function dispatchEdit(env, chatId, mode, prompt, strength) {
  strength = strength || "suave"; // por defecto SUAVE (retoque natural, no plastico)
  await putEditState(env, chatId, { awaiting: false, mode, prompt, strength });
  const r = await ghDispatch(env, "photo_edit.yml", {
    chat_id: String(chatId),
    mode,
    prompt: prompt || "",
    strength,
  });
  if (!r.ok) {
    return tg(env, "sendMessage", { chat_id: chatId, text: `❌ No pude iniciar el retoque (${r.status}).` });
  }
  const txt = mode === "fondo"
    ? "🖼️ Cambiando el fondo y puliendo, sin tocar tu rostro. Tarda ~5-7 min y te la mando acá."
    : `🖼️ Retoque pro (${strength}) — piel más limpia + textura, MISMA cara. Tarda ~5-7 min y te la mando acá.`;
  return tg(env, "sendMessage", { chat_id: chatId, text: txt });
}

// "Otra vez": re-dispara con el mismo origen (sigue en R2), mismo modo/prompt/fuerza.
async function reDispatchEdit(env, chatId) {
  const src = env.R2 && (await env.R2.get(editKey(chatId, "source")));
  if (!src) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "No tengo una foto en edición. Mándame una foto primero." });
  }
  const st = await getEditState(env, chatId);
  return dispatchEdit(env, chatId, (st && st.mode) || "retoque", (st && st.prompt) || "", (st && st.strength) || "suave");
}

// Calibrar: re-hace la MISMA foto con otra suavidad (suave | medio | fuerte).
async function reEditStrength(env, chatId, strength) {
  const src = env.R2 && (await env.R2.get(editKey(chatId, "source")));
  if (!src) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "No tengo una foto en edición. Mándame una foto primero." });
  }
  const st = await getEditState(env, chatId);
  return dispatchEdit(env, chatId, (st && st.mode) || "retoque", (st && st.prompt) || "", strength);
}

// ---------- Fase 8: RECETA (reel 9:16 con tus fotos/videos + Pexels/IA + voz + subtitulos) ----------
// En "modo receta" las fotos NO se retocan: se recolectan EN ORDEN para armar el reel.
function recipeKey(chatId, kind) { return `recipe/${chatId}/${kind}`; }

async function getRecipeState(env, chatId) {
  if (!env.R2) return null;
  const o = await env.R2.get(recipeKey(chatId, "state"));
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch { return null; }
}
function setRecipeState(env, chatId, s) {
  return env.R2.put(recipeKey(chatId, "state"), JSON.stringify(s), { httpMetadata: { contentType: "application/json" } });
}

async function recipeStart(env, chatId) {
  if (!env.R2) return tg(env, "sendMessage", { chat_id: chatId, text: "Aún no puedo (falta R2)." });
  await setRecipeState(env, chatId, { active: true, n: 0 });
  await env.R2.delete(recipeKey(chatId, "text"));
  return tg(env, "sendMessage", {
    chat_id: chatId,
    parse_mode: "Markdown",
    text: "🍳 *Modo receta activado.*\n\nMándame, en el ORDEN que quieres el reel:\n• las *fotos/videos* de la receta (uno por uno)\n• el *texto* de la receta (ingredientes y pasos, como quieras)\n\nNarro con tu voz registrada. Para lo que falte, agrego clips/imágenes relacionados.\nCuando termines escribe */listo* (o */cancelar*).",
  });
}

async function recipeAddMedia(message, env, chatId, rs, kind) {
  const fileId = kind === "photo" ? message.photo[message.photo.length - 1].file_id : message.video.file_id;
  const bytes = await tgDownloadFile(env, fileId);
  if (!bytes) return tg(env, "sendMessage", { chat_id: chatId, text: "No pude bajar ese medio, reintenta." });
  const idx = String(rs.n).padStart(3, "0");
  const ext = kind === "video" ? "mp4" : "jpg";
  await env.R2.put(recipeKey(chatId, `media/${idx}.${ext}`), bytes, {
    httpMetadata: { contentType: kind === "video" ? "video/mp4" : "image/jpeg" },
  });
  rs.n += 1;
  await setRecipeState(env, chatId, rs);
  return tg(env, "sendMessage", { chat_id: chatId, text: `📎 ${kind === "video" ? "Video recibido" : "Foto recibida"} (${rs.n}). Sigue mandando o escribe /listo.` });
}

async function recipeAddText(env, chatId, rs, t) {
  const prev = await env.R2.get(recipeKey(chatId, "text"));
  const acc = (prev ? (await prev.text()) + "\n" : "") + t;
  await env.R2.put(recipeKey(chatId, "text"), acc, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
  return tg(env, "sendMessage", { chat_id: chatId, text: "📝 Receta anotada. Sigue mandando o escribe /listo." });
}

async function recipeCancel(env, chatId) {
  await setRecipeState(env, chatId, { active: false, n: 0 });
  return tg(env, "sendMessage", { chat_id: chatId, text: "🍳 Receta cancelada." });
}

async function recipeBuild(env, chatId, rs) {
  if (!rs.n) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "No recibí fotos/videos. Manda al menos uno y luego /listo." });
  }
  await setRecipeState(env, chatId, { active: false, n: rs.n });
  const r = await ghDispatch(env, "recipe_reel.yml", { chat_id: String(chatId), count: String(rs.n) });
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: r.ok
      ? `🍳 Armando tu reel de receta (${rs.n} medios + clips relacionados, voz y subtítulos). Tarda unos minutos y te lo mando acá.`
      : `❌ No pude iniciar el reel (${r.status}).`,
  });
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

// ---------- Fase 8: registrar una voz mandando un audio (para narrar recetas) ----------
// Mandas una nota de voz / audio -> se guarda como una voz seleccionable en R2 (privado,
// NUNCA en el repo publico). Chatterbox clona el timbre desde ese audio. Clonar la voz de
// otra persona real requiere su permiso (la voz de la esposa de Juan quedo AUTORIZADA por
// el, 2026-07-24). El registro `voice/registry.json` lista las voces disponibles.

function slugifyVoice(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "voz";
}

async function handleVoiceRegister(message, env, chatId) {
  if (!env.R2) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "Aún no puedo guardar voces (falta R2)." });
  }
  const a = message.voice || message.audio;
  const bytes = await tgDownloadFile(env, a.file_id);
  if (!bytes) return tg(env, "sendMessage", { chat_id: chatId, text: "No pude bajar el audio, reintenta." });
  await env.R2.put(`voice/pending/${chatId}`, bytes, { httpMetadata: { contentType: "audio/ogg" } });

  const caption = (message.caption || "").trim();
  if (caption) return finalizeVoice(env, chatId, caption);

  await env.R2.put(`voice/pending/${chatId}.json`, JSON.stringify({ awaiting: true }), {
    httpMetadata: { contentType: "application/json" },
  });
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: "🎤 Audio recibido. ¿Cómo llamo esta voz? Escríbeme un nombre corto (ej: \"esposa\", \"yo\").",
  });
}

async function finalizeVoice(env, chatId, name) {
  const slug = slugifyVoice(name);
  const pend = await env.R2.get(`voice/pending/${chatId}`);
  if (!pend) {
    return tg(env, "sendMessage", { chat_id: chatId, text: "No tengo un audio pendiente. Mándame primero la nota de voz." });
  }
  const bytes = new Uint8Array(await pend.arrayBuffer());
  await env.R2.put(`voice/ref_${slug}.mp3`, bytes, { httpMetadata: { contentType: "audio/mpeg" } });

  let reg = {};
  const r = await env.R2.get("voice/registry.json");
  if (r) { try { reg = JSON.parse(await r.text()); } catch {} }
  reg[slug] = { label: name, key: `voice/ref_${slug}.mp3` };
  await env.R2.put("voice/registry.json", JSON.stringify(reg), { httpMetadata: { contentType: "application/json" } });

  await env.R2.delete(`voice/pending/${chatId}`);
  await env.R2.delete(`voice/pending/${chatId}.json`);
  return tg(env, "sendMessage", {
    chat_id: chatId,
    text: `✅ Voz guardada como "${slug}". La usaré para narrar (ej: los reels de recetas). Manda otra voz cuando quieras.`,
  });
}
