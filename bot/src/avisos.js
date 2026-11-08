// Avisos con criterio: llega al momento solo lo que pide algo de Juan; lo demas va a UN resumen diario.
//
// Flujo: pipeline/notify_telegram.sh pregunta POST /aviso (firmado con HMAC del token del bot). El Worker
// clasifica y responde {modo:"ahora"} -> el script lo manda como siempre, o {modo:"resumen"} -> queda guardado.
// El reloj del bot manda el resumen a las 7 pm de Bogota (00:00 UTC) y, los domingos, se ajusta solo: lo que
// llego al momento varias veces sin que Juan lo usara pasa al resumen, y se lo cuenta con un boton para revertir.
//
// Estado en R2: os/avisos/estado.json (categorias y uso) y os/avisos/pendientes.json (lo que va al resumen).

export const HORA_RESUMEN_UTC = 0;                 // 7:00 pm en Bogota
const VENTANA_USO_MS = 2 * 3600e3;                 // tocar el bot dentro de 2 h cuenta como "lo usaste"
const REPETIDA_MS = 20 * 3600e3;                   // una falla igual dentro de 20 h ya no interrumpe
const MIN_PARA_AJUSTAR = 5;                        // avisos al momento en la semana antes de juzgar una categoria
const MAX_PENDIENTES = 3000;
const K_ESTADO = "os/avisos/estado.json";
const K_PEND = "os/avisos/pendientes.json";

const FALLA = /^\s*(❌|🚨|🚫|⚠️|⚠)/u;
const LISTO = /^\s*(🎬|✅|🗂️|📊|📈|🎉|🧠|📋|🩺)/u;
const PAUSA = /^\s*(⏸️|⏸|💤|🔁)/u;

const diaBogota = (iso) => new Date(Date.parse(iso) - 5 * 3600e3).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);

export function tipoDe(texto) {
  const t = String(texto || "");
  if (FALLA.test(t)) return "falla";
  if (PAUSA.test(t)) return "pausa";
  if (LISTO.test(t)) return "listo";
  return "info";
}

