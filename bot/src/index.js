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

import { APP_HTML } from "./miniapp.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Mini App (interfaz "tipo app pro" dentro de Telegram).
    if (url.pathname === "/app") {
      // no-store: Telegram Mini App cachea el WebView; sin esto sigue sirviendo una version vieja.
      return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache" } });
    }
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (e) {
        // Nunca dejar la app en blanco por un error del servidor: devolver JSON legible.
        return new Response(JSON.stringify({ error: "server", detail: (e && e.message) || "error" }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }
    // Ver el video por link (streaming desde R2). Telegram por bot no deja mandar
    // archivos >50MB; el video del canal pesa ~250MB, asi que se ve por aqui.
    if (request.method === "GET" && url.pathname.startsWith("/watch/")) {
      const key = decodeURIComponent(url.pathname.slice("/watch/".length));
      return handleWatch(request, env, key, url.searchParams.get("t"));
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
async function handleWatch(request, env, key, token) {
  if (!env.R2) return new Response("sin almacenamiento", { status: 500 });
  if (!/^(video|recipe|voices)\/[^?]+\.(mp4|mov|webm|jpg|jpeg|png|webp|mp3|wav|m4a)$/.test(key)) {
    return new Response("no permitido", { status: 403 });
  }
  // Contenido PERSONAL (recipe/): exige enlace firmado (HMAC). Asi no queda publico
  // aunque alguien adivine la URL + el chat_id. Los video/ del canal (que van a YouTube) siguen abiertos.
  if (key.startsWith("recipe/")) {
    const good = await watchToken(env, key);
    if (!good || token !== good) return new Response("no autorizado", { status: 403 });
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

// ---------- Mini App: API (auth por initData de Telegram) ----------
async function hmacBytes(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
// Token firmado para enlaces /watch de contenido personal (recipe/). Mismo secreto
// que usan los workflows (TELEGRAM_BOT_TOKEN), asi el que arma el reel puede firmar el link.
async function watchToken(env, key) {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const h = toHex(await hmacBytes(new TextEncoder().encode(env.TELEGRAM_BOT_TOKEN), "watch:" + key));
  return h.slice(0, 32);
}

// Valida el initData que manda la Web App de Telegram. Devuelve el user si es valido
// y es el OWNER; si no, null. (Algoritmo oficial de Telegram con HMAC-SHA256.)
async function validateInitData(initData, env) {
  if (!initData || !env.TELEGRAM_BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await hmacBytes(new TextEncoder().encode("WebAppData"), env.TELEGRAM_BOT_TOKEN);
  const check = toHex(await hmacBytes(secret, dcs));
  if (check !== hash) return null;
  // Frescura: rechazar initData de mas de 24 h (cierra el replay a largo plazo).
  const authDate = +(params.get("auth_date") || 0);
  if (!authDate || (Date.now() / 1000 - authDate) > 86400) return null;
  let user;
  try { user = JSON.parse(params.get("user") || "null"); } catch { return null; }
  if (!user || !isOwner(user.id, env)) return null;
  return user;
}

const APP_WORKFLOWS = new Set([
  "render_phased.yml", "voice_parallel.yml", "channel_report.yml", "shorts_plan.yml",
  "shorts_final.yml", "publish_youtube.yml", "set_privacy.yml", "recipe_reel.yml",
  "produce_video.yml", "seo_regen.yml", "thumbnail_only.yml", "voice_samples.yml",
  "schedule_youtube.yml", "daily_video.yml", "channel_report.yml", "niche_radar.yml",
  "report_auto2.yml", "produce_oddly.yml", "publish_oddly.yml", "build_asmr_library.yml", "daily_oddly.yml",
]);

// Voces disponibles para el canal (con su ejemplo en R2). engine/kvoice se usan en la voz.
const VOICE_OPTIONS = [
  { id: "gemini_charon", label: "Locutor Gemini (Charon)", engine: "gemini", kvoice: "", sample: "voices/sample_gemini_charon.mp3" },
  { id: "kokoro_am_michael", label: "Kokoro Michael (americano)", engine: "kokoro", kvoice: "am_michael", sample: "voices/sample_kokoro_am_michael.mp3" },
  { id: "kokoro_am_adam", label: "Kokoro Adam (americano)", engine: "kokoro", kvoice: "am_adam", sample: "voices/sample_kokoro_am_adam.mp3" },
  { id: "kokoro_bm_george", label: "Kokoro George (británico)", engine: "kokoro", kvoice: "bm_george", sample: "voices/sample_kokoro_bm_george.mp3" },
  { id: "kokoro_bm_lewis", label: "Kokoro Lewis (británico)", engine: "kokoro", kvoice: "bm_lewis", sample: "voices/sample_kokoro_bm_lewis.mp3" },
  { id: "kokoro_af_heart", label: "Kokoro Heart (femenina)", engine: "kokoro", kvoice: "af_heart", sample: "voices/sample_kokoro_af_heart.mp3" },
  { id: "kokoro_af_bella", label: "Kokoro Bella (femenina)", engine: "kokoro", kvoice: "af_bella", sample: "voices/sample_kokoro_af_bella.mp3" },
  { id: "kokoro_bf_emma", label: "Kokoro Emma (británica)", engine: "kokoro", kvoice: "bf_emma", sample: "voices/sample_kokoro_bf_emma.mp3" },
];

// Analisis de tendencias con Gemini (¿los proximos videos estan alineados?).
async function geminiTrends(env) {
  if (!env.GEMINI_API_KEY) return { error: "Falta GEMINI_API_KEY en el Worker (agrégalo al deploy)." };
  const state = (await r2json(env, "channel/state.json")) || {};
  const up = (state.upcoming || []).map((u) => `#${u.n}: ${u.topic}`).join("\n") || "(ninguno)";
  const pub = (state.published || []).map((v) => v.title).join("; ") || "(ninguno)";
  const prompt = `Eres estratega de un canal faceless de datos/dinero en YouTube (ingles, mercado EE.UU.). Ya publicado: ${pub}. Proximos videos planeados:\n${up}\n\nResponde en ESPAÑOL, breve y concreto (sin relleno): por CADA proximo tema, una linea con potencial de vistas ALTO/MEDIO/BAJO segun tendencias e interes actual del publico + un ajuste corto para mejorarlo. Al final, sugiere 1-2 temas calientes que FALTAN y deberiamos agregar.`;
  for (const m of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return { analysis: t };
    } catch {}
  }
  return { error: "No pude analizar (Gemini no respondio)." };
}

// Analisis de RENDIMIENTO: que videos rinden mas (vistas + minutos vistos) y que replicar.
async function geminiInsights(env) {
  if (!env.GEMINI_API_KEY) return { error: "Falta GEMINI_API_KEY en el Worker." };
  const inv = await channelInventory(env);
  const vids = [...(inv.longs || []), ...(inv.shorts || [])]
    .filter((v) => v.privacy === "public")
    .map((v) => ({ t: v.title, type: (v.seconds || 0) <= 60 ? "short" : "largo", views: v.views || 0, watch: v.watch_min || 0 }))
    .sort((a, b) => b.views - a.views);
  if (!vids.length) return { error: "Aún no hay videos públicos con métricas para analizar." };
  const lines = vids.map((v) => `- [${v.type}] ${v.t} — ${v.views} vistas, ${v.watch} min vistos`).join("\n");
  const prompt = `Eres estratega de crecimiento de un canal faceless de datos/dinero en YouTube (ingles, EE.UU.). Videos publicados con su rendimiento REAL:\n${lines}\n\nAnaliza y responde en ESPAÑOL, breve y accionable (sin relleno):\n1) Qué temas/formatos rinden MÁS (por vistas y por minutos vistos) y QUÉ tienen en común (tema, ángulo, tipo de título).\n2) Qué NO funciona.\n3) 3-4 IDEAS de próximos videos concretas que REPLIQUEN lo que funciona, con el título tentativo en INGLÉS. Prioriza vistas y retención.`;
  for (const m of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return { analysis: t };
    } catch {}
  }
  return { error: "No pude analizar (Gemini no respondió)." };
}

// Offset de ET (America/New_York) vs UTC en una fecha dada (-4 EDT / -5 EST) — maneja el DST.
function etOffsetHours(d) {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName").value;
    const m = s.match(/GMT([+-]?\d{1,2})/); return m ? parseInt(m[1], 10) : -4;
  } catch { return -4; }
}
// MEJORES horas de publicacion (ET) por dia de semana — DOS slots/dia para poder publicar >=2/dia:
//  fin de semana: 9AM y 3PM · lunes: 3PM y 7PM · mar-vie: 12PM y 5PM.
function bestHoursET(dow) { if (dow === 0 || dow === 6) return [9, 12, 15, 18]; if (dow === 1) return [12, 15, 18, 21]; return [11, 14, 17, 20]; }
// Lista cronologica de TODOS los slots (mejor hora) de los proximos `days` dias, en ms UTC.
function upcomingSlotList(days) {
  const out = [], now = Date.now();
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  for (let day = 0; day < days; day++) {
    const probe = new Date(now + day * 86400 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(probe);
    const y = +parts.find((p) => p.type === "year").value, mo = +parts.find((p) => p.type === "month").value, da = +parts.find((p) => p.type === "day").value;
    const dow = dowMap[parts.find((p) => p.type === "weekday").value] ?? 2;
    const off = etOffsetHours(probe);
    for (const h of bestHoursET(dow)) out.push(Date.UTC(y, mo - 1, da, h - off, 0, 0));
  }
  return out.sort((a, b) => a - b);
}
// Proxima MEJOR hora (ET) libre (>=2h de anticipacion). Reparte: primero franjas VACIAS; si todas
// tienen 1, permite una 2a en la misma hora (TOPE 2/hora). Solo mira las ocupadas de ESTE canal.
function nextBestSlot(occupiedMs) {
  const minAhead = Date.now() + 2 * 3600 * 1000;
  const near = (s) => occupiedMs.filter((o) => Math.abs(o - s) < 30 * 60 * 1000).length;
  const slots = upcomingSlotList(21);
  for (const s of slots) { if (s < minAhead) continue; if (near(s) === 0) return new Date(s).toISOString(); }
  for (const s of slots) { if (s < minAhead) continue; if (near(s) < 2) return new Date(s).toISOString(); }
  return null;
}
// Calendario dia-a-dia: cada dia con sus slots (mejor hora), marcados LLENO (video programado) o LIBRE.
function buildCalendar(scheduled, days) {
  const now = Date.now();
  const isoETDate = (ms) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms)); return p.find((x) => x.type === "year").value + "-" + p.find((x) => x.type === "month").value + "-" + p.find((x) => x.type === "day").value; };
  const fmtDay = (ms) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/New_York", weekday: "short", day: "numeric", month: "short" }).format(new Date(ms));
  const fmtTime = (ms) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ms));
  const items = (scheduled || []).map((s) => ({ ms: Date.parse(s.publish_at), title: s.title, type: s.type, video_id: s.video_id })).filter((x) => x.ms > now).sort((a, b) => a.ms - b.ms);
  const used = new Set(), daysMap = new Map();
  for (const slotMs of upcomingSlotList(days)) {
    if (slotMs < now - 30 * 60000) continue;
    const dkey = isoETDate(slotMs);
    if (!daysMap.has(dkey)) daysMap.set(dkey, { date: dkey, label: fmtDay(slotMs), slots: [] });
    let match = null;
    for (let i = 0; i < items.length; i++) { if (used.has(i)) continue; if (Math.abs(items[i].ms - slotMs) < 3600 * 1000) { match = items[i]; used.add(i); break; } }
    daysMap.get(dkey).slots.push({ time: fmtTime(slotMs), filled: !!match, title: match ? match.title : null, type: match ? match.type : null });
  }
  // Programados en horas NO estandar (reprogramaciones manuales): mostrarlos igual, para no ocultar nada.
  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue; const it = items[i]; const dkey = isoETDate(it.ms);
    if (!daysMap.has(dkey)) daysMap.set(dkey, { date: dkey, label: fmtDay(it.ms), slots: [] });
    daysMap.get(dkey).slots.push({ time: fmtTime(it.ms), filled: true, title: it.title, type: it.type, off_slot: true });
  }
  return [...daysMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}
