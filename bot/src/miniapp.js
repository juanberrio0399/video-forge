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
<header><h1>The Data Lens</h1><div class="sub" id="hd">Centro de control</div></header>
<div class="wrap">
  <div id="tabHelp" class="muted" style="font-size:12px;margin:2px 2px 8px"></div>
  <div id="globalStatus"></div>
  <div id="s-canal"></div>
  <div id="s-videos" class="hide"></div>
  <div id="s-plan" class="hide"></div>
  <div id="s-shorts" class="hide"></div>
  <div id="s-crear" class="hide"></div>
</div>
<div id="toast"></div>
<div class="nav">
  <button data-t="canal" class="on"><span class="ic">📊</span>Canal</button>
  <button data-t="videos"><span class="ic">🎬</span>Videos</button>
  <button data-t="plan"><span class="ic">🧭</span>Control</button>
  <button data-t="shorts"><span class="ic">✂️</span>Shorts</button>
  <button data-t="crear"><span class="ic">✨</span>Crear</button>
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

  var curTab="canal";
  var vSort="views";
  var lastInsights="";
  var TABHELP={
    canal:"📊 Tu canal de un vistazo: seguidores, vistas y analytics — en vivo.",
    videos:"🎥 Todos tus videos y shorts, con vistas y minutos vistos. Ordénalos y pide análisis.",
    plan:"🧭 El centro de control: en qué paso va la producción y qué le falta a cada video.",
    shorts:"✂️ Sugerir, aprobar y publicar shorts de tu último video.",
    crear:"➕ Subir una foto para retocar, una receta o una nota de voz."
  };
  function setHelp(t){ var e=el("tabHelp"); if(e) e.textContent=TABHELP[t]||""; }
  function setVSort(s){ vSort=s; render(); }
  function tab(name){
    curTab=name;
    ["canal","videos","plan","shorts","crear"].forEach(function(t){el("s-"+t).classList.toggle("hide",t!==name);});
    document.querySelectorAll(".nav button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-t")===name);});
    setHelp(name);
  }
  document.querySelectorAll(".nav button").forEach(function(b){b.onclick=function(){tab(b.getAttribute("data-t"));};});

  function pct(a,b){return Math.min(100,Math.round((( +a||0)/(b||1))*100));}
  function statusHtml(){
    var a=ST.active||[];
    if(!a.length) return '<div class="card muted">✅ Nada en proceso ahora.</div>';
    return a.map(function(r){
      return '<div class="card"><div style="font-weight:700"><span class="live"></span> '+esc(r.name)+'</div>'
        +'<div class="muted" style="font-size:12px;margin:4px 0">'+esc(r.step||r.status)+(r.eta?' · ~'+r.eta+' min':'')+'</div>'
        +'<div class="bar"><i style="width:'+(r.pct||3)+'%"></i></div></div>';
    }).join("");
  }
  function problemsHtml(){
    var p=ST.problems||[];
    if(!p.length) return "";
    return '<h2>⚠️ Problemas</h2>'+p.map(function(x){
      return '<div class="card" style="border:1px solid rgba(245,158,11,.45)">'
        +'<div style="font-weight:700;color:var(--am)">⚠️ '+esc(x.name)+'</div>'
        +'<div class="muted" style="margin:4px 0">Falló en: '+esc(x.step||"?")+'</div>'
        +'<div><button class="btn mini" onclick="retry(\\''+esc(x.workflow)+'\\')">🔁 Reintentar</button> '
        +'<button class="btn mini ghost" onclick="showError('+(x.run_id||0)+')">📋 Ver el error</button></div>'
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
    // Video ya publicado → el siguiente paso son los shorts.
    if(sst.pending) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Siguiente: aprobar shorts</div><div class="muted" style="font-size:12px;margin:4px 0">Hay '+sst.pending+' short(s) sugerido(s) esperando tu aprobación.</div><button class="btn" onclick="goShorts()">Ver shorts para aprobar</button></div>';
    if(sst.approved_pend) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Siguiente: generar shorts</div><div class="muted" style="font-size:12px;margin:4px 0">'+sst.approved_pend+' aprobado(s), listos para generar.</div><button class="btn" onclick="goShorts()">Ir a Shorts</button></div>';
    if(sst.uploaded && !sst.all_done) return '<div class="card"><button class="btn" onclick="goShorts()">🎬 Ver / publicar shorts</button></div>';
    if(sst.can_suggest) return '<div class="card" style="border:1px solid var(--cy)"><div style="font-weight:700">🎬 Siguiente: sugerir shorts</div><div class="muted" style="font-size:12px;margin:4px 0">El video quedó publicado. Ahora sus shorts.</div><button class="btn" onclick="goShorts()">Ir a Shorts</button></div>';
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
      return h+'<div class="card muted">Analytics ya está autorizado ✅. YouTube tarda ~1-2 días en procesar el primer dato; en cuanto llegue, aquí verás vistas, minutos vistos y crecimiento en vivo.</div>';
    }
    var l=(a&&a.last28)||{views:0,minutes:0,subs_gained:0,avg_sec:0};
    h+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:8px">Últimos 28 días</div><div class="row">'
      +'<div class="kpi"><div class="n">'+num(l.views)+'</div><div class="l">Vistas</div></div>'
      +'<div class="kpi"><div class="n">'+num(l.minutes)+'</div><div class="l">Min vistos</div></div>'
      +'<div class="kpi"><div class="n">'+(l.subs_gained>=0?"+":"")+num(l.subs_gained)+'</div><div class="l">Subs</div></div>'
      +'<div class="kpi"><div class="n">'+durTxt(l.avg_sec)+'</div><div class="l">Dur. media</div></div>'
      +'</div>';
    var daily=(a&&a.daily)||[];
    if(daily.length){
      var mx=Math.max.apply(null, daily.map(function(x){return x.views;}).concat([1]));
      var bars=daily.slice(-21).map(function(x){
        var hh=Math.max(2, Math.round((x.views/mx)*44));
        return '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end"><div style="height:'+hh+'px;background:var(--cy);border-radius:2px"></div></div>';
      }).join("");
      h+='<div style="margin-top:12px"><div class="muted" style="font-size:11px;margin-bottom:4px">Vistas por día (últimos 21)</div><div style="display:flex;gap:2px;align-items:flex-end;height:48px">'+bars+'</div></div>';
    }
    h+='</div>';
    h+='<div class="card muted" style="font-size:11px">Tiempo reproducido total del canal: '+num(tot.watch_min||0)+' min · Los datos de YouTube Analytics tienen ~1-2 días de retraso.</div>';
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
    // Solo videos producidos con ALGO pendiente; los que ya tienen todo ✓ no salen.
    var vm=(ST.video_matrix||[]).filter(function(v){var s=v.stages||{};return !(s.publicado && s.miniatura && s.shorts);});
    if(!(ST.video_matrix||[]).length) return "";
    if(!vm.length) return '<h2>📋 Control por video</h2><div class="card muted">✅ Todos los videos están al día: publicados, con miniatura y shorts.</div>';
    var head='<tr><th style="text-align:left">Video</th><th>🌍 Público</th><th>🖼️ Miniatura</th><th>🎬 Shorts</th></tr>';
    var rows=vm.map(function(v){
      var s=v.stages||{}, vid=v.video_id;
      function cell(key,act){
        if(s[key]) return '<td style="text-align:center;color:#34d399;font-size:16px">✓</td>';
        return '<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="'+act+'">＋ Hacer</span></td>';
      }
      // Miniatura: solo ESTADO en la tabla; la imagen grande y el botón salen ARRIBA.
      var miniCell;
      if(s.miniatura){
        miniCell='<td style="text-align:center"><span style="color:#34d399;font-size:15px">✓</span> <span style="cursor:pointer;color:var(--hint)" onclick="thumbRow(\\''+vid+'\\')">🔁</span></td>';
      } else if(v.thumb_url){
        miniCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--am);font-size:11px;font-weight:700" onclick="window.scrollTo(0,0)">⏳ aprobar ↑</span></td>';
      } else {
        miniCell='<td style="text-align:center"><span style="cursor:pointer;color:var(--cy);font-weight:800" onclick="thumbRow(\\''+vid+'\\')">＋ Hacer</span></td>';
      }
      return '<tr><td>'+(vid?'<a href="https://youtu.be/'+vid+'" target="_blank">'+esc((v.title||"").slice(0,20))+'</a>':esc((v.title||"").slice(0,20)))+'</td>'
        +cell("publicado","publishRow(\\'"+vid+"\\')")
        +miniCell
        +cell("shorts","goShorts()")
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
      var hr='<h2>🎬 Video listo — revísalo y aprueba</h2>';
      if(p.watch_url) hr+='<a class="btn" href="'+esc(location.origin+p.watch_url)+'" target="_blank">▶️ Ver el video</a>';
      hr+='<div class="card"><div style="display:flex;align-items:center;gap:12px">'
        +'<div class="score" style="color:'+scoreColor(ms)+'">'+ms+'<span style="font-size:13px;color:var(--hint)">/10</span></div>'
        +'<div><div style="font-weight:700">Calificación IA del video</div><div class="muted" style="font-size:12px">'+(q2.passed?"✅ Pasó el mínimo (7.5)":"⚠️ Bajo 7.5 — puedes regenerar")+'</div></div></div></div>';
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
        h+='<div style="text-align:center;font-weight:700;color:var(--gr);padding:8px;margin:8px 0;background:rgba(52,211,153,.12);border-radius:12px">✅ Descripción aprobada</div>'
          +'<button class="btn" onclick="publishVideo()">🌍 Publicar (hacer público)</button>'
          +'<div class="muted" style="font-size:11px;margin-top:4px">Paso 2: esto hace el video PÚBLICO en el canal.</div>';
      } else {
        h+='<button class="btn" onclick="approveSeo()">✅ Aprobar descripción</button>'
          +'<div class="muted" style="font-size:11px;margin-top:4px">Paso 1: aprobar deja el SEO listo (el video sigue privado). Después aparece Publicar.</div>';
      }
      h+='</div>';
    }
    return h;
  }

  function render(){
    var ch = ST.channel||{}, cs = ST.channel_stats||{}, mon = ST.monetization||{};
    var pub = ST.published||[], up = ST.upcoming||[], sh = (ST.shorts_list||[]);
    var liveTag = (ST.active&&ST.active.length) ? " · 🟢 en vivo" : "";
    el("hd").textContent = "@TheDataLensHQ · act. "+ (ST.updated_at? String(ST.updated_at).slice(5,16).replace("T"," "):"—") + liveTag;

    setHelp(curTab);
    // Estado GLOBAL: cualquier proceso en marcha se ve arriba, en TODAS las pestañas.
    el("globalStatus").innerHTML = (ST.active&&ST.active.length) ? ('<h2>⚡ En proceso ahora</h2>'+statusHtml()) : "";

    // CANAL
    el("s-canal").innerHTML =
      '<div class="card"><div class="row">'
      + '<div class="kpi"><div class="n">'+num(cs.subs)+'</div><div class="l">Subs</div></div>'
      + '<div class="kpi"><div class="n">'+num(cs.total_views)+'</div><div class="l">Vistas</div></div>'
      + '<div class="kpi"><div class="n">'+(ST.long_count||0)+'</div><div class="l">Largos</div></div>'
      + '<div class="kpi"><div class="n">'+(ST.shorts_count||0)+'</div><div class="l">Shorts</div></div>'
      + '</div></div>'
      + analyticsHtml()
      + '<h2>Monetización (YPP)</h2><div class="card">'
      + '<div class="muted">Suscriptores '+(mon.subs||0)+' / 1000</div><div class="bar"><i style="width:'+pct(mon.subs,1000)+'%"></i></div>'
      + '<div class="muted" style="margin-top:10px">Horas '+(mon.watch_hours!=null?mon.watch_hours:"—")+' / 4000</div><div class="bar"><i style="width:'+pct(mon.watch_hours,4000)+'%"></i></div>'
      + '<div style="margin-top:12px" class="'+(mon.elegible?"":"muted")+'">'+(mon.elegible?"✅ Elegible para monetizar":"❌ Aún no elegible")+'</div>'
      + '</div>'
      + r2Html()
      + problemsHtml()
      + '<button class="btn ghost" onclick="dispatch(\\'channel_report.yml\\',\\'Reporte de métricas\\')">🔄 Refrescar métricas</button>';

    // VIDEOS: tabla compacta con TODOS (largos+shorts), tipo, vistas y MINUTOS VISTOS + total + IA.
    var av=(ST.all_videos||[]).slice();
    var tot=ST.totals||{views:0,watch_min:0};
    var nLong=av.filter(function(v){return v.type==="long";}).length;
    var nShort=av.filter(function(v){return v.type==="short";}).length;
    av.sort(function(a,b){ return vSort==="watch" ? (b.watch_min||0)-(a.watch_min||0) : (b.views||0)-(a.views||0); });
    var vrows=av.map(function(v){
      var pv=v.privacy==="public";
      return '<tr><td style="text-align:center">'+(v.type==="short"?"🎬":"📹")+'</td>'
        +'<td>'+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc((v.title||"").replace(/ #Shorts$/,"").slice(0,38))+'</a>':esc(v.title||""))+'</td>'
        +'<td style="text-align:right">'+(pv?num(v.views):"🔒")+'</td>'
        +'<td style="text-align:right">'+(ST.analytics_ok?num(v.watch_min||0):"—")+'</td></tr>';
    }).join("");
    var totalRow='<tr style="font-weight:800;border-top:2px solid rgba(255,255,255,.2)"><td></td><td>TOTAL ('+av.length+')</td><td style="text-align:right">'+num(tot.views)+'</td><td style="text-align:right">'+(ST.analytics_ok?num(tot.watch_min):"—")+'</td></tr>';
    el("s-videos").innerHTML='<h2>Videos · '+nLong+' largos · '+nShort+' shorts</h2>'
      +'<div style="display:flex;gap:6px;margin:4px 0"><span class="chip'+(vSort==="views"?" on":"")+'" onclick="setVSort(\\'views\\')">Por vistas</span><span class="chip'+(vSort==="watch"?" on":"")+'" onclick="setVSort(\\'watch\\')">Por min vistos</span></div>'
      +'<div class="card" style="padding:8px"><table style="font-size:13px"><tr><th></th><th>Título</th><th style="text-align:right">Vistas</th><th style="text-align:right">Min vist.</th></tr>'+(vrows||'<tr><td colspan="4" class="muted">Aún no hay videos. Ve a <b>Control</b> y dale ▶️ Producir para crear el primero.</td></tr>')+(vrows?totalRow:'')+'</table></div>'
      +(ST.analytics_ok?'':'<div class="muted" style="font-size:11px">⚠️ Los "min vistos" necesitan el permiso de YouTube Analytics. Reautoriza el OAuth con el scope yt-analytics para verlos.</div>')
      +'<button class="btn" onclick="showInsights()">🧠 Analizar qué replicar (IA)</button>'
      +'<div id="insightsOut">'+lastInsights+'</div>'
      +'<div class="muted" style="font-size:11px;text-align:center">📹 largo · 🎬 short · 🔒 privado</div>';

    // PLAN (panel de produccion): estado + siguiente con boton + pendientes + tendencias
    var next = up[0];
    var rest = up.slice(1);
    var producing = (ST.active||[]).some(function(r){return /Producir|guion|Render VIDEO|Voiceover/i.test(r.name||"");});
    var prows = rest.map(function(u){return '<tr><td>#'+(u.n||"")+'</td><td>'+esc(u.topic||"")+'<div class="muted" style="font-size:11px">'+esc(u.why||"")+'</div></td><td style="text-align:right;white-space:nowrap">'+esc(u.target_date||"")+'</td></tr>';}).join("");
    el("s-plan").innerHTML=
      pendingThumbsHtml()
      +flowStepsHtml()
      +productionHtml()
      +nextStepHtml()
      +matrixHtml()
      +problemsHtml()
      +(next
        ? '<h2>Siguiente video</h2><div class="card"><div style="font-weight:800;font-size:16px">#'+(next.n||"")+' · '+esc(next.topic||"")+'</div>'
          +'<div class="muted" style="margin:6px 0 12px">'+esc(next.why||"")+' · '+esc(next.target_date||"")+'</div>'
          +(producing
            ? '<div style="text-align:center;font-weight:700;color:var(--cy);padding:10px;background:rgba(34,211,238,.12);border-radius:12px">⏳ Produciendo… mira "En proceso ahora"</div>'
            : '<button class="btn" onclick="produceVideo('+(next.n||0)+')">▶️ Producir este video</button>')
          +'<button class="btn ghost" onclick="showTrends()">🔥 Analizar tendencias (¿alineado?)</button></div>'
        : '<div class="card muted">🎉 Todo lo programado ya se produjo. Pídeme por el chat más temas cuando quieras.</div>')
      +'<div id="trendsOut"></div>'
      +'<h2>Programados (pendientes)</h2><div class="card"><table><tr><th>#</th><th>Tema</th><th style="text-align:right">Fecha</th></tr>'+(prows||'<tr><td colspan="3" class="muted">No hay más temas en cola por ahora.</td></tr>')+'</table></div>'
      +'<div class="card muted">Cadencia objetivo: '+esc((ST.cadence&&ST.cadence.goal)||"1 video cada 2 días")+'.</div>';

    // SHORTS: aprobar → generar → publicar, todo desde la app.
    var prop = ST.shorts_proposal||[]; var sst = ST.shorts_status||{};
    var pend=prop.filter(function(s){return s.state==="pending";});
    var appr=prop.filter(function(s){return s.state==="approved";});
    var upl=prop.filter(function(s){return s.state==="uploaded";});
    var skip=prop.filter(function(s){return s.state==="skipped";});
    var sh="";
    var vid=sst.latest_video_id;
    if(pend.length){
      sh+='<h2>🤖 Sugerencias por aprobar ('+pend.length+')</h2>';
      sh+=pend.map(function(s){
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
      // Rehacer las sugerencias con comentarios (como el SEO).
      sh+='<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">¿No te convencen? Deja un comentario y la IA las rehace:</div>'
        +'<textarea id="shNotes" placeholder="Ej: shorts más cortos, que empiecen con la cifra, usa el momento del minuto 3"></textarea>'
        +'<button class="btn ghost" onclick="regenShorts()">🔁 Regenerar sugerencias con mis comentarios</button></div>';
    }
    if(appr.length){
      sh+='<h2>✅ Aprobados ('+appr.length+') — listos para generar</h2><div class="card">'
        +appr.map(function(s){return '<div style="margin:2px 0">• '+esc(s.title)+'</div>';}).join("")
        +'<button class="btn" onclick="dispatch(\\'shorts_final.yml\\',\\'Generar los shorts aprobados\\')">🎬 Generar los aprobados</button></div>';
    }
    if(upl.length){
      sh+='<h2>🎬 Shorts hechos</h2><div class="card"><table><tr><th>Short</th><th>Estado</th><th style="text-align:right">Vistas</th></tr>'
        +upl.map(function(s){var pv=s.privacy==="public";
          return '<tr><td>'+(s.video_id?'<a href="https://youtu.be/'+s.video_id+'" target="_blank">'+esc(s.title)+'</a>':esc(s.title))+'</td>'
          +'<td><span class="tag '+(pv?"pub":"priv")+'">'+esc(s.privacy||"?")+'</span></td>'
          +'<td style="text-align:right">'+(!pv?'<button class="btn mini" onclick="pubShort(\\''+s.video_id+'\\')">Publicar</button>':num(s.views))+'</td></tr>';
        }).join("")+'</table></div>';
    }
    if(skip.length) sh+='<div class="muted" style="font-size:12px;margin:6px 2px">Saltados: '+skip.length+'.</div>';
    if(sst.can_suggest){
      sh+='<button class="btn" onclick="suggestShorts()">🤖 Sugerir shorts del último video</button>'
        +'<div class="muted" style="font-size:11px;margin-top:4px">La IA analiza el último video: cuántos shorts, de qué momentos y qué tan largos.</div>';
    } else if(sst.all_done){
      sh+='<div class="card muted">✓ Ya hiciste los shorts de este video. Cuando publiques uno nuevo, aquí podrás sugerir los suyos.</div>';
    }
    el("s-shorts").innerHTML=sh||'<div class="card muted">Aún no hay shorts. Publica un video y dale a Sugerir.</div>';

    // CREAR
    el("s-crear").innerHTML=
      voicePickerHtml()
      +'<h2>Editar foto</h2><div class="card">'
      +'<label class="file" for="fPhoto">🖼️ Elegir foto para retocar</label><input id="fPhoto" type="file" accept="image/*" class="hide">'
      +'<input id="pPrompt" type="text" placeholder="Opcional: qué cambiar (ej: fondo blanco, más luz)"></div>'
      +'<h2>Reel de receta</h2><div class="card">'
      +'<label class="file" for="fRecipe">🍳 Elegir fotos/videos de la receta</label><input id="fRecipe" type="file" accept="image/*,video/*" multiple class="hide">'
      +'<div id="recCount" class="muted"></div>'
      +'<textarea id="rText" placeholder="Texto de la receta (ingredientes y pasos)"></textarea>'
      +'<button class="btn" onclick="buildRecipe()">🍳 Armar el reel</button></div>'
      +'<h2>Voz</h2><div class="card"><label class="file" for="fVoice">🎤 Subir nota de voz</label><input id="fVoice" type="file" accept="audio/*" class="hide">'
      +'<input id="vName" type="text" placeholder="Nombre de la voz (ej: esposa)"></div>';

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
    if(wf==="produce_video.yml"){ var u=(ST.upcoming||[])[0]; if(u){produceVideo(u.n);return;} }
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:wf})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Reintentando…":"❌ "+(j.error||"no pude"));setTimeout(load,1500);});
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
    api("/api/approve",{method:"POST"}).then(function(r){return r.json();}).then(function(j){toast(j.ok?"✅ Descripción aprobada. Ahora aparece Publicar.":"❌ no pude");setTimeout(load,600);});
  }
  function publishVideo(){
    var p=ST.production||{}; if(!p.video_id){toast("Aún no hay video subido");return;}
    var go=function(){ api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"set_privacy.yml",inputs:{video_id:p.video_id,privacy:"public"}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🌍 Publicando el video como público. Cuando quieras, ve a Shorts y dale Sugerir.":"❌ "+(j.error||"no pude"));setTimeout(load,1800);}); };
    if(tg&&tg.showConfirm){ tg.showConfirm("¿Publicar el video como PÚBLICO en el canal?",function(ok){if(ok)go();}); }
    else if(confirm("¿Publicar el video como PÚBLICO en el canal?")){ go(); }
  }
  function shortApprove(n, ok){
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/short",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({n:n,action:ok?"approve":"skip"})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?(ok?"✅ Short aprobado":"❌ Short saltado"):"❌ no pude");setTimeout(load,500);});
  }
  function goShorts(){ tab("shorts"); }
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
    refTimer=setTimeout(function(){ if(curTab!=="crear" && !isTyping()) load(); else scheduleRefresh(); }, ms);
  }
  function load(){ api("/api/state").then(function(r){return r.json();}).then(function(j){ if(j.error){el("hd").textContent="No autorizado";return;} ST=j; render(); scheduleRefresh(); }).catch(function(){el("hd").textContent="Error de conexión";scheduleRefresh();}); }
  load();
</script>
</body></html>`;
