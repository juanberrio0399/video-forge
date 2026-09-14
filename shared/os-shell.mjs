// os-shell.mjs — APP COMÚN del AI OS. La misma pantalla en Video Forge, Viento y Radar (cambia el acento y el
// panel propio). Lee /api/os (estado global unido al leer + pulse del sistema) y muestra:
//   Pulse      qué está pasando ahora, prioridad del día, los tres sistemas, lo que te necesita, agentes,
//              métricas con interpretación, insights con su confianza y la actividad real de la IA.
//   Trabajo    tareas del sistema (en curso primero) y su bitácora completa.
//   Decisiones todo lo que espera a Juan en los tres sistemas, con la cadena qué/por qué/evidencia/autonomía.
//   Panel      el panel detallado que ya existe en cada bot (ahí se aprueba: el OS no inventa aprobaciones).
// Reglas: el HTML se arma por concatenación (sin backticks ni "${" en las cadenas), cliente ES5, eventos data-*.
import { OS_HEAD, OS_CSS, OS_ICONS, OS_JS, OS_UI_VERSION } from "./os-ui.mjs";

export const OS_SHELL_VERSION = "1.0.0";

export const OS_SYSTEMS_UI = {
  "video-forge": { name: "Video Forge", role: "Create", icon: "play", panel: "/app2", panelLabel: "Canales", method: "POST" },
  viento: { name: "Viento", role: "Grow", icon: "growth", panel: "/app", panelLabel: "Tienda", method: "GET" },
  radar: { name: "Radar", role: "Improve", icon: "radar", panel: "/app", panelLabel: "Repos", method: "POST" },
};

export const OS_SHELL_CSS = `
:root{--os-c-video-forge:#A594FF;--os-c-viento:#3DDBB0;--os-c-radar:#4CC9F0}
html[data-theme="light"]{--os-c-video-forge:#6E56CF;--os-c-viento:#119C74;--os-c-radar:#0A84A8}
.os-chip.sys[data-c="video-forge"]{color:var(--os-c-video-forge);border-color:currentColor}
.os-chip.sys[data-c="viento"]{color:var(--os-c-viento);border-color:currentColor}
.os-chip.sys[data-c="radar"]{color:var(--os-c-radar);border-color:currentColor}
.os-sysbar{width:3px;align-self:stretch;border-radius:2px;background:var(--os-border)}
.os-sysbar[data-c="video-forge"]{background:var(--os-c-video-forge)}
.os-sysbar[data-c="viento"]{background:var(--os-c-viento)}
.os-sysbar[data-c="radar"]{background:var(--os-c-radar)}
.os-role{font-family:var(--os-mono);font-size:11px;color:var(--os-t3);margin-left:8px;font-weight:400}
.os-row.me .title{color:var(--os-t1)}
.os-prio{display:block;width:100%;text-align:left;font:inherit;color:inherit;border:1px solid var(--os-acc-line);background:var(--os-acc-soft);border-radius:var(--os-r-card);padding:14px 16px;margin-top:18px;cursor:pointer}
.os-prio:active{transform:scale(.99)}
.os-prio .k{font-family:var(--os-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--os-acc)}
.os-prio .t{font-weight:600;font-size:16px;line-height:1.3;margin-top:6px;text-wrap:balance}
.os-prio .w{font-size:13.5px;color:var(--os-t2);margin-top:4px}
.os-need.tap{cursor:pointer}.os-need.tap:active{opacity:.75}
.os-foot{font-family:var(--os-mono);font-size:11px;color:var(--os-t3);text-align:center;margin:28px 0 8px}
.os-sheet .os-title{font-size:18px;font-weight:650;letter-spacing:-.01em;line-height:1.25;margin:0 0 14px;text-wrap:balance}
.os-actions{display:grid;gap:8px;margin-top:18px}
.os-note{font-size:13px;color:var(--os-t2);margin-top:14px}
`;

