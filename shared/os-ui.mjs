// os-ui.mjs — DESIGN SYSTEM del AI OS (Video Forge · Viento · Radar). Una sola fuente para las tres Mini Apps.
// Exporta cadenas para incrustar en el HTML de cada Worker: OS_HEAD (fuentes), OS_CSS (tokens + componentes),
// OS_ICONS (sprite SVG) y OS_JS (utilidades del cliente). Reglas: sin backticks ni "${" dentro de las cadenas
// (van dentro de template literals de los Workers), eventos por data-* y ES5 en el cliente.
// Dirección: quiet luxury de centro de control. Oscuro como experiencia principal; claro heredado de Telegram.
// Versión: subir OS_UI_VERSION en cada cambio (la copia de Viento se valida contra este número y su hash).

export const OS_UI_VERSION = "1.0.0";

export const OS_HEAD = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">';

export const OS_CSS = `
:root{
  --os-bg:#0A0D12;--os-surface:#10151C;--os-elev:#161D26;--os-border:#232C38;--os-hair:#1A222C;
  --os-t1:#E7ECF3;--os-t2:#9BA8B9;--os-t3:#687588;
  --os-ok:#3DD68C;--os-warn:#F2B84B;--os-bad:#F07070;--os-info:#6CB4FF;
  --os-acc:#A594FF;--os-acc-soft:rgba(165,148,255,.14);--os-acc-line:rgba(165,148,255,.35);
  --os-sans:"Geist",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
  --os-mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --os-r-chip:8px;--os-r-row:12px;--os-r-card:16px;--os-r-sheet:22px;
  --os-fast:120ms;--os-base:200ms;--os-slow:320ms;--os-ease:cubic-bezier(.2,.8,.2,1);
  --os-safe-b:env(safe-area-inset-bottom);
}
body[data-sys="video-forge"]{--os-acc:#A594FF;--os-acc-soft:rgba(165,148,255,.14);--os-acc-line:rgba(165,148,255,.35)}
body[data-sys="viento"]{--os-acc:#3DDBB0;--os-acc-soft:rgba(61,219,176,.13);--os-acc-line:rgba(61,219,176,.35)}
body[data-sys="radar"]{--os-acc:#4CC9F0;--os-acc-soft:rgba(76,201,240,.13);--os-acc-line:rgba(76,201,240,.35)}
html[data-theme="light"]{
  --os-bg:#F4F6F8;--os-surface:#FFFFFF;--os-elev:#FFFFFF;--os-border:#DDE3EA;--os-hair:#E8ECF1;
  --os-t1:#0E141B;--os-t2:#4A5667;--os-t3:#7A8697;
  --os-ok:#1F9D63;--os-warn:#B7791F;--os-bad:#D14343;--os-info:#2F6FD1;
}
html[data-theme="light"] body[data-sys="video-forge"]{--os-acc:#6E56CF;--os-acc-soft:rgba(110,86,207,.10);--os-acc-line:rgba(110,86,207,.30)}
html[data-theme="light"] body[data-sys="viento"]{--os-acc:#119C74;--os-acc-soft:rgba(17,156,116,.10);--os-acc-line:rgba(17,156,116,.30)}
html[data-theme="light"] body[data-sys="radar"]{--os-acc:#0A84A8;--os-acc-soft:rgba(10,132,168,.10);--os-acc-line:rgba(10,132,168,.30)}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--os-bg);color:var(--os-t1)}
body{font-family:var(--os-sans);font-size:15.5px;line-height:1.5;-webkit-font-smoothing:antialiased;padding:0 16px calc(84px + var(--os-safe-b))}
.os-wrap{max-width:560px;margin:0 auto}
.os-mono{font-family:var(--os-mono)}
.os-num{font-variant-numeric:tabular-nums}
.os-t2{color:var(--os-t2)}.os-t3{color:var(--os-t3)}
/* Encabezado del sistema */
.os-top{position:sticky;top:0;z-index:10;background:var(--os-bg);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0 10px}
.os-id{display:flex;align-items:center;gap:10px;min-width:0}
.os-mark{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--os-acc-soft);color:var(--os-acc);flex-shrink:0}
.os-mark svg{width:18px;height:18px}
.os-name{font-weight:600;font-size:15px;letter-spacing:-.01em}
.os-ai{font-family:var(--os-mono);font-size:11px;color:var(--os-t3);display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.os-iconbtn{width:36px;height:36px;border-radius:10px;border:1px solid var(--os-border);background:var(--os-surface);color:var(--os-t2);display:flex;align-items:center;justify-content:center;cursor:pointer}
.os-iconbtn svg{width:18px;height:18px}
.os-iconbtn:active{transform:scale(.94)}
/* Pulse del sistema */
.os-pulse{padding:18px 0 6px}
.os-greet{font-family:var(--os-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--os-t3)}
.os-headline{font-size:28px;font-weight:650;letter-spacing:-.025em;line-height:1.15;margin-top:6px;text-wrap:balance}
.os-sub{color:var(--os-t2);margin-top:6px;font-size:15px}
.os-counts{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:14px;font-family:var(--os-mono);font-size:12px;color:var(--os-t2)}
.os-counts span{display:inline-flex;align-items:center;gap:7px}
/* Estados (dot) */
.os-dot{width:8px;height:8px;border-radius:50%;background:var(--os-t3);display:inline-block;flex-shrink:0;position:relative}
.os-dot[data-s="observing"],.os-dot[data-s="analyzing"]{background:var(--os-info)}
.os-dot[data-s="thinking"],.os-dot[data-s="researching"]{background:var(--os-acc)}
.os-dot[data-s="executing"],.os-dot[data-s="asking"],.os-dot[data-s="warning"]{background:var(--os-warn)}
.os-dot[data-s="completed"],.os-dot[data-s="normal"]{background:var(--os-ok)}
.os-dot[data-s="failed"],.os-dot[data-s="critical"]{background:var(--os-bad)}
.os-dot[data-s="attention"]{background:var(--os-warn)}
.os-dot[data-s="degraded"]{background:var(--os-t2)}
.os-dot[data-s="thinking"]::after,.os-dot[data-s="executing"]::after,.os-dot[data-s="researching"]::after,.os-dot[data-s="observing"]::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid currentColor;color:inherit;opacity:0;animation:os-ring 1.8s var(--os-ease) infinite}
.os-dot[data-s="thinking"]::after{border-color:var(--os-acc)}.os-dot[data-s="executing"]::after{border-color:var(--os-warn)}
.os-dot[data-s="researching"]::after{border-color:var(--os-acc)}.os-dot[data-s="observing"]::after{border-color:var(--os-info);animation-duration:3s}
@keyframes os-ring{0%{opacity:.7;transform:scale(.6)}100%{opacity:0;transform:scale(1.6)}}
/* Secciones y filas: divisores antes que tarjetas */
.os-sec{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-family:var(--os-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--os-t3);margin:26px 0 8px}
.os-sec a,.os-sec button{font-family:var(--os-sans);text-transform:none;letter-spacing:0;font-size:12.5px;color:var(--os-acc);background:none;border:0;padding:0;cursor:pointer}
.os-list{border-top:1px solid var(--os-hair)}
.os-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--os-hair);min-height:48px}
.os-row.tap{cursor:pointer}.os-row.tap:active{opacity:.7}
.os-row .main{flex:1;min-width:0}
.os-row .title{font-size:14.5px;font-weight:500;line-height:1.3}
.os-row .meta{font-size:12.5px;color:var(--os-t2);margin-top:2px}
.os-row .end{font-family:var(--os-mono);font-size:12px;color:var(--os-t2);white-space:nowrap}
.os-chev{color:var(--os-t3);width:16px;height:16px;flex-shrink:0}
/* Decisiones (Needs you) */
.os-need{border:1px solid var(--os-border);background:var(--os-surface);border-radius:var(--os-r-row);padding:12px 14px;margin:8px 0}
.os-need[data-sev="critical"]{border-color:rgba(240,112,112,.45)}
.os-need .h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.os-need .t{font-weight:600;font-size:14.5px;line-height:1.3}
.os-need .w{font-size:13px;color:var(--os-t2);margin-top:4px}
.os-need .e{font-family:var(--os-mono);font-size:11.5px;color:var(--os-t3);margin-top:6px}
.os-need .a{display:flex;gap:8px;margin-top:10px}
/* Actividad de la IA */
.os-act{display:grid;grid-template-columns:46px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid var(--os-hair);font-size:13.5px}
.os-act:last-child{border-bottom:0}
.os-act .tm{font-family:var(--os-mono);font-size:11.5px;color:var(--os-t3);padding-top:1px}
.os-act .ag{font-size:12px;color:var(--os-t2)}
.os-act.new{animation:os-in var(--os-base) var(--os-ease)}
/* Métrica con interpretación */
.os-metric{padding:12px 0;border-bottom:1px solid var(--os-hair)}
.os-metric .k{font-family:var(--os-mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--os-t3)}
.os-metric .v{display:flex;align-items:baseline;gap:10px;margin-top:4px}
.os-metric .val{font-size:24px;font-weight:650;letter-spacing:-.02em}
.os-metric .chg{font-family:var(--os-mono);font-size:12px}
.os-metric .chg.up{color:var(--os-ok)}.os-metric .chg.down{color:var(--os-bad)}
.os-metric .ctx{font-size:12.5px;color:var(--os-t3);margin-top:2px}
.os-metric .ai{font-size:13px;color:var(--os-t2);margin-top:6px}
.os-metric .ai b{color:var(--os-acc);font-weight:500}
/* Insight: qué, por qué, impacto, acción */
.os-insight{border-left:2px solid var(--os-acc-line);padding:2px 0 2px 12px;margin:12px 0}
.os-insight .what{font-weight:600;font-size:14.5px}
.os-insight .why{font-size:13px;color:var(--os-t2);margin-top:3px}
.os-insight .do{font-size:13px;margin-top:6px;color:var(--os-t1)}
.os-insight .conf{font-family:var(--os-mono);font-size:11px;color:var(--os-t3);margin-top:6px}
/* Chips, barras, gráficos */
.os-chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--os-mono);font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--os-border);color:var(--os-t2);white-space:nowrap}
.os-chip.acc{border-color:var(--os-acc-line);color:var(--os-acc)}
.os-chip.ok{color:var(--os-ok)}.os-chip.warn{color:var(--os-warn)}.os-chip.bad{color:var(--os-bad)}
.os-bar{height:4px;border-radius:999px;background:var(--os-hair);overflow:hidden;margin-top:8px}
.os-bar i{display:block;height:100%;background:var(--os-acc);border-radius:999px;transition:width var(--os-slow) var(--os-ease)}
.os-spark{display:block;width:100%;height:36px}
.os-spark path.l{fill:none;stroke:var(--os-acc);stroke-width:1.5}
.os-spark path.a{fill:var(--os-acc-soft);stroke:none}
.os-spark circle{fill:var(--os-acc)}
.os-spark line.ref{stroke:var(--os-border);stroke-dasharray:2 3}
/* Botones */
.os-btn{height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--os-border);background:var(--os-surface);color:var(--os-t1);font-family:var(--os-sans);font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform var(--os-fast) var(--os-ease)}
.os-btn:active{transform:scale(.97)}
.os-btn.primary{background:var(--os-acc);border-color:var(--os-acc);color:#0A0D12}
.os-btn.danger{color:var(--os-bad);border-color:rgba(240,112,112,.4)}
.os-btn.sm{height:34px;padding:0 12px;font-size:13px;border-radius:10px}
.os-btn.block{width:100%}
/* Navegación inferior con comando central */
.os-nav{position:fixed;left:0;right:0;bottom:0;z-index:20;background:rgba(10,13,18,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--os-hair);padding:6px 10px calc(8px + var(--os-safe-b));display:flex;justify-content:space-around;align-items:center}
html[data-theme="light"] .os-nav{background:rgba(255,255,255,.92)}
.os-nav button{flex:1;background:none;border:0;color:var(--os-t3);font-family:var(--os-sans);font-size:10.5px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;cursor:pointer;position:relative}
.os-nav button svg{width:22px;height:22px}
.os-nav button.on{color:var(--os-t1)}
.os-nav button.on svg{color:var(--os-acc)}
.os-nav .ask{flex:0 0 auto;width:48px;height:48px;border-radius:15px;background:var(--os-acc);color:#0A0D12;margin:0 6px;justify-content:center}
.os-nav .ask svg{width:22px;height:22px;color:#0A0D12}
.os-badge{position:absolute;top:2px;left:50%;margin-left:6px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--os-warn);color:#0A0D12;font-family:var(--os-mono);font-size:10px;line-height:16px;text-align:center}
/* Sheet */
.os-shade{position:fixed;inset:0;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity var(--os-base) var(--os-ease);z-index:40}
.os-shade.on{opacity:1;pointer-events:auto}
.os-sheet{position:fixed;left:0;right:0;bottom:0;z-index:41;background:var(--os-elev);border-top:1px solid var(--os-border);border-radius:var(--os-r-sheet) var(--os-r-sheet) 0 0;padding:10px 16px calc(20px + var(--os-safe-b));max-height:86vh;overflow:auto;transform:translateY(104%);transition:transform var(--os-slow) var(--os-ease);box-shadow:0 -20px 50px rgba(0,0,0,.45)}
.os-sheet.on{transform:none}
.os-grip{width:36px;height:4px;border-radius:999px;background:var(--os-border);margin:0 auto 14px}
.os-chain{display:grid;gap:10px}
.os-chain div{display:grid;grid-template-columns:96px 1fr;gap:12px;font-size:14px}
.os-chain .k{font-family:var(--os-mono);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--os-t3);padding-top:2px}
/* Vacíos, errores, carga, toast */
.os-empty{padding:18px 0;color:var(--os-t2);font-size:14px}
.os-empty b{display:block;color:var(--os-t1);font-weight:600;margin-bottom:2px}
.os-error{border:1px solid rgba(240,112,112,.35);border-radius:var(--os-r-row);padding:12px 14px;margin:10px 0}
.os-error b{color:var(--os-bad)}
.os-skel{height:12px;border-radius:6px;background:var(--os-hair);margin:10px 0;position:relative;overflow:hidden}
.os-skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);animation:os-shim 1.4s infinite}
@keyframes os-shim{to{transform:translateX(100%)}}
.os-toast{position:fixed;left:16px;right:16px;bottom:calc(92px + var(--os-safe-b));z-index:50;background:var(--os-elev);border:1px solid var(--os-border);border-radius:12px;padding:12px 14px;font-size:14px;transform:translateY(20px);opacity:0;pointer-events:none;transition:all var(--os-base) var(--os-ease)}
.os-toast.on{transform:none;opacity:1}
@keyframes os-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.os-view{animation:os-in var(--os-base) var(--os-ease)}
.os-hide{display:none!important}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
`;

