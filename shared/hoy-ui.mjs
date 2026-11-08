// hoy-ui.mjs — cliente de la pantalla unica (minimalista). Se sirve desde un Worker dentro de una cadena:
// el script NO usa backticks ni "${" (lo verifica tests/hoy.test.mjs). ES5 + promesas, eventos con data-*.
//
// Reglas que este codigo cumple en cada boton:
//   - al tocarlo muestra puntitos y queda bloqueado (no hay doble toque);
//   - nunca desaparece: si falla vuelve a su texto, dice que paso y deja reintentar;
//   - toda espera tiene tope (15 s) y termina en exito o en error, jamas queda colgada.
// Y en los datos: abre al instante con lo ultimo guardado, se refresca sola en vivo (WebSocket) y si se corta
// la red lo dice ("sin conexión · hace 2 min") y reintenta.

export const HOY_CSS = `
:root{--bg:#0A0A0B;--s1:#121214;--s2:#18181B;--s3:#232327;--line:rgba(255,255,255,.07);--t1:#EDEDEF;--t2:#A1A1AA;--t3:#63636B;
--inv:#0A0A0B;--ok:#4ADE80;--warn:#FBBF24;--bad:#F87171;--sombra:rgba(0,0,0,.6)}
html[data-tema="claro"]{--bg:#FAFAFA;--s1:#FFFFFF;--s2:#F4F4F5;--s3:#E9E9EC;--line:rgba(0,0,0,.08);--t1:#18181B;--t2:#52525B;--t3:#9A9AA3;
--inv:#FAFAFA;--ok:#16A34A;--warn:#D97706;--bad:#DC2626;--sombra:rgba(0,0,0,.25)}
*{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
html,body{background:var(--bg);color:var(--t1)}
body{font:15px/1.42 -apple-system,"Segoe UI Variable","Segoe UI",Roboto,Inter,sans-serif;padding:max(10px,env(safe-area-inset-top)) 14px 96px;min-height:100vh}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.hd{display:flex;align-items:center;gap:10px;padding:6px 2px 12px}
.av{width:38px;height:38px;border-radius:12px;background:var(--s3);display:grid;place-items:center;font-weight:700}
.hd h1{font-size:17px;font-weight:700;letter-spacing:-.01em}
.vivo{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--t3);padding:2px 0}
.vivo i{width:7px;height:7px;border-radius:50%;background:var(--t3)}
.vivo.ok i{background:var(--ok)}.vivo.mal i{background:var(--bad)}.vivo.va i{background:var(--warn)}
.hd .ic{margin-left:auto;min-width:38px;height:38px;border-radius:12px;border:1px solid var(--line);display:grid;place-items:center;color:var(--t2);font-size:15px}
.hero{border-radius:20px;padding:15px;background:var(--s1);border:1px solid var(--line)}
.hero .big{font-size:21px;font-weight:650;letter-spacing:-.02em;line-height:1.22;white-space:pre-line}
.hero .sub{color:var(--t2);font-size:13px;margin-top:5px}
.strip{display:flex;gap:18px;margin-top:12px;padding-top:11px;border-top:1px solid var(--line)}
.strip div{font-size:11.5px;color:var(--t3);min-width:0}
.strip b{display:block;font-size:17px;color:var(--t1);font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
.sec{display:flex;justify-content:space-between;align-items:baseline;margin:18px 4px 8px;font-size:12.5px;font-weight:650;color:var(--t2)}
.sec span{color:var(--t3);font-weight:500}
.it{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px;border-radius:16px;background:var(--s1);border:1px solid var(--line);margin-bottom:7px}
.it:active{background:var(--s2)}
.it .tx{flex:1;min-width:0}
.it .t{font-weight:650;font-size:14px;display:flex;align-items:center;gap:8px}
.it .d{font-size:12px;color:var(--t3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt{width:6px;height:6px;border-radius:50%;flex:none;background:var(--warn)}
.pt.critical{background:var(--bad)}.pt.info{background:var(--t3)}.pt.normal{background:var(--ok)}.pt.degraded{background:var(--t3)}.pt.attention{background:var(--warn)}
.go{font-weight:600;font-size:12.5px;padding:7px 11px;border-radius:10px;background:var(--s3);white-space:nowrap}
.nuevo{font-size:10.5px;font-weight:700;color:var(--t2);letter-spacing:.02em}
.it.recien{box-shadow:0 0 0 1px var(--t3)}
.lista{border-radius:16px;background:var(--s1);border:1px solid var(--line);overflow:hidden}
.fila{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:11px 12px;border-bottom:1px solid var(--line)}
.fila:last-child{border-bottom:0}.fila:active{background:var(--s2)}
.mk{width:32px;height:32px;border-radius:10px;background:var(--s3);color:var(--t2);display:grid;place-items:center;font-weight:700;font-size:11.5px;flex:none}
.fila .n{font-weight:650;font-size:14px}.fila .m{font-size:12px;color:var(--t3);display:flex;align-items:center;gap:6px}
.fila .r{margin-left:auto;text-align:right;font-size:12.5px;color:var(--t2);font-variant-numeric:tabular-nums;white-space:nowrap}
.fila .r small{display:block;color:var(--t3);font-size:11px}
.ev{display:grid;grid-template-columns:52px 1fr;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--t2)}
.ev:last-child{border-bottom:0}.ev .tm{color:var(--t3);font-size:11.5px;font-variant-numeric:tabular-nums}.ev b{color:var(--t1);font-weight:600}
.vacio{padding:16px 12px;color:var(--t3);font-size:13px}
.aviso{margin:0 0 10px;padding:10px 12px;border-radius:12px;background:var(--s2);font-size:12.5px;color:var(--t2);display:flex;gap:10px;align-items:center}
.aviso button{margin-left:auto;font-weight:600;color:var(--t1)}
.ske{border-radius:16px;background:var(--s1);border:1px solid var(--line);height:62px;margin-bottom:7px;animation:pul 1.2s ease-in-out infinite}
@keyframes pul{50%{opacity:.55}}
.cargando{opacity:.85;pointer-events:none}
.pp{display:inline-flex;gap:3px;vertical-align:middle}
.pp i{width:5px;height:5px;border-radius:50%;background:currentColor;animation:pp 1s infinite ease-in-out}
.pp i:nth-child(2){animation-delay:.15s}.pp i:nth-child(3){animation-delay:.3s}
@keyframes pp{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}
.principal{position:fixed;left:14px;right:14px;bottom:max(14px,env(safe-area-inset-bottom));height:50px;border-radius:14px;background:var(--t1);color:var(--inv);font-weight:650;font-size:15px;display:none;align-items:center;justify-content:center;gap:8px;z-index:5}
.principal.on{display:flex}
.velo{position:fixed;inset:0;background:var(--sombra);opacity:0;pointer-events:none;transition:opacity .2s;z-index:10}
.velo.on{opacity:1;pointer-events:auto}
.hoja{position:fixed;left:0;right:0;bottom:0;max-height:86vh;overflow:auto;background:var(--s1);border-radius:24px 24px 0 0;border-top:1px solid var(--line);padding:10px 16px max(20px,env(safe-area-inset-bottom));transform:translateY(105%);transition:transform .26s cubic-bezier(.2,.8,.2,1);z-index:11}
.hoja.on{transform:none}
.agarre{width:40px;height:4px;border-radius:9px;background:var(--s3);margin:2px auto 14px}
.hh{display:flex;align-items:center;gap:11px;margin-bottom:12px}
.hh .n{font-weight:700;font-size:16.5px}.hh .m{font-size:12.5px;color:var(--t3)}
.hh .x{margin-left:auto;width:34px;height:34px;border-radius:10px;background:var(--s2);color:var(--t2)}
.met{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 6px}
.met div{background:var(--s2);border-radius:14px;padding:10px 12px;min-width:0}
.met b{display:block;font-size:18px;font-weight:650;font-variant-numeric:tabular-nums}.met span{font-size:11.5px;color:var(--t3)}
.met small{display:block;font-size:11px;color:var(--t2);margin-top:2px;overflow-wrap:anywhere}
.btn{width:100%;height:46px;border-radius:13px;background:var(--t1);color:var(--inv);font-weight:650;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:8px}
.btn.sec{background:var(--s3);color:var(--t1)}
.toast{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translate(-50%,-140%);background:var(--s3);color:var(--t1);border:1px solid var(--line);font-size:13px;padding:9px 14px;border-radius:999px;transition:transform .22s;z-index:20;max-width:92vw;text-align:center}
.toast.on{transform:translate(-50%,0)}.toast.mal{border-color:var(--bad)}
.inicio{display:none;width:100%;margin-top:14px;padding:11px 12px;border-radius:12px;border:1px dashed var(--line);font-size:12.5px;color:var(--t2);text-align:left}
.inicio.on{display:block}
.pie{margin-top:16px;text-align:center;font-size:11px;color:var(--t3)}
.reproductor{position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:16/9;margin-bottom:10px}
.reproductor.vert{aspect-ratio:9/16;max-height:52vh;margin-left:auto;margin-right:auto}
.reproductor video{width:100%;height:100%;display:block;background:#000;object-fit:contain}
.reproductor .msj{position:absolute;inset:0;display:grid;place-items:center;color:var(--t2);font-size:13px;text-align:center;padding:16px}
.vt{font-weight:650;font-size:15.5px;line-height:1.3}
.vm{font-size:12px;color:var(--t3);margin-top:3px}
.alts{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.alt{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;font-size:12.5px;color:var(--t2);padding:9px 11px;border-radius:10px;background:var(--s2)}
.alt em{font-style:normal;font-weight:600;color:var(--t1);white-space:nowrap}
.acc{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.acc button{height:44px;border-radius:12px;background:var(--s2);font-weight:600;font-size:13.5px;display:flex;align-items:center;justify-content:center;gap:6px}
.acc .si{background:var(--t1);color:var(--inv)}
.acc .no{background:transparent;border:1px solid var(--line);color:var(--t2)}
.nav{display:flex;align-items:center;gap:8px;margin-top:12px}
.nav button{height:38px;padding:0 12px;border-radius:10px;background:var(--s2);font-size:13px;font-weight:600}
.nav button:disabled{opacity:.35}
.nav span{flex:1;text-align:center;font-size:12px;color:var(--t3)}
.barra{height:5px;border-radius:9px;background:var(--s3);overflow:hidden;margin:2px 0 12px}
.barra i{display:block;height:100%;background:var(--t2)}
.marca{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line);font-size:13px}
.marca:last-child{border-bottom:0}.marca .tx{flex:1;min-width:0}.marca .d{font-size:11.5px;color:var(--t3)}
.marca .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.marca button{font-weight:600;font-size:12.5px;padding:7px 10px;border-radius:9px;background:var(--s3);white-space:nowrap}
.cod{font:700 20px ui-monospace,Consolas,monospace;letter-spacing:.1em;margin:4px 0}
`;