export const OS_APP_JS = `
(function(){
  var C=window.OS_CFG,OS=window.OS,tg=OS.tg,E=OS.esc;
  var ST=null,ERR=null,TAB="pulse",LOADING=false,LAST=0,ANIM=true;
  var SYSN={"video-forge":"Video Forge",viento:"Viento",radar:"Radar"};
  var STATUS_TXT={normal:"En orden",attention:"Requiere atención",degraded:"Sin señal",critical:"Crítico"};
  var STATE_TXT={idle:"En espera",observing:"Observando",thinking:"Pensando",researching:"Investigando",analyzing:"Analizando",executing:"Ejecutando",waiting:"Esperando",asking:"Te pregunta",completed:"Terminó",warning:"Con avisos",failed:"Falló",paused:"En pausa"};
  var TASK_TXT={QUEUED:"En cola",RUNNING:"Corriendo",THINKING:"Pensando",WAITING:"Esperando",APPROVAL:"Espera tu OK",COMPLETED:"Terminada",FAILED:"Falló",CANCELLED:"Cancelada"};
  var TASK_DOT={QUEUED:"idle",RUNNING:"executing",THINKING:"thinking",WAITING:"idle",APPROVAL:"asking",COMPLETED:"completed",FAILED:"failed",CANCELLED:"degraded"};
  var AUT_TXT={AUTO:"Automática",REVIEW:"Para revisar",APPROVAL:"Necesita tu aprobación",CRITICAL:"Crítica"};
  var TRUST_TXT={suggested:"sugerido",prepared:"preparado",executed:"hecho",approved:"aprobado por ti"};
  var RISK_TXT={low:"Bajo",medium:"Medio",high:"Alto"};
  var ACTIVE=["observing","thinking","researching","analyzing","executing","waiting","asking"];

  function plural(n,one,many){return n+" "+(n===1?one:many);}
  function chipSys(s){return '<span class="os-chip sys" data-c="'+E(s)+'">'+E(SYSN[s]||s)+'</span>';}
  function conf(c){return c&&c.basis?"Confianza "+Math.round(c.value*100)+"% · "+c.basis:"Confianza: datos insuficientes";}
  function needs(){return (ST&&ST.global&&ST.global.needs)||[];}
  function mine(){return ST&&ST.pulse;}
  function leadState(p){var s=(p.agents||[]).map(function(a){return a.state;});var order=["executing","thinking","researching","analyzing","asking","observing"];for(var i=0;i<order.length;i++)if(s.indexOf(order[i])>=0)return order[i];return p.status;}

  function topHtml(){
    var p=mine(),line,state;
    if(!ST){line=ERR?"Sin conexión":"Conectando…";state="idle";}
    else if(!p){line="Sin señal de "+C.name;state="degraded";}
    else if(p.stale){line="Sin señal "+OS.ago(p.at);state="degraded";}
    else{var act=(p.agents||[]).filter(function(a){return ACTIVE.indexOf(a.state)>=0;}).length;line=plural(act,"agente activo","agentes activos")+" · "+OS.ago(p.at);state=leadState(p);}
    return '<div class="os-id"><div class="os-mark">'+OS.icon(C.icon)+'</div><div style="min-width:0"><div class="os-name">'+E(C.name)+'</div><div class="os-ai">'+OS.dot(state)+'<span>'+E(line)+'</span></div></div></div>'
      +'<button class="os-iconbtn" data-act="refresh" aria-label="Actualizar">'+OS.icon("refresh")+'</button>';
  }

  function needHtml(n){
    return '<div class="os-need tap" data-need="'+E(n.id)+'" data-sev="'+E(n.severity)+'"><div class="h"><div class="t">'+E(n.title)+'</div>'+chipSys(n.system)+'</div>'
      +(n.why?'<div class="w">'+E(n.why)+'</div>':"")
      +'<div class="e">'+E(AUT_TXT[n.autonomy]||n.autonomy)+(n.evidence?" · "+E(n.evidence):"")+'</div></div>';
  }
  function metricHtml(m){
    var chg=m.change_pct==null?"":'<span class="chg '+(m.change_pct>=0?"up":"down")+'">'+OS.pct(m.change_pct)+'</span>';
    var val=m.value==null?"—":(m.unit==="COP"?"$":"")+OS.num(m.value);
    return '<div class="os-metric"><div class="k">'+E(m.label)+(m.timeframe?" · "+E(m.timeframe):"")+'</div><div class="v"><span class="val os-num">'+E(val)+'</span>'+chg+'</div>'
      +(m.context?'<div class="ctx">'+E(m.context)+'</div>':"")
      +((m.series||[]).length>1?OS.sparkline(m.series,{label:m.label}):"")
      +(m.interpretation?'<div class="ai">'+E(m.interpretation)+'</div>':"")+'</div>';
  }
  function insightHtml(i){
    return '<div class="os-insight"><div class="what">'+E(i.what)+'</div>'+(i.why?'<div class="why">'+E(i.why)+'</div>':"")+(i.impact?'<div class="why">'+E(i.impact)+'</div>':"")
      +(i.action?'<div class="do">'+E(i.action)+'</div>':"")+'<div class="conf">'+E(conf(i.confidence))+'</div></div>';
  }
  function actHtml(a,showSys){
    return '<div class="os-act"><div class="tm os-num">'+E(OS.hhmm(a.at))+'</div><div><div>'+E(a.text)+'</div><div class="ag">'
      +(showSys&&a.system?E(SYSN[a.system]||"")+" · ":"")+E(a.agent||"")+(TRUST_TXT[a.trust]?" · "+E(TRUST_TXT[a.trust]):"")+" · "+E(OS.ago(a.at))+'</div></div></div>';
  }
  function taskHtml(t){
    var meta=[t.agent,t.started?OS.ago(t.started):"",t.duration_s?Math.round(t.duration_s/60)+" min":""].filter(function(x){return x;}).join(" · ");
    var sub=t.next||t.result||"";
    return '<div class="os-row'+(t.url?" tap":"")+'"'+(t.url?' data-open="'+E(t.url)+'"':"")+'>'+OS.dot(TASK_DOT[t.status]||"idle")+'<div class="main"><div class="title">'+E(t.name)+'</div><div class="meta">'+E(meta)+(sub?" · "+E(sub):"")+'</div></div><div class="end">'+E(TASK_TXT[t.status]||t.status)+'</div></div>';
  }

  function pulseView(){
    var g=ST.global,p=mine(),h="";
    var run=p?(p.tasks||[]).filter(function(t){return t.status==="RUNNING"||t.status==="THINKING";}).length:0;
    var myN=needs().filter(function(n){return n.system===C.system;}).length;
    h+='<section class="os-pulse"><div class="os-greet">'+E(OS.greet())+" · "+E(C.role)+'</div>';
    h+='<div class="os-headline">'+E(p?p.headline:"Sin señal de "+C.name)+'</div>';
    if(p&&p.sub)h+='<div class="os-sub">'+E(p.sub)+'</div>';
    h+='<div class="os-counts"><span>'+OS.dot(p?p.status:"degraded")+E(STATUS_TXT[p?p.status:"degraded"])+'</span><span>'+E(plural(run,"en curso","en curso"))+'</span><span>'+E(plural(myN,"decisión","decisiones"))+'</span></div></section>';
    if(g.priority){
      h+='<button class="os-prio" data-act="prio"><div class="k">Prioridad de hoy · '+E(SYSN[g.priority.system]||"")+'</div><div class="t">'+E(g.priority.title)+'</div>'+(g.priority.why?'<div class="w">'+E(g.priority.why)+'</div>':"")+'</button>';
    }
    h+='<div class="os-sec"><span>Tu equipo de IA</span></div><div class="os-list">';
    (g.systems||[]).forEach(function(s){
      h+='<div class="os-row'+(s.system===C.system?" me":"")+'"><span class="os-sysbar" data-c="'+E(s.system)+'"></span>'+OS.dot(s.status)+'<div class="main"><div class="title">'+E(s.name)+'<span class="os-role">'+E(s.role)+'</span></div><div class="meta">'+E(s.headline)+'</div></div><div class="end">'+(s.at?E(OS.ago(s.at)):"—")+'</div></div>';
    });
    h+='</div>';
    var nd=needs();
    h+='<div class="os-sec"><span>Te necesita</span>'+(nd.length>3?'<button data-tab="needs">Ver las '+nd.length+'</button>':"")+'</div>';
    h+=nd.length?nd.slice(0,3).map(needHtml).join(""):OS.empty("Nada pendiente","Ningún sistema espera una decisión tuya ahora.");
    if(p&&(p.agents||[]).length){
      h+='<div class="os-sec"><span>Agentes de '+E(C.name)+'</span></div><div class="os-list">'+p.agents.map(function(a){
        return '<div class="os-row">'+OS.dot(a.state)+'<div class="main"><div class="title">'+E(a.name)+'</div><div class="meta">'+E(a.detail||"")+'</div></div><div class="end">'+E(STATE_TXT[a.state]||a.state)+'</div></div>';
      }).join("")+'</div>';
    }
    if(p&&(p.metrics||[]).length)h+='<div class="os-sec"><span>Métricas</span></div><div class="os-list">'+p.metrics.map(metricHtml).join("")+'</div>';
    if(p&&(p.insights||[]).length)h+='<div class="os-sec"><span>Lo que la IA ve</span></div>'+p.insights.map(insightHtml).join("");
    var acts=(g.activity||[]).slice(0,10);
    h+='<div class="os-sec"><span>Actividad</span><button data-tab="work">Todo</button></div>';
    h+=acts.length?'<div>'+acts.map(function(a){return actHtml(a,true);}).join("")+'</div>':OS.empty("Sin actividad todavía","Cuando un agente haga algo, aparece aquí con su hora.");
    return h;
  }

  function workView(){
    var p=mine(),h="";
    var tasks=p?(p.tasks||[]).slice():[];
    var order={RUNNING:0,THINKING:0,APPROVAL:1,WAITING:2,QUEUED:2,FAILED:3,COMPLETED:4,CANCELLED:5};
    tasks.sort(function(a,b){return (order[a.status]-order[b.status])||(Date.parse(b.started||0)-Date.parse(a.started||0));});
    var run=tasks.filter(function(t){return t.status==="RUNNING"||t.status==="THINKING";}).length;
    h+='<section class="os-pulse"><div class="os-greet">Trabajo · '+E(C.name)+'</div><div class="os-headline">'+E(run?plural(run,"tarea en curso","tareas en curso"):"Nada corriendo ahora")+'</div>';
    h+='<div class="os-sub">'+E(tasks.length?"Lo último que hicieron los agentes, con su resultado.":"Este sistema todavía no reporta tareas.")+'</div></section>';
    if(tasks.length)h+='<div class="os-sec"><span>Tareas</span></div><div class="os-list">'+tasks.map(taskHtml).join("")+'</div>';
    var acts=p?(p.activity||[]):[];
    h+='<div class="os-sec"><span>Bitácora</span></div>';
    h+=acts.length?'<div>'+acts.map(function(a){return actHtml(a,false);}).join("")+'</div>':OS.empty("Bitácora vacía","Sin eventos reportados en este sistema.");
    return h;
  }

  function needsView(){
    var nd=needs(),h="";
    var own=nd.filter(function(n){return n.system===C.system;}),other=nd.filter(function(n){return n.system!==C.system;});
    h+='<section class="os-pulse"><div class="os-greet">Decisiones</div><div class="os-headline">'+E(nd.length?plural(nd.length,"decisión te espera","decisiones te esperan"):"Todo decidido")+'</div>';
    h+='<div class="os-sub">'+E(nd.length?"Toca una para ver por qué, la evidencia y qué pasa si la apruebas.":"Los agentes siguen trabajando; te aviso cuando algo necesite tu criterio.")+'</div></section>';
    if(own.length)h+='<div class="os-sec"><span>En '+E(C.name)+'</span></div>'+own.map(needHtml).join("");
    if(other.length)h+='<div class="os-sec"><span>En los otros sistemas</span></div>'+other.map(needHtml).join("");
    return h;
  }

  function needSheet(n){
    var own=n.system===C.system,first=(n.actions||[])[0];
    var rows=[["Sistema",SYSN[n.system]],["Qué",n.title],["Por qué",n.why],["Evidencia",n.evidence],["Impacto",n.impact],["Riesgo",RISK_TXT[n.risk]],["Autonomía",AUT_TXT[n.autonomy]],["Confianza",conf(n.confidence)],["Desde",OS.ago(n.created_at)]];
    var btn="";
    if(n.url)btn+='<button class="os-btn primary block" data-open="'+E(n.url)+'">'+E((first&&first.label)||"Abrir")+'</button>';
    if(own)btn+='<button class="os-btn block'+(n.url?"":" primary")+'" data-act="panel">'+E(n.url?"Ir a "+C.panelLabel:((first&&first.label)||"Ir a "+C.panelLabel))+'</button>';
    var note=own?"La decisión se toma en el panel de "+C.panelLabel+": el OS te muestra el contexto, no aprueba por ti.":"Esta decisión se toma en la app de "+(SYSN[n.system]||"ese sistema")+".";
    OS.openSheet('<div class="os-title">'+E(n.title)+'</div>'+OS.chain(rows)+'<div class="os-actions">'+btn+'</div><div class="os-note">'+E(note)+'</div>');
  }

  function navHtml(){
    var nd=needs().length;
    function b(id,ic,l,badge){return '<button data-tab="'+id+'" class="'+(TAB===id?"on":"")+'" aria-label="'+E(l)+'">'+OS.icon(ic)+'<span>'+E(l)+'</span>'+(badge?'<span class="os-badge">'+badge+'</span>':"")+'</button>';}
    return b("pulse","pulse","Pulse")+b("work","pipeline","Trabajo")+b("needs","needs","Decisiones",nd||"")+'<button data-act="panel" aria-label="'+E(C.panelLabel)+'">'+OS.icon(C.icon)+'<span>'+E(C.panelLabel)+'</span></button>';
  }
  function errText(e){return /autoriz/i.test(String(e))?"Ábrelo desde el bot en Telegram.":String(e||"Error desconocido");}

  function render(){
    OS.el("top").innerHTML=topHtml();
    OS.el("nav").innerHTML=navHtml();
    var v=OS.el("view");
    if(!ST){v.innerHTML=ERR?'<div class="os-error" style="margin-top:24px"><b>No pude cargar el estado del OS.</b><div class="os-t2" style="margin-top:4px">'+E(errText(ERR))+'</div><button class="os-btn sm" style="margin-top:10px" data-act="refresh">Reintentar</button></div>':'<section class="os-pulse">'+OS.skeleton(5)+'</section>';OS.backSync();return;}
    var body=TAB==="work"?workView():TAB==="needs"?needsView():pulseView();
    if(ERR)body+='<div class="os-error"><b>No pude actualizar.</b> Muestro lo último que llegó '+E(OS.ago(new Date(LAST).toISOString()))+'. '+E(errText(ERR))+'</div>';
    body+='<div class="os-foot">AI OS · '+E(C.name)+' · build '+E(C.build)+'</div>';
    v.innerHTML='<div class="'+(ANIM?"os-view":"")+'">'+body+'</div>';
    ANIM=false;
    OS.backSync();
  }

  function load(manual){
    if(LOADING)return;LOADING=true;
    OS.api(C.api,{method:C.method}).then(function(j){
      LOADING=false;
      if(!j||j.error||!j.global){ERR=(j&&j.error)||"Respuesta vacía";if(manual)OS.haptic("err");}
      else{ST=j;ERR=null;LAST=Date.now();if(manual){OS.haptic("ok");OS.toast("Actualizado");}}
      render();
    })["catch"](function(){LOADING=false;ERR="Sin conexión";if(manual)OS.haptic("err");render();});
  }

  OS.backSync=function(){try{if(!tg||!tg.BackButton)return;if(OS.sheetOpen||TAB!=="pulse")tg.BackButton.show();else tg.BackButton.hide();}catch(e){}};
  if(tg&&tg.BackButton){try{tg.BackButton.onClick(function(){if(OS.sheetOpen){OS.closeSheet();return;}if(TAB!=="pulse"){TAB="pulse";ANIM=true;render();window.scrollTo(0,0);}});}catch(e){}}

  document.addEventListener("click",function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest("[data-tab],[data-act],[data-need],[data-open]"):null;
    if(!el)return;
    var tab=el.getAttribute("data-tab"),act=el.getAttribute("data-act"),need=el.getAttribute("data-need"),open=el.getAttribute("data-open");
    if(tab){if(OS.sheetOpen)OS.closeSheet();TAB=tab;ANIM=true;OS.haptic("sel");render();window.scrollTo(0,0);return;}
    if(act==="refresh"){load(true);return;}
    if(act==="panel"){OS.haptic("light");location.href=C.panel+(C.panel.indexOf("?")<0?"?":"&")+"from=os";return;}
    if(act==="prio"){var pr=ST&&ST.global.priority;if(!pr)return;var hit=needs().filter(function(n){return n.system===pr.system&&n.title===pr.title;})[0];if(hit)needSheet(hit);else{TAB="needs";ANIM=true;render();}return;}
    if(need){var n=needs().filter(function(x){return x.id===need;})[0];if(n)needSheet(n);return;}
    if(open){try{if(tg&&tg.openLink)tg.openLink(open);else window.open(open,"_blank");}catch(e){}return;}
  });
  setInterval(function(){if(document.visibilityState==="visible"&&!OS.sheetOpen)load(false);},30000);
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&Date.now()-LAST>20000)load(false);});
  render();
  load(false);
})();
`;