// Programa un video en la proxima mejor hora libre (usado por /api/schedule y /api/approve).
async function doSchedule(env, vid, isProductionVideo) {
  const inv = await channelInventory(env);
  const occupied = [...(inv.longs || []), ...(inv.shorts || [])].filter((v) => v.publish_at && Date.parse(v.publish_at) > Date.now()).map((v) => Date.parse(v.publish_at));
  // Contar tambien lo recien programado localmente, para no meter dos videos en el mismo slot.
  const prevLocal = (await r2json(env, "channel/scheduled_local.json")) || [];
  prevLocal.forEach((s) => { if (s.publish_at && s.video_id !== vid && Date.parse(s.publish_at) > Date.now()) occupied.push(Date.parse(s.publish_at)); });
  const slot = nextBestSlot(occupied);
  if (!slot) return { ok: false, error: "no encontré un horario libre" };
  const r = await ghDispatch(env, "schedule_youtube.yml", { video_id: vid, publish_at: slot });
  if (r.ok) {
    if (isProductionVideo) {
      for (const f of ["render_pending.json", "quality.json", "package.json", "seo_approved.json", "video_id.txt"]) { try { await env.R2.delete(`video/0001-youtube-money/${f}`); } catch {} }
    }
    const title = (inv.longs || []).concat(inv.shorts || []).find((v) => v.video_id === vid);
    const rec = { video_id: vid, publish_at: slot, title: (title && title.title) || "Video", type: (title && (title.seconds || 0) <= 60) ? "short" : "long", at: new Date().toISOString() };
    const merged = [...prevLocal.filter((s) => s.video_id !== vid), rec];
    try { await env.R2.put("channel/scheduled_local.json", JSON.stringify(merged), { httpMetadata: { contentType: "application/json" } }); } catch {}
    try { await env.R2.delete("channel/inventory_cache.json"); } catch {}
  }
  return { ok: r.ok, publish_at: slot };
}

