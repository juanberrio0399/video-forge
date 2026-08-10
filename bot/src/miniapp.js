// miniapp.js — la Mini App de Telegram (interfaz "tipo app pro") de video-forge.
// El Worker la sirve en /app. Usa el SDK de Telegram Web App (auth por initData +
// tema nativo). Muestra paneles/tablas del canal y permite disparar acciones y subir
// fotos/videos/texto. El JS del cliente NO usa template-literals (para no chocar con
// el template-literal exterior).
export const APP_HTML = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The Data Lens — Control</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    --bg:var(--tg-theme-bg-color,#0f1420); --card:var(--tg-theme-secondary-bg-color,#1a2130);
    --txt:var(--tg-theme-text-color,#eaf1ff); --hint:var(--tg-theme-hint-color,#8aa0c0);
    --btn:var(--tg-theme-button-color,#22a0e0); --btntx:var(--tg-theme-button-text-color,#fff);
    --link:var(--tg-theme-link-color,#4fc3f7); --cy:#22d3ee; --gr:#34d399; --am:#f59e0b;
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;background:var(--bg);color:var(--txt);font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;padding-bottom:80px}
  header{padding:14px 16px 8px;position:sticky;top:0;background:var(--bg);z-index:5}
  header h1{font-size:19px;margin:0;font-weight:800}
  header .sub{color:var(--hint);font-size:12px;margin-top:2px}
  .wrap{padding:0 14px}
  .card{background:var(--card);border-radius:14px;padding:14px;margin:10px 0}
  .row{display:flex;gap:10px}
  .kpi{flex:1;text-align:center}
  .kpi .n{font-size:26px;font-weight:900;line-height:1}
  .kpi .l{font-size:11px;color:var(--hint);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
  h2{font-size:13px;color:var(--hint);text-transform:uppercase;letter-spacing:1px;margin:16px 4px 6px}
  .bar{height:9px;background:rgba(255,255,255,.1);border-radius:6px;overflow:hidden;margin-top:6px}
  .bar > i{display:block;height:100%;background:linear-gradient(90deg,var(--cy),var(--gr));border-radius:6px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{color:var(--hint);text-align:left;font-weight:600;padding:6px 6px;font-size:11px;text-transform:uppercase}
  td{padding:8px 6px;border-top:1px solid rgba(255,255,255,.07);vertical-align:top}
  .tag{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700}
  .tag.pub{background:rgba(52,211,153,.18);color:var(--gr)} .tag.priv{background:rgba(245,158,11,.18);color:var(--am)}
  a{color:var(--link);text-decoration:none}
  .btn{display:block;width:100%;background:var(--btn);color:var(--btntx);border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:700;margin:8px 0;cursor:pointer}
  .btn.ghost{background:transparent;color:var(--txt);border:1px solid rgba(255,255,255,.18)}
  .btn.mini{display:inline-block;width:auto;padding:6px 12px;font-size:12px;margin:0}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  input[type=text],textarea{width:100%;background:var(--bg);color:var(--txt);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:11px;font-size:15px;font-family:inherit}
  textarea{min-height:80px;resize:vertical}
  .file{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px dashed rgba(255,255,255,.25);border-radius:12px;padding:14px;justify-content:center;color:var(--hint);cursor:pointer;margin:8px 0}
  .nav{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--card);border-top:1px solid rgba(255,255,255,.08);padding:6px 4px 10px}
  .nav button{flex:1;background:none;border:0;color:var(--hint);font-size:11px;font-weight:600;padding:5px 2px;cursor:pointer;border-radius:12px;margin:0 2px;transition:background .15s}
  .nav button .ic{font-size:20px;display:block;margin-bottom:2px}
  .nav button.on{color:var(--cy);background:rgba(34,211,238,.14)}
  .chsel{display:flex;background:var(--bg);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:3px;gap:2px}
  .chsel button{background:none;border:0;color:var(--hint);font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
  .chsel button.on{background:var(--cy);color:#04121a}
  .gauge{font-size:34px;font-weight:900;line-height:1}
  .hide{display:none}
  .muted{color:var(--hint);font-size:13px}
  #toast{position:fixed;bottom:78px;left:14px;right:14px;background:#111a2b;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:13px 16px;text-align:center;font-weight:600;transform:translateY(140px);transition:.25s;z-index:20;box-shadow:0 8px 30px rgba(0,0,0,.45)}
  #toast.show{transform:translateY(0)}
  .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
  .chip{font-size:12px;padding:6px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.18);cursor:pointer}
  .chip.on{background:var(--cy);color:#04121a;border-color:var(--cy);font-weight:700}
  .live{display:inline-block;width:9px;height:9px;border-radius:50%;background:#34d399;margin-right:2px;animation:pulse 1.4s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.55)}70%{box-shadow:0 0 0 8px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
  .ytcard{border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:var(--card);margin:6px 0 10px}
  .ytthumb{aspect-ratio:16/9;background:linear-gradient(135deg,#0e7490,#1e293b);display:flex;align-items:center;justify-content:center}
  .ytbig{font-weight:900;font-size:26px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6);text-align:center;padding:0 14px;letter-spacing:.5px;line-height:1.1}
  .yttitle{font-weight:700;font-size:14px;line-height:1.3;margin-bottom:2px}
  .score{font-size:30px;font-weight:800;line-height:1}
</style></head>
<body>
<header>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
    <h1 id="chTitle">The Data Lens</h1>
    <div class="chsel" id="chSel">
      <button data-ch="data-lens" class="on">The Data Lens</button>
      <button data-ch="auto2">Auto #2</button>
    </div>
  </div>
  <div class="sub" id="hd">Centro de control</div>
</header>
<div class="wrap">
  <div id="tabHelp" class="muted" style="font-size:12px;margin:2px 2px 8px"></div>
  <div id="globalStatus"></div>
  <div id="s-inicio"></div>
  <div id="s-producir" class="hide"></div>
  <div id="s-agenda" class="hide"></div>
  <div id="s-analitica" class="hide"></div>
  <div id="s-mas" class="hide"></div>
</div>
<div id="toast"></div>
<div class="nav">
  <button data-t="inicio" class="on"><span class="ic">🏠</span>Inicio</button>
  <button data-t="producir"><span class="ic">🏭</span>Producir</button>
  <button data-t="agenda"><span class="ic">📅</span>Agenda</button>
  <button data-t="analitica"><span class="ic">📈</span>Analítica</button>
  <button data-t="mas"><span class="ic">⚙️</span>Más</button>
</div>
<script>
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { tg.ready(); tg.expand(); }
  var INIT = tg ? tg.initData : "";
  var ST = {};
  function el(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function toast(m){var t=el("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show");},2600);}
  function api(path, opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["X-Init-Data"]=INIT;return fetch(path,opts);}
  function num(n){n=+n||0;return n>=1000?(n/1000).toFixed(n>=100000?0:1)+"k":String(n);}
  function durTxt(sec){ if(sec==null) return "—"; sec=+sec; if(sec>=60){var m=Math.floor(sec/60),s=sec%60;return m+":"+("0"+s).slice(-2);} return sec+"s"; }

  var curTab="inicio", curChannel="data-lens";
  var vSort="views";
  var lastInsights="";
  var localSched={}; // video_id -> "schedule"|"public": marca optimista al programar/publicar (feedback inmediato aunque el reporte del canal tarde en refrescar)
  var TABHELP={
    inicio:"🏠 Lo que necesita tu atención ahora + el pulso del canal.",
    producir:"🏭 El flujo de cada video: producir, revisar, aprobar, publicar — y qué le falta a cada uno. Aquí también los shorts.",
    agenda:"📅 Tu calendario de publicación (mejores horas EEUU) y lo programado.",
    analitica:"📈 Análisis del canal: qué tan prometedor, reclamaciones, métricas, capacidad y tus videos.",
    mas:"⚙️ Crear (foto/receta/voz), voz del canal, salud de herramientas y almacenamiento."
  };
  function setHelp(t){ var e=el("tabHelp"); if(e) e.textContent=TABHELP[t]||""; }
  function setVSort(s){ vSort=s; render(); }
  function tab(name){
    curTab=name;
    ["inicio","producir","agenda","analitica","mas"].forEach(function(t){el("s-"+t).classList.toggle("hide",t!==name);});
    document.querySelectorAll(".nav button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-t")===name);});
    setHelp(name);
  }
  function setChannel(ch){ curChannel=ch; document.querySelectorAll(".chsel button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-ch")===ch);}); render(); }
  document.querySelectorAll(".nav button").forEach(function(b){b.onclick=function(){tab(b.getAttribute("data-t"));};});
  document.querySelectorAll(".chsel button").forEach(function(b){b.onclick=function(){setChannel(b.getAttribute("data-ch"));};});

  function pct(a,b){return Math.min(100,Math.round((( +a||0)/(b||1))*100));}
  // Clasifica una ejecución por canal: Auto (Oddly Loop) vs The Data Lens.
  var AUTO_WF=/^(produce_oddly|publish_oddly|report_auto2|build_asmr_library|niche_radar)\.yml$/;
  function isAutoRun(r){ return AUTO_WF.test(r.wf||"") || /Oddly|compilaci|ASMR|autom[aá]tic/i.test(r.name||""); }
  function activeFor(ch){ var a=ST.active||[]; return ch==="auto2"?a.filter(isAutoRun):a.filter(function(r){return !isAutoRun(r);}); }
  function statusHtml(ch){
    var a=ch?activeFor(ch):(ST.active||[]);
    if(!a.length) return '<div class="card muted">✅ Nada en proceso ahora.</div>';
    return a.map(function(r){
      return '<div class="card"><div style="font-weight:700"><span class="live"></span> '+esc(r.name)+'</div>'
        +'<div class="muted" style="font-size:12px;margin:4px 0">'+esc(r.step||r.status)+(r.eta?' · ~'+r.eta+' min':'')+'</div>'
        +'<div class="bar"><i style="width:'+(r.pct||3)+'%"></i></div></div>';
    }).join("");
  }
  function toolsHealthHtml(){
    // Salud de las herramientas/APIs gratis que usa la fábrica a diario.
    var t=ST.tools_health; if(!t||!(t.tools||[]).length) return "";
    var rows=(t.tools||[]).map(function(x){
      return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0">'
        +'<div style="font-size:12px">'+(x.ok?"✅":(x.critical?"🔴":"🟡"))+' '+esc(x.name)+'</div>'
        +'<div class="muted" style="font-size:11px;text-align:right">'+esc(x.detail||"")+'</div></div>';
    }).join("");
    var head=(t.down>0)?('⚠️ '+t.ok+'/'+t.total+' OK'):('✅ Todo OK ('+t.ok+'/'+t.total+')');
    return '<h2>🧰 Herramientas diarias</h2>'
      +'<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">'+head+'</div>'+rows
      +(t.at?'<div class="muted" style="font-size:10px;margin-top:6px">Validado: '+esc(String(t.at).slice(0,16).replace("T"," "))+'</div>':'')
      +'</div>';
  }
  function errorLearnHtml(){
    // Bucle de errores: identificados + analizados por IA + patrones recurrentes. Aprende día con día.
    var e=ST.error_learnings; if(!e||(!(e.incidents||[]).length && !(e.patterns||[]).length)) return "";
    var catColor={transitorio:"var(--hint)",config:"var(--am)",codigo:"#f87171",datos:"var(--am)"};
    var inc=(e.incidents||[]).map(function(i){
      var col=catColor[i.category]||"var(--hint)";
      return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:6px 0">'
        +'<div style="font-size:12px"><b>'+esc(i.workflow||i.name||"")+'</b> <span style="color:'+col+';font-size:10px">['+esc(i.category||"?")+']</span></div>'
        +'<div class="muted" style="font-size:11px">'+esc(i.cause||"")+'</div>'
        +(i.fix?'<div style="font-size:11px;color:var(--cy)">→ '+esc(i.fix)+'</div>':'')
        +(i.url?'<a href="'+esc(i.url)+'" target="_blank" style="font-size:10px">↗ log</a>':'')+'</div>';
    }).join("");
    var pat=(e.patterns||[]).map(function(p){return '<span class="chip" style="font-size:11px">🔁 '+esc(p.key)+' ×'+p.count+'</span>';}).join(" ");
    return '<h2>🛠️ Aprendizajes de errores</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px">El sistema identifica, analiza y aprende de cada error. Lo transitorio se reintenta solo; lo recurrente sale como patrón para resolverlo de raíz.</div>'
      +(pat?'<div style="margin:8px 0">'+pat+'</div>':'')
      +(inc||'<div class="muted" style="font-size:12px;margin-top:6px">Sin errores registrados. 🎉</div>')
      +(e.at?'<div class="muted" style="font-size:10px;margin-top:6px">Último análisis: '+esc(String(e.at).slice(0,16).replace("T"," "))+'</div>':'')
      +'</div>';
  }
  function problemsHtml(){
    var p=ST.problems||[];
    if(!p.length) return "";
    return '<h2>⚠️ Problemas ('+p.length+')</h2>'
      +'<div class="muted" style="font-size:11px;margin:0 2px 6px">Errores de las últimas 24 h. 📋 Ver el error muestra el detalle; 🔁 Reintentar lo vuelve a lanzar; ↗ abre el log completo en GitHub.</div>'
      +p.map(function(x){
      return '<div class="card" style="border:1px solid rgba(245,158,11,.45)">'
        +'<div style="font-weight:700;color:var(--am)">⚠️ '+esc(x.name)+'</div>'
        +'<div class="muted" style="margin:4px 0">Falló en: '+esc(x.step||"?")+'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn mini" onclick="retry(\\''+esc(x.workflow)+'\\')">🔁 Reintentar</button>'
        +'<button class="btn mini ghost" onclick="showError('+(x.run_id||0)+')">📋 Ver el error</button>'
        +(x.url?'<a class="btn mini ghost" href="'+esc(x.url)+'" target="_blank">↗ Log completo</a>':'')+'</div>'
        +'<div id="err'+(x.run_id||0)+'" style="margin-top:6px"></div></div>';
    }).join("");
  }
  function showError(run){
    var o=el("err"+run); if(!o) return;
    o.innerHTML='<div class="muted" style="font-size:12px">Cargando el error…</div>';
    api("/api/error-detail?run="+run).then(function(r){return r.json();}).then(function(j){
      o.innerHTML='<div class="card" style="background:var(--bg);padding:8px"><div style="color:var(--am);font-weight:700;font-size:12px;margin-bottom:4px">'+esc(j.step||"")+'</div>'
        +'<div style="font-family:monospace;font-size:10.5px;white-space:pre-wrap;max-height:220px;overflow:auto">'+esc(j.detail||j.error||"sin detalle")+'</div></div>';
    }).catch(function(){o.innerHTML='<div class="muted">No pude cargar el error.</div>';});
  }

  function scoreColor(s){ return s>=7.5?"#34d399":(s>=6?"#f59e0b":"#f87171"); }
  function nextStepHtml(){
    var p=ST.production||{}, sst=ST.shorts_status||{};
    if(!p.done) return ""; // aún en revisión/publicación del video: manda la tarjeta de producción
    var prop=ST.shorts_proposal||[];
    var uplPend=prop.filter(function(s){return s.state==="uploaded" && s.privacy!=="public" && !s.publish_at;}); // shorts hechos que FALTAN publicar/programar
    var anyUploaded=prop.some(function(s){return s.state==="uploaded";});
    // Video ya publicado → el siguiente paso son los shorts (solo si faltan; lo hecho/programado queda oculto).
    if(sst.pending) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Siguiente: aprobar shorts</div><div class="muted" style="font-size:12px;margin:4px 0">Hay '+sst.pending+' short(s) sugerido(s) esperando tu aprobación.</div><button class="btn" onclick="goShorts()">Ver shorts para aprobar</button></div>';
    if(sst.approved_pend) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Siguiente: generar shorts</div><div class="muted" style="font-size:12px;margin:4px 0">'+sst.approved_pend+' aprobado(s), listos para generar.</div><button class="btn" onclick="goShorts()">Ir a Shorts</button></div>';
    if(uplPend.length) return '<div class="card"><button class="btn" onclick="goShorts()">🎬 Publicar/programar shorts ('+uplPend.length+')</button></div>';
    if(sst.can_suggest && !anyUploaded) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Siguiente: sugerir shorts</div><div class="muted" style="font-size:12px;margin:4px 0">El video quedó publicado. Ahora sus shorts.</div><button class="btn" onclick="goShorts()">Ir a Shorts</button></div>';
    return '';
  }
  function voicePickerHtml(){
    var vp=ST.voices_pick; if(!vp||!vp.options||!vp.options.length) return "";
    return '<h2>🎙️ Voz del canal</h2><div class="card">'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">Escucha y elige la voz para los próximos videos. La actual está marcada.</div>'
      +vp.options.map(function(o){
        var cur=o.id===vp.current;
        return '<div style="margin:6px 0;padding:8px;border-radius:10px;background:'+(cur?"rgba(34,211,238,.12)":"transparent")+'">'
          +'<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;font-weight:600">'+esc(o.label)+(cur?' <span style="color:var(--cy);font-size:12px">· actual</span>':'')+'</div>'
          +(cur?'':'<button class="btn mini" onclick="pickVoice(\\''+o.id+'\\')">Usar</button>')+'</div>'
          +'<audio controls preload="none" style="width:100%;height:34px;margin-top:5px"><source src="'+esc(location.origin+o.sample_url)+'" type="audio/mpeg"></audio>'
          +'</div>';
      }).join("")
      +'</div>';
  }
  function r2Html(){
    var r=ST.r2; if(!r) return "";
    var warn=r.pct>=80;
    return '<h2>💾 Almacenamiento '+(warn?'<span style="color:var(--am)">⚠️</span>':'')+'</h2><div class="card">'
      +'<div class="muted">'+r.used_gb+' GB de '+r.limit_gb+' GB (gratis) · '+num(r.count)+' archivos</div>'
      +'<div class="bar"><i style="width:'+Math.max(2,r.pct)+'%;background:'+(warn?"#f87171":"var(--cy)")+'"></i></div>'
      +(warn
        ?'<div style="color:var(--am);font-weight:700;margin-top:8px">⚠️ R2 al '+r.pct+'%. Hay que liberar espacio para que siga gratis (borrar renders/audios viejos).</div>'
        :'<div class="muted" style="font-size:11px;margin-top:6px">Al '+r.pct+'% del límite gratis. Se revisa cada ~30 min.</div>')
      +'</div>';
  }
  function analyticsHtml(){
    var a=ST.analytics, tot=ST.totals||{};
    var h='<h2>📊 Analytics de YouTube <span class="live"></span></h2>';
    if(!ST.analytics_ok){
      return h+'<div class="card muted">Aún sin datos de Analytics. Si ya reautorizaste el permiso, YouTube tarda ~1-2 días en procesar el primer dato. Si sigue vacío tras 2 días, reautoriza el OAuth con el scope <b>yt-analytics.readonly</b>. Entonces verás vistas, minutos vistos y crecimiento en vivo.</div>';
    }
    // VALORES = canal COMPLETO (no 28 días): suscriptores, vistas totales, min vistos, videos.
    h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:8px">Tu canal completo</div><div class="row">'
      +'<div class="kpi"><div class="n">'+num(tot.subs||0)+'</div><div class="l">Suscriptores</div></div>'
      +'<div class="kpi"><div class="n">'+num(tot.views||0)+'</div><div class="l">Vistas</div></div>'
      +'<div class="kpi"><div class="n">'+num(tot.watch_min||0)+'</div><div class="l">Min vistos</div></div>'
      +'<div class="kpi"><div class="n">'+num(tot.videos||0)+'</div><div class="l">Videos</div></div>'
      +'</div>';
    // GRAFICA = últimos 7 días, con EJE Y numérico (vertical) para leer la escala.
    var daily=((a&&a.daily)||[]).slice(-7);
    if(daily.length){
      var mx=Math.max.apply(null, daily.map(function(x){return x.views||0;}).concat([1]));
      var CH=90; // alto del área de barras en px
      // Eje Y: 3 marcas (max, mitad, 0)
      var yl=[mx, Math.round(mx/2), 0].map(function(v){
        return '<div style="flex:1;display:flex;align-items:flex-start;justify-content:flex-end;font-size:10px;color:var(--hint);line-height:1">'+num(v)+'</div>';
      }).join("");
      var bars=daily.map(function(x){
        var v=x.views||0, hh=Math.max(2, Math.round((v/mx)*CH));
        var dd=x.d?String(x.d).slice(5).replace("-","/"):"";
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px">'
          +'<div style="font-size:10px;color:var(--txt);font-weight:600">'+num(v)+'</div>'
          +'<div title="'+esc(x.d)+': '+v+' vistas" style="width:70%;height:'+hh+'px;background:var(--cy);border-radius:3px 3px 0 0"></div>'
          +'<div style="font-size:9px;color:var(--hint)">'+esc(dd)+'</div></div>';
      }).join("");
      h+='<div style="margin-top:12px"><div class="muted" style="font-size:11px;margin-bottom:6px">Vistas por día — últimos 7 días</div>'
        +'<div style="display:flex;gap:6px">'
        +'<div style="display:flex;flex-direction:column;height:'+CH+'px;width:34px;text-align:right">'+yl+'</div>'
        +'<div style="flex:1;display:flex;gap:4px;align-items:flex-end;border-left:1px solid rgba(255,255,255,.18);border-bottom:1px solid rgba(255,255,255,.18);padding:0 2px 0 6px;min-height:'+(CH+18)+'px">'+bars+'</div>'
        +'</div></div>';
    } else if(ST.analytics_ok){
      h+='<div class="muted" style="font-size:11px;margin-top:10px">Aún no hay historial por día. YouTube lo llena en 1-2 días tras las primeras vistas públicas.</div>';
    }
    h+='</div>';
    h+='<div class="card muted" style="font-size:11px">Los datos de YouTube Analytics tienen ~1-2 días de retraso.</div>';
    return h;
  }
  function factoryHtml(){
    // Capacidad diaria (throughput real) + experimento de duración (sube la duración poco a poco).
    var f=ST.factory; if(!f) return "";
    var d=f.duration||{}; var ramp=(d.ramp||[]); var step=d.step||0;
    var rampHtml=ramp.map(function(m,i){
      var on=i===step, done=i<step;
      return '<span style="font-size:11px;padding:3px 9px;border-radius:20px;margin:2px 3px 2px 0;display:inline-block;'
        +(on?'background:rgba(34,211,238,.18);color:var(--cy);font-weight:700':done?'background:rgba(52,211,153,.15);color:var(--gr)':'background:rgba(255,255,255,.06);color:var(--hint)')
        +'">'+(done?'✓ ':'')+m+'m</span>';
    }).join("");
    var last=(d.history||[]).slice(-1)[0];
    var h='<h2>🏭 Fábrica</h2><div class="card">'
      +'<div class="muted" style="font-size:11px;margin-bottom:6px">Capacidad de publicación (últimos 7 días).</div>'
      +'<div class="row">'
      +'<div class="kpi"><div class="n">'+(f.pub_7d||0)+'</div><div class="l">Publicados 7d</div></div>'
      +'<div class="kpi"><div class="n">'+(f.per_day!=null?f.per_day:0)+'</div><div class="l">Por día</div></div>'
      +'<div class="kpi"><div class="n">'+(f.pub_7d_long||0)+'</div><div class="l">Largos</div></div>'
      +'<div class="kpi"><div class="n">'+(f.pub_7d_short||0)+'</div><div class="l">Shorts</div></div>'
      +'</div>';
    if(ramp.length){
      h+='<div style="margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px">'
        +'<div class="muted" style="font-size:12px;margin-bottom:5px">Experimento de duración — objetivo <b style="color:var(--cy)">'+(d.target_min||ramp[step]||8)+' min</b> (sube poco a poco con las pruebas):</div>'
        +'<div>'+rampHtml+'</div>'
        +(last?'<div class="muted" style="font-size:11px;margin-top:7px">Último video: '+(last.actual_min||0)+' min · QA '+(last.qa_passed?'✓':'✗')+' · racha '+(d.streak||0)+'/2 para subir de escalón</div>':'<div class="muted" style="font-size:11px;margin-top:7px">Aún sin videos medidos.</div>')
        +'</div>';
    }
    h+='</div>';
    return h;
  }
  function pendingThumbsHtml(){
    var vm=ST.video_matrix||[];
    // Solo las que FALTAN aprobar; al aprobar, desaparece la tarjeta.
    var pend=vm.filter(function(v){return v.thumb_url && !(v.stages||{}).miniatura;});
    if(!pend.length) return "";
    return pend.map(function(v){
      var u=esc(location.origin+v.thumb_url)+"?t="+(ST.updated_at||"");
      var appr=v.thumb_approved;
      return '<div class="card" style="border:1px solid var(--cy)">'
        +'<div style="font-weight:700;margin-bottom:6px">🖼️ Miniatura — '+(appr?'aprobada ✓, falta publicar':'por aprobar')+' · '+esc((v.title||"").slice(0,22))+'</div>'
        +'<a href="'+u+'" target="_blank"><img src="'+u+'" style="width:100%;border-radius:8px;display:block;margin-bottom:8px"></a>'
        +(appr
          ? '<button class="btn" onclick="thumbPublish(\\''+v.video_id+'\\')">🌍 Publicar (ponerla en YouTube)</button>'
          : '<button class="btn" onclick="thumbApprove(\\''+v.video_id+'\\')">✅ Aprobar</button>')
        +'<button class="btn ghost" onclick="thumbRow(\\''+v.video_id+'\\')">🔁 Rehacer otra</button></div>';
    }).join("");
  }
  function matrixHtml(){
    // ¿El video YA tiene shorts? (del árbol, incluye los PROGRAMADOS) -> no marcar "falta shorts".
    var hasShorts={}; (ST.video_tree||[]).forEach(function(l){ if((l.shorts||[]).length) hasShorts[l.video_id]=true; });
    var shDone=function(v){ return (v.stages||{}).shorts || hasShorts[v.video_id]; };
    // Solo videos producidos con ALGO pendiente; los que ya tienen todo ✓ NO salen, y los YA
    // PROGRAMADOS tampoco (ya se ven en 📅 Agenda; no repetir la nota aquí).
    var vm=(ST.video_matrix||[]).filter(function(v){var s=v.stages||{};return !v.scheduled && !(s.publicado && s.miniatura && shDone(v));});
    if(!(ST.video_matrix||[]).length) return "";
    if(!vm.length) return '<h2>📋 Control por video</h2><div class="card muted">✅ Todos los videos están al día: publicados, con miniatura y shorts.</div>';
    var head='<tr><th style="text-align:left">Video</th><th>🌍 Público</th><th>🖼️ Miniatura</th><th>🎬 Shorts</th></tr>';
    var rows=vm.map(function(v){
      var s=v.stages||{}, vid=v.video_id;
      function cell(key,act){
        if(s[key]) return '<td style="text-align:center;color:#34d399;font-size:16px">✓</td>';
        return '<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="'+act+'">＋ Hacer</span></td>';
      }
      // Público: ✓ si en vivo, 🕒 Programado si tiene hora futura, ＋ Hacer si falta.
      var pubCell;
      if(v.public){ pubCell='<td style="text-align:center;color:#34d399;font-size:16px">✓</td>'; }
      else if(v.scheduled){ pubCell='<td style="text-align:center"><span style="color:var(--cy);font-size:11px;font-weight:700">🕒 Programado</span></td>'; }
      else { pubCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="publishRow(\\''+vid+'\\')">＋ Hacer</span></td>'; }
      // Miniatura: solo ESTADO en la tabla; la imagen grande y el botón salen ARRIBA.
      var miniCell;
      if(s.miniatura){
        miniCell='<td style="text-align:center"><span style="color:#34d399;font-size:15px">✓</span> <span style="cursor:pointer;color:var(--hint)" onclick="thumbRow(\\''+vid+'\\')">🔁</span></td>';
      } else if(v.thumb_url){
        miniCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--am);font-size:11px;font-weight:700" onclick="window.scrollTo(0,0)">⏳ aprobar ↑</span></td>';
      } else {
        miniCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="thumbRow(\\''+vid+'\\')">＋ Hacer</span></td>';
      }
      // Shorts: ✓ si ya tiene (aunque estén PROGRAMADOS). Si no, ＋Hacer (solo si el video ya es público).
      var shortsCell;
      if(shDone(v)){ shortsCell='<td style="text-align:center;color:#34d399;font-size:16px">✓</td>'; }
      else if(v.public){ shortsCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="goShorts()">＋ Hacer</span></td>'; }
      else { shortsCell='<td style="text-align:center"><span style="color:var(--hint);font-size:11px">⏳ al publicar</span></td>'; }
      return '<tr><td>'+(vid?'<a href="https://youtu.be/'+vid+'" target="_blank">'+esc((v.title||"").slice(0,20))+'</a>':esc((v.title||"").slice(0,20)))+'</td>'
        +pubCell
        +miniCell
        +shortsCell
        +'</tr>';
    }).join("");
    return '<h2>📋 Control por video</h2>'
      +'<div class="muted" style="font-size:12px;margin:0 2px 6px">Qué le falta a cada video. <b>＋ Hacer</b> para completarlo. La miniatura la <b>ves aquí</b> y le das ✅ Aprobar (o 🔁 rehacer) antes de ponerla. No cambia lo ya publicado.</div>'
      +'<div class="card" style="padding:8px"><table style="font-size:13px">'+head+rows+'</table></div>';
  }
  function currentStage(){
    var a=ST.active||[], p=ST.production||{}, sst=ST.shorts_status||{};
    var isA=function(re){return a.some(function(r){return re.test(r.name||"");});};
    if(isA(/Producir|guion/i)) return 1;
    if(isA(/Voiceover|voz/i)) return 2;
    if(isA(/Render|fase/i)) return 3;
    if(p.seo && !p.approved && !p.done) return 4;
    if(p.approved && !p.done) return 5;
    if(p.done && (sst.pending||sst.approved_pend||(sst.uploaded&&!sst.all_done)||sst.can_suggest)) return 6;
    return 0;
  }
  function flowStepsHtml(){
    var st=currentStage(); if(!st) return "";
    var steps=["Guion","Voz","Render","Aprobar","Publicar","Shorts"];
    var cells=steps.map(function(lbl,i){
      var n=i+1; var col = n<st?"var(--gr)":(n===st?"var(--cy)":"var(--hint)");
      return '<div style="flex:1;text-align:center;font-size:10px;font-weight:'+(n===st?"700":"400")+';color:'+col+'">'+(n<st?"✓ ":(n===st?"● ":""))+esc(lbl)+'</div>';
    }).join("");
    return '<div class="card" style="padding:10px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">📍 Vamos en el paso '+st+' de 6</div><div style="display:flex;gap:4px">'+cells+'</div></div>';
  }
  function productionHtml(){
    var p=ST.production||{}, q=p.quality, seo=p.seo;
    if(p.done) return ""; // video ya publicado: el paso SEO terminó, no mostrar su calificación
    // Video RENDERIZADO esperando aprobación -> ver / aprobar / regenerar, TODO en la app.
    if(p.render_pending){
      var q2=p.quality||{}, ms=q2.min_score||0;
      var qa=p.render_qa||{};
      var hr='<h2>🎬 Video listo — revísalo y aprueba</h2>';
      var mmss=qa.duration?(' · '+Math.floor(qa.duration/60)+':'+('0'+(qa.duration%60)).slice(-2)):'';
      if(qa.warning){
        hr+='<div class="card" style="border:1px solid rgba(245,158,11,.5)"><b style="color:var(--am)">⚠️ '+esc(qa.warning)+'</b><div class="muted" style="font-size:12px;margin-top:4px">Revísalo: apruébalo si te sirve o regéralo.</div></div>';
      } else {
        hr+='<div class="muted" style="font-size:12px;margin:2px">✅ Video completo (duración'+mmss+'). Míralo y decide.</div>';
      }
      if(p.watch_url) hr+='<a class="btn" href="'+esc(location.origin+p.watch_url)+'" target="_blank">▶️ Ver el video</a>';
      if(ms>0){
        hr+='<div class="card"><div style="display:flex;align-items:center;gap:12px">'
          +'<div class="score" style="color:'+scoreColor(ms)+'">'+ms+'<span style="font-size:13px;color:var(--hint)">/10</span></div>'
          +'<div><div style="font-weight:700">Nota IA del video</div><div class="muted" style="font-size:12px">'+(ms>=7?"✅ Buena":"Puedes regenerar si quieres subirla")+'</div></div></div></div>';
      }
      hr+='<button class="btn" onclick="approveRender()">✅ Aprobar (subir y preparar el SEO)</button>'
        +'<button class="btn ghost" onclick="regenRender()">🔁 Regenerar el video</button>';
      return hr;
    }
    if(!q && !seo) return "";
    var h='<h2>🎬 Video en producción</h2>';
    if(q){
      var ms=q.min_score||0;
      var ph=(q.phases||[]).map(function(f){
        return '<div style="flex:1;text-align:center"><div class="bar" style="height:8px"><i style="width:'+Math.round((f.score/10)*100)+'%;background:'+scoreColor(f.score)+'"></i></div><div class="muted" style="font-size:10px;margin-top:3px">'+esc(f.phase)+'·'+f.score+'</div></div>';
      }).join("");
      h+='<div class="card"><div style="display:flex;align-items:center;gap:12px">'
        +'<div class="score" style="color:'+scoreColor(ms)+'">'+ms+'<span style="font-size:13px;color:var(--hint)">/10</span></div>'
        +'<div><div style="font-weight:700">Calificación IA del video</div><div class="muted" style="font-size:12px">'+(q.passed?"✅ Pasó el mínimo (7.5)":"⚠️ Bajo 7.5 — conviene regenerar")+'</div></div></div>'
        +(ph?'<div style="display:flex;gap:8px;margin-top:12px">'+ph+'</div>':'')+'</div>';
    }
    if(seo){
      var val=seo.validation||{};
      h+='<div class="card"><div style="font-weight:700;margin-bottom:8px">📦 SEO para publicar'+(val.nota_global!=null?' · <span style="color:'+scoreColor(val.nota_global)+'">'+val.nota_global+'/10</span>':'')+'</div>'
        +'<div class="muted" style="font-size:11px">TÍTULO</div><div style="font-weight:600;margin-bottom:8px">'+esc(seo.title||"—")+'</div>'
        +'<div class="muted" style="font-size:11px">DESCRIPCIÓN</div><div style="font-size:13px;white-space:pre-wrap;max-height:130px;overflow:auto;margin-bottom:8px">'+esc((seo.description||"—").slice(0,600))+'</div>'
        +'<div class="muted" style="font-size:11px">TAGS</div><div style="margin-bottom:4px">'+((seo.tags||[]).map(function(t){return '<span class="chip" style="font-size:11px">'+esc(t)+'</span>';}).join(" ")||"—")+'</div>'
        +((val.problemas&&val.problemas.length)?'<div class="muted" style="font-size:12px;color:var(--am);margin-top:6px">⚠️ '+esc(val.problemas.join("; "))+'</div>':'')
        +'</div>';
      var thumbInner = p.thumb_url
        ? '<img src="'+esc(location.origin+p.thumb_url)+'" style="width:100%;display:block" alt="miniatura">'
        : '<div class="ytthumb"><span class="ytbig">'+esc(seo.thumbnail_text||"THE DATA LENS")+'</span></div>';
      h+='<div class="muted" style="font-size:11px;margin:2px 2px 0">Vista previa'+(p.thumb_url?" (miniatura real)":" (cómo se vería)")+':</div>'
        +'<div class="ytcard">'+thumbInner
        +'<div style="padding:9px"><div class="yttitle">'+esc(seo.title||"—")+'</div><div class="muted" style="font-size:12px">The Data Lens · '+(p.video_id?"privado":"—")+'</div></div></div>';
    }
    if(p.watch_url){ h+='<a class="btn ghost" href="'+esc(location.origin+p.watch_url)+'" target="_blank">▶️ Ver el video</a>'; }
    if(seo){
      h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Comentarios para mejorar el SEO (opcional):</div>'
        +'<textarea id="seoNotes" placeholder="Ej: título más directo, menos clickbait, menciona la cifra"></textarea>'
        +'<button class="btn ghost" onclick="regenSeo()">🔁 Regenerar SEO</button>';
      if(p.approved){
        h+='<div style="text-align:center;font-weight:700;color:var(--am);padding:8px;margin:8px 0;background:rgba(245,158,11,.12);border-radius:12px">✅ Aprobado · falta agendar</div>'
          +'<button class="btn" onclick="scheduleVideo()">📅 Programar en la mejor hora</button>'
          +'<div class="muted" style="font-size:11px;margin:4px 0 8px">La auto-programación no encontró hora libre o falló. Toca aquí para reintentar. Lo verás en 📅 Agenda.</div>'
          +'<button class="btn ghost" onclick="publishVideo()">🌍 Publicar ahora</button>';
      } else {
        h+='<button class="btn" onclick="approveSeo()">✅ Aprobar y programar (mejor hora)</button>'
          +'<div class="muted" style="font-size:11px;margin-top:4px">Un toque: aprueba el SEO y lo <b>agenda solo</b> en la próxima mejor hora (EEUU). Lo verás en 📅 Agenda. YouTube lo publica solo a esa hora.</div>';
      }
      h+='</div>';
    }
    return h;
  }

  function craftHtml(){
    // Auto-mejora: lo que el sistema aprendió del último video y aplica al siguiente.
    var c=ST.craft; if(!c||(!c.footage && !c.hook && !c.score)) return "";
    var f=c.fixes||{};
    var fx=[];
    if(f.brightness) fx.push("luz "+(f.brightness>0?"+":"")+f.brightness);
    if(f.saturation) fx.push("saturación "+(f.saturation>0?"+":"")+f.saturation);
    if(f.contrast) fx.push("contraste "+(f.contrast>0?"+":"")+f.contrast);
    if(f.pace==="faster") fx.push("cortes más rápidos");
    return '<h2>🔧 Auto-mejora (cada video aprende del anterior)</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px;margin-bottom:4px">Esto se aplica automáticamente al PRÓXIMO render.</div>'
      +(c.score?'<div style="font-size:12px">Última nota del render: <b>'+c.score+'/10</b></div>':'')
      +(c.hook?'<div style="font-size:12px">🪝 Gancho: '+esc(c.hook)+'</div>':'')
      +(c.footage?'<div style="font-size:12px">🎬 Footage a mejorar: '+esc(c.footage)+'</div>':'')
      +(fx.length?'<div style="font-size:12px;color:var(--cy)">🎨 Ajustes aprendidos: '+esc(fx.join(" · "))+'</div>':'')
      +'</div>';
  }
  function learningsHtml(){
    // Qué aprendimos de lo ya subido (métricas + tendencias) y se aplica al PRÓXIMO video.
    var l=ST.learnings; if(!l||!l.brief) return "";
    var srcTxt={"metricas-reales":"según el rendimiento REAL de tus videos","sin-videos-publicos":"aún sin datos propios: tendencias + buenas prácticas","sin-oauth":"buenas prácticas (falta permiso de métricas)","error-fallback":"buenas prácticas"}[l.source]||"";
    var top=(l.top||[]).slice(0,3).map(function(v){return '<div class="muted" style="font-size:11px">• '+esc((v.title||"").slice(0,42))+' — '+num(v.views||0)+' vistas'+(v.watch?' · '+num(v.watch)+' min':'')+'</div>';}).join("");
    return '<h2>📈 Qué estamos mejorando</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px;margin-bottom:6px">Se aplica al próximo guion '+esc(srcTxt)+'.</div>'
      +'<div style="font-size:13px;white-space:pre-wrap;max-height:180px;overflow:auto">'+esc(l.brief)+'</div>'
      +(top?'<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px"><div class="muted" style="font-size:11px;font-weight:700">Lo que más rinde:</div>'+top+'</div>':'')
      +(l.at?'<div class="muted" style="font-size:10px;margin-top:6px">Analizado: '+esc(String(l.at).slice(0,16).replace("T"," "))+'</div>':'')
      +'</div>';
  }
  function fmtSlot(iso){
    try{
      var d=new Date(iso);
      var et=d.toLocaleString("es-CO",{timeZone:"America/New_York",weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit",hour12:true});
      var lo=d.toLocaleString("es-CO",{timeZone:"America/Bogota",hour:"numeric",minute:"2-digit",hour12:true});
      return et+" ET · tu "+lo;
    }catch(e){return iso;}
  }
  function scheduledHtml(){
    // Videos PROGRAMADOS (con hora futura). Al publicarse, YouTube los pasa a público y desaparecen.
    var s=ST.scheduled||[]; if(!s.length) return "";
    var rows=s.map(function(v){
      return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:6px 0">'
        +'<div style="font-size:12px">'+(v.type==="short"?"🎬 ":"📹 ")+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,34))+'</a>':esc(v.title||""))+'</div>'
        +'<div style="font-size:11px;color:var(--cy)">🕒 '+esc(fmtSlot(v.publish_at))+'</div></div>';
    }).join("");
    return '<h2>📅 Programados ('+s.length+')</h2>'
      +'<div class="card"><div class="muted" style="font-size:11px;margin-bottom:4px">Se publican solos en la mejor hora (EEUU). Al publicarse, desaparecen de aquí.</div>'+rows+'</div>';
  }
  function calendarHtml(){
    // CALENDARIO día a día: cada día con sus 2 franjas (mejores horas EEUU), lleno o libre. Meta 2/día.
    var cal=ST.calendar||[];
    var h='<h2>📅 Calendario de publicación</h2>'
      +'<div class="card muted" style="font-size:12px">Cada día tiene 2 franjas en las mejores horas (EEUU). Cuando <b>apruebas</b> un video o short, se agenda solo en la próxima franja libre. <b>Meta: 2/día.</b></div>';
    if(!cal.length) return h+'<div class="card muted">Nada programado aún. Aprueba un video (Control) o un short (Shorts) y aparece aquí.</div>';
    cal.forEach(function(d){
      var filled=d.slots.filter(function(s){return s.filled;}).length;
      var slots=d.slots.map(function(s){
        if(s.filled){
          return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)">'
            +'<div style="font-size:12px">'+(s.type==="short"?"🎬":"📹")+' '+esc((s.title||"Video").slice(0,32))+(s.off_slot?' <span class="muted" style="font-size:10px">(hora manual)</span>':'')+'</div>'
            +'<div style="font-size:11px;color:var(--cy);white-space:nowrap">'+esc(s.time)+'</div></div>';
        }
        return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px dashed rgba(255,255,255,.10)">'
          +'<div style="font-size:12px;color:var(--hint)">— Libre —</div>'
          +'<div style="font-size:11px;color:var(--hint);white-space:nowrap">'+esc(s.time)+'</div></div>';
      }).join("");
      var badge=filled>=2?'<span style="color:var(--gr)">✔ '+filled+'</span>':'<span style="color:var(--am)">'+filled+'/2</span>';
      h+='<div class="card" style="padding:10px 12px"><div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;text-transform:capitalize"><span>'+esc(d.label)+'</span>'+badge+'</div>'+slots+'</div>';
    });
    return h;
  }
  function bestTimesHtml(){
    // Mejores horas para PUBLICAR (audiencia EE.UU., canal de datos/dinero, faceless).
    // Se sube ~2-3h ANTES del pico de la tarde/noche para que el algoritmo lo indexe a tiempo.
    // Corre en el navegador -> hora ET real (con horario de verano) via zona horaria.
    var now=new Date();
    var etNow=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));
    var dow=etNow.getDay(); // 0 dom .. 6 sab
    var hr=etNow.getHours()+etNow.getMinutes()/60;
    // Ventana óptima por día: [inicio, fin, etiqueta] en hora ET
    var WIN={0:[9,11,"9–11 AM"],1:[15,18,"3–6 PM"],2:[12,15,"12–3 PM"],3:[12,15,"12–3 PM"],4:[12,15,"12–3 PM"],5:[12,15,"12–3 PM"],6:[9,11,"9–11 AM"]};
    var DAYS=["dom","lun","mar","mié","jue","vie","sáb"];
    var BEST={4:1,5:1,6:1,0:1}; // mejores días para este nicho: jue, vie, sáb, dom
    // Diferencia ET vs tu hora (Bogotá) en este instante (maneja el DST solo).
    var diff=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"})).getHours()-new Date(now.toLocaleString("en-US",{timeZone:"America/Bogota"})).getHours();
    function loc(h){var x=((h-diff)%24+24)%24;var ap=x>=12?"PM":"AM";var hh=x%12;if(hh===0)hh=12;return hh+" "+ap;}
    var w=WIN[dow], rec, recLoc;
    if(hr<w[1]){
      var when=hr<w[0]?"HOY":"AHORA (ventana abierta)";
      rec="📌 Publica <b>"+when+"</b> · "+DAYS[dow]+" "+w[2]+" ET"+(BEST[dow]?" ★":"");
      recLoc="tu hora: "+loc(w[0])+"–"+loc(w[1]);
    } else {
      var nd=(dow+1)%7, w2=WIN[nd];
      rec="📌 Próxima buena hora: <b>"+DAYS[nd]+" "+w2[2]+" ET</b>"+(BEST[nd]?" ★":"");
      recLoc="tu hora: "+loc(w2[0])+"–"+loc(w2[1]);
    }
    // Tabla semanal compacta
    var rows=[0,1,2,3,4,5,6].map(function(d){
      var ww=WIN[d];
      return '<tr'+(d===dow?' style="background:rgba(34,211,238,.12)"':'')+'><td>'+DAYS[d]+(BEST[d]?' ★':'')+'</td><td style="text-align:right">'+ww[2]+' ET</td><td style="text-align:right;color:var(--hint)">'+loc(ww[0])+'–'+loc(ww[1])+'</td></tr>';
    }).join("");
    return '<h2>⏰ Mejores horas para publicar</h2>'
      +'<div class="card"><div style="font-weight:700;font-size:14px">'+rec+'</div>'
      +'<div class="muted" style="font-size:12px;margin-top:2px">'+recLoc+'</div>'
      +'<table style="font-size:12px;margin-top:10px;width:100%"><tr><th style="text-align:left">Día</th><th style="text-align:right">Hora EEUU (ET)</th><th style="text-align:right">Tu hora</th></tr>'+rows+'</table>'
      +'<div class="muted" style="font-size:11px;margin-top:8px">★ = mejores días. Se sube ~2-3h antes del pico de la noche para que el algoritmo lo empuje. '
      +(ST.analytics_ok?'Cuando el canal tenga más datos, ajusto esto a la hora real en que TU audiencia se conecta.':'Con datos de audiencia lo personalizo a tu público real.')+'</div></div>';
  }

  function auto2KpisHtml(){
    var a=ST.auto2;
    if(!a) return '<div class="card" style="text-align:center;padding:22px"><div style="font-size:34px">🏭</div>'
      +'<div style="font-weight:800;font-size:17px;margin-top:6px">Oddly Loop — sin datos aún</div>'
      +'<div class="muted" style="font-size:13px;margin-top:6px">Compilaciones ASMR/satisfying legales, automáticas. En cuanto haya un video, verás sus vistas y minutos.</div></div>';
    return '<div class="card"><div class="muted" style="font-size:11px;margin-bottom:6px">'+esc(a.name||"Oddly Loop")+' · '+esc(a.handle||"@oddlyloophq")+'</div><div class="row">'
      +'<div class="kpi"><div class="n">'+num(a.subs||0)+'</div><div class="l">Subs</div></div>'
      +'<div class="kpi"><div class="n">'+num(a.total_views||0)+'</div><div class="l">Vistas</div></div>'
      +'<div class="kpi"><div class="n">'+(a.videos||0)+'</div><div class="l">Videos</div></div>'
      +'<div class="kpi"><div class="n">'+num(a.watch_min||0)+'</div><div class="l">Min vistos</div></div>'
      +'</div></div>';
  }
  // Lo que MÁS RINDE (por vistas/día) para replicar ese tipo de contenido + categoría ganadora.
  function auto2TopHtml(){
    var a=ST.auto2||{}; var top=a.top||[]; var nr=a.niche_ranking||[];
    if(!top.length && !nr.length) return '<h2>🔥 Lo que más rinde</h2><div class="card muted" style="font-size:12px">Aún sin datos de vistas. Cuando los videos acumulen vistas, aquí verás qué categoría y qué videos jalan más — para replicar.</div>';
    var h='<h2>🔥 Lo que más rinde (para replicar)</h2>';
    if(nr.length){
      h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Categoría por vistas/día — produce más de la de arriba 👑:</div>'
        +nr.slice(0,4).map(function(r,i){return '<div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px">'+(i===0?'👑 ':'')+'<b>'+esc(r.label)+'</b></div><div class="muted" style="font-size:11px;white-space:nowrap">'+r.avg_vpd+'/día · '+r.videos+' vid</div></div>';}).join("")+'</div>';
    }
    if(top.length){
      h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">🏆 Top 3 (vistas/día):</div>'
        +top.slice(0,3).map(function(v,i){return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px">'+["🥇","🥈","🥉"][i]+' '+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,26))+'</a>':esc(v.title||""))+(v.niche_label?' <span class="muted">('+esc(v.niche_label)+')</span>':'')+'</div><div style="font-size:11px;color:var(--cy);white-space:nowrap">'+num(v.views)+' · '+(v.vpd||0)+'/día</div></div>';}).join("")+'</div>';
    }
    var zero=((a.list)||[]).filter(function(v){return v.privacy==="public"&&(v.views||0)===0;}).length;
    var pubN=((a.list)||[]).filter(function(v){return v.privacy==="public";}).length;
    if(pubN) h+='<div class="card muted" style="font-size:12px">👁️ Sin ni una vista: <b>'+zero+'</b> de '+pubN+' públicos.'+(zero?' Revisa título/miniatura/hora de esos.':' ')+'</div>';
    var bh=a.best_hours;
    if(bh&&bh.hours&&bh.hours.length) h+='<div class="card muted" style="font-size:12px">🕐 <b>Mejores horas (por tus datos):</b> '+bh.hours.map(function(x){return x+':00';}).join(", ")+' ET · programando ahí. (Basado en '+bh.based_on+' videos.)</div>';
    else h+='<div class="card muted" style="font-size:12px">🕐 Horas de publicación: por ahora las de mejor resultado según investigación (pico tarde/noche EEUU). Se afinan solas cuando haya datos de tu canal.</div>';
    return h;
  }
  // The Data Lens: top videos (vistas/día) + mejores horas por datos. Vacío si aún no hay señal.
  function dataLensTopHtml(){
    var top=ST.top||[]; var bh=ST.best_hours; var h='';
    if(top.length){
      h+='<h2>🔥 Lo que más rinde (para replicar)</h2><div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">🏆 Top 3 (vistas/día):</div>'
        +top.slice(0,3).map(function(v,i){return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px">'+["🥇","🥈","🥉"][i]+' '+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,28))+'</a>':esc(v.title||""))+'</div><div style="font-size:11px;color:var(--cy);white-space:nowrap">'+num(v.views)+' · '+(v.vpd||0)+'/día</div></div>';}).join("")+'</div>';
    }
    // Videos públicos sin ni una vista (de todo el árbol: largos + shorts).
    var all=[]; (ST.video_tree||[]).forEach(function(l){ all.push(l); (l.shorts||[]).forEach(function(s){all.push(s);}); }); (ST.video_tree_ungrouped||[]).forEach(function(s){all.push(s);});
    var pubN=all.filter(function(v){return v.privacy==="public";}).length;
    var zero=all.filter(function(v){return v.privacy==="public"&&(v.views||0)===0;}).length;
    if(pubN) h+='<div class="card muted" style="font-size:12px">👁️ Sin ni una vista: <b>'+zero+'</b> de '+pubN+' públicos.'+(zero?' Revisa título/miniatura/hora de esos.':'')+'</div>';
    if(bh&&bh.hours&&bh.hours.length) h+='<div class="card muted" style="font-size:12px">🕐 <b>Mejores horas (por tus datos):</b> '+bh.hours.map(function(x){return x+':00';}).join(", ")+' ET · programando ahí. (Basado en '+bh.based_on+' videos.)</div>';
    return h;
  }
  function auto2VideosHtml(withActions){
    var list=(ST.auto2&&ST.auto2.list)||[];
    if(!list.length) return '<h2>Videos de Oddly Loop</h2><div class="card muted" style="font-size:12px">Aún sin videos. Produce una compilación arriba 👆</div>';
    // Lo YA HECHO (público o programado) queda OCULTO; solo mostramos lo que falta REVISAR.
    var now2=new Date();
    list=list.filter(function(v){ var pv=v.privacy==="public"; var loc=localSched[v.video_id]; var future=v.publish_at&&(new Date(v.publish_at)>now2); return !pv && !future && loc!=="schedule" && loc!=="public"; });
    if(!list.length) return '<h2>Videos de Oddly Loop</h2><div class="card muted" style="font-size:12px">✅ Todo al día. Lo público y lo programado está hecho (lo ves en 📅 Agenda). Cuando produzcas uno nuevo, aparece aquí para revisar.</div>';
    return '<h2>Por revisar ('+list.length+')</h2>'+list.map(function(v){
      var pv=v.privacy==="public";
      var loc=localSched[v.video_id]||""; // marca optimista de esta sesión
      var schedAt=v.publish_at||""; var future=schedAt&&(new Date(schedAt)>new Date());
      // Estado del video: publicado / programado / publicando / en revisión.
      var estado, act='';
      if(pv){ estado='<span class="tag pub">público</span>'; }
      else if(loc==="public"){ estado='<span class="tag priv">🌍 publicando…</span>'; }
      else if(loc==="schedule"||future){
        estado='<span class="tag priv">📅 programado'+(future?' · '+esc(fmtSlot(schedAt)):' (mejor hora)')+'</span>';
        // Ya programado, pero SIEMPRE con acciones: reprogramar (a otra franja libre) o publicar ya.
        if(withActions&&v.video_id) act='<div style="margin-top:8px"><button class="btn mini ghost" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'schedule\\')">🔁 Reprogramar</button> <button class="btn mini ghost" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'public\\')">🌍 Publicar ya</button></div>';
      }
      else { estado='<span class="tag priv">🔎 en revisión</span>';
        if(withActions&&v.video_id) act='<div style="margin-top:8px"><button class="btn mini" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'schedule\\')">📅 Programar (mejor hora)</button> <button class="btn mini ghost" onclick="oddlyPublish(\\''+v.video_id+'\\',\\'public\\')">🌍 Publicar ahora</button></div>';
      }
      return '<div class="card"><div style="font-weight:700;font-size:13px">'+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,42))+'</a>':esc(v.title||""))+'</div>'
        +(v.manual?'<div style="font-size:12px;margin-top:3px">✋ <b>Subido a mano</b>'+(/#short/i.test(v.title||'')?' · 📱 Short':'')+'</div>':((v.niche_label||/#short/i.test(v.title||''))?'<div style="font-size:12px;margin-top:3px">'+(/#short/i.test(v.title||'')?'📱 <b>Short</b>':'🎬 <b>'+esc(v.niche_label)+'</b>')+'</div>':''))
        +'<div class="muted" style="font-size:12px;margin-top:3px">'+estado+' · '+num(v.views||0)+' vistas</div>'+act+'</div>';
    }).join("");
  }
  function auto2ProduceCard(){
    var niches=[["satisfying","Satisfying/ASMR"],["narrativas","Narrativas"],["ciencia_humor","Ciencia+humor"],["naturaleza_relax","Naturaleza"]];
    return '<h2>🏭 Producir</h2>'
      +'<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">📱 Shorts ASMR <span class="muted" style="font-weight:400">— lo que más se ve</span></div>'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">Vertical 9:16 · duración según categoría (ASMR aguanta más largo). PRIVADOS para revisar.</div>'
      +'<div class="chips">'
      +'<span class="chip" onclick="produceOddly(\\'satisfying\\',\\'short\\',\\'puro\\')">🔇 Short sin voz</span>'
      +'<span class="chip" onclick="produceOddly(\\'satisfying\\',\\'short\\',\\'narrado\\')">🎙️ Short con voz</span>'
      +'</div></div>'
      +'<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">🎬 Video largo (16:9)</div>'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">Compilación completa. PRIVADO para revisar. ~15 min.</div>'
      +'<div class="chips">'
      +'<span class="chip" onclick="produceOddly(\\'satisfying\\',\\'video\\',\\'puro\\')">🔇 ASMR sin voz</span>'
      +'<span class="chip" onclick="produceOddly(\\'satisfying\\',\\'video\\',\\'narrado\\')">🎙️ ASMR con voz</span>'
      +'</div>'
      +'<div class="muted" style="font-size:11px;margin-top:10px;margin-bottom:4px">Otros nichos (video con voz):</div>'
      +'<div class="chips">'+niches.slice(1).map(function(n){return '<span class="chip ghost" onclick="produceOddly(\\''+n[0]+'\\',\\'video\\',\\'narrado\\')">'+esc(n[1])+'</span>';}).join("")+'</div>'
      +'</div>'
      +'<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">🎧 Biblioteca de sonidos ASMR</div>'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">Los mejores sonidos CC0 curados por paleta (cama + acentos), guardados en la nube. Necesita la API key de Freesound.</div>'
      +'<button class="btn ghost" onclick="dispatch(\\'build_asmr_library.yml\\',\\'Construir biblioteca ASMR\\')">🎧 Construir / refrescar biblioteca</button></div>';
  }
  function auto2RefreshBtn(){
    var a=ST.auto2;
    return '<button class="btn ghost" onclick="dispatch(\\'report_auto2.yml\\',\\'Refrescar Oddly Loop\\')">🔄 Refrescar canal</button>'
      +(a&&a.at?'<div class="muted" style="font-size:10px;text-align:center">Act. '+esc(String(a.at).slice(0,16).replace("T"," "))+'</div>':'');
  }
  // AGENDA del canal auto: próximos a publicar (programados), en revisión por programar, y estado del automático.
  function auto2AgendaHtml(){
    var list=(ST.auto2&&ST.auto2.list)||[];
    var now=new Date();
    var isFuture=function(v){ return (v.publish_at&&(new Date(v.publish_at)>now))||localSched[v.video_id]==="schedule"; };
    var prog=list.filter(isFuture).sort(function(a,b){ return (a.publish_at||"9")<(b.publish_at||"9")?-1:1; });
    var enRev=list.filter(function(v){ return v.privacy!=="public" && !isFuture(v) && localSched[v.video_id]!=="public"; });
    var pubCount=list.filter(function(v){ return v.privacy==="public"; }).length;
    var h='<h2>📅 Programación de Oddly Loop</h2>';
    // Próximos a publicar (programados)
    h+='<div class="card"><div style="font-weight:800;font-size:14px;margin-bottom:6px">🗓️ Próximos a publicar ('+prog.length+')</div>';
    if(prog.length){
      h+=prog.map(function(v){
        var when=v.publish_at?fmtSlot(v.publish_at):"mejor hora";
        return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:7px 0">'
          +'<div style="font-size:13px">'+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,34))+'</a>':esc(v.title||""))
          +(v.niche_label?'<div class="muted" style="font-size:11px">🎬 '+esc(v.niche_label)+'</div>':'')+'</div>'
          +'<div style="font-size:11px;color:var(--cy);white-space:nowrap;text-align:right">🕒 '+esc(when)+'</div></div>';
      }).join("");
    } else {
      h+='<div class="muted" style="font-size:12px">Nada programado aún. En <b>Producir</b>, a un video privado dale <b>📅 Programar</b> y aparece aquí con su fecha.</div>';
    }
    h+='</div>';
    // En revisión (por programar)
    if(enRev.length){
      h+='<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:800;font-size:14px;margin-bottom:4px">👀 En revisión — por programar ('+enRev.length+')</div>'
        +'<div class="muted" style="font-size:12px;margin-bottom:8px">Privados, esperando que los revises y les pongas hora.</div>'
        +enRev.slice(0,6).map(function(v){ return '<div style="font-size:12px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0">• '+esc((v.title||"").slice(0,40))+(v.niche_label?' <span class="muted">('+esc(v.niche_label)+')</span>':'')+'</div>'; }).join("")
        +'<button class="btn" style="margin-top:8px" onclick="tab(\\'producir\\')">Ir a programar</button></div>';
    }
    // Cadencia diaria por categoría (cron)
    h+='<div class="card"><div style="font-weight:800;font-size:14px;margin-bottom:4px">⚙️ Cadencia diaria (automática)</div>'
      +'<div class="muted" style="font-size:12px;margin-bottom:8px">🚀 <b>Blitz de Shorts:</b> 2 Shorts por categoría (8/día) + 1 largo/día, cada uno a su mejor hora libre (tope 2/hora). Vía rápida a monetizar (10M vistas de Shorts/90d).<br>🎬 Satisfying/ASMR · 🎬 Narrativas · 🎬 Ciencia+humor · 🎬 Naturaleza. <br>Ajustable en cadence.json. Publicados hasta hoy: '+pubCount+'.</div>'
      +'<button class="btn ghost" onclick="dispatch(\\'daily_oddly.yml\\',\\'Lanzar la cadencia de hoy\\')">▶️ Lanzar la tanda de hoy ahora</button></div>';
    return h+bestTimesHtml();
  }
  function nicheRadarHtml(){
    var nr=ST.niche_radar;
    var h='<h2>📡 Radar de nichos</h2>';
    if(!nr) return h+'<div class="card muted" style="font-size:12px">Aún sin configurar. Se activa con el canal automático.</div>';
    h+='<div class="card"><div style="font-size:13px;font-weight:600;margin-bottom:6px">'+esc(nr.recommendation||"")+'</div>';
    var rk=nr.ranking||[];
    if(rk.length){
      h+=rk.map(function(r){return '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px"><b>#'+r.rank+'</b> '+esc(r.label)+'</div><div class="muted" style="font-size:11px;white-space:nowrap">'+num(r.avg_views)+'/video · '+r.videos+' vid</div></div>';}).join("");
    } else {
      h+='<div class="muted" style="font-size:11px;margin-bottom:2px">Portafolio en prueba (candidatos):</div>';
      h+=(nr.portfolio||[]).map(function(p){return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:5px 0"><div style="font-size:12px">🎯 '+esc(p.label)+'</div>'+(p.note?'<div class="muted" style="font-size:11px">'+esc(p.note)+'</div>':'')+'</div>';}).join("");
    }
    h+=(nr.updated_at?'<div class="muted" style="font-size:10px;margin-top:6px">Actualizado: '+esc(String(nr.updated_at).slice(0,16).replace("T"," "))+'</div>':'')
      +'<button class="btn ghost" style="margin-top:8px" onclick="dispatch(\\'niche_radar.yml\\',\\'Radar de nichos\\')">🔄 Actualizar radar</button></div>';
    return h;
  }
  function nextActionHtml(){
    var p=ST.production||{}, sst=ST.shorts_status||{}, prob=(ST.problems||[]).length, active=ST.active&&ST.active.length;
    function card(t,d,btn,act){ return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:800;font-size:15px">'+t+'</div><div class="muted" style="font-size:13px;margin:4px 0 8px">'+esc(d)+'</div><button class="btn" onclick="'+act+'">'+btn+'</button></div>'; }
    if(p.render_pending) return card("🎬 Video listo por revisar","Un video renderizado espera tu aprobación.","Revisarlo","tab(\\'producir\\')");
    if(p.seo && !p.approved && !p.done) return card("📦 SEO por aprobar","El video está subido; aprueba el SEO para agendarlo a la mejor hora.","Ir a aprobar","tab(\\'producir\\')");
    if(p.approved && !p.done) return card("📅 Falta agendar","Aprobado; solo falta ponerle hora.","Programar","tab(\\'producir\\')");
    if(sst.pending) return card("✂️ Shorts por aprobar",sst.pending+" short(s) sugerido(s) esperan tu OK.","Ver shorts","tab(\\'producir\\')");
    if(prob) return card("⚠️ "+prob+" problema(s)","Algo falló. Revisa y reintenta.","Ir a Más","tab(\\'mas\\')");
    if(active) return "";
    var next=(ST.upcoming||[])[0];
    if(next) return card("▶️ Producir el siguiente","#"+(next.n||"")+" · "+(next.topic||""),"Producir","tab(\\'producir\\')");
    return '<div class="card muted">✅ Todo al día. Nada requiere tu atención ahora.</div>';
  }
  function promiseMiniHtml(){
    var a=ST.analysis; if(!a) return "";
    var col=a.promise>=66?"var(--gr)":a.promise>=40?"var(--cy)":"var(--am)";
    return '<div class="card" onclick="tab(\\'analitica\\')" style="cursor:pointer;display:flex;align-items:center;gap:14px">'
      +'<div style="text-align:center"><div class="gauge" style="color:'+col+'">'+a.promise+'</div><div class="muted" style="font-size:10px">/100</div></div>'
      +'<div style="flex:1"><div style="font-weight:700">'+esc(a.label||"")+'</div><div class="muted" style="font-size:12px">Qué tan prometedor se ve el canal. Toca para el análisis completo.</div></div>'
      +'<div style="color:var(--hint);font-size:20px">›</div></div>';
  }
  function healthLineHtml(){
    var t=ST.tools_health||{}, prob=(ST.problems||[]).length, pieces=[];
    if(t.tools&&t.tools.length) pieces.push(t.down>0?('🧰 '+t.ok+'/'+t.total+' herramientas'):'🧰 herramientas OK');
    pieces.push(prob?('⚠️ '+prob+' problema(s)'):'✅ sin problemas');
    var pr=(ST.analysis&&ST.analysis.problems)||[];
    if(pr.length) pieces.push('🚩 '+pr.length+' reclamación(es)');
    return '<div class="card muted" style="font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><span>'+pieces.join(' · ')+'</span><span onclick="tab(\\'mas\\')" style="color:var(--cy);cursor:pointer">detalle ›</span></div>';
  }
  function monetizationHtml(){
    var mon=ST.monetization||{};
    return '<h2>Monetización (YPP)</h2><div class="card">'
      +'<div class="muted">Suscriptores '+(mon.subs||0)+' / 1000</div><div class="bar"><i style="width:'+pct(mon.subs,1000)+'%"></i></div>'
      +'<div class="muted" style="margin-top:10px">Horas '+(mon.watch_hours!=null?mon.watch_hours:"—")+' / 4000</div><div class="bar"><i style="width:'+pct(mon.watch_hours,4000)+'%"></i></div>'
      +'<div style="margin-top:12px" class="'+(mon.elegible?"":"muted")+'">'+(mon.elegible?"✅ Elegible para monetizar":"❌ Aún no elegible")+'</div>'
      +'<div class="muted" style="font-size:10px;margin-top:6px">⏱️ Las horas/minutos vistos vienen de YouTube Analytics, que va ~2-3 días atrasado (normal, no es error). Las <b>vistas</b> sí son casi al día.</div></div>';
  }
  function analysisHtml(){
    var a=ST.analysis; if(!a) return "";
    var col=a.promise>=66?"var(--gr)":a.promise>=40?"var(--cy)":"var(--am)";
    var f=a.factors||{};
    function barRow(lbl,val,max){ var pp=Math.round((val/(max||1))*100); return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><div class="muted" style="font-size:11px;width:96px">'+lbl+'</div><div class="bar" style="flex:1"><i style="width:'+pp+'%"></i></div><div class="muted" style="font-size:11px;width:40px;text-align:right">'+val+'/'+max+'</div></div>'; }
    var h='<h2>🔬 Análisis del canal</h2><div class="card">'
      +'<div style="display:flex;align-items:center;gap:14px">'
      +'<div style="text-align:center"><div class="gauge" style="color:'+col+'">'+a.promise+'</div><div class="muted" style="font-size:10px">/100</div></div>'
      +'<div><div style="font-weight:700">'+esc(a.label||"")+'</div><div class="muted" style="font-size:12px">Qué tan prometedor se ve el canal: crecimiento, retención, cadencia y avance a monetizar.</div></div></div>'
      +'<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px">'
      +barRow("Crecimiento",f.crecimiento||0,35)+barRow("Retención",f.retencion||0,30)+barRow("Cadencia",f.cadencia||0,20)+barRow("Monetización",f.ypp||0,15)
      +'</div>'
      +'<div class="muted" style="font-size:11px;margin-top:6px">Tendencia 7d: '+((a.trend_pct||0)>=0?"+":"")+(a.trend_pct||0)+'% · retención ~'+(a.retention_pct||0)+'% · '+(a.recent_14d||0)+' videos en 14 días</div>'
      +(a.ai&&a.ai.assessment?'<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;font-size:13px;white-space:pre-wrap">'+esc(a.ai.assessment)+'</div>':'')
      +'</div>';
    var pr=a.problems||[];
    h+='<div class="card"'+(pr.length?' style="border:1px solid rgba(248,113,113,.45)"':'')+'>'
      +'<div style="font-weight:700;font-size:13px">'+(pr.length?('🚩 Reclamaciones/problemas ('+pr.length+')'):'✅ Sin reclamaciones detectadas')+'</div>';
    if(pr.length) h+=pr.map(function(v){return '<div style="border-top:1px solid rgba(255,255,255,.06);padding:5px 0;font-size:12px">'+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,30))+'</a>':esc(v.title||""))+' — <span style="color:#f87171">'+esc(v.reason||"")+'</span></div>';}).join("");
    h+='<div class="muted" style="font-size:10px;margin-top:6px">Según la API de YouTube (rechazos/estado de subida). Los reclamos de Content ID completos solo se ven en Studio.</div></div>';
    return h;
  }
  function render(){
    var ch = ST.channel||{}, cs = ST.channel_stats||{}, mon = ST.monetization||{};
    var up = ST.upcoming||[];
    var liveTag = (activeFor(curChannel).length) ? " · 🟢 en vivo" : "";
    el("chTitle").textContent = curChannel==="auto2" ? "Auto #2" : "The Data Lens";
    el("hd").textContent = (curChannel==="auto2"?"canal automático":"@TheDataLensHQ")+" · act. "+ (ST.updated_at? String(ST.updated_at).slice(5,16).replace("T"," "):"—") + liveTag;
    setHelp(curTab);
    el("globalStatus").innerHTML = (activeFor("data-lens").length) ? ('<h2>⚡ En proceso ahora</h2>'+statusHtml("data-lens")) : "";

    // CANAL AUTOMATICO #2 (Oddly Loop): cada flujo con su contenido propio.
    if(curChannel==="auto2"){
      var producingA=activeFor("auto2").length>0;
      var statusA=producingA?('<h2>⚡ Produciendo en Oddly Loop</h2>'+statusHtml("auto2")):'';
      // Aviso si hay videos privados por revisar (de este canal).
      var privA=((ST.auto2&&ST.auto2.list)||[]).filter(function(v){return v.privacy!=="public";}).length;
      var pendA=privA?('<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:800;font-size:15px">👀 '+privA+' video(s) por revisar</div><div class="muted" style="font-size:13px;margin:4px 0 8px">De Oddly Loop, privados. Revísalos y publica/programa en Producir.</div><button class="btn" onclick="tab(\\'producir\\')">Ir a revisar</button></div>'):'';
      // INICIO: pulso (KPIs + estado + pendientes + producir + radar)
      el("s-inicio").innerHTML = auto2KpisHtml() + statusA + pendA + auto2TopHtml() + auto2ProduceCard() + nicheRadarHtml();
      // PRODUCIR: sus videos CON acciones (publicar/programar) + producir + nota
      el("s-producir").innerHTML = statusA + auto2VideosHtml(true) + auto2ProduceCard()
        + '<div class="card muted" style="font-size:12px">Oddly Loop es <b>full-auto</b>: cuando prendamos el cron, produce y programa 3/día solo. Aquí revisas/publicas los suyos y disparas manuales.</div>';
      // AGENDA: próximos a publicar (programados) + en revisión + estado del automático + mejores horas
      el("s-agenda").innerHTML = auto2AgendaHtml();
      // ANALITICA: KPIs + top 3 + sin-vistas + radar (sin listar todos los videos)
      el("s-analitica").innerHTML = auto2KpisHtml() + auto2TopHtml() + nicheRadarHtml();
      // MAS: info + refrescar
      el("s-mas").innerHTML = '<h2>⚙️ Canal automático</h2><div class="card muted" style="font-size:12px">Oddly Loop · @oddlyloophq · compilaciones ASMR/satisfying legales, automáticas. Solo fuentes con licencia (puerta de compliance).</div>'
        + '<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:2px">🎨 Marca del canal</div><div class="muted" style="font-size:12px;margin-bottom:8px">Aplica el banner, la descripción y los tags por API. El avatar te lo mando por Telegram para que lo subas en Studio (la API no lo permite).</div><button class="btn ghost" onclick="dispatch(\\'set_oddly_branding.yml\\',\\'Aplicar marca del canal\\')">🎨 Aplicar marca del canal</button></div>'
        + auto2RefreshBtn();
      el("globalStatus").innerHTML="";
      return;
    }

    // ===== INICIO ===== lo que necesita tu atencion + pulso del canal.
    el("s-inicio").innerHTML =
      nextActionHtml()
      +'<div class="card"><div class="row">'
      +'<div class="kpi"><div class="n">'+num(cs.subs)+'</div><div class="l">Subs</div></div>'
      +'<div class="kpi"><div class="n">'+num(cs.total_views)+'</div><div class="l">Vistas</div></div>'
      +'<div class="kpi"><div class="n">'+(ST.long_count||0)+'</div><div class="l">Largos</div></div>'
      +'<div class="kpi"><div class="n">'+(ST.shorts_count||0)+'</div><div class="l">Shorts</div></div>'
      +'</div></div>'
      +promiseMiniHtml()
      +healthLineHtml();

    // ===== PRODUCIR ===== produccion + resultados + que pasa con cada video + shorts.
    var next = up[0], rest = up.slice(1);
    var producing = (ST.active||[]).some(function(r){return /Producir|guion|Render VIDEO|Voiceover/i.test(r.name||"");});
    var prows = rest.map(function(u){return '<tr><td>#'+(u.n||"")+'</td><td>'+esc(u.topic||"")+'<div class="muted" style="font-size:11px">'+esc(u.why||"")+'</div></td><td style="text-align:right;white-space:nowrap">'+esc(u.target_date||"")+'</td></tr>';}).join("");
    var prop = ST.shorts_proposal||[]; var sst = ST.shorts_status||{};
    var pend=prop.filter(function(s){return s.state==="pending";});
    var appr=prop.filter(function(s){return s.state==="approved";});
    var upl=prop.filter(function(s){return s.state==="uploaded";});
    // Shorts YA PROGRAMADOS: fuera del listado (se ven en 📅 Agenda). Solo mostramos los que faltan.
    var uplSched=upl.filter(function(s){return s.publish_at && s.privacy!=="public";});
    var uplShow=upl.filter(function(s){return !(s.publish_at && s.privacy!=="public");});
    var skip=prop.filter(function(s){return s.state==="skipped";});
    var shb=""; var vid=sst.latest_video_id;
    if(pend.length){
      shb+='<h2>🤖 Sugerencias por aprobar ('+pend.length+')</h2>';
      shb+=pend.map(function(s){
        var moment = (vid && s.start!=null) ? 'https://youtu.be/'+vid+'?t='+s.start : null;
        var mmss = (s.start!=null) ? (Math.floor(s.start/60)+':'+('0'+(s.start%60)).slice(-2)) : '';
        return '<div class="card"><div style="font-weight:700">'+esc(s.title)+(s.dur?' · '+s.dur+'s':'')+'</div>'
          +(mmss?'<div class="muted" style="font-size:11px">⏱️ desde el '+mmss+' del video</div>':'')
          +(s.hook?'<div class="muted" style="font-size:12px;margin:3px 0">🪝 '+esc(s.hook)+'</div>':'')
          +(s.caption?'<div style="font-size:13px;margin:3px 0">'+esc(s.caption)+'</div>':'')
          +((s.hashtags&&s.hashtags.length)?'<div class="muted" style="font-size:11px">'+esc(s.hashtags.join(" "))+'</div>':'')
          +'<div style="margin-top:8px">'
          +(moment?'<a class="btn mini ghost" href="'+moment+'" target="_blank">▶️ Ver el momento</a> ':'')
          +'<button class="btn mini" onclick="shortApprove('+s.n+',1)">✅ Aprobar</button> '
          +'<button class="btn mini ghost" onclick="shortApprove('+s.n+',0)">❌ Saltar</button></div></div>';
      }).join("");
      shb+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">¿No te convencen? Deja un comentario y la IA las rehace:</div>'
        +'<textarea id="shNotes" placeholder="Ej: shorts más cortos, que empiecen con la cifra, usa el momento del minuto 3"></textarea>'
        +'<button class="btn ghost" onclick="regenShorts()">🔁 Regenerar sugerencias con mis comentarios</button></div>';
    }
    if(appr.length){
      shb+='<h2>✅ Aprobados ('+appr.length+') — listos para generar</h2><div class="card">'
        +appr.map(function(s){return '<div style="margin:2px 0">• '+esc(s.title)+'</div>';}).join("")
        +'<button class="btn" onclick="dispatch(\\'shorts_final.yml\\',\\'Generar los shorts aprobados\\')">🎬 Generar los aprobados</button></div>';
    }
    if(uplSched.length) shb+='<div class="muted" style="font-size:12px;margin:6px 2px">📅 '+uplSched.length+' short(s) ya programado(s) — en la Agenda.</div>';
    if(uplShow.length){
      var parentPub = sst.parent_public;
      shb+='<h2>🎬 Shorts (por publicar/programar)</h2>';
      if(!parentPub){
        shb+='<div class="card" style="border:1px solid rgba(245,158,11,.45)"><div style="font-weight:700;color:var(--am)">⏳ Esperando que se publique el video</div>'
          +'<div class="muted" style="font-size:12px;margin-top:4px">Estos shorts son de <b>'+esc(sst.parent_title||"un video")+'</b>, que aún está privado/programado. Se publicarán cuando el video esté público (los shorts llevan gente al video — sin video público no sirven).</div></div>';
      }
      shb+='<div class="card"><table><tr><th>Short</th><th>Estado</th><th style="text-align:right">Acción</th></tr>'
        +uplShow.map(function(s){var pv=s.privacy==="public";
          var cell;
          if(pv){ cell=num(s.views)+' vistas'; }
          else if(s.publish_at){ cell='<span style="font-size:10px;color:var(--cy)">🕒 '+esc(fmtSlot(s.publish_at))+'</span>'; }
          else if(parentPub){ cell='<button class="btn mini" onclick="scheduleShort(\\''+s.video_id+'\\')">📅 Programar</button>'; }
          else { cell='<span class="muted" style="font-size:11px">⏳ tras el video</span>'; }
          return '<tr><td>'+(s.video_id?'<a href="https://youtu.be/'+s.video_id+'" target="_blank">'+esc(s.title)+'</a>':esc(s.title))+'</td>'
          +'<td><span class="tag '+(pv?"pub":"priv")+'">'+(s.publish_at&&!pv?"programado":esc(s.privacy||"?"))+'</span></td>'
          +'<td style="text-align:right">'+cell+'</td></tr>';
        }).join("")+'</table></div>';
    }
    if(skip.length) shb+='<div class="muted" style="font-size:12px;margin:6px 2px">Saltados: '+skip.length+'.</div>';
    if(sst.can_suggest && !upl.length){
      shb+='<button class="btn" onclick="suggestShorts()">🤖 Sugerir shorts del último video</button>'
        +'<div class="muted" style="font-size:11px;margin-top:4px">La IA analiza el último video: cuántos shorts, de qué momentos y qué tan largos.</div>';
    } else if((sst.all_done || uplSched.length) && !uplShow.length){
      shb+='<div class="card muted">✓ Los shorts de este video ya están hechos'+(uplSched.length?' y programados':'')+'. Cuando publiques uno nuevo, aquí podrás sugerir los suyos.</div>';
    }
    if(!shb) shb='<div class="card muted">Aún no hay shorts. Publica un video y dale a Sugerir.</div>';

    el("s-producir").innerHTML=
      pendingThumbsHtml()
      +flowStepsHtml()
      +productionHtml()
      +nextStepHtml()
      +matrixHtml()
      +learningsHtml()
      +craftHtml()
      +(next
        ? '<h2>Siguiente video</h2><div class="card"><div style="font-weight:800;font-size:16px">#'+(next.n||"")+' · '+esc(next.topic||"")+'</div>'
          +'<div class="muted" style="margin:6px 0 12px">'+esc(next.why||"")+' · '+esc(next.target_date||"")+'</div>'
          +(producing
            ? '<div style="text-align:center;font-weight:700;color:var(--cy);padding:10px;background:rgba(34,211,238,.12);border-radius:12px">⏳ Produciendo… mira "En proceso ahora"</div>'
            : '<button class="btn" onclick="produceVideo('+(next.n||0)+')">▶️ Producir este video</button>')
          +'<button class="btn ghost" onclick="showTrends()">🔥 Analizar tendencias (¿alineado?)</button></div>'
        : '<div class="card muted">🎉 Todo lo programado ya se produjo. Pídeme por el chat más temas cuando quieras.</div>')
      +'<div id="trendsOut"></div>'
      +'<h2>En cola (próximos temas)</h2><div class="card"><table><tr><th>#</th><th>Tema</th><th style="text-align:right">Fecha</th></tr>'+(prows||'<tr><td colspan="3" class="muted">No hay más temas en cola por ahora.</td></tr>')+'</table></div>'
      +'<div class="card muted">Cadencia objetivo: '+esc((ST.cadence&&ST.cadence.goal)||"1 video cada 2 días")+'.</div>'
      +'<h2 id="shortsAnchor">✂️ Shorts</h2>'
      +shb;

    // ===== AGENDA =====
    el("s-agenda").innerHTML = calendarHtml()+scheduledHtml()+bestTimesHtml();

    // ===== ANALITICA ===== canal completo + analisis + fabrica + tus videos.
    var tree=ST.video_tree||[], ung=ST.video_tree_ungrouped||[];
    var aok=ST.analytics_ok, gV=0, gW=0, rowsHtml="", li=0;
    function vcell(v,isPub){ return '<td style="text-align:right">'+(isPub?num(v.views):"🔒")+'</td>'
      +'<td style="text-align:right">'+(aok?num(v.watch_min||0):"—")+'</td>'; }
    function man(v){ return v.manual?' <span style="color:var(--am);font-size:10px;white-space:nowrap">✋ manual</span>':''; }
    function link(v){ return (v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").slice(0,30))+'</a>':esc(v.title||""))+man(v); }
    tree.forEach(function(l){ li++;
      var pv=l.privacy==="public"; gV+=l.views||0; gW+=l.watch_min||0;
      rowsHtml+='<tr style="font-weight:700;border-top:1px solid rgba(255,255,255,.10)"><td>📹 <span class="muted" style="font-weight:400">#'+li+'</span> '+link(l)+'</td>'+vcell(l,pv)+'</tr>';
      (l.shorts||[]).forEach(function(s){ var sp=s.privacy==="public"; gV+=s.views||0; gW+=s.watch_min||0;
        rowsHtml+='<tr><td style="padding-left:24px">↳ 🎬 '+link(s)+'</td>'+vcell(s,sp)+'</tr>';
      });
    });
    if(ung.length){
      rowsHtml+='<tr style="font-weight:700;border-top:1px solid rgba(255,255,255,.10)"><td>🎬 Shorts sueltos</td><td></td><td></td></tr>';
      ung.forEach(function(s){ var sp=s.privacy==="public"; gV+=s.views||0; gW+=s.watch_min||0;
        rowsHtml+='<tr><td style="padding-left:24px">↳ '+link(s)+'</td>'+vcell(s,sp)+'</tr>';
      });
    }
    var totalRow='<tr style="font-weight:900;border-top:2px solid rgba(255,255,255,.28)"><td>Total</td><td style="text-align:right">'+num(gV)+'</td><td style="text-align:right">'+(aok?num(gW):"—")+'</td></tr>';
    var videosCard='<h2>Tus videos</h2>'
      +'<div class="card" style="padding:8px"><table style="font-size:13px;width:100%"><tr><th style="text-align:left">Video</th><th style="text-align:right">Vistas</th><th style="text-align:right">Min. vistos</th></tr>'
      +(rowsHtml||'<tr><td colspan="3" class="muted">Aún no hay videos.</td></tr>')+(rowsHtml?totalRow:'')+'</table></div>'
      +(aok?'':'<div class="muted" style="font-size:11px">⚠️ Los "min vistos" necesitan el permiso de YouTube Analytics (reautoriza el OAuth con el scope yt-analytics).</div>')
      +'<button class="btn" onclick="showInsights()">🧠 Analizar qué replicar (IA)</button>'
      +'<div id="insightsOut">'+lastInsights+'</div>'
      +'<div class="muted" style="font-size:11px;text-align:center">📹 largo · ↳🎬 sus shorts · 🔒 privado</div>';
    el("s-analitica").innerHTML=
      analyticsHtml()
      +dataLensTopHtml()
      +analysisHtml()
      +factoryHtml()
      +monetizationHtml();

    // ===== MAS ===== crear contenido + sistema (voz, herramientas, problemas, errores, almacenamiento).
    el("s-mas").innerHTML=
      '<h2>Crear contenido</h2>'
      +'<div class="card">'
      +'<label class="file" for="fPhoto">🖼️ Elegir foto para retocar</label><input id="fPhoto" type="file" accept="image/*" class="hide">'
      +'<input id="pPrompt" type="text" placeholder="Opcional: qué cambiar (ej: fondo blanco, más luz)"></div>'
      +'<div class="card">'
      +'<label class="file" for="fRecipe">🍳 Elegir fotos/videos de la receta</label><input id="fRecipe" type="file" accept="image/*,video/*" multiple class="hide">'
      +'<div id="recCount" class="muted"></div>'
      +'<textarea id="rText" placeholder="Texto de la receta (ingredientes y pasos)"></textarea>'
      +'<button class="btn" onclick="buildRecipe()">🍳 Armar el reel</button></div>'
      +'<div class="card"><label class="file" for="fVoice">🎤 Subir nota de voz</label><input id="fVoice" type="file" accept="audio/*" class="hide">'
      +'<input id="vName" type="text" placeholder="Nombre de la voz (ej: esposa)"></div>'
      +voicePickerHtml()
      +toolsHealthHtml()
      +problemsHtml()
      +errorLearnHtml()
      +r2Html()
      +'<button class="btn ghost" onclick="dispatch(\\'channel_report.yml\\',\\'Reporte + análisis\\')">🔄 Refrescar métricas + análisis</button>';

    el("fPhoto").onchange=function(e){uploadPhoto(e.target.files[0]);};
    el("fRecipe").onchange=function(e){recFiles=Array.prototype.slice.call(e.target.files);el("recCount").textContent=recFiles.length+" archivo(s) elegido(s).";};
    el("fVoice").onchange=function(e){uploadVoice(e.target.files[0]);};
  }

  var recFiles=[];
  function dispatch(workflow, label){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:workflow})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ "+label+" — en marcha, mira ⚡ arriba el progreso"):("❌ "+(j.error||"no pude")));if(j.ok)setTimeout(load,3000);})
      .catch(function(){toast("❌ Error de red");});
  }
  function retry(wf){
    // produce_video se reintenta produciendo el próximo tema (necesita topic).
    if(wf==="produce_video.yml"){ var u=(ST.upcoming||[])[0]; if(u){produceVideo(u.n);return;} toast("Abre 'Siguiente video' para producir."); return; }
    // El resto se reintenta directo. (set_privacy ya es inofensivo sin inputs: default vacío + guarda.)
    if(!wf){ toast("❌ No sé qué workflow reintentar."); return; }
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:wf})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Reintentando… mira ⚡ arriba":"❌ "+(j.error||"no pude"));setTimeout(load,2000);})
      .catch(function(){toast("❌ Error de red");});
  }
  function produceVideo(n){
    var u=(ST.upcoming||[]).find(function(x){return x.n===n;})||{};
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"produce_video.yml",inputs:{topic:u.topic||"",n:String(n)}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ Produciendo el video #"+n+" — te aviso al chat"):("❌ "+(j.error||"no pude")));setTimeout(load,1500);});
  }
  function showTrends(){
    var o=el("trendsOut"); o.innerHTML='<div class="card muted">🔎 Analizando tendencias…</div>';
    api("/api/trends").then(function(r){return r.json();}).then(function(j){
      o.innerHTML='<h2>🔥 Tendencias — ¿alineado?</h2><div class="card">'+esc(j.analysis||j.error||"sin datos").replace(/\\n/g,"<br>")+'</div>';
    }).catch(function(){o.innerHTML='<div class="card muted">No pude analizar tendencias.</div>';});
  }
  function showInsights(){
    var o=el("insightsOut"); o.innerHTML='<div class="card muted">🧠 Analizando qué videos rinden más y qué replicar…</div>';
    api("/api/insights").then(function(r){return r.json();}).then(function(j){
      lastInsights='<h2>🧠 Qué replicar</h2><div class="card">'+esc(j.analysis||j.error||"sin datos").replace(/\\n/g,"<br>")+'</div>';
      var e=el("insightsOut"); if(e) e.innerHTML=lastInsights;
    }).catch(function(){var e=el("insightsOut"); if(e) e.innerHTML='<div class="card muted">No pude analizar.</div>';});
  }
  function regenSeo(){
    var notes=(el("seoNotes")&&el("seoNotes").value)||"";
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"seo_regen.yml",inputs:{notes:notes}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Regenerando el SEO — te muestro el nuevo aquí y en el chat":"❌ "+(j.error||"no pude"));setTimeout(load,2500);});
  }
  function approveRender(){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"publish_youtube.yml"})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Aprobado. Subiendo y preparando el SEO…":"❌ "+(j.error||"no pude"));setTimeout(load,2500);});
  }
  function regenRender(){
    var go=function(){ api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"render_phased.yml"})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Regenerando el video…":"❌ "+(j.error||"no pude"));setTimeout(load,2500);}); };
    if(tg&&tg.showConfirm){ tg.showConfirm("¿Regenerar el video (vuelve a renderizar)?",function(ok){if(ok)go();}); } else if(confirm("¿Regenerar el video?")){ go(); }
  }
  function approveSeo(){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/approve",{method:"POST"}).then(function(r){return r.json();}).then(function(j){
      var msg="❌ no pude";
      if(j.ok && j.scheduled) msg="✅ Aprobado y agendado"+(j.publish_at?" · "+fmtSlot(j.publish_at):"")+". Míralo en 📅 Agenda.";
      else if(j.ok) msg="✅ Aprobado. No encontré hora libre — usa 📅 Programar. ("+(j.schedule_error||"")+")";
      toast(msg);setTimeout(load,900);
    });
  }
  function publishVideo(){
    var p=ST.production||{}; if(!p.video_id){toast("Aún no hay video subido");return;}
    var go=function(){ api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:p.video_id,privacy:"public"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🌍 Publicando el video como público. Cuando quieras, ve a Shorts y dale Sugerir.":"❌ "+(j.error||"no pude"));setTimeout(load,1800);}); };
    if(tg&&tg.showConfirm){ tg.showConfirm("¿Publicar el video como PÚBLICO AHORA (sin esperar la mejor hora)?",function(ok){if(ok)go();}); }
    else if(confirm("¿Publicar el video como PÚBLICO ahora?")){ go(); }
  }
  function scheduleVideo(){
    var p=ST.production||{}; if(!p.video_id){toast("Aún no hay video subido");return;}
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/schedule",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({})})
      .then(function(r){return r.json();}).then(function(j){
        if(j.ok){ toast("📅 Programado para "+fmtSlot(j.publish_at)); setTimeout(load,1800); }
        else toast("❌ "+(j.error||"no pude programar"));
      }).catch(function(){toast("❌ Error de red");});
  }
  function scheduleShort(id){
    if(!id){toast("Sin short");return;}
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/schedule",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:id})})
      .then(function(r){return r.json();}).then(function(j){
        if(j.ok){ toast("📅 Short programado para "+fmtSlot(j.publish_at)); setTimeout(load,1800); }
        else toast("❌ "+(j.error||"no pude programar"));
      }).catch(function(){toast("❌ Error de red");});
  }
  function shortApprove(n, ok){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/short",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({n:n,action:ok?"approve":"skip"})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?(ok?"✅ Short aprobado":"❌ Short saltado"):"❌ no pude");setTimeout(load,500);});
  }
  function produceOddly(niche,kind,variant){
    kind=kind||"video"; variant=variant||"puro";
    var fmt=(kind==="short")?"9:16":"16:9";
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"produce_oddly.yml",inputs:{niche:niche||"satisfying",variant:variant,kind:kind,format:fmt,publish:"no"}})})
      .then(function(r){return r.json();}).then(function(j){
        var pieza=(kind==="short")?"Short 📱":"video";
        var voz=(variant==="puro")?"sin voz":"con voz";
        toast(j.ok?("🏭 Produciendo "+pieza+" ASMR ("+voz+")… "+(kind==="short"?"~8":"~15")+" min, te aviso al chat"):("❌ "+(j.error||"no pude")));
        setTimeout(load,3000);})
      .catch(function(){toast("❌ Error de red");});
  }
  function oddlyPublish(vid,mode){
    if(!vid){toast("sin video");return;}
    mode=mode||"schedule";
    var go=function(){
      if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
      api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"publish_oddly.yml",inputs:{video_id:vid,mode:mode}})})
      .then(function(r){return r.json();}).then(function(j){
        if(j.ok){ localSched[vid]=mode; render(); toast(mode==="public"?"🌍 Publicando en Oddly Loop… te aviso al chat":"📅 Programado a la mejor hora ✓ te aviso al chat"); setTimeout(load,4000); }
        else toast("❌ "+(j.error||"no pude"));
      }).catch(function(){toast("❌ Error de red");}); };
    if(mode==="public"&&tg&&tg.showConfirm){ tg.showConfirm("¿Publicar este video de Oddly Loop AHORA (público)?",function(ok){if(ok)go();}); } else go();
  }
  function goShorts(){ tab("producir"); var e=el("shortsAnchor"); if(e) e.scrollIntoView({behavior:"smooth",block:"start"}); }
  function runShortsPlan(notes){
    var vid=(ST.shorts_status&&ST.shorts_status.latest_video_id)||"";
    var inputs={}; if(vid)inputs.video_id=vid; if(notes)inputs.notes=notes;
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"shorts_plan.yml",inputs:inputs})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🤖 Analizando el video para (re)sugerir shorts…":"❌ "+(j.error||"no pude"));setTimeout(load,2500);});
  }
  function suggestShorts(){ runShortsPlan(""); }
  function regenShorts(){ runShortsPlan((el("shNotes")&&el("shNotes").value)||""); }
  function publishRow(vid){
    var go=function(){ api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:vid,privacy:"public"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🌍 Publicando el video…":"❌ "+(j.error||"no pude"));setTimeout(load,1800);}); };
    if(tg&&tg.showConfirm){ tg.showConfirm("¿Publicar este video como PÚBLICO?",function(ok){if(ok)go();}); } else if(confirm("¿Publicar público?")){ go(); }
  }
  function thumbRow(vid){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"thumbnail_only.yml",inputs:{video_id:vid,mode:"generate"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🖼️ Generando la miniatura — en un momento la ves aquí para aprobar":"❌ "+(j.error||"no pude"));setTimeout(load,4000);});
  }
  function thumbApprove(vid){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/thumb-approve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({video_id:vid})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Aprobada. Ahora dale 🌍 Publicar.":"❌ no pude");setTimeout(load,500);});
  }
  function thumbPublish(vid){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"thumbnail_only.yml",inputs:{video_id:vid,mode:"apply"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🌍 Publicando la miniatura en YouTube…":"❌ "+(j.error||"no pude"));setTimeout(load,3000);});
  }
  function pickVoice(id){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/voice",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:id})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ Voz del canal: "+j.label):"❌ no pude");setTimeout(load,600);});
  }
  function pubShort(id){
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:id,privacy:"public"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Publicando el short":"❌ no pude");setTimeout(load,1500);});
  }
  function uploadPhoto(f){ if(!f)return; var fd=new FormData(); fd.append("kind","photo"); fd.append("prompt",el("pPrompt").value||""); fd.append("file",f);
    toast("Subiendo foto…"); api("/api/upload",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Retocando la foto, te llega al chat":"❌ "+(j.error||"falló"));}); }
  function uploadVoice(f){ if(!f)return; var fd=new FormData(); fd.append("kind","voice"); fd.append("name",el("vName").value||"voz"); fd.append("file",f);
    toast("Subiendo voz…"); api("/api/upload",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Voz guardada":"❌ "+(j.error||"falló"));}); }
  function buildRecipe(){ if(!recFiles.length){toast("Elige al menos una foto/video");return;}
    var fd=new FormData(); fd.append("kind","recipe"); fd.append("text",el("rText").value||"");
    recFiles.forEach(function(f){fd.append("file",f);});
    toast("Subiendo receta…"); api("/api/upload",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Armando el reel, te llega al chat":"❌ "+(j.error||"falló"));recFiles=[];}); }

  // Auto-refresco: RAPIDO (9s) cuando algo corre = se ve en vivo; lento (25s) cuando no.
  // No refresca en "Crear" para no borrar lo que escribes.
  var refTimer=null;
  function isTyping(){ var a=document.activeElement; return a && (a.tagName==="TEXTAREA"||a.tagName==="INPUT"); }
  function scheduleRefresh(){
    clearTimeout(refTimer);
    var ms=(ST.active&&ST.active.length)?9000:25000;
    // No refrescar si estás escribiendo (no borrar comentarios/textos a medias).
    refTimer=setTimeout(function(){ if(curTab!=="mas" && !isTyping()) load(); else scheduleRefresh(); }, ms);
  }
  function load(){ api("/api/state").then(function(r){return r.json();}).then(function(j){ if(j.error){ el("hd").textContent = j.error==="no autorizado" ? "No autorizado" : ("⚠️ "+(j.detail||j.error)+" — reintentando…"); scheduleRefresh(); return; } ST=j; render(); scheduleRefresh(); }).catch(function(){el("hd").textContent="Sin conexión — reintentando…";scheduleRefresh();}); }
  load();
</script>
</body></html>`;