// HTML completo de la app del OS para un sistema. build: versión del deploy (se muestra y sirve para cache).
export function osShellHtml(system, opts = {}) {
  const s = OS_SYSTEMS_UI[system];
  if (!s) throw new Error(`sistema desconocido: ${system}`);
  const cfg = {
    system, name: s.name, role: s.role, icon: s.icon, panel: opts.panel || s.panel, panelLabel: s.panelLabel,
    api: opts.api || "/api/os", method: opts.method || s.method, build: String(opts.build || "dev").slice(0, 12), ui: OS_UI_VERSION, shell: OS_SHELL_VERSION,
  };
  const safeCfg = JSON.stringify(cfg).replace(/</g, "\\u003c");
  return '<!doctype html><html lang="es" data-theme="dark"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>' + s.name + '</title>' + OS_HEAD +
    '<script src="https://telegram.org/js/telegram-web-app.js"></script>' +
    '<style>' + OS_CSS + OS_SHELL_CSS + '</style></head>' +
    '<body data-sys="' + system + '">' + OS_ICONS +
    '<div class="os-wrap"><header class="os-top" id="top"></header><main id="view" aria-live="polite"></main></div>' +
    '<nav class="os-nav" id="nav"></nav>' +
    '<script>window.OS_CFG=' + safeCfg + ';' + OS_JS + OS_APP_JS + '</script></body></html>';
}