async function handleApi(request, env, url) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  const initData = request.headers.get("X-Init-Data") || "";
  const user = await validateInitData(initData, env);
  if (!user) return json({ error: "no autorizado" }, 403);
  const chatId = env.OWNER_CHAT_ID;

  if (url.pathname === "/api/state") {
    const state = await r2json(env, "channel/state.json") || {};
    const plan = await r2json(env, "shorts/0001-youtube-money/plan.json") || {};
    const approvedShorts = (plan.shorts || []).filter((s) => s.approved);
    // Inventario REAL del canal (cacheado 10 min): largos + shorts + subs/vistas.
    // Asi la lista de publicados y el contador se actualizan solos al subir/publicar.
    const inv = await channelInventory(env);
    // OCULTOS (duplicados retirados): fuera de TODA la app (arbol, matriz, contadores...).
    const hidden = new Set((await r2json(env, "channel/hidden_videos.json")) || []);
    if (hidden.size) {
      inv.longs = (inv.longs || []).filter((v) => !hidden.has(v.video_id));
      inv.shorts = (inv.shorts || []).filter((v) => !hidden.has(v.video_id));
    }
    const seedPub = state.published || [];
    if (inv.longs && inv.longs.length) {
      state.published = inv.longs.map((v) => {
        const seed = seedPub.find((p) => p.video_id === v.video_id) || {};
        return { video_id: v.video_id, title: v.title, privacy: v.privacy, published_at: v.published_at, n: seed.n, ai_score: seed.ai_score, stats: { views: v.views, likes: v.likes } };
      });
    }
    // Privacidad/vistas frescas de TODOS los shorts subidos (del plan).
    const planShorts = plan.shorts || [];
    const yt = await ytStatus(env, planShorts.filter((s) => s.video_id).map((s) => s.video_id));
    // Contadores: cuantos videos largos y cuantos shorts (lo que pidio Juan).
    state.long_count = (state.published || []).length;
    state.shorts_count = (inv.shorts || []).length;
    state.shorts_public = (inv.shorts || []).filter((s) => s.privacy === "public").length;
    // Lista compacta de TODOS los videos (largos + shorts) con tipo, vistas y duracion.
    state.all_videos = [
      ...(inv.longs || []).map((v) => ({ type: "long", video_id: v.video_id, title: v.title, privacy: v.privacy, views: v.views, seconds: v.seconds, watch_min: v.watch_min || 0, avg_sec: v.avg_sec || 0 })),
      ...(inv.shorts || []).map((v) => ({ type: "short", video_id: v.video_id, title: v.title, privacy: v.privacy, views: v.views, seconds: v.seconds, watch_min: v.watch_min || 0, avg_sec: v.avg_sec || 0 })),
    ];
    state.analytics_ok = !!inv.analytics_ok;
    state.analytics = inv.analytics || null;
    // PROGRAMADOS: videos con publishAt en el futuro (YouTube los publica solo a esa hora).
    // Al publicarse, YouTube quita publishAt y pasan a público -> desaparecen de esta lista.
    const nowMs = Date.now();
    const invAll = [...(inv.longs || []), ...(inv.shorts || [])];
    const fromYT = invAll
      .filter((v) => v.publish_at && Date.parse(v.publish_at) > nowMs)
      .map((v) => ({ video_id: v.video_id, title: v.title, type: (v.seconds || 0) <= 60 ? "short" : "long", publish_at: v.publish_at }));
    // + registro LOCAL (recien programados, antes de que YouTube confirme). Se descartan los que ya
    // aparecen en YouTube (evita duplicar) o que ya son publicos (ya se publicaron) o cuya hora paso.
    const schedLocal = (await r2json(env, "channel/scheduled_local.json")) || [];
    const publicIds = new Set(invAll.filter((v) => v.privacy === "public").map((v) => v.video_id));
    const ytIds = new Set(fromYT.map((v) => v.video_id));
    const fromLocal = schedLocal.filter((s) => s.publish_at && Date.parse(s.publish_at) > nowMs && !publicIds.has(s.video_id) && !ytIds.has(s.video_id));
    state.scheduled = [...fromYT, ...fromLocal].sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at));
    // CALENDARIO dia-a-dia (proximos 12 dias): mejores horas, marcadas lleno/libre. Meta: >=2/dia.
    state.calendar = buildCalendar(state.scheduled, 12);
    state.totals = {
      views: inv.total_views || state.all_videos.reduce((s, v) => s + (v.views || 0), 0),
      watch_min: state.all_videos.reduce((s, v) => s + (v.watch_min || 0), 0),
      subs: inv.subs || 0,
      videos: (inv.longs || []).length + (inv.shorts || []).length,
      longs: (inv.longs || []).length,
      shorts: (inv.shorts || []).length,
    };
    // FABRICA: capacidad/throughput real (publicados en 7 dias, GRATIS desde el inventario) + experimento de duracion.
    const wk = Date.now() - 7 * 86400 * 1000;
    const pub7 = invAll.filter((v) => v.published_at && Date.parse(v.published_at) >= wk);
    const exp = (await r2json(env, "channel/experiments.json")) || {};
    state.factory = {
      pub_7d: pub7.length,
      pub_7d_long: pub7.filter((v) => (v.seconds || 0) > 60).length,
      pub_7d_short: pub7.filter((v) => (v.seconds || 0) <= 60).length,
      per_day: +(pub7.length / 7).toFixed(1),
      duration: exp.duration || null,
    };
    // ANALISIS DEL CANAL: score "que tan prometedor" + problemas/reclamaciones (lo que la API expone) + narrativa IA.
    {
      const A = inv.analytics || {};
      const daily = A.daily || [];
      const sumV = (arr) => arr.reduce((s, x) => s + (x.views || 0), 0);
      const last3 = sumV(daily.slice(-3)), prev3 = sumV(daily.slice(-6, -3));
      const trend = prev3 > 0 ? (last3 - prev3) / prev3 : (last3 > 0 ? 1 : 0);
      const avgSec = (A.last28 && A.last28.avg_sec) || 0;
      const avgLen = (inv.longs || []).length ? ((inv.longs).reduce((s, v) => s + (v.seconds || 0), 0) / inv.longs.length) : 0;
      const retention = avgLen > 0 ? Math.min(1, avgSec / avgLen) : 0;
      const recent = invAll.filter((v) => v.published_at && (Date.now() - Date.parse(v.published_at)) < 14 * 86400 * 1000).length;
      const watchHours = (state.totals.watch_min || 0) / 60;
      const yppSubs = Math.min(1, (inv.subs || 0) / 1000), yppHours = Math.min(1, watchHours / 4000);
      const gScore = Math.max(0, Math.min(1, (trend + 1) / 2)) * 35;
      const rScore = retention * 30;
      const cScore = Math.min(1, recent / 6) * 20;
      const yScore = ((yppSubs + yppHours) / 2) * 15;
      const promise = Math.round(gScore + rScore + cScore + yScore);
      const label = promise >= 66 ? "Prometedor" : promise >= 40 ? "En construcción" : "Arrancando";
      const problems = invAll
        .filter((v) => v.rejection_reason || (v.upload_status && !["processed", "uploaded"].includes(v.upload_status)))
        .map((v) => ({ video_id: v.video_id, title: v.title, reason: v.rejection_reason || v.upload_status }));
      state.analysis = {
        promise, label,
        factors: { crecimiento: Math.round(gScore), retencion: Math.round(rScore), cadencia: Math.round(cScore), ypp: Math.round(yScore) },
        trend_pct: Math.round(trend * 100), retention_pct: Math.round(retention * 100), recent_14d: recent,
        problems, ai: (await r2json(env, "channel/analysis.json")) || null,
      };
    }
    // RADAR DE NICHOS (canal auto #2): portafolio + ranking + recomendacion semanal.
    state.niche_radar = (await r2json(env, "channel/niche_radar.json")) || null;
    // CANAL AUTO #2 (Oddly Loop): estado real (videos/subs/vistas/min), lo llena report_auto2.
    state.auto2 = (await r2json(env, "channel/auto2/state.json")) || null;
    // ARBOL de Videos: cada LARGO con sus SHORTS anidados debajo (pestaña Videos, como la pidio Juan).
    // Mapeo short->padre: ledger persistente (channel/shorts_map.json) + el plan actual (for_video_id).
    const shortsMap = (await r2json(env, "channel/shorts_map.json")) || {};
    if (plan.for_video_id) (plan.shorts || []).forEach((s) => { if (s.video_id) shortsMap[s.video_id] = plan.for_video_id; });
    const byParent = {};
    (inv.shorts || []).forEach((sh) => { const p = shortsMap[sh.video_id]; if (p) (byParent[p] = byParent[p] || []).push(sh); });
    // Ledger de la fabrica (channel/videos.json): lo que NO esta aqui = subido MANUALMENTE por Juan.
    const vledger = (await r2json(env, "channel/videos.json")) || {};
    const slimV = (v) => ({ video_id: v.video_id, title: (v.title || "").replace(/ #Shorts$/, ""), privacy: v.privacy, views: v.views || 0, watch_min: v.watch_min || 0, manual: !vledger[v.video_id] });
    state.video_tree = (inv.longs || []).map((l) => ({ ...slimV(l), shorts: (byParent[l.video_id] || []).map(slimV) }));
    const groupedIds = new Set(Object.values(byParent).flat().map((s) => s.video_id));
    state.video_tree_ungrouped = (inv.shorts || []).filter((sh) => !groupedIds.has(sh.video_id)).map(slimV);
    // MATRIZ de control por video largo: check de lo hecho + acciones posibles.
    // publicado = en vivo del canal; miniatura = registro; shorts = registro O el plan
    // (si el plan es de este video y sus shorts aprobados ya estan subidos) -> auto-corrige.
    const planFor = plan.for_video_id;
    const planApproved = (plan.shorts || []).filter((s) => s.approved);
    const planShortsDone = planApproved.length > 0 && planApproved.every((s) => s.video_id);
    state.video_matrix = await Promise.all((inv.longs || []).map(async (v) => {
      const st = (vledger[v.video_id] || {}).stages || {};
      // La miniatura ya viene resuelta en el inventario cacheado (evita 1 R2.head por video en CADA request).
      const thumbUrl = v.thumb_url || null;
      const scheduled = !!(v.publish_at && Date.parse(v.publish_at) > Date.now());
      return {
        video_id: v.video_id, title: v.title, public: v.privacy === "public", scheduled, publish_at: v.publish_at || null,
        views: v.views, watch_min: v.watch_min || 0, manual: !vledger[v.video_id],
        thumb_url: thumbUrl, thumb_approved: !!st.thumb_approved,
        stages: {
          // "publicado" = ya gestionado: público EN VIVO o PROGRAMADO (se publica solo a su hora).
          publicado: v.privacy === "public" || scheduled,
          miniatura: !!st.thumbnail, // ✓ = aplicada en YouTube (thumb_url = solo generada, por aprobar)
          // shorts HECHOS si: el registro lo dice, O el video YA TIENE shorts en el canal (byParent),
          // O el plan actual es de este video y sus shorts aprobados ya se subieron.
          shorts: !!st.shorts || ((byParent[v.video_id] || []).length > 0) || !!(planFor && planFor === v.video_id && planShortsDone),
        },
      };
    }));
    // Shorts "hechos" = hay aprobados y TODOS estan subidos (tienen video_id).
    const shortsDone = approvedShorts.length > 0 && approvedShorts.every((s) => s.video_id);
    (state.published || []).forEach((v, i) => { v.shorts_done = i === 0 ? shortsDone : false; });
    // Agrupa los shorts bajo el video al que pertenecen (por ahora, el 1o publicado).
    const firstVid = (state.published || [])[0] || {};
    const shortsWith = approvedShorts.map((s) => ({
      title: s.title, video_id: s.video_id || null,
      privacy: s.video_id ? (yt[s.video_id] ? yt[s.video_id].privacy : "private") : "—",
      views: s.video_id && yt[s.video_id] ? yt[s.video_id].views : 0,
    }));
    state.shorts_groups = shortsWith.length ? [{ n: firstVid.n || 1, title: firstVid.title || "Video 1", shorts: shortsWith }] : [];
    state.shorts_list = shortsWith;
    // PROPUESTA completa de shorts (para aprobar/generar/publicar DESDE la app).
    // Estado por short: pending (sin decidir) | approved | skipped | uploaded.
    // Hora programada (publishAt) de cada short subido, del inventario de YouTube.
    const shortPub = {}; invAll.forEach((v) => { if (v.publish_at) shortPub[v.video_id] = v.publish_at; });
    state.shorts_proposal = planShorts.map((s) => {
      const uploaded = !!s.video_id;
      // pending = aun sin decidir (approved!=true y NO saltado). skipped SOLO si skipped===true.
      const st = uploaded ? "uploaded" : (s.approved === true ? "approved" : (s.skipped === true ? "skipped" : "pending"));
      return {
        n: s.n, title: s.title || ("Short #" + ((s.n || 0) + 1)), hook: s.hook || "", caption: s.caption || "",
        hashtags: s.hashtags || [], dur: s.dur || null, start: s.start != null ? s.start : null, end: s.end != null ? s.end : null,
        state: st, video_id: s.video_id || null,
        privacy: uploaded ? (yt[s.video_id] ? yt[s.video_id].privacy : "private") : null,
        publish_at: uploaded ? (shortPub[s.video_id] || null) : null,
        views: uploaded && yt[s.video_id] ? yt[s.video_id].views : 0,
      };
    });
    const sp = state.shorts_proposal;
    // Los shorts se hacen del ultimo video PUBLICO (no de uno programado/privado).
    const latestPublic = (state.published || []).find((v) => v.privacy === "public") || {};
    // ¿El plan actual es del ULTIMO video publico? (para no sugerir de más).
    const forCurrent = !!(plan.for_video_id && latestPublic.video_id && plan.for_video_id === latestPublic.video_id);
    const anyToAct = sp.some((s) => s.state === "pending" || s.state === "approved");
    const allDone = sp.some((s) => s.state === "uploaded") && !anyToAct;
    // ¿El VIDEO PADRE de estos shorts ya esta publico? No se deben publicar shorts de un video
    // privado/programado (llevarian trafico a un video que nadie ve).
    const parentVid = invAll.find((v) => v.video_id === plan.for_video_id);
    const parentPublic = !!(parentVid && parentVid.privacy === "public");
    state.shorts_status = {
      total: sp.length,
      pending: sp.filter((s) => s.state === "pending").length,
      approved_pend: sp.filter((s) => s.state === "approved").length,
      uploaded: sp.filter((s) => s.state === "uploaded").length,
      all_done: allDone,
      for_current: forCurrent,
      parent_id: plan.for_video_id || null,
      parent_public: parentPublic,
      parent_title: (parentVid && parentVid.title) || null,
      // Sugerir SOLO si YA hay un video PUBLICO, no hay nada por decidir/generar, y (no hay plan o es de otro video).
      can_suggest: !!latestPublic.video_id && !anyToAct && (sp.length === 0 || !forCurrent),
      latest_video_id: latestPublic.video_id || null,
    };
    // Avanzar PROXIMOS: quitar los que ya se produjeron (channel/produced.json = {done:[ns]}).
    const produced = (await r2json(env, "channel/produced.json")) || { done: [] };
    const doneSet = new Set(produced.done || []);
    // Avanza los proximos: quita los ya producidos (produced.json, señal principal) Y los
    // cubiertos por la cantidad de largos PUBLICOS (auto-avance de respaldo si falta produced.json).
    // Usa PUBLICOS (no todos) para que un largo privado/borrador no oculte temas de la cola.
    const publicLongCount = (state.published || []).filter((v) => v.privacy === "public").length;
    state.upcoming = (state.upcoming || []).filter((u) => !doneSet.has(u.n) && u.n > publicLongCount);
    // Metricas frescas del canal (del inventario, cada 10 min).
    if (inv.at) {
      state.channel_stats = { subs: inv.subs, total_views: inv.total_views, videos: (inv.longs || []).length + (inv.shorts || []).length };
      state.monetization = state.monetization || {};
      state.monetization.subs = inv.subs;
    }
    state.inventory_at = inv.at;
    // MEJORA CONTINUA: aprendizajes (métricas reales + tendencias) que se aplican al próximo
    // guion. Los genera pipeline/learnings.mjs antes de producir y los guarda en R2.
    const learn = await r2json(env, "channel/learnings.json");
    state.learnings = learn ? { brief: learn.brief || "", source: learn.source || "", top: (learn.top || []).slice(0, 5), at: learn.generated_at || null } : null;
    // Aprendizajes de ERRORES (identificados + analizados por IA + patrones). "Aprende dia con dia."
    const elog = await r2json(env, "channel/error_log.json");
    state.error_learnings = elog ? { incidents: (elog.incidents || []).slice(-6).reverse(), patterns: elog.patterns || [], at: elog.updated_at || null } : null;
    // Salud de las herramientas diarias (APIs gratis).
    state.tools_health = await r2json(env, "channel/tools_health.json");
    // AUTO-MEJORA del render: lo que aprendió del último video y aplica al siguiente.
    const craft = await r2json(env, "channel/craft_feedback.json");
    state.craft = craft ? { footage: craft.footage_feedback || "", hook: craft.hook || "", score: craft.score || 0, fixes: craft.fixes || {}, at: craft.at || null } : null;
    // Uso de R2 (alerta para que siga gratis: limite 10 GB).
    const r2u = await r2Usage(env);
    const usedGb = (r2u.bytes || 0) / (1024 * 1024 * 1024);
    state.r2 = { used_gb: Math.round(usedGb * 100) / 100, count: r2u.count || 0, limit_gb: 10, pct: Math.min(100, Math.round((usedGb / 10) * 100)) };
    let voices = [];
    const reg = await r2json(env, "voice/registry.json");
    if (reg) voices = Object.values(reg).map((v) => v.label);
    state.voices = voices;
    // Selector de voz del canal (con ejemplos para escuchar).
    const vchoice = await r2json(env, "channel/voice_choice.json");
    state.voices_pick = {
      current: (vchoice && vchoice.id) || "gemini_charon",
      options: VOICE_OPTIONS.map((v) => ({ id: v.id, label: v.label, sample_url: "/watch/" + v.sample })),
    };
    // Corridas: activas (en proceso) + PROBLEMAS (fallidas recientes, con el paso que fallo).
    const runsRes = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs?per_page=50`);
    const runs = runsRes.ok ? ((await runsRes.json()).workflow_runs || []) : [];
    // Activas CON paso actual + % + ETA (para verlo en vivo en la app, cortito).
    const actRuns = runs.filter((r) => r.status !== "completed");
    state.active = [];
    for (let ai = 0; ai < actRuns.length; ai++) {
      const r = actRuns[ai];
      const mins = r.run_started_at ? Math.max(0, Math.round((Date.now() - Date.parse(r.run_started_at)) / 60000)) : 0;
      let step = r.status === "queued" ? "en cola…" : "iniciando…";
      // Solo pido el detalle de pasos de las primeras 3 activas (ahorra subrequests de Cloudflare).
      const jr = ai < 3 ? await ghApi(env, `/repos/${env.GH_REPO}/actions/runs/${r.id}/jobs`) : { ok: false };
      if (jr.ok) {
        const jobs = (await jr.json()).jobs || [];
        const job = jobs.find((j) => j.status === "in_progress") || jobs[0];
        const steps = (job && job.steps) || [];
        const total = steps.length, done = steps.filter((s) => s.status === "completed").length;
        const cur = steps.find((s) => s.status === "in_progress");
        if (cur) step = `paso ${Math.min(done + 1, total)}/${total}: ${cur.name}`;
        else if (total && done === total) step = "cerrando…";
      }
      const exp = expectedMin(r.name);
      state.active.push({ name: r.name, wf: (r.path || "").split("/").pop(), status: r.status, step, pct: r.status === "queued" ? 0 : Math.min(99, Math.round((mins / exp) * 100)), eta: Math.max(0, exp - mins) });
    }
    // PROBLEMAS sin repetir: solo la ULTIMA corrida por workflow, y solo si esa fallo
    // (asi cada error sale UNA vez y se limpia solo cuando reintentas con exito).
    const latestByWf = {};
    for (const r of runs) { const wf = r.path || r.name; if (!latestByWf[wf]) latestByWf[wf] = r; }
    // Muestra TODOS los errores recientes (últimas 24h), la última corrida fallida por workflow.
    const fails = Object.values(latestByWf).filter((r) => r.conclusion === "failure" && (Date.now() - Date.parse(r.updated_at)) < 24 * 3600 * 1000).slice(0, 8);
    state.problems = [];
    for (const r of fails) {
      // Sin pedir /jobs aqui (ahorra subrequests de Cloudflare): el paso/detalle se carga al
      // hacer clic en "Ver el error" (/api/error-detail). Asi /api/state no explota en subrequests.
      state.problems.push({ name: r.name, step: "", url: r.html_url, run_id: r.id, workflow: (r.path || "").split("/").pop() });
    }
    // PRODUCCION actual: calificacion de la IA (calidad del render) + paquete SEO + preview.
    const quality = await r2json(env, "video/0001-youtube-money/quality.json");
    const pkg = await r2json(env, "video/0001-youtube-money/package.json");
    let seoVideoId = null;
    try { const ido = await env.R2.get("video/0001-youtube-money/video_id.txt"); if (ido) seoVideoId = (await ido.text()).trim(); } catch {}
    let thumbUrl = null;
    try { const th = await env.R2.head("video/0001-youtube-money/thumbnail.jpg"); if (th) thumbUrl = "/watch/video/0001-youtube-money/thumbnail.jpg"; } catch {}
    const renderPending = await r2json(env, "video/0001-youtube-money/render_pending.json");
    const approvedFlag = await r2json(env, "video/0001-youtube-money/seo_approved.json");
    // Aprobado solo si el titulo aprobado == el titulo actual (si regeneras el SEO, se resetea).
    const isApproved = !!(approvedFlag && approvedFlag.approved && pkg && approvedFlag.title === pkg.title);
    // El video de producción YA está publicado (público) => el paso SEO terminó, se oculta.
    const prodPublished = !!(seoVideoId && (inv.longs || []).some((v) => v.video_id === seoVideoId && v.privacy === "public"));
    state.production = {
      approved: isApproved,
      done: prodPublished,
      render_pending: !!renderPending,
      render_qa: renderPending ? { ok: renderPending.qa_ok !== false, warning: renderPending.qa_warning || "", duration: renderPending.duration || 0 } : null,
      quality: quality || null,
      seo: pkg ? {
        title: pkg.title || null, description: pkg.description || null,
        tags: pkg.tags || [], hashtags: pkg.hashtags || [],
        thumbnail_text: pkg.thumbnail_text || null, chapters: pkg.chapters || [],
        pinned_comment: pkg.pinned_comment || null, validation: pkg.validation || null,
      } : null,
      video_id: seoVideoId,
      watch_url: "/watch/video/0001-youtube-money/video.mp4",
      thumb_url: thumbUrl,
    };
    return json(state);
  }

  if (url.pathname === "/api/trends") {
    return json(await geminiTrends(env));
  }

  if (url.pathname === "/api/insights") {
    return json(await geminiInsights(env));
  }

  if (url.pathname === "/api/error-detail") {
    // Trae el ERROR EXACTO (últimas líneas del log del paso fallido) para verlo en la app.
    const runId = url.searchParams.get("run") || "";
    if (!/^\d+$/.test(runId)) return json({ error: "run inválido" }, 400);
    try {
      const jr = await ghApi(env, `/repos/${env.GH_REPO}/actions/runs/${runId}/jobs`);
      if (!jr.ok) return json({ detail: "No pude leer el run." });
      const jobs = (await jr.json()).jobs || [];
      // Job que rompió: fallido, o cancelado (timeout), o el último no-exitoso.
      const job = jobs.find((j) => j.conclusion === "failure") || jobs.find((j) => j.conclusion === "cancelled")
        || jobs.filter((j) => j.conclusion && j.conclusion !== "success").pop();
      if (!job) return json({ detail: "No encontré un paso con error en ese run. Abre el log completo en GitHub (↗)." });
      const failedStep = (job.steps || []).find((s) => s.conclusion === "failure") || (job.steps || []).find((s) => s.conclusion === "cancelled");
      const lr = await fetch(`https://api.github.com/repos/${env.GH_REPO}/actions/jobs/${job.id}/logs`, { headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "video-forge" }, redirect: "follow" });
      if (!lr.ok) return json({ detail: `No pude leer el log inline (HTTP ${lr.status}${lr.status === 410 ? " — el log ya expiró en GitHub" : ""}). Abre el log completo con ↗.`, step: (failedStep && failedStep.name) || job.name });
      const text = await lr.text();
      const lines = text.split("\n").map((l) => l.replace(/^\S+\s/, "")).filter((l) => l.trim());
      const tail = lines.slice(-45).join("\n").slice(-2800);
      return json({ detail: tail || "(log vacío) — ábrelo completo con ↗.", step: (failedStep && failedStep.name) || job.name });
    } catch (e) { return json({ detail: "Error leyendo el detalle: " + e.message }); }
  }

  if (url.pathname === "/api/schedule" && request.method === "POST") {
    // Programa el video en la PROXIMA mejor hora (EEUU) libre. YouTube lo publica solo a esa hora.
    let body = {}; try { body = await request.json(); } catch {}
    let vid = body.video_id;
    const isProductionVideo = !vid; // sin video_id en el body = el VIDEO de produccion (slot activo). Con video_id = un SHORT u otro.
    if (!vid) { try { const ido = await env.R2.get("video/0001-youtube-money/video_id.txt"); if (ido) vid = (await ido.text()).trim(); } catch {} }
    if (!vid || !/^[A-Za-z0-9_-]{6,20}$/.test(vid)) return json({ error: "no encontré el video a programar" }, 400);
    const res = await doSchedule(env, vid, isProductionVideo);
    if (!res.ok) return json({ error: res.error || "no pude programar" }, 500);
    return json({ ok: true, publish_at: res.publish_at });
  }

  if (url.pathname === "/api/approve" && request.method === "POST") {
    // Aprobar la descripcion/SEO Y programar el video en la proxima mejor hora (EEUU), en un solo toque.
    const pkg = await r2json(env, "video/0001-youtube-money/package.json");
    const title = pkg ? pkg.title || "" : "";
    await env.R2.put("video/0001-youtube-money/seo_approved.json",
      JSON.stringify({ approved: true, title, at: new Date().toISOString() }),
      { httpMetadata: { contentType: "application/json" } });
    // Tomar el video del slot activo y programarlo automaticamente a la mejor hora.
    let vid = null;
    try { const ido = await env.R2.get("video/0001-youtube-money/video_id.txt"); if (ido) vid = (await ido.text()).trim(); } catch {}
    if (vid && /^[A-Za-z0-9_-]{6,20}$/.test(vid)) {
      const res = await doSchedule(env, vid, true);
      return json({ ok: true, title, scheduled: res.ok, publish_at: res.publish_at || null, schedule_error: res.ok ? null : (res.error || "no pude programar") });
    }
    return json({ ok: true, title, scheduled: false });
  }

  if (url.pathname === "/api/voice" && request.method === "POST") {
    // Elegir la voz del canal (se usa en la proxima produccion).
    let body = {};
    try { body = await request.json(); } catch {}
    const opt = VOICE_OPTIONS.find((v) => v.id === body.id);
    if (!opt) return json({ error: "voz desconocida" }, 400);
    await env.R2.put("channel/voice_choice.json", JSON.stringify({ id: opt.id, engine: opt.engine, kvoice: opt.kvoice, label: opt.label }), { httpMetadata: { contentType: "application/json" } });
    return json({ ok: true, label: opt.label });
  }

  if (url.pathname === "/api/thumb-approve" && request.method === "POST") {
    // Paso 1: APROBAR la miniatura (marca, NO la pone en YouTube todavia).
    let body = {};
    try { body = await request.json(); } catch {}
    const vid = String(body.video_id || "");
    if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) return json({ error: "video_id inválido" }, 400);
    const db = (await r2json(env, "channel/videos.json")) || {};
    const e = db[vid] || { stages: {} };
    e.stages = e.stages || {};
    e.stages.thumb_approved = true;
    e.updated_at = new Date().toISOString();
    db[vid] = e;
    await env.R2.put("channel/videos.json", JSON.stringify(db, null, 2), { httpMetadata: { contentType: "application/json" } });
    return json({ ok: true });
  }

  if (url.pathname === "/api/short" && request.method === "POST") {
    // Aprobar o saltar un short propuesto (actualiza el plan en R2), desde la app.
    let body = {};
    try { body = await request.json(); } catch {}
    const n = Number(body.n);
    if (!Number.isInteger(n) || !["approve", "skip"].includes(body.action)) return json({ error: "parámetros inválidos" }, 400);
    const ok = await markShort(env, n, body.action === "approve");
    return json({ ok });
  }

  if (url.pathname === "/api/dispatch" && request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch {}
    if (!APP_WORKFLOWS.has(body.workflow)) return json({ error: "workflow no permitido" }, 400);
    // Validar la forma de los inputs conocidos (defensa en profundidad).
    const inputs = body.inputs || {};
    if (inputs.video_id != null && !/^[A-Za-z0-9_-]{11}$/.test(String(inputs.video_id))) return json({ error: "video_id inválido" }, 400);
    if (inputs.privacy != null && !["public", "private", "unlisted"].includes(String(inputs.privacy))) return json({ error: "privacy inválido" }, 400);
    if (inputs.n != null && !/^\d{1,4}$/.test(String(inputs.n))) return json({ error: "n inválido" }, 400);
    if (inputs.notes != null) inputs.notes = String(inputs.notes).slice(0, 500);
    if (inputs.topic != null) inputs.topic = String(inputs.topic).slice(0, 300);
    if (inputs.niche != null && !["satisfying", "narrativas", "ciencia_humor", "naturaleza_relax"].includes(String(inputs.niche))) return json({ error: "niche inválido" }, 400);
    if (inputs.variant != null && !["puro", "narrado"].includes(String(inputs.variant))) return json({ error: "variant inválido" }, 400);
    if (inputs.kind != null && !["video", "short"].includes(String(inputs.kind))) return json({ error: "kind inválido" }, 400);
    if (inputs.format != null && !["16:9", "9:16"].includes(String(inputs.format))) return json({ error: "format inválido" }, 400);
    if (inputs.mode != null && !["schedule", "public"].includes(String(inputs.mode))) return json({ error: "mode inválido" }, 400);
    const r = await ghDispatch(env, body.workflow, inputs);
    return json({ ok: r.ok, status: r.status });
  }

  if (url.pathname === "/api/upload" && request.method === "POST") {
    let form;
    try { form = await request.formData(); } catch { return json({ error: "cuerpo inválido (se esperaba multipart)" }, 400); }
    const kind = form.get("kind");
    if (kind === "photo") {
      const f = form.get("file");
      if (!f) return json({ error: "sin archivo" }, 400);
      await env.R2.put(editKey(chatId, "source"), new Uint8Array(await f.arrayBuffer()), { httpMetadata: { contentType: "image/jpeg" } });
      const { mode, prompt } = parseEdit(form.get("prompt") || "");
      const r = await ghDispatch(env, "photo_edit.yml", { chat_id: String(chatId), mode, prompt: prompt || "", strength: "suave" });
      await putEditState(env, chatId, { awaiting: false, mode, prompt, strength: "suave" });
      return json({ ok: r.ok });
    }
    if (kind === "voice") {
      const f = form.get("file");
      if (!f) return json({ error: "sin archivo" }, 400);
      const slug = slugifyVoice(form.get("name") || "voz");
      await env.R2.put(`voice/ref_${slug}.mp3`, new Uint8Array(await f.arrayBuffer()), { httpMetadata: { contentType: "audio/mpeg" } });
      const reg = (await r2json(env, "voice/registry.json")) || {};
      reg[slug] = { label: form.get("name") || slug, key: `voice/ref_${slug}.mp3` };
      await env.R2.put("voice/registry.json", JSON.stringify(reg), { httpMetadata: { contentType: "application/json" } });
      return json({ ok: true });
    }
    if (kind === "recipe") {
      const files = form.getAll("file");
      if (!files.length) return json({ error: "sin archivos" }, 400);
      let n = 0;
      for (const f of files) {
        const idx = String(n).padStart(3, "0");
        const ext = (f.type || "").startsWith("video") ? "mp4" : "jpg";
        await env.R2.put(recipeKey(chatId, `media/${idx}.${ext}`), new Uint8Array(await f.arrayBuffer()), { httpMetadata: { contentType: f.type || "image/jpeg" } });
        n++;
      }
      const text = form.get("text") || "";
      if (text) await env.R2.put(recipeKey(chatId, "text"), text, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
      await setRecipeState(env, chatId, { active: false, n });
      const r = await ghDispatch(env, "recipe_reel.yml", { chat_id: String(chatId), count: String(n) });
      return json({ ok: r.ok });
    }
    return json({ error: "kind desconocido" }, 400);
  }
  return json({ error: "ruta no encontrada" }, 404);
}