export const HOY_JS = `
(function () {
  "use strict";
  var tg = window.Telegram && window.Telegram.WebApp;
  var CFG = window.HOY_CFG || {};
  var CLAVE = "hoy:v1";
  var TOPE_MS = 15000;
  var S = { datos: null, at: 0, version: "", conexion: "va", ultimaRed: 0, hoja: null, vistos: {}, fallas: 0, ws: null, wsIntentos: 0, refrescando: null };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function vib(t) { try { if (t) tg.HapticFeedback.notificationOccurred(t); else tg.HapticFeedback.impactOccurred("light"); } catch (e) {} }

  // ---------- Tema: sigue a Telegram (claro u oscuro) ----------
  function tema() { document.documentElement.setAttribute("data-tema", tg && tg.colorScheme === "light" ? "claro" : "oscuro"); }

  // ---------- Avisos cortos arriba ----------
  var tt = null;
  function toast(texto, mal) {
    var e = $("toast"); e.textContent = texto; e.className = "toast on" + (mal ? " mal" : "");
    clearTimeout(tt); tt = setTimeout(function () { e.className = "toast"; }, mal ? 4200 : 2200);
  }

  // ---------- Botones: puntitos mientras trabajan, nunca desaparecen, siempre terminan ----------
  var PUNTOS = '<span class="pp" aria-label="cargando"><i></i><i></i><i></i></span>';
  function conTope(promesa, ms) {
    return new Promise(function (ok, mal) {
      var t = setTimeout(function () { mal(new Error("Tardó demasiado. Revisa la conexión y vuelve a intentar.")); }, ms || TOPE_MS);
      Promise.resolve(promesa).then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); mal(e); });
    });
  }
  function correr(btn, fn, opciones) {
    opciones = opciones || {};
    if (!btn || btn.getAttribute("data-ocupado") === "1") return Promise.resolve();
    var original = btn.innerHTML;
    btn.setAttribute("data-ocupado", "1"); btn.setAttribute("aria-busy", "true");
    btn.classList.add("cargando"); btn.innerHTML = PUNTOS;
    return conTope(new Promise(function (ok) { ok(fn()); }), opciones.tope)
      .then(function (r) {
        vib("success");
        if (opciones.exito) toast(opciones.exito);
        return r;
      }, function (e) {
        vib("error");
        toast((e && e.message) || "No se pudo. Vuelve a intentar.", true);
      })
      .then(function (r) {
        if (document.body.contains(btn)) {      // si el boton sigue en pantalla, vuelve a su estado normal
          btn.innerHTML = original; btn.classList.remove("cargando");
          btn.removeAttribute("data-ocupado"); btn.removeAttribute("aria-busy");
        }
        return r;
      });
  }

  // ---------- Guardar en el celular (abre al instante la proxima vez) ----------
  function guardar(d) {
    var s = JSON.stringify({ d: d, at: Date.now() });
    try { if (tg && tg.DeviceStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("9.0")) { tg.DeviceStorage.setItem(CLAVE, s, function () {}); return; } } catch (e) {}
    try { localStorage.setItem(CLAVE, s); } catch (e) {}
  }
  function leerGuardado() {
    return new Promise(function (ok) {
      var listo = false;
      function fin(s) { if (listo) return; listo = true; try { ok(s ? JSON.parse(s) : null); } catch (e) { ok(null); } }
      setTimeout(function () { fin(null); }, 600);
      try {
        if (tg && tg.DeviceStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("9.0")) { tg.DeviceStorage.getItem(CLAVE, function (err, v) { fin(err ? null : v); }); return; }
      } catch (e) {}
      try { fin(localStorage.getItem(CLAVE)); } catch (e) { fin(null); }
    });
  }

  // ---------- Red ----------
  function api(ruta, datos) {
    var op = { headers: { "X-Init-Data": tg ? tg.initData : "" }, cache: "no-store" };
    if (datos !== undefined) { op.method = "POST"; op.headers["content-type"] = "application/json"; op.body = JSON.stringify(datos); }
    return conTope(fetch(ruta, op).catch(function () {
      throw new Error(navigator.onLine === false ? "Sin internet. Revisa la conexión y vuelve a intentar." : "No pude conectar con el bot. Revisa la conexión y vuelve a intentar.");
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 403) throw new Error("Sesión vencida: cierra y abre la app desde el botón del bot.");
        if (!r.ok) throw new Error(j.error || ("Error " + r.status));
        return j;
      });
    }));
  }
  function refrescar(motivo) {
    if (S.refrescando) return S.refrescando;
    S.refrescando = api("/api/hoy").then(function (d) {
      S.fallas = 0; S.ultimaRed = Date.now(); S.errorRed = null;
      if (d.build && CFG.build && d.build !== CFG.build && CFG.build !== "dev") { location.replace(location.pathname + "?v=" + encodeURIComponent(d.build)); return; }
      if (d.version !== S.version) { pintar(d, motivo === "vivo"); guardar(d); }
      estadoConexion();
    }, function (e) {
      S.fallas++; S.errorRed = e;
      estadoConexion(e);
      clearTimeout(S.reintento);      // un solo reintento pendiente, cada vez mas espaciado (2 s, 4 s ... 30 s)
      S.reintento = setTimeout(function () { refrescar("reintento").catch(function () {}); }, Math.min(30000, 2000 * Math.pow(2, S.fallas - 1)));
      throw e;
    }).then(function (x) { S.refrescando = null; return x; }, function (e) { S.refrescando = null; throw e; });
    return S.refrescando;
  }

  // ---------- En vivo: el bot avisa cada cambio por WebSocket ----------
  function conectar() {
    if (!window.WebSocket || !tg || !tg.initData) return;
    if (S.ws && (S.ws.readyState === 0 || S.ws.readyState === 1)) return;
    var url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/vivo?init=" + encodeURIComponent(tg.initData);
    var ws;
    try { ws = new WebSocket(url); } catch (e) { return programarConexion(); }
    S.ws = ws;
    var ping = null, espera = null;
    ws.onopen = function () {
      S.wsIntentos = 0; estadoConexion();
      ping = setInterval(function () { try { ws.send("ping"); } catch (e) {} }, 25000);
      if (Date.now() - S.ultimaRed > 5000) refrescar("vivo").catch(function () {});   // si recien se consulto, no repite
    };
    ws.onmessage = function (m) {
      if (m.data === "pong") return;
      clearTimeout(espera); espera = setTimeout(function () { refrescar("vivo").catch(function () {}); }, 350);
    };
    ws.onclose = function () { clearInterval(ping); if (S.ws === ws) { S.ws = null; estadoConexion(); programarConexion(); } };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }
  function programarConexion() {
    if (document.hidden) return;
    S.wsIntentos++;
    setTimeout(conectar, Math.min(30000, 1000 * Math.pow(2, Math.min(S.wsIntentos, 5))));
  }
  // Respaldo: si el socket no esta abierto, consulta cada 45 s mientras la app se ve.
  setInterval(function () { if (!document.hidden && !(S.ws && S.ws.readyState === 1)) refrescar("respaldo").catch(function () {}); }, 45000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { refrescar("volver").catch(function () {}); conectar(); }
  });
  window.addEventListener("online", function () { refrescar("red").catch(function () {}); conectar(); });

  function haceCuanto(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 10) return "ahora";
    if (s < 60) return "hace " + s + " s";
    var m = Math.round(s / 60);
    if (m < 60) return "hace " + m + " min";
    var h = Math.round(m / 60);
    return h < 24 ? "hace " + h + " h" : "hace " + Math.round(h / 24) + " d";
  }
  function estadoConexion(error) {
    var e = $("vivo"); if (!e) return;
    var abierta = S.ws && S.ws.readyState === 1;
    var cls, txt;
    error = error || S.errorRed;      // mientras la ultima consulta haya fallado, no se dice "En vivo"
    if (error || (!navigator.onLine)) { cls = "mal"; txt = "Sin conexión" + (S.ultimaRed ? " · datos de " + haceCuanto(S.ultimaRed) : "") + " · reintentando"; }
    else if (abierta) { cls = "ok"; txt = "En vivo · " + (S.ultimaRed ? "actualizado " + haceCuanto(S.ultimaRed) : "conectando"); }
    else { cls = "va"; txt = S.ultimaRed ? "Actualizado " + haceCuanto(S.ultimaRed) : "Conectando…"; }
    e.className = "vivo " + cls; e.innerHTML = "<i></i>" + esc(txt);
  }
  setInterval(function () { estadoConexion(); }, 15000);

  // ---------- Pintar ----------
  function fila(s) {
    return '<button class="fila" data-sis="' + esc(s.id) + '"><div class="mk">' + esc(s.sigla) + '</div><div><div class="n">' + esc(s.name) + '</div>' +
      '<div class="m"><span class="pt ' + esc(s.status) + '"></span>' + esc(s.linea) + '</div></div>' +
      (s.der ? '<div class="r">' + esc(s.der) + (s.derSub ? '<small>' + esc(s.derSub) + '</small>' : '') + '</div>' : '') + '</button>';
  }
  function item(n, recien) {
    return '<button class="it' + (recien ? " recien" : "") + '" data-need="' + esc(n.id) + '"><span class="pt ' + esc(n.severity) + '"></span><div class="tx">' +
      '<div class="t">' + esc(n.title) + (recien ? ' <span class="nuevo">NUEVO</span>' : '') + '</div><div class="d">' + esc(n.detail || n.sigla) + '</div></div>' +
      '<span class="go">' + esc(n.accion || "Ver") + '</span></button>';
  }
  function hora(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }); }
  function pintar(d, vivo) {
    var antes = S.datos;
    S.datos = d; S.version = d.version;
    var conocidos = {};
    if (antes) (antes.paraTi || []).forEach(function (n) { conocidos[n.id] = 1; });
    $("frase").textContent = d.frase || "";
    $("estado").textContent = d.estado || "";
    $("cifras").innerHTML = (d.cifras || []).map(function (c) { return "<div><b>" + esc(c.valor) + "</b>" + esc(c.label) + "</div>"; }).join("");
    $("cifras").style.display = (d.cifras || []).length ? "flex" : "none";
    var pt = d.paraTi || [];
    $("cuantos").textContent = pt.length ? "toca para resolver" : "";
    $("parati").innerHTML = pt.length ? pt.map(function (n) { return item(n, vivo && antes && !conocidos[n.id]); }).join("") : '<div class="lista"><div class="vacio">Todo al día. Te aviso aquí cuando algo te necesite.</div></div>';
    $("sistemas").innerHTML = (d.sistemas || []).map(fila).join("");
    var act = d.actividad || [];
    $("actividad").innerHTML = act.length ? act.map(function (e) { return '<div class="ev"><span class="tm">' + esc(hora(e.at)) + '</span><span><b>' + esc(e.name) + '</b> · ' + esc(e.text) + '</span></div>'; }).join("") : '<div class="vacio">Sin movimientos recientes.</div>';
    principal();
    if (S.hoja === "signal-halo") recargarSH(false).catch(function () {});      // en vivo: refresca la hoja sin cortar el video
    else if (S.hoja) abrirSistema(S.hoja, true);
  }

  // ---------- Boton principal: la accion mas importante del momento ----------
  function principal() {
    var b = $("principal"), n = S.datos && (S.datos.paraTi || [])[0];
    if (!n || S.hoja) { b.className = "principal"; return; }
    b.innerHTML = esc((n.accion || "Ver") + ": " + n.title);
    b.setAttribute("data-need", n.id); b.className = "principal on";
  }

  // ---------- Hoja de un sistema (todo detalle se abre aqui; "atras" la cierra) ----------
  function sistema(id) { return ((S.datos && S.datos.sistemas) || []).filter(function (s) { return s.id === id; })[0]; }
  function abrirSistema(id, solo) {
    if (id === "signal-halo") return abrirSH(null, solo);
    var s = sistema(id); if (!s) return;
    S.hoja = id;
    var needs = (S.datos.paraTi || []).filter(function (n) { return n.system === id; });
    var mets = (s.metrics || []).slice(0, 4).map(function (m) {
      return '<div><b>' + esc(m.value == null ? "—" : fmt(m.value) + (m.unit ? " " + m.unit : "")) + '</b><span>' + esc(m.label) + (m.timeframe ? " · " + esc(m.timeframe) : "") + '</span>' + (m.context ? '<small>' + esc(m.context) + '</small>' : '') + '</div>';
    }).join("");
    var act = (S.datos.actividad || []).filter(function (e) { return e.system === id; });
    var h = '<div class="agarre"></div><div class="hh"><div class="mk">' + esc(s.sigla) + '</div><div><div class="n">' + esc(s.name) + '</div><div class="m">' + esc(s.headline || s.linea) + '</div></div><button class="x" data-cerrar="1" aria-label="Cerrar">✕</button></div>';
    if (s.stale) h += '<div class="aviso">Este sistema no reporta hace rato. Lo que ves puede estar viejo.</div>';
    if (s.sub) h += '<div class="hero" style="padding:12px 13px;margin-bottom:10px"><div class="sub" style="margin:0">' + esc(s.sub) + '</div></div>';
    if (mets) h += '<div class="met">' + mets + '</div>';
    if (needs.length) h += '<div class="sec" style="margin-top:14px">Para ti</div>' + needs.map(function (n) { return item(n, false); }).join("");
    if (act.length) h += '<div class="sec" style="margin-top:14px">Lo último</div><div class="lista">' + act.map(function (e) { return '<div class="ev"><span class="tm">' + esc(hora(e.at)) + '</span><span>' + esc(e.text) + '</span></div>'; }).join("") + '</div>';
    h += '<button class="btn" data-panel="' + esc(id) + '">Abrir ' + esc(s.name) + ' completo</button>';
    $("hoja").innerHTML = h;
    if (!solo) {
      $("velo").className = "velo on"; $("hoja").className = "hoja on"; $("hoja").scrollTop = 0;
      try { tg.BackButton.show(); } catch (e) {}
      principal();
    }
  }
  function cerrarHoja() {
    if (!S.hoja) return;
    S.hoja = null; $("velo").className = "velo"; $("hoja").className = "hoja";
    try { tg.BackButton.hide(); } catch (e) {}
    principal();
  }
  function fmt(v) { var n = Number(v); if (!isFinite(n)) return "—"; return n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\\.0$/, "") + "k" : String(Math.round(n * 10) / 10); }

  // ---------- Hoja de Signal Halo: ver, bajar, copiar titulo y marcar sin salir de Inicio ----------
  // El reproductor solo se cambia si cambia el video: una actualizacion en vivo no corta lo que estas viendo.
  var SH = { d: null, i: 0, titulos: {}, enlaces: {}, ver: null, cargando: null };
  var NOMBRE = { usado: "USADO", no_se_usara: "NO SE USARÁ" };
  function porUsar() { return ((SH.d && SH.d.videos) || []).filter(function (v) { return !v.borrado && v.estado === "listo"; }); }
  function gbs(b) { return (Math.round((Number(b) || 0) / 107374182.4) / 10).toFixed(1) + " GB"; }
  function mbs(b) { return Math.round((Number(b) || 0) / 1048576) + " MB"; }
  function reloj(s) { s = Math.round(s || 0); var x = s % 60; return Math.floor(s / 60) + ":" + (x < 10 ? "0" : "") + x; }
  function abrirSH(ver, solo) {
    S.hoja = "signal-halo"; SH.ver = ver || SH.ver;
    if (!solo) {
      $("hoja").innerHTML = '<div class="agarre"></div><div class="hh"><div class="mk">SH</div><div><div class="n">Signal Halo</div><div class="m" id="sh-sub">Cargando…</div></div><button class="x" data-cerrar="1" aria-label="Cerrar">✕</button></div>' +
        '<div id="sh-cuerpo"><div class="ske"></div><div class="ske"></div></div>';
      $("velo").className = "velo on"; $("hoja").className = "hoja on"; $("hoja").scrollTop = 0;
      try { tg.BackButton.show(); } catch (e) {}
      principal();
    }
    return recargarSH(!solo).catch(function () {});     // si falla, la hoja muestra el error y un Reintentar
  }
  // Devuelve una promesa que FALLA si no se pudo cargar (los botones muestran el error); el refresco en vivo la ignora.
  function recargarSH(mostrarError) {
    if (!SH.cargando) {
      SH.cargando = api("/v/signal-halo/api/estado").then(function (d) {
        SH.d = d; SH.cargando = null; pintarSH();
      }, function (e) {
        SH.cargando = null;
        if (mostrarError && $("sh-cuerpo") && !SH.d) $("sh-cuerpo").innerHTML = '<div class="aviso">' + esc(e.message) + ' <button data-sh="recargar">Reintentar</button></div>';
        throw e;
      });
    }
    return SH.cargando;
  }
  function enlace(id, bajar) {
    var k = id + (bajar ? ":dl" : ""), c = SH.enlaces[k];
    if (c && c.vence > Date.now()) return Promise.resolve(c.url);
    return api("/v/signal-halo/api/enlace?id=" + encodeURIComponent(id) + (bajar ? "&dl=1" : "")).then(function (r) {
      if (!r.url) throw new Error("No pude preparar el video.");
      SH.enlaces[k] = { url: r.url, vence: Date.now() + 5 * 3600000 };     // el link firmado dura 6 h
      return r.url;
    });
  }
  function pintarSH() {
    if (S.hoja !== "signal-halo" || !$("sh-cuerpo") || !SH.d) return;
    var d = SH.d, lista = porUsar();
    if (SH.i >= lista.length) SH.i = Math.max(0, lista.length - 1);
    var v = lista[SH.i];
    $("sh-sub").textContent = (lista.length ? lista.length + " por usar" : "Nada por usar") + " · " + gbs(d.uso) + " de " + gbs(d.limite);
    var pend = (d.pcs || []).filter(function (p) { return p.estado === "pendiente"; });
    var marcados = (d.videos || []).filter(function (x) { return !x.borrado && (x.estado === "usado" || x.estado === "no_se_usara"); });
    var cuerpo = $("sh-cuerpo"), reproductor = $("sh-rep");
    var mismo = reproductor && v && reproductor.getAttribute("data-id") === v.id;
    if (!mismo) {
      cuerpo.innerHTML = '<div class="barra"><i style="width:' + Math.min(100, d.limite ? d.uso / d.limite * 100 : 0).toFixed(1) + '%"></i></div>' +
        (v ? '<div class="reproductor' + (v.formato === "vertical" ? " vert" : "") + '" id="sh-rep" data-id="' + esc(v.id) + '"><div class="msj" id="sh-msj">Preparando el video…</div></div>' : '') +
        '<div id="sh-info"></div><div id="sh-otros"></div>';
      if (v) cargarVideo(v);
    } else {
      var barra = cuerpo.querySelector(".barra i");
      if (barra) barra.style.width = Math.min(100, d.limite ? d.uso / d.limite * 100 : 0).toFixed(1) + "%";
    }
    var info = "";
    if (v) {
      var elegido = SH.titulos[v.id] || v.titulo;
      var opciones = [v.titulo].concat(v.opciones || []).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      info += '<div class="vt">' + esc(elegido) + '</div><div class="vm">' + esc(v.proyecto) + ' · ' + reloj(v.duracion) + ' · ' + (v.formato === "horizontal" ? "Horizontal" : "Vertical") + ' · ' + mbs(v.bytes) + '</div>';
      if (opciones.length > 1) info += '<div class="alts">' + opciones.map(function (o, i) { return '<button class="alt" data-sh="titulo" data-n="' + i + '"><span>' + esc(o) + '</span><em>' + (o === elegido ? "✓ usando" : "Usar") + '</em></button>'; }).join("") + '</div>';
      info += '<div class="acc"><button data-sh="bajar">⬇ Descargar</button><button data-sh="copiar">⧉ Copiar título</button>' +
        '<button class="si" data-sh="marcar" data-e="usado">✓ USADO</button><button class="no" data-sh="marcar" data-e="no_se_usara">✕ NO SE USARÁ</button></div>';
      if (lista.length > 1) info += '<div class="nav"><button data-sh="ant"' + (SH.i === 0 ? " disabled" : "") + '>‹ Anterior</button><span>' + (SH.i + 1) + ' de ' + lista.length + '</span><button data-sh="sig"' + (SH.i >= lista.length - 1 ? " disabled" : "") + '>Siguiente ›</button></div>';
    } else {
      info += '<div class="lista"><div class="vacio">No hay videos por usar. Los que apruebes en Studio llegan aquí solos.</div></div>';
    }
    $("sh-info").innerHTML = info;
    var otros = "";
    if (pend.length) otros += '<div class="sec" id="sh-pcs" style="margin-top:16px">PC que piden acceso</div><div class="lista">' + pend.map(function (p) {
      var c = String(p.codigo || "");
      return '<div class="marca" style="display:block"><div class="t">' + esc(p.nombre) + (p.usuario ? " · " + esc(p.usuario) : "") + '</div><div class="d">Confirma que Studio muestre este código:</div><div class="cod">' + esc(c.slice(0, 3) + " " + c.slice(3)) + '</div>' +
        '<div class="acc" style="margin-top:6px"><button class="no" data-sh="pc" data-x="revocar" data-id="' + esc(p.id) + '">Rechazar</button><button class="si" data-sh="pc" data-x="autorizar" data-id="' + esc(p.id) + '">Autorizar</button></div></div>';
    }).join("") + '</div>';
    if (marcados.length) otros += '<div class="sec" style="margin-top:16px">Marcados <span>se borran de la nube a las 24 h</span></div><div class="lista">' + marcados.map(function (x) {
      return '<div class="marca"><div class="tx"><div class="t">' + esc(x.titulo) + '</div><div class="d">' + esc(NOMBRE[x.estado]) + ' · ' + esc(faltan(x.borrar_en)) + '</div></div><button data-sh="deshacer" data-id="' + esc(x.id) + '">Deshacer</button></div>';
    }).join("") + '</div>';
    otros += '<button class="btn sec" data-panel="signal-halo">Historial y PC autorizados</button>';
    $("sh-otros").innerHTML = otros;
    if (SH.ver === "pcs" && $("sh-pcs")) { $("sh-pcs").scrollIntoView({ block: "start" }); SH.ver = null; }
  }
  function cargarVideo(v) {
    enlace(v.id, false).then(function (url) {
      var r = $("sh-rep"); if (!r || r.getAttribute("data-id") !== v.id) return;
      r.innerHTML = '<video controls playsinline preload="metadata"></video>';
      var vid = r.querySelector("video");
      vid.addEventListener("error", function () {
        SH.enlaces[v.id] = null;
        r.innerHTML = '<div class="msj">No pude reproducir el video.<br><button class="go" data-sh="reintentar-video" style="margin-top:8px">Reintentar</button></div>';
      });
      vid.src = url;
    }, function (e) {
      var r = $("sh-rep"); if (!r || r.getAttribute("data-id") !== v.id) return;
      r.innerHTML = '<div class="msj">' + esc(e.message) + '<br><button class="go" data-sh="reintentar-video" style="margin-top:8px">Reintentar</button></div>';
    });
  }
  function faltan(iso) { var h = Math.round((new Date(iso) - Date.now()) / 3600000); return isNaN(h) ? "" : h <= 1 ? "se borra en menos de 1 h" : "se borra en " + h + " h"; }
  function copiarTexto(texto) {
    return new Promise(function (ok, mal) {
      function clasico() {
        var a = document.createElement("textarea"); a.value = texto; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0";
        document.body.appendChild(a); a.select(); var bien = false;
        try { bien = document.execCommand("copy"); } catch (e) { bien = false; }
        a.remove();
        if (bien) ok(); else mal(new Error("No pude copiar. Mantén presionado el título para copiarlo."));
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, clasico); else clasico();
    });
  }
  function bajar(v) {
    return enlace(v.id, true).then(function (url) {
      var nombre = String(SH.titulos[v.id] || v.titulo || "video").replace(/[/:*?"<>|]/g, "").trim().slice(0, 80) + ".mp4";
      return new Promise(function (ok) {
        if (tg && tg.downloadFile && tg.isVersionAtLeast && tg.isVersionAtLeast("8.0")) {
          try { tg.downloadFile({ url: url, file_name: nombre }, function (acepto) { ok(acepto ? "Descargando al celular" : "Descarga cancelada"); }); return; } catch (e) {}
        }
        try { tg.openLink(url); } catch (e) { window.open(url, "_blank"); }
        ok("Abrí el video para descargarlo");
      });
    });
  }
  function accionSH(b) {
    var que = b.getAttribute("data-sh"), lista = porUsar(), v = lista[SH.i];
    if (que === "ant" || que === "sig") { vib(); SH.i = Math.max(0, Math.min(lista.length - 1, SH.i + (que === "sig" ? 1 : -1))); pintarSH(); return; }
    if (que === "titulo" && v) {
      vib();
      var ops = [v.titulo].concat(v.opciones || []).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      SH.titulos[v.id] = ops[Number(b.getAttribute("data-n"))] || v.titulo; pintarSH(); return;
    }
    if (que === "reintentar-video" && v) { vib(); SH.enlaces[v.id] = null; var r = $("sh-rep"); if (r) r.removeAttribute("data-id"); pintarSH(); return; }
    if (que === "recargar") return correr(b, function () { return recargarSH(true); });
    if (que === "copiar" && v) return correr(b, function () { return copiarTexto(SH.titulos[v.id] || v.titulo); }, { exito: "Título copiado" });
    if (que === "bajar" && v) return correr(b, function () { return bajar(v).then(function (m) { toast(m); }); });
    if (que === "marcar" && v) {
      var estado = b.getAttribute("data-e");
      return correr(b, function () {
        return api("/v/signal-halo/api/marcar", { id: v.id, estado: estado }).then(function () { return recargarSH(false); });
      }, { exito: "Marcado " + NOMBRE[estado] + " · se borra de la nube en 24 h" });
    }
    if (que === "deshacer") return correr(b, function () {
      return api("/v/signal-halo/api/marcar", { id: b.getAttribute("data-id"), estado: "listo" }).then(function () { return recargarSH(false); });
    }, { exito: "Desmarcado: vuelve a Por usar" });
    if (que === "pc") {
      var x = b.getAttribute("data-x");
      return correr(b, function () {
        return api("/v/signal-halo/api/pc", { id: b.getAttribute("data-id"), accion: x }).then(function () { return recargarSH(false); });
      }, { exito: x === "autorizar" ? "PC autorizado: ya puede subir videos" : "Acceso rechazado" });
    }
  }

  // ---------- Ir a un panel completo o a un link ----------
  function irPanel(id, ver) {
    var s = sistema(id); if (!s) throw new Error("Ese sistema no está disponible.");
    location.href = s.panel + "?from=hoy" + (ver ? "&ver=" + encodeURIComponent(ver) : "");
    return new Promise(function () {});        // la pagina se va: los puntitos quedan hasta que cargue el panel
  }
  function resolver(needId) {
    var n = ((S.datos && S.datos.paraTi) || []).filter(function (x) { return x.id === needId; })[0];
    if (!n) throw new Error("Eso ya se resolvió. Actualizo la pantalla.");
    if (n.system === "signal-halo") { abrirSH(n.ver || null); return Promise.resolve(); }
    if (n.url && /^https:\\/\\//.test(n.url)) { try { tg.openLink(n.url); } catch (e) { window.open(n.url, "_blank"); } return Promise.resolve(); }
    return irPanel(n.system, n.ver);
  }

  // ---------- Eventos: un solo escuchador ----------
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) { if (ev.target.id === "velo") cerrarHoja(); return; }
    if (b.hasAttribute("data-cerrar")) { vib(); return cerrarHoja(); }
    if (b.hasAttribute("data-sh")) return accionSH(b);
    if (b.hasAttribute("data-sis")) { vib(); return abrirSistema(b.getAttribute("data-sis")); }
    if (b.hasAttribute("data-need")) return correr(b, function () { return resolver(b.getAttribute("data-need")); }, { tope: 20000 }).then(function () { refrescar("accion").catch(function () {}); });
    if (b.hasAttribute("data-panel")) return correr(b, function () { return irPanel(b.getAttribute("data-panel")); }, { tope: 20000 });
    if (b.id === "refrescar") return correr(b, function () { return refrescar("manual"); }, { exito: "Al día" });
    if (b.id === "inicio") return correr(b, function () {
      return new Promise(function (ok, mal) {
        try { tg.addToHomeScreen(); setTimeout(ok, 400); } catch (e) { mal(new Error("Tu Telegram no permite agregarlo a inicio todavía.")); }
      });
    });
    if (b.id === "reintentar") return correr(b, function () { return refrescar("manual"); }, { exito: "Al día" });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarHoja(); });

  // ---------- Arranque: primero lo guardado (al instante), luego lo vivo ----------
  function arrancar() {
    tema();
    if (tg) {
      try { tg.ready(); tg.expand(); } catch (e) {}
      try { tg.BackButton.onClick(cerrarHoja); } catch (e) {}
      try { tg.onEvent("themeChanged", tema); } catch (e) {}
      try {
        if (tg.isVersionAtLeast && tg.isVersionAtLeast("8.0") && tg.checkHomeScreenStatus) {
          tg.checkHomeScreenStatus(function (st) { if (st === "missed" || st === "unknown") $("inicio").className = "inicio on"; });
        }
      } catch (e) {}
    }
    var u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (u && u.first_name) { $("saludo").textContent = "Hola, " + u.first_name; $("av").textContent = u.first_name.charAt(0).toUpperCase(); }
    estadoConexion();
    leerGuardado().then(function (g) {
      if (g && g.d && !S.datos) { pintar(g.d, false); S.ultimaRed = g.at || 0; estadoConexion(); }
      return refrescar("inicio");
    }).catch(function () {
      if (!S.datos) $("parati").innerHTML = '<div class="aviso">No pude cargar los datos. <button id="reintentar">Reintentar</button></div>';
    });
    conectar();
  }
  arrancar();
})();
`;