// Iconos: trazo 1.5, 24x24, currentColor. Uso: <svg><use href="#i-pulse"/></svg>
export const OS_ICONS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
  '<symbol id="i-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 5 12 2.5-6H21"/></symbol>' +
  '<symbol id="i-pipeline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1.5"/><rect x="3" y="10" width="12" height="4" rx="1.5"/><rect x="3" y="16" width="7" height="4" rx="1.5"/></symbol>' +
  '<symbol id="i-learn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-4 3 3 5-6"/></symbol>' +
  '<symbol id="i-ask" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.9L19 9.7l-4.2 3.1L16 18l-4-2.8L8 18l1.2-5.2L5 9.7l5.2-1.8z"/></symbol>' +
  '<symbol id="i-needs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l2.5-8h11L20 13"/><path d="M4 13v6h16v-6"/><path d="M4 13h5l1 2h4l1-2h5"/></symbol>' +
  '<symbol id="i-growth" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c4 0 5-10 9-10 2.5 0 3 3 7 3"/><path d="M16 4h4v4"/></symbol>' +
  '<symbol id="i-commerce" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 11H6.2z"/><path d="M9 8V6a3 3 0 016 0v2"/></symbol>' +
  '<symbol id="i-radar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l5-5"/></symbol>' +
  '<symbol id="i-health" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></symbol>' +
  '<symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>' +
  '<symbol id="i-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/></symbol>' +
  '<symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></symbol>' +
  '<symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>' +
  '<symbol id="i-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></symbol>' +
  '<symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></symbol>' +
  '<symbol id="i-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></symbol>' +
  '<symbol id="i-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 5.5v13l10.5-6.5z"/></symbol>' +
  '<symbol id="i-pause" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 5v14M15 5v14"/></symbol>' +
  '<symbol id="i-pr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M6 8.2v7.6"/><path d="M18 15.8V10a3 3 0 00-3-3h-3"/><path d="M13.5 5L12 7l1.5 2"/></symbol>' +
  '<symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></symbol>' +
  '<symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 5v6h-6"/></symbol>' +
  '</defs></svg>';

