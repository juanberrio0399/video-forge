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
  .nav button{flex:1;background:none;border:0;color:var(--hint);font-size:10px;padding:6px 2px;cursor:pointer}
  .nav button .ic{font-size:20px;display:block}
  .nav button.on{color:var(--cy)}
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
  <button data-t="plan"><span class="ic">🗓️</span>Plan</button>
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

  var curTab="canal";
  function tab(name){
    curTab=name;
    ["canal","videos","plan","shorts","crear"].forEach(function(t){el("s-"+t).classList.toggle("hide",t!==name);});
    document.querySelectorAll(".nav button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-t")===name);});
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
        +'<a class="btn mini ghost" href="'+esc(x.url)+'" target="_blank">Ver detalle</a></div>'
        +'<div class="muted" style="font-size:12px;margin-top:6px">Suele resolverse reintentando. Si persiste, escríbeme por el chat y lo reviso.</div></div>';
    }).join("");
  }

  function scoreColor(s){ return s>=7.5?"#34d399":(s>=6?"#f59e0b":"#f87171"); }
  function productionHtml(){
    var p=ST.production||{}, q=p.quality, seo=p.seo;
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
      h+='<div class="muted" style="font-size:11px;margin:2px 2px 0">Vista previa (cómo se vería):</div>'
        +'<div class="ytcard"><div class="ytthumb"><span class="ytbig">'+esc(seo.thumbnail_text||"THE DATA LENS")+'</span></div>'
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

    // CANAL
    el("s-canal").innerHTML =
      '<div class="card"><div class="row">'
      + '<div class="kpi"><div class="n">'+num(cs.subs)+'</div><div class="l">Subs</div></div>'
      + '<div class="kpi"><div class="n">'+num(cs.total_views)+'</div><div class="l">Vistas</div></div>'
      + '<div class="kpi"><div class="n">'+(ST.long_count||0)+'</div><div class="l">Largos</div></div>'
      + '<div class="kpi"><div class="n">'+(ST.shorts_count||0)+'</div><div class="l">Shorts</div></div>'
      + '</div></div>'
      + '<h2>Monetización (YPP)</h2><div class="card">'
      + '<div class="muted">Suscriptores '+(mon.subs||0)+' / 1000</div><div class="bar"><i style="width:'+pct(mon.subs,1000)+'%"></i></div>'
      + '<div class="muted" style="margin-top:10px">Horas '+(mon.watch_hours!=null?mon.watch_hours:"—")+' / 4000</div><div class="bar"><i style="width:'+pct(mon.watch_hours,4000)+'%"></i></div>'
      + '<div style="margin-top:12px" class="'+(mon.elegible?"":"muted")+'">'+(mon.elegible?"✅ Elegible para monetizar":"❌ Aún no elegible")+'</div>'
      + '</div>'
      + problemsHtml()
      + '<h2>⚡ En proceso ahora</h2>'+statusHtml()
      + '<div class="card"><button class="btn" onclick="dispatch(\\'channel_report.yml\\',\\'Reporte de métricas\\')">🔄 Refrescar métricas</button></div>';

    // VIDEOS
    var vrows = pub.map(function(v,idx){
      var s=v.stats||{}; var pv=v.privacy==="public";
      // Botón de shorts SOLO en el video más nuevo, público y sin shorts hechos.
      var shortsCell = v.shorts_done ? '<span class="muted">✓</span>'
        : ((idx===0 && pv) ? '<button class="btn mini" onclick="goShorts()">✂️ Hacer</button>' : '<span class="muted">—</span>');
      return '<tr><td>'+(v.video_id?'<a href="https://youtu.be/'+v.video_id+'" target="_blank">'+esc(v.title||v.video_id)+'</a>':esc(v.title||""))+'<div class="muted" style="font-size:11px">'+esc(v.published_at||"")+'</div></td>'
        +'<td><span class="tag '+(pv?"pub":"priv")+'">'+esc(v.privacy||"")+'</span></td>'
        +'<td style="text-align:right">'+(pv?num(s.views):"—")+'</td>'
        +'<td style="text-align:right">'+shortsCell+'</td></tr>';
    }).join("");
    el("s-videos").innerHTML='<h2>Videos publicados</h2><div class="card"><table><tr><th>Título</th><th>Estado</th><th style="text-align:right">Vistas</th><th style="text-align:right">Shorts</th></tr>'+(vrows||'<tr><td class="muted">Sin videos.</td></tr>')+'</table></div>'
      +'<button class="btn" onclick="dispatch(\\'render_phased.yml\\',\\'Render del video por fases\\')">🎬 Renderizar video</button>'
      +'<button class="btn ghost" onclick="dispatch(\\'voice_parallel.yml\\',\\'Generar voz\\')">🎙️ Generar voz</button>';

    // PLAN (panel de produccion): estado + siguiente con boton + pendientes + tendencias
    var next = up[0];
    var rest = up.slice(1);
    var producing = (ST.active||[]).some(function(r){return /Producir|guion|Render VIDEO|Voiceover/i.test(r.name||"");});
    var prows = rest.map(function(u){return '<tr><td>#'+(u.n||"")+'</td><td>'+esc(u.topic||"")+'<div class="muted" style="font-size:11px">'+esc(u.why||"")+'</div></td><td style="text-align:right;white-space:nowrap">'+esc(u.target_date||"")+'</td></tr>';}).join("");
    el("s-plan").innerHTML=
      problemsHtml()
      +'<h2>⚡ En proceso ahora</h2>'+statusHtml()
      +productionHtml()
      +(next
        ? '<h2>Siguiente video</h2><div class="card"><div style="font-weight:800;font-size:16px">#'+(next.n||"")+' · '+esc(next.topic||"")+'</div>'
          +'<div class="muted" style="margin:6px 0 12px">'+esc(next.why||"")+' · '+esc(next.target_date||"")+'</div>'
          +(producing
            ? '<div style="text-align:center;font-weight:700;color:var(--cy);padding:10px;background:rgba(34,211,238,.12);border-radius:12px">⏳ Produciendo… mira "En proceso ahora"</div>'
            : '<button class="btn" onclick="produceVideo('+(next.n||0)+')">▶️ Producir este video</button>')
          +'<button class="btn ghost" onclick="showTrends()">🔥 Analizar tendencias (¿alineado?)</button></div>'
        : '<div class="card muted">🎉 No hay videos pendientes.</div>')
      +'<div id="trendsOut"></div>'
      +'<h2>Programados (pendientes)</h2><div class="card"><table><tr><th>#</th><th>Tema</th><th style="text-align:right">Fecha</th></tr>'+(prows||'<tr><td class="muted">—</td></tr>')+'</table></div>'
      +'<div class="card muted">Cadencia objetivo: '+esc((ST.cadence&&ST.cadence.goal)||"1 video cada 2 días")+'.</div>';

    // SHORTS: aprobar → generar → publicar, todo desde la app.
    var prop = ST.shorts_proposal||[]; var sst = ST.shorts_status||{};
    var pend=prop.filter(function(s){return s.state==="pending";});
    var appr=prop.filter(function(s){return s.state==="approved";});
    var upl=prop.filter(function(s){return s.state==="uploaded";});
    var skip=prop.filter(function(s){return s.state==="skipped";});
    var sh="";
    if(pend.length){
      sh+='<h2>🤖 Sugerencias por aprobar ('+pend.length+')</h2>';
      sh+=pend.map(function(s){
        return '<div class="card"><div style="font-weight:700">'+esc(s.title)+(s.dur?' · '+s.dur+'s':'')+'</div>'
          +(s.hook?'<div class="muted" style="font-size:12px;margin:3px 0">🪝 '+esc(s.hook)+'</div>':'')
          +(s.caption?'<div style="font-size:13px;margin:3px 0">'+esc(s.caption)+'</div>':'')
          +((s.hashtags&&s.hashtags.length)?'<div class="muted" style="font-size:11px">'+esc(s.hashtags.join(" "))+'</div>':'')
          +'<div style="margin-top:8px"><button class="btn mini" onclick="shortApprove('+s.n+',1)">✅ Aprobar</button> '
          +'<button class="btn mini ghost" onclick="shortApprove('+s.n+',0)">❌ Saltar</button></div></div>';
      }).join("");
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
      '<h2>Editar foto</h2><div class="card">'
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
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?("✅ "+label+" — en marcha"):("❌ "+(j.error||"no pude")));})
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
  function regenSeo(){
    var notes=(el("seoNotes")&&el("seoNotes").value)||"";
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("light");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"seo_regen.yml",inputs:{notes:notes}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🔁 Regenerando el SEO — te muestro el nuevo aquí y en el chat":"❌ "+(j.error||"no pude"));setTimeout(load,2500);});
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
  function suggestShorts(){
    var vid=(ST.shorts_status&&ST.shorts_status.latest_video_id)||"";
    if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred("medium");
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"shorts_plan.yml",inputs:vid?{video_id:vid}:{}})})
      .then(function(r){return r.json();}).then(function(j){toast(j.ok?"🤖 Analizando el último video para sugerir shorts…":"❌ "+(j.error||"no pude"));setTimeout(load,2500);});
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