export function hoyHtml({ build = "dev" } = {}) {
  build = String(build).replace(/[^\w.-]/g, "").slice(0, 40) || "dev";     // va dentro de un <script>: solo letras, numeros, . y -
  return '<!doctype html><html lang="es" data-tema="oscuro"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="color-scheme" content="dark light"><title>Inicio</title>' +
    '<script src="https://telegram.org/js/telegram-web-app.js"></script>' +
    "<style>" + HOY_CSS + "</style></head><body>" +
    '<div class="hd"><div class="av" id="av">J</div><div><h1 id="saludo">Hola</h1><div class="vivo va" id="vivo"><i></i>Conectando…</div></div>' +
    '<button class="ic" id="refrescar" aria-label="Actualizar">↻</button></div>' +
    '<div class="hero"><div class="big" id="frase">Cargando…</div><div class="sub" id="estado"></div><div class="strip" id="cifras" style="display:none"></div></div>' +
    '<div class="sec">Para ti <span id="cuantos"></span></div><div id="parati"><div class="ske"></div><div class="ske"></div></div>' +
    '<div class="sec">Sistemas <span>toca uno para abrirlo</span></div><div class="lista" id="sistemas"><div class="ske" style="margin:0;border:0;border-radius:0"></div></div>' +
    '<div class="sec">Últimas horas</div><div class="lista" id="actividad"></div>' +
    '<button class="inicio" id="inicio">📱 Agregar a la pantalla de inicio del celular</button>' +
    '<div class="pie">Build ' + String(build).replace(/[^\w.-]/g, "") + "</div>" +
    '<button class="principal" id="principal"></button>' +
    '<div class="velo" id="velo"></div><div class="hoja" id="hoja"></div><div class="toast" id="toast"></div>' +
    '<script>window.HOY_CFG={build:' + JSON.stringify(String(build)) + "};</script>" +
    "<script>" + HOY_JS + "</script></body></html>";
}