// Consulta YouTube el estado REAL (privacidad + vistas) de varios videos por id.
async function ytStatus(env, ids) {
  ids = [...new Set((ids || []).filter(Boolean))];
  if (!ids.length || !env.YT_REFRESH_TOKEN) return {};
  try {
    const token = await ytToken(env); // token cacheado (evita pedirlo 2 veces por request)
    if (!token) return {};
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,statistics&id=${ids.join(",")}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const out = {};
    for (const it of j.items || []) out[it.id] = {
      privacy: it.status && it.status.privacyStatus,
      views: +((it.statistics && it.statistics.viewCount) || 0),
      likes: +((it.statistics && it.statistics.likeCount) || 0),
    };
    return out;
  } catch { return {}; }
}

// Duracion ISO8601 (PT#M#S) -> segundos.
function isoDurSec(d) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || "") || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}
// Token OAuth de YouTube (refresh). Cacheado en memoria ~50 min: varias funciones (ytStatus,
// channelInventory) lo comparten dentro del mismo request (y entre requests del mismo isolate)
// -> no se pide el token 2 veces por refresco de la app.
let _ytTok = { token: null, exp: 0 };
async function ytToken(env) {
  if (!env.YT_REFRESH_TOKEN) return null;
  if (_ytTok.token && Date.now() < _ytTok.exp) return _ytTok.token;
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
      signal: AbortSignal.timeout(6000),
    });
    const tj = await tr.json();
    if (tj.access_token) { _ytTok = { token: tj.access_token, exp: Date.now() + 50 * 60 * 1000 }; return tj.access_token; }
    return null;
  } catch { return null; }
}
// Inventario REAL del canal (largos vs shorts) + subs/vistas. Cacheado 10 min en R2 para
// no gastar cuota de YouTube en cada refresco de la app. Asi la lista se actualiza sola.
async function channelInventory(env) {
  const cached = await r2json(env, "channel/inventory_cache.json");
  if (cached && cached.at && (Date.now() - Date.parse(cached.at) < 10 * 60 * 1000)) return cached;
  const token = await ytToken(env);
  if (!token) return cached || { longs: [], shorts: [], subs: 0, total_views: 0, at: null, stale: true };
  const H = { Authorization: `Bearer ${token}` };
  try {
    const ch = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&mine=true", { headers: H })).json();
    const item = ch.items && ch.items[0];
    const up = item && item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
    if (!up) return cached || { longs: [], shorts: [], subs: 0, total_views: 0, at: null, stale: true };
    let ids = [], page = "";
    do {
      const j = await (await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`, { headers: H })).json();
      ids.push(...(j.items || []).map((i) => i.contentDetails.videoId));
      page = j.nextPageToken || "";
    } while (page && ids.length < 200);
    const longs = [], shorts = [];
    for (let i = 0; i < ids.length; i += 50) {
      const j = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics,contentDetails&id=${ids.slice(i, i + 50).join(",")}`, { headers: H })).json();
      for (const v of j.items || []) {
        const secs = isoDurSec(v.contentDetails.duration);
        const st = v.status || {};
        const row = { video_id: v.id, title: v.snippet.title, privacy: st.privacyStatus, publish_at: st.publishAt || null, published_at: v.snippet.publishedAt.slice(0, 10), views: +((v.statistics || {}).viewCount || 0), likes: +((v.statistics || {}).likeCount || 0), seconds: secs, upload_status: st.uploadStatus || null, rejection_reason: st.rejectionReason || null };
        if (secs > 0 && secs <= 60) shorts.push(row); else longs.push(row);
      }
    }
    longs.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
    shorts.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
    // Tiempo REPRODUCIDO por video (minutos vistos) — Analytics API (requiere scope yt-analytics).
    let analyticsOk = false, analytics = null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const start28 = new Date(Date.now() - 28 * 86400 * 1000).toISOString().slice(0, 10);
      const a = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=${today}&metrics=estimatedMinutesWatched,averageViewDuration&dimensions=video&sort=-estimatedMinutesWatched&maxResults=200`, { headers: H });
      if (a.ok) {
        const aj = await a.json();
        analyticsOk = true;
        const wm = {};
        for (const row of aj.rows || []) wm[row[0]] = { watch_min: Math.round(row[1] || 0), avg_sec: Math.round(row[2] || 0) };
        for (const v of longs) { const w = wm[v.video_id] || {}; v.watch_min = w.watch_min || 0; v.avg_sec = w.avg_sec || 0; }
        for (const v of shorts) { const w = wm[v.video_id] || {}; v.watch_min = w.watch_min || 0; v.avg_sec = w.avg_sec || 0; }
        // Totales + serie diaria de los ultimos 28 dias (para el tablero de analytics).
        try {
          const [totRes, dayRes] = await Promise.all([
            fetch(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start28}&endDate=${today}&metrics=views,estimatedMinutesWatched,subscribersGained,averageViewDuration`, { headers: H }),
            fetch(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start28}&endDate=${today}&dimensions=day&metrics=views,estimatedMinutesWatched&sort=day`, { headers: H }),
          ]);
          const tj2 = totRes.ok ? await totRes.json() : null;
          const dj = dayRes.ok ? await dayRes.json() : null;
          const tr2 = (tj2 && tj2.rows && tj2.rows[0]) || [];
          analytics = {
            last28: { views: tr2[0] || 0, minutes: Math.round(tr2[1] || 0), subs_gained: tr2[2] || 0, avg_sec: Math.round(tr2[3] || 0) },
            daily: ((dj && dj.rows) || []).map((r) => ({ d: r[0], views: r[1] || 0, min: Math.round(r[2] || 0) })),
          };
        } catch {}
      }
    } catch {}
    // Miniatura generada (para la app) — se resuelve UNA vez aqui (cacheado 10 min), NO en cada /api/state.
    // Antes esto era 1 R2.head por video en cada request -> reventaba el limite de subrequests al crecer el canal.
    for (const v of longs) {
      try { const th = await env.R2.head(`video/0001-youtube-money/thumb_${v.video_id}.jpg`); v.thumb_url = th ? `/watch/video/0001-youtube-money/thumb_${v.video_id}.jpg` : null; } catch { v.thumb_url = null; }
    }
    const inv = { longs, shorts, subs: +(((item.statistics || {}).subscriberCount) || 0), total_views: +(((item.statistics || {}).viewCount) || 0), analytics_ok: analyticsOk, analytics, at: new Date().toISOString() };
    await env.R2.put("channel/inventory_cache.json", JSON.stringify(inv), { httpMetadata: { contentType: "application/json" } });
    return inv;
  } catch { return cached || { longs: [], shorts: [], subs: 0, total_views: 0, at: null, stale: true }; }
}

// Lee un JSON de R2 (o null). Resiliente: un blip de red de R2 devuelve null, no tumba /api/state.
async function r2json(env, key) {
  if (!env.R2) return null;
  try { const o = await env.R2.get(key); if (!o) return null; return JSON.parse(await o.text()); } catch { return null; }
}

// Uso de almacenamiento R2 (para no pasar el limite gratis de 10 GB). Cacheado 6h: cambia lento y el
// loop de list() consume subrequests -> se recalcula pocas veces al dia, no en cada refresco de la app.
async function r2Usage(env) {
  const cached = await r2json(env, "channel/r2usage.json");
  if (cached && cached.at && (Date.now() - Date.parse(cached.at) < 6 * 60 * 60 * 1000)) return cached;
  if (!env.R2) return cached || { bytes: 0, count: 0, at: null };
  try {
    let bytes = 0, count = 0, cursor, guard = 0;
    do {
      const res = await env.R2.list({ limit: 1000, cursor });
      for (const o of res.objects || []) { bytes += o.size || 0; count++; }
      cursor = res.truncated ? res.cursor : undefined;
    } while (cursor && ++guard < 12);
    const usage = { bytes, count, at: new Date().toISOString() };
    await env.R2.put("channel/r2usage.json", JSON.stringify(usage), { httpMetadata: { contentType: "application/json" } });
    return usage;
  } catch { return cached || { bytes: 0, count: 0, at: null }; }
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

    case "/panel":
    case "/canal":
      return sendPanel(env, chatId);

    case "/reporte": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "channel_report.yml", {});
      return ack(env, chatId, r, "Reporte del canal (métricas frescas de YouTube)");
    }

    case "/shorts": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "shorts_plan.yml", {});
      return ack(env, chatId, r, "Análisis de Shorts (la IA sugiere cuántos y cuáles)");
    }

    case "/generarshorts": {
      if (await busyGuard(env, chatId)) return;
      const napp = await countApprovedShorts(env);
      if (!napp) return tg(env, "sendMessage", { chat_id: chatId, text: "No hay shorts aprobados aún. Corre /shorts, aprueba los que quieras y luego /generarshorts." });
      // Pipeline FINAL: voz de locutor + karaoke + logo + musica (nativo vertical).
      const r = await ghDispatch(env, "shorts_final.yml", {});
      return ack(env, chatId, r, `Generando ${napp} short(s) final(es) — voz+karaoke+logo+música`);
    }

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
    case "panel":
      return sendPanel(env, chatId);
    case "reporte": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "channel_report.yml", {});
      return ack(env, chatId, r, "Reporte del canal (métricas frescas de YouTube)");
    }
    case "shorts_plan": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "shorts_plan.yml", {});
      return ack(env, chatId, r, "Análisis de Shorts (la IA sugiere cuántos y cuáles)");
    }
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

    // ---- Puerta del SEO (Parte 1): aprobar la publicacion o regenerar el SEO ----
    case "seo_regen": {
      if (await busyGuard(env, chatId)) return;
      const r = await ghDispatch(env, "seo_regen.yml", {});
      return ack(env, chatId, r, "Regenerando el SEO (según los comentarios de la IA)");
    }
    case "pub_ok": {
      return tg(env, "sendMessage", {
        chat_id: chatId,
        parse_mode: "Markdown",
        text:
          "✅ *Publicación aprobada.* El video queda con este SEO en YouTube (privado).\n\n" +
          "Cuando lo hagas *Público* en Studio, el siguiente paso son los *Shorts*: la IA te dirá cuántos hacer, de qué momentos y qué tan largos, y los apruebas uno por uno.\n\n" +
          "🎬 Escribe /shorts cuando quieras arrancar con eso.",
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
      if (data.startsWith("short_pub:")) {
        const vid = data.slice("short_pub:".length);
        const r = await ghDispatch(env, "set_privacy.yml", { video_id: vid, privacy: "public" });
        return ack(env, chatId, r, `Publicando el short (${vid})`);
      }
      if (data.startsWith("short_keep:")) {
        return tg(env, "sendMessage", { chat_id: chatId, text: "⏸️ Listo, ese short queda privado. Puedes publicarlo después." });
      }
      if (data.startsWith("short_ok:") || data.startsWith("short_no:")) {
        const n = parseInt(data.split(":")[1], 10);
        const approved = data.startsWith("short_ok:");
        const ok = await markShort(env, n, approved);
        return tg(env, "sendMessage", {
          chat_id: chatId,
          text: ok
            ? (approved ? `✅ Short #${n + 1} aprobado. Cuando termines, /generarshorts para armarlos.` : `❌ Short #${n + 1} saltado.`)
            : "No pude actualizar el short (¿corriste /shorts primero?).",
        });
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
      [{ text: "🚀 Abrir la app (panel pro)", web_app: { url: "https://video-forge-bot.tienvo.workers.dev/app" } }],
      [{ text: "🎬 Video", callback_data: "menu:video" }, { text: "📊 Canal", callback_data: "menu:canal" }],
      [{ text: "🖼️ Foto", callback_data: "menu:foto" }, { text: "🎤 Voces", callback_data: "menu:voces" }],
      [{ text: "🍳 Recetas", callback_data: "menu:recetas" }, { text: "❓ Ayuda", callback_data: "menu:ayuda" }],
    ],
  },
  canal: {
    inline_keyboard: [
      [{ text: "📋 Ver panel (programación)", callback_data: "panel" }],
      [{ text: "🔄 Reporte fresco (métricas)", callback_data: "reporte" }],
      [{ text: "🎬 Sugerir Shorts (IA)", callback_data: "shorts_plan" }],
      [{ text: "⬅️ Volver", callback_data: "menu:home" }],
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
  canal: "*📊 Canal — dirección*\n\n📋 Panel — programación de próximos videos + monetización (al instante).\n🔄 Reporte — jala las métricas frescas de YouTube (subs, vistas, likes).",
  video: "*🎬 Video*\n\n🎙️ Generar voz — narración del canal, con tu voz.\n🎬 Renderizar — arma el video POR FASES (cada tramo de ~3 min pasa la prueba 7.5 y al final se unen).\n📊 Estado — qué se está haciendo ahora.",
  foto: "*🖼️ Foto*\n\nMándame una foto: limpio la piel y subo la textura, sin cambiar tu cara (~5-7 min).\nPara el fondo, escribe *fondo ...* al enviarla (ej: fondo blanco).",
  voces: "*🎤 Voces*\n\nMándame una nota de voz y le pongo nombre. Sirve para narrar (tu voz o la de tu esposa).",
  recetas: "*🍳 Recetas*\n\nMándame las *fotos/videos* de tu receta (en el orden que quieres el reel) + el *texto* de la preparación. Yo mejoro tus tomas, completo lo que falte con clips/imágenes relacionados, narro con tu voz y pongo los subtítulos de los pasos.\n\nToca *Nueva receta* para empezar.",
  ayuda: "*❓ Ayuda* — qué puedes hacer:\n\n• *Foto* → mándala y te la retoco (piel/luz/color, sin cambiar tu cara).\n• *Nota de voz* → la guardo con nombre para narrar (tu voz o la de tu esposa).\n• *Video* → genero la voz y renderizo el video del canal POR FASES (cada tramo pasa 7.5).\n• *Receta* → /receta, mandas fotos/videos + el texto y armo un reel 9:16 con voz y subtítulos.\n\nTodo corre en la nube; te aviso aquí cuando termine. Solo tú puedes usar el bot.",
};

async function sendMenu(env, chatId) {
  // Boton de menu de Telegram que abre la Mini App (interfaz tipo app).
  await tg(env, "setChatMenuButton", {
    chat_id: chatId,
    menu_button: { type: "web_app", text: "📊 App", web_app: { url: "https://video-forge-bot.tienvo.workers.dev/app" } },
  });
  await tg(env, "setMyCommands", {
    commands: [
      { command: "start", description: "🏠 Menú" },
      { command: "voz", description: "🎙️ Generar la narración" },
      { command: "render", description: "🎬 Renderizar el video (por fases)" },
      { command: "receta", description: "🍳 Armar un reel de receta" },
      { command: "panel", description: "📊 Panel del canal (programación)" },
      { command: "reporte", description: "🔄 Reporte de métricas del canal" },
      { command: "shorts", description: "🎬 Sugerir Shorts del último video" },
      { command: "estado", description: "⏳ Qué se hace ahora" },
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

// ---- Shorts: aprobar/saltar cada short propuesto (actualiza el plan en R2) ----
const SHORTS_KEY = "shorts/0001-youtube-money/plan.json";

async function markShort(env, n, approved) {
  if (!env.R2) return false;
  const o = await env.R2.get(SHORTS_KEY);
  if (!o) return false;
  let plan;
  try { plan = JSON.parse(await o.text()); } catch { return false; }
  const s = (plan.shorts || []).find((x) => x.n === n);
  if (!s) return false;
  s.approved = approved;
  s.skipped = !approved;
  await env.R2.put(SHORTS_KEY, JSON.stringify(plan), { httpMetadata: { contentType: "application/json" } });
  return true;
}

async function countApprovedShorts(env) {
  if (!env.R2) return 0;
  const o = await env.R2.get(SHORTS_KEY);
  if (!o) return 0;
  try {
    const plan = JSON.parse(await o.text());
    return (plan.shorts || []).filter((x) => x.approved && !x.video_id).length;
  } catch { return 0; }
}

// Panel de direccion: lee el estado del canal (channel/state.json en R2) y muestra
// la programacion + monetizacion al instante. Para metricas frescas se usa /reporte.
async function sendPanel(env, chatId) {
  let st = null;
  if (env.R2) {
    const o = await env.R2.get("channel/state.json");
    if (o) { try { st = JSON.parse(await o.text()); } catch {} }
  }
  if (!st) {
    return tg(env, "sendMessage", {
      chat_id: chatId,
      text: "📊 Aún no hay datos del canal. Corre /reporte una vez para inicializarlo (jala métricas de YouTube y guarda el estado).",
    });
  }
  const mon = st.monetization || {};
  const pub = st.published || [];
  const up = st.upcoming || [];
  const L = [];
  L.push(`<b>📊 Panel — ${esc(st.channel?.name || "The Data Lens")}</b>`);
  if (st.channel_stats) L.push(`👥 ${st.channel_stats.subs} subs · 👁️ ${st.channel_stats.total_views} vistas · 🎬 ${st.channel_stats.videos} videos`);
  L.push("");
  L.push(`<b>Publicados (${pub.length}):</b>`);
  for (const v of pub.slice(-5)) {
    const s = v.stats || {};
    L.push(`• ${esc(v.title || v.video_id)} — ${v.privacy}${v.privacy === "public" ? ` · ${s.views || 0} vistas` : ""}`);
  }
  L.push("");
  L.push(`<b>Programación:</b>`);
  for (const u of up.slice(0, 6)) L.push(`• #${u.n} · ${u.target_date} — ${esc(u.topic)}`);
  L.push("");
  L.push(`<b>Monetización:</b> subs ${mon.subs ?? "?"}/1000 · horas ${mon.watch_hours ?? "?"}/4000 · ${mon.elegible ? "✅ elegible" : "❌ aún no"}`);
  if (st.updated_at) L.push(`\n<i>Métricas: ${String(st.updated_at).slice(0, 16).replace("T", " ")} UTC · /reporte para refrescar</i>`);
  return tg(env, "sendMessage", { chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true, text: L.join("\n") });
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
  if (n.includes("shorts")) return (n.includes("final") || n.includes("subir")) ? 25 : 4;  // generar shorts vs analizar
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
    // Timeout: una API de GitHub LENTA (no caida) no debe colgar /api/state.
    signal: init.signal || AbortSignal.timeout(6000),
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