// "Producir compilacion (Oddly Loop / canal auto)" -> "Producir compilacion"
export function nombreCorto(wf) {
  return String(wf || "Otro").replace(/\s*[(—–-]\s.*$/u, "").replace(/\s*\(.*$/, "").trim().slice(0, 40) || "Otro";
}

export function categoria(a) {
  return `${nombreCorto(a.wf)}:${tipoDe(a.texto)}`;
}

// Decide "ahora" o "resumen". `estado` = {cat:{modo, ultima, ...}}; `ahoraMs` inyectable para pruebas.
export function clasificar(a, estado, ahoraMs = Date.now()) {
  const cat = categoria(a);
  const c = (estado.cat || {})[cat] || {};
  if (a.botones || a.archivo) return { modo: "ahora", cat, por: "pide algo de ti" };
  if (c.modo === "ahora") return { modo: "ahora", cat, por: "lo pediste al momento" };
  if (c.modo === "resumen") return { modo: "resumen", cat, por: "aprendido" };
  if (tipoDe(a.texto) === "falla") {
    // Interrumpe solo si es nueva: ni en las ultimas 20 h ni el dia anterior. Si se repite va al resumen con su racha.
    const ayer = c.ultima && diasEntre(diaBogota(c.ultima), diaBogota(new Date(ahoraMs).toISOString())) <= 1;
    const repetida = c.ultima && (ahoraMs - Date.parse(c.ultima) < REPETIDA_MS || ayer);
    return repetida ? { modo: "resumen", cat, por: "falla repetida" } : { modo: "ahora", cat, por: "falla nueva" };
  }
  return { modo: "resumen", cat, por: "informativo" };
}

export function registrar(estado, a, decision, ahoraIso = new Date().toISOString()) {
  estado.cat = estado.cat || {};
  const c = (estado.cat[decision.cat] = estado.cat[decision.cat] || { semana: { ahora: 0, usados: 0 } });
  c.semana = c.semana || { ahora: 0, usados: 0 };
  if (decision.modo === "ahora") {
    c.semana.ahora++;
    c.ultimaAhora = ahoraIso;
    estado.recientes = [...(estado.recientes || []).filter((r) => Date.parse(ahoraIso) - Date.parse(r.t) < VENTANA_USO_MS), { cat: decision.cat, t: ahoraIso, usado: false }];
  }
  if (tipoDe(a.texto) === "falla") {
    const hoy = diaBogota(ahoraIso), antes = c.ultima ? diaBogota(c.ultima) : "";
    if (antes !== hoy) c.racha = antes && diasEntre(antes, hoy) === 1 ? (c.racha || 1) + 1 : 1;     // dias seguidos con falla
    c.ultima = ahoraIso;
  }
  return estado;
}

// Juan toco el bot: los avisos al momento de las ultimas 2 h le sirvieron.
export function marcarUso(estado, ahoraMs = Date.now()) {
  let n = 0;
  for (const r of estado.recientes || []) {
    if (!r.usado && ahoraMs - Date.parse(r.t) < VENTANA_USO_MS) {
      r.usado = true;
      const c = (estado.cat || {})[r.cat];
      if (c) { c.semana = c.semana || { ahora: 0, usados: 0 }; c.semana.usados++; }
      n++;
    }
  }
  return n;
}

// Domingo: lo que interrumpio varias veces y nunca se uso pasa al resumen. Devuelve las categorias movidas.
export function ajustar(estado) {
  const movidas = [];
  for (const [cat, c] of Object.entries(estado.cat || {})) {
    const s = c.semana || { ahora: 0, usados: 0 };
    if (!c.modo && s.ahora >= MIN_PARA_AJUSTAR && s.usados === 0) { c.modo = "resumen"; movidas.push(cat); }
    c.semana = { ahora: 0, usados: 0 };
  }
  return movidas;
}

const SIGNO = { falla: "❌", pausa: "⏸", listo: "✅", info: "•" };

// Un mensaje corto: una linea por sistema, con conteos y, si hubo, la ultima falla.
export function armarResumen(pendientes, estado, movidas = [], fecha = new Date()) {
  if (!pendientes.length && !movidas.length) return null;
  const por = new Map();
  for (const p of pendientes) {
    const n = nombreCorto(p.wf);
    const g = por.get(n) || { falla: 0, pausa: 0, listo: 0, info: 0, ultimaFalla: "" };
    const t = tipoDe(p.texto);
    g[t]++;
    if (t === "falla") g.ultimaFalla = String(p.texto).split("\n")[0].replace(FALLA, "").trim().slice(0, 70);
    por.set(n, g);
  }
  const orden = [...por.entries()].sort((a, b) => (b[1].falla - a[1].falla) || (b[1].listo - a[1].listo));
  const lineas = orden.slice(0, 10).map(([n, g]) => {
    const partes = ["listo", "falla", "pausa", "info"].filter((k) => g[k]).map((k) => `${SIGNO[k]} ${g[k]}`);
    let l = `${n}: ${partes.join(" · ")}`;
    if (g.ultimaFalla) l += `\n   ↳ ${g.ultimaFalla}`;
    return l;
  });
  if (orden.length > 10) lineas.push(`… y ${orden.length - 10} más en el bot`);
  const rachas = Object.entries(estado.cat || {}).filter(([cat, c]) => cat.endsWith(":falla") && (c.racha || 0) >= 3)
    .map(([cat, c]) => `${cat.split(":")[0]} lleva ${c.racha} días fallando`);
  const dia = fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short", timeZone: "America/Bogota" });
  let texto = `📋 Resumen · ${dia}\n\n${lineas.join("\n")}`;
  if (rachas.length) texto += `\n\n🔁 ${rachas.join(" · ")}`;
  if (movidas.length) texto += `\n\n🧹 Esta semana dejé de avisarte al momento: ${movidas.map((c) => c.replace(":", " · ")).join(", ")}. No los usaste; siguen aquí en el resumen.`;
  return texto.slice(0, 3900);
}

// ---------- Integracion con el Worker ----------
async function leerJson(env, k, def) {
  try { const o = await env.R2.get(k); return o ? await o.json() : def; } catch { return def; }
}
const guardar = (env, k, v) => env.R2.put(k, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });

async function hmacHex(clave, texto) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /aviso desde Actions. Firma: hex(HMAC-SHA256(token del bot, cuerpo)). Sin firma valida no hace nada.
export async function recibirAviso(request, env, safeEqual) {
  const cuerpo = (await request.text()).slice(0, 8000);
  const firma = request.headers.get("X-Aviso-Firma") || "";
  if (!env.TELEGRAM_BOT_TOKEN || !safeEqual(firma, await hmacHex(env.TELEGRAM_BOT_TOKEN, cuerpo))) {
    return new Response(JSON.stringify({ error: "firma" }), { status: 403, headers: { "content-type": "application/json" } });
  }
  let a;
  try { a = JSON.parse(cuerpo); } catch { return new Response(JSON.stringify({ modo: "ahora" }), { headers: { "content-type": "application/json" } }); }
  const estado = await leerJson(env, K_ESTADO, {});
  const d = clasificar(a, estado);
  registrar(estado, a, d);
  await guardar(env, K_ESTADO, estado);
  if (d.modo === "resumen") {
    const pend = await leerJson(env, K_PEND, []);
    pend.push({ t: new Date().toISOString(), wf: String(a.wf || "").slice(0, 80), texto: String(a.texto || "").slice(0, 300) });
    await guardar(env, K_PEND, pend.slice(-MAX_PENDIENTES));
  }
  return new Response(JSON.stringify({ modo: d.modo, por: d.por }), { headers: { "content-type": "application/json" } });
}

export async function anotarUso(env) {
  try {
    const estado = await leerJson(env, K_ESTADO, {});
    if (marcarUso(estado)) await guardar(env, K_ESTADO, estado);
  } catch (e) { console.error("[avisos] uso", e && e.message); }
}

// Llamado por el reloj: a la hora del resumen manda uno y vacia la lista; los domingos se ajusta solo.
export async function quizasResumen(env, t, enviar, abrirUrl) {
  if (t.getUTCHours() !== HORA_RESUMEN_UTC || t.getUTCMinutes() >= 30) return null;
  const estado = await leerJson(env, K_ESTADO, {});
  const hoy = t.toISOString().slice(0, 10);
  if (estado.ultimoResumen === hoy) return null;            // el reloj puede disparar dos veces
  const movidas = t.getUTCDay() === 1 ? ajustar(estado) : [];    // lunes 00 UTC = domingo 7 pm en Bogota
  const pend = await leerJson(env, K_PEND, []);
  const texto = armarResumen(pend, estado, movidas, t);
  estado.ultimoResumen = hoy;
  if (!texto) { await guardar(env, K_ESTADO, estado); return { enviado: false }; }
  const teclado = [[{ text: "🧠 Abrir el bot", web_app: { url: abrirUrl } }]];
  estado.movidas = movidas;      // el boton lleva el numero, no el nombre: Telegram corta callback_data en 64 bytes
  if (movidas.length) teclado.push(movidas.slice(0, 3).map((c, i) => ({ text: `↩️ Al momento: ${c.split(":")[0].slice(0, 18)}`, callback_data: `av:on:${i}` })));
  await guardar(env, K_ESTADO, estado);
  await enviar({ text: texto, reply_markup: { inline_keyboard: teclado }, disable_web_page_preview: true });
  await guardar(env, K_PEND, []);
  return { enviado: true, items: pend.length, movidas };
}

// Boton "↩️ Al momento: X": esa categoria vuelve a avisar en el instante.
export async function volverAlMomento(env, i) {
  const estado = await leerJson(env, K_ESTADO, {});
  const cat = (estado.movidas || [])[Number(i)];
  if (!cat) return null;
  estado.cat = estado.cat || {};
  estado.cat[cat] = { ...(estado.cat[cat] || {}), modo: "ahora" };
  await guardar(env, K_ESTADO, estado);
  return cat;
}