// Utilidades del cliente (ES5, sin backticks). Se exponen en window.OS.
export const OS_JS = `
(function(){
  var tg=window.Telegram&&window.Telegram.WebApp;
  var OS={tg:tg};
  OS.el=function(id){return document.getElementById(id);};
  OS.esc=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");};
  OS.num=function(n){if(n==null||!isFinite(+n))return "—";n=+n;var a=Math.abs(n);if(a>=1e6)return (n/1e6).toFixed(a>=1e7?0:1)+" M";if(a>=1e4)return Math.round(n/1e3)+" mil";return Math.round(n).toLocaleString("es");};
  OS.pct=function(n){if(n==null||!isFinite(+n))return "—";return (n>0?"+":"")+(Math.round(n*10)/10)+"%";};
  OS.ago=function(iso){var t=Date.parse(iso);if(!isFinite(t))return "—";var m=Math.round((Date.now()-t)/60000);if(m<1)return "ahora";if(m<60)return "hace "+m+" min";var h=Math.round(m/60);if(h<48)return "hace "+h+" h";return "hace "+Math.round(h/24)+" d";};
  OS.hhmm=function(iso){var d=new Date(iso);if(isNaN(d))return "—";return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2);};
  OS.greet=function(){var h=new Date().getHours();return h<12?"Buenos días":h<19?"Buenas tardes":"Buenas noches";};
  OS.icon=function(name,cls){return '<svg class="'+(cls||"")+'" aria-hidden="true"><use href="#i-'+name+'"/></svg>';};
  OS.dot=function(state){return '<span class="os-dot" data-s="'+OS.esc(state||"idle")+'"></span>';};
  OS.haptic=function(t){try{var H=tg&&tg.HapticFeedback;if(!H)return;if(t==="sel")H.selectionChanged();else if(t==="ok")H.notificationOccurred("success");else if(t==="err")H.notificationOccurred("error");else if(t==="warn")H.notificationOccurred("warning");else H.impactOccurred(t||"light");}catch(e){}};
  OS.toast=function(msg){var t=OS.el("osToast");if(!t){t=document.createElement("div");t.id="osToast";t.className="os-toast";document.body.appendChild(t);}t.textContent=msg;t.classList.add("on");clearTimeout(OS._tt);OS._tt=setTimeout(function(){t.classList.remove("on");},2600);};
  OS.sparkline=function(values,opts){opts=opts||{};var v=(values||[]).filter(function(x){return isFinite(+x);}).map(Number);if(v.length<2)return "";var W=300,H=36,p=3,mn=Math.min.apply(null,v),mx=Math.max.apply(null,v),rg=(mx-mn)||1;
    var pts=v.map(function(y,i){return [p+(i/(v.length-1))*(W-2*p),H-p-((y-mn)/rg)*(H-2*p)];});
    var d=pts.map(function(q,i){return (i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1);}).join(" ");
    var area=d+" L"+pts[pts.length-1][0].toFixed(1)+" "+(H-p)+" L"+pts[0][0].toFixed(1)+" "+(H-p)+" Z";
    var ref="";if(opts.ref!=null&&isFinite(+opts.ref)){var ry=H-p-((+opts.ref-mn)/rg)*(H-2*p);if(ry>=0&&ry<=H)ref='<line class="ref" x1="0" x2="'+W+'" y1="'+ry.toFixed(1)+'" y2="'+ry.toFixed(1)+'"/>';}
    var last=pts[pts.length-1];
    return '<svg class="os-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="'+OS.esc(opts.label||"tendencia")+'">'+ref+'<path class="a" d="'+area+'"/><path class="l" d="'+d+'"/><circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="2.5"/></svg>';};
  OS.openSheet=function(html){var sh=OS.el("osSheet"),sd=OS.el("osShade");if(!sh){sd=document.createElement("div");sd.id="osShade";sd.className="os-shade";sh=document.createElement("div");sh.id="osSheet";sh.className="os-sheet";document.body.appendChild(sd);document.body.appendChild(sh);sd.addEventListener("click",OS.closeSheet);}
    sh.innerHTML='<div class="os-grip"></div>'+html;sd.classList.add("on");sh.classList.add("on");OS.sheetOpen=true;OS.haptic("light");OS.backSync&&OS.backSync();};
  OS.closeSheet=function(){var sh=OS.el("osSheet"),sd=OS.el("osShade");if(sh)sh.classList.remove("on");if(sd)sd.classList.remove("on");OS.sheetOpen=false;OS.backSync&&OS.backSync();};
  OS.chain=function(rows){return '<div class="os-chain">'+rows.map(function(r){return '<div><span class="k">'+OS.esc(r[0])+'</span><span>'+OS.esc(r[1]||"—")+'</span></div>';}).join("")+'</div>';};
  OS.empty=function(title,meaning){return '<div class="os-empty"><b>'+OS.esc(title)+'</b>'+OS.esc(meaning||"")+'</div>';};
  OS.skeleton=function(n){var s="";for(var i=0;i<(n||3);i++)s+='<div class="os-skel" style="width:'+(88-i*17)+'%"></div>';return s;};
  OS.theme=function(){try{var light=tg&&tg.colorScheme==="light";document.documentElement.setAttribute("data-theme",light?"light":"dark");if(tg&&tg.setHeaderColor)tg.setHeaderColor(light?"#F4F6F8":"#0A0D12");if(tg&&tg.setBackgroundColor)tg.setBackgroundColor(light?"#F4F6F8":"#0A0D12");}catch(e){}};
  OS.api=function(path,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["X-Init-Data"]=tg?tg.initData:"";return fetch(path,opts).then(function(r){return r.json();});};
  if(tg){try{tg.ready();tg.expand();tg.disableVerticalSwipes&&tg.disableVerticalSwipes();tg.onEvent&&tg.onEvent("themeChanged",OS.theme);}catch(e){}}
  OS.theme();
  window.OS=OS;
})();
`;
