// miniapp_v2.js — Video Forge v2: el MONITOR del cerebro (Brain OS integrado), reconstruida desde cero.
// Servida en /app2 (la /app v1 no se toca hasta el cut-over). Monitor puro: NADA se aprueba aquí —
// el cerebro produce, programa y publica solo; Juan solo mira y, si acaso, despublica un dud.
// Diseño: sistema pro 2026 (dark-first sobre el tema de Telegram, identidad por canal esmeralda/oro,
// bento, hero, skeleton, sheet de detalle, MainButton nativo) + método dataviz en las gráficas.
// El JS del cliente NO usa template-literals ni onclick inline (data-* + delegación de eventos).
export const APP2_HTML = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Video Forge</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    --bg:var(--tg-theme-bg-color,#0b0f17); --card:var(--tg-theme-secondary-bg-color,#141b26);
    --txt:var(--tg-theme-text-color,#eaf1ff); --hint:var(--tg-theme-hint-color,#8aa0c0);
    --link:var(--tg-theme-link-color,#4fc3f7);
    --line:rgba(130,140,158,.20); --soft:rgba(130,140,158,.10);
    --gr:#34d399; --am:#f59e0b; --rd:#f87171;
    --acc:#22d3ee; --acc2:#38bdf8; --glow:rgba(34,211,238,.16); --accfg:#04121a;
    --r:17px; --shadow:0 12px 30px rgba(0,0,0,.30);
  }
  body[data-ch="auto2"]{--acc:#10b981;--acc2:#2dd4bf;--glow:rgba(16,185,129,.20);--accfg:#04140d}
  body[data-ch="data-lens"]{--acc:#f5b23c;--acc2:#ff8a3d;--glow:rgba(245,178,60,.18);--accfg:#1c1200}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;background:radial-gradient(120% 42% at 50% -60px,var(--glow),transparent 62%),var(--bg);color:var(--txt);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;font-size:15px;line-height:1.45;
    padding-bottom:calc(92px + env(safe-area-inset-bottom));transition:background .3s}
  header{padding:14px 14px 10px;position:sticky;top:0;background:var(--bg);z-index:6;border-bottom:1px solid var(--line)}
  .hdrow{display:flex;align-items:center;justify-content:space-between;gap:11px}
  .hd-l{display:flex;align-items:center;gap:11px;min-width:0}
  .logo{width:44px;height:44px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(140deg,var(--acc),var(--acc2));box-shadow:0 8px 20px var(--glow);transition:background .3s}
  .logo svg{width:27px;height:27px;display:block}
  h1{font-size:17px;margin:0;font-weight:800;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{color:var(--hint);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .icon{background:var(--card);border:1px solid var(--line);color:var(--txt);min-width:38px;height:38px;border-radius:12px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .12s}
  .icon:active{transform:scale(.9) rotate(-35deg)}
  .seg{display:flex;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px;gap:3px;margin-top:11px}
  .seg button{flex:1;background:none;border:0;color:var(--hint);font-size:12px;font-weight:700;padding:8px 10px;border-radius:10px;cursor:pointer;white-space:nowrap;transition:transform .08s}
  .seg button:active{transform:scale(.97)}
  .seg button.on{background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--accfg);box-shadow:0 4px 12px var(--glow)}
  .wrap{padding:0 14px}
  h2{font-size:11px;color:var(--hint);text-transform:uppercase;letter-spacing:.7px;font-weight:800;margin:18px 4px 8px;display:flex;align-items:center;gap:8px}
  h2 .cnt{background:var(--card);border:1px solid var(--line);color:var(--txt);padding:1px 8px;border-radius:999px;font-size:11px;letter-spacing:0;text-transform:none}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin:11px 0;box-shadow:var(--shadow)}
  .card.tap{cursor:pointer;transition:transform .1s}.card.tap:active{transform:scale(.985)}
  .card.hero{background:linear-gradient(150deg,var(--glow),transparent 62%),var(--card)}
  .hero-h{font-weight:850;font-size:18px;letter-spacing:-.2px}
  .big{font-size:30px;font-weight:850;letter-spacing:-.6px;line-height:1}
  .big small{font-size:13px;color:var(--hint);font-weight:600;letter-spacing:0}
  .bento{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:11px 0}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:12px 13px;box-shadow:var(--shadow);transition:transform .12s cubic-bezier(.2,.9,.3,1)}
  .stat:active{transform:scale(.97)}
  .stat .n{font-size:23px;font-weight:850;line-height:1;letter-spacing:-.5px}
  .stat .l{font-size:10.5px;color:var(--hint);margin-top:4px;text-transform:uppercase;letter-spacing:.4px;font-weight:700}
  .stat .d{font-size:11px;font-weight:700;color:var(--acc);margin-top:3px}
  .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .muted{color:var(--hint);font-size:12px}
  .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
  .bar{height:9px;background:var(--soft);border-radius:999px;overflow:hidden;margin-top:7px}
  .bar > i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:999px;box-shadow:0 0 14px var(--glow)}
  .bar > i.gr{background:var(--gr);box-shadow:none}.bar > i.am{background:var(--am);box-shadow:none}.bar > i.rd{background:var(--rd);box-shadow:none}
  .pill{display:inline-block;font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:999px;background:var(--soft);color:var(--txt);white-space:nowrap}
  .pill.acc{background:var(--soft);color:var(--acc)}.pill.gr{color:var(--gr)}.pill.am{color:var(--am)}.pill.rd{color:var(--rd)}
  .alert{border-left:3px solid var(--am);padding-left:11px}.alert.rd{border-left-color:var(--rd)}
  .btn{display:block;width:100%;background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--accfg);border:0;border-radius:14px;padding:13px;font-size:15px;font-weight:800;margin:8px 0;cursor:pointer;transition:transform .09s;box-shadow:0 8px 20px var(--glow)}
  .btn:active{transform:scale(.98)}
  .btn.ghost{background:transparent;color:var(--txt);border:1px solid var(--line);box-shadow:none}
  .btn.mini{display:inline-block;width:auto;padding:7px 13px;font-size:12px;margin:0;border-radius:11px;box-shadow:none}
  input[type=text]{width:100%;background:var(--bg);color:var(--txt);border:1px solid var(--line);border-radius:11px;padding:11px;font-size:15px;font-family:inherit}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{color:var(--hint);text-align:left;font-weight:700;padding:6px 6px;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:8px 6px;border-top:1px solid var(--line);vertical-align:top}
  .vcard{display:flex;gap:11px;padding:10px;align-items:flex-start}
  .vthumb{width:104px;flex-shrink:0;border-radius:11px;overflow:hidden;background:var(--soft);aspect-ratio:16/9}
  .vthumb img{width:100%;height:100%;object-fit:cover;display:block}
  .vmeta{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
  .vtitle{font-weight:700;font-size:13px;line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .vstatus{font-size:12px;color:var(--hint);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .nav{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--card);border-top:1px solid var(--line);padding:7px 8px calc(11px + env(safe-area-inset-bottom));z-index:7;box-shadow:0 -8px 24px rgba(0,0,0,.22)}
  .nav button{flex:1;background:none;border:0;color:var(--hint);font-size:10.5px;font-weight:700;padding:6px 2px;cursor:pointer;border-radius:13px;margin:0 2px;transition:transform .1s,color .15s}
  .nav button:active{transform:scale(.9)}
  .nav button .ic{font-size:20px;display:block;margin-bottom:2px}
  .nav button.on{color:var(--accfg);background:linear-gradient(135deg,var(--acc),var(--acc2));box-shadow:0 6px 16px var(--glow)}
  .hide{display:none}
  .fadein{animation:fadein .26s ease}
  @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .sk-l{height:13px;border-radius:8px;background:var(--soft);margin:7px 0;position:relative;overflow:hidden}
  .sk-l::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--soft),transparent);animation:shimmer 1.3s infinite}
  .sk-l.s{height:11px;width:55%}
  @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
  .live{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--acc);margin-right:4px;animation:pulse 1.4s infinite;vertical-align:middle}
  @keyframes pulse{0%{box-shadow:0 0 0 0 var(--glow)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
  #toast{position:fixed;bottom:calc(92px + env(safe-area-inset-bottom));left:14px;right:14px;background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:14px;padding:13px 16px;text-align:center;font-weight:600;transform:translateY(160%);opacity:0;transition:transform .3s cubic-bezier(.2,.9,.3,1),opacity .3s;z-index:20;box-shadow:0 14px 34px rgba(0,0,0,.4)}
  #toast.show{transform:none;opacity:1}
  /* Sheet de detalle (bottom sheet nativo) */
  #shade{position:fixed;inset:0;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s;z-index:30}
  #shade.on{opacity:1;pointer-events:auto}
  #sheet{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-radius:22px 22px 0 0;border-top:1px solid var(--line);padding:10px 16px calc(18px + env(safe-area-inset-bottom));max-height:82vh;overflow:auto;transform:translateY(105%);transition:transform .3s cubic-bezier(.2,.9,.3,1);z-index:31;box-shadow:0 -14px 40px rgba(0,0,0,.45)}
  #sheet.on{transform:none}
  .grip{width:40px;height:4px;border-radius:999px;background:var(--line);margin:0 auto 12px}
  .wksc{overflow-x:auto;-webkit-overflow-scrolling:touch}
  @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
</style></head>
<body>
<header>
  <div class="hdrow">
    <div class="hd-l">
      <span class="logo" id="logoBox"></span>
      <div style="min-width:0"><h1 id="chTitle">Video Forge</h1><div class="sub" id="hd">Monitor del cerebro</div></div>
    </div>
    <button class="icon" id="btnRefresh" aria-label="Actualizar">⟳</button>
  </div>
  <div class="seg" id="chSel">
    <button data-ch="resumen" class="on">Resumen</button>
    <button data-ch="data-lens">Data Lens</button>
    <button data-ch="auto2">Oddly</button>
  </div>
</header>
<div class="wrap">
  <div id="s-hoy"></div>
  <div id="s-videos" class="hide"></div>
  <div id="s-agenda" class="hide"></div>
  <div id="s-cerebro" class="hide"></div>
  <div id="s-mas" class="hide"></div>
</div>
<div id="toast"></div>
<div id="shade"></div><div id="sheet"><div class="grip"></div><div id="sheetBody"></div></div>
<div class="nav">
  <button data-t="hoy" class="on"><span class="ic">☀️</span>Hoy</button>
  <button data-t="videos"><span class="ic">🎬</span>Videos</button>
  <button data-t="agenda"><span class="ic">📅</span>Agenda</button>
  <button data-t="cerebro"><span class="ic">🧠</span>Cerebro</button>
  <button data-t="mas"><span class="ic">⚙️</span>Más</button>
</div>
<script>
  var tg=window.Telegram&&window.Telegram.WebApp;
  if(tg){ tg.ready(); tg.expand(); try{ tg.disableVerticalSwipes&&tg.disableVerticalSwipes(); }catch(e){} try{ tg.setHeaderColor&&tg.setHeaderColor("bg_color"); }catch(e){} }
  var INIT=tg?tg.initData:"";
  var ST={}, BR=null, brLoading=false, curTab="hoy", curCh="resumen", refT=null, DAY=864e5;
  function el(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function num(n){n=+n||0;if(n>=1e6)return (n/1e6).toFixed(n>=1e7?0:1)+"M";if(n>=1e3)return (n/1e3).toFixed(n>=1e5?0:1)+"k";return String(Math.round(n));}
  function api(path,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["X-Init-Data"]=INIT;return fetch(path,opts);}
  function h(t){try{var H=tg&&tg.HapticFeedback;if(!H)return;if(t==="sel")H.selectionChanged();else if(t==="ok")H.notificationOccurred("success");else if(t==="err")H.notificationOccurred("error");else H.impactOccurred(t||"light");}catch(e){}}
  function toast(m){var t=el("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show");},2600);}
  function fmtDT(s){ if(!s) return "—"; var d=new Date(s); if(isNaN(d)) return String(s).slice(0,16); return d.toLocaleDateString([],{weekday:"short",day:"numeric",month:"short"})+" "+d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); }
  function fmtD(s){ if(!s) return "—"; var d=new Date(s); if(isNaN(d)) return String(s).slice(0,10); return d.toLocaleDateString([],{weekday:"short",day:"numeric",month:"short"}); }
  function dayKey(s){ var d=new Date(s); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
  var TODAY=dayKey(new Date().toISOString());

  // ===== Identidad por canal =====
  var CH={
    "data-lens":{name:"The Data Lens",handle:"@TheDataLensHQ",wk:["data-lens","data_lens","datalens"]},
    "auto2":{name:"Oddly Loop",handle:"@oddlyloophq",wk:["oddly","auto2"]}
  };
  var LOGOS={
    "auto2":'<svg viewBox="0 0 44 44" fill="none"><path d="M22 22 C22 11 10 11 10 22 C10 33 22 33 22 22 C22 11 34 11 34 22 C34 33 22 33 22 22Z" stroke="#04140d" stroke-width="4.5" stroke-linecap="round"/></svg>',
    "data-lens":'<svg viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="15" stroke="#1c1200" stroke-width="3.5"/><rect x="16" y="21" width="3.4" height="7" rx="1.4" fill="#1c1200"/><rect x="20.4" y="17" width="3.4" height="11" rx="1.4" fill="#1c1200"/><rect x="24.8" y="13.5" width="3.4" height="14.5" rx="1.4" fill="#1c1200"/></svg>',
    "resumen":'<svg viewBox="0 0 44 44" fill="none"><rect x="10" y="20" width="8" height="14" rx="2" fill="#04121a"/><rect x="18" y="13" width="8" height="21" rx="2" fill="#04121a"/><rect x="26" y="16" width="8" height="18" rx="2" fill="#04121a"/></svg>'
  };
  function applyChannelTheme(ch){
    try{ document.body.setAttribute("data-ch", ch||"resumen"); }catch(e){}
    var lb=el("logoBox"); if(lb) lb.innerHTML=LOGOS[ch]||LOGOS.resumen;
    var t=el("chTitle"); if(t) t.textContent = ch==="resumen"?"Video Forge":(CH[ch]||{}).name||"Video Forge";
  }

  // ===== Normalización de datos del canal (desde /api/state) =====
  function chData(ch){
    var now=Date.now();
    if(ch==="auto2"){
      var a=ST.auto2||{}; var list=(a.list||[]).slice();
      return {subs:a.subs||0,views:a.total_views||0,videos:a.videos||list.length,watch:a.watch_min||0,list:list,monet:a.monet_goal||null,top:a.top||[],niches:a.niche_ranking||[]};
    }
    var cs=ST.channel_stats||{}; var list=(ST.all_videos||[]).slice();
    return {subs:cs.subs||0,views:cs.total_views||(ST.totals&&ST.totals.views)||0,videos:(ST.long_count||0)+(ST.shorts_count||0)||list.length,watch:(ST.totals&&ST.totals.watch_min)||0,list:list,monet:ST.monet_goal||null,top:[],niches:[]};
  }
  function isFuture(v){ return !!(v&&v.publish_at&&Date.parse(v.publish_at)>Date.now()); }
  function isPublic(v){ return v&&v.privacy==="public"; }
  function inFlight(v){ return v&&!isPublic(v)&&!v.publish_at&&!v.pending_sched; }
  function pubDate(v){ return (v&&(v.published_at||v.publish_at))||null; }
  function scheduledOf(ch){ var d=chData(ch); var s=d.list.filter(isFuture); if(ch!=="auto2"&&(ST.scheduled||[]).length) s=(ST.scheduled||[]).filter(isFuture); return s.sort(function(a,b){return Date.parse(a.publish_at)-Date.parse(b.publish_at);}); }
  function brCh(ch){ return (BR&&BR.ch&&BR.ch[ch])||{}; }
  function scoreOf(ch,vid){ var sc=brCh(ch).scores; if(!sc||!sc.scores) return null; for(var i=0;i<sc.scores.length;i++){ if(sc.scores[i].video_id===vid) return sc.scores[i]; } return null; }
  var VERD={SCALE:["gr","🚀 Escalar"],ITERATE:["am","🔁 Iterar"],TEST_AGAIN:["acc","⏳ Midiendo"],STOP:["rd","⛔ Cortar"]};
  function verdictPill(s){ if(!s) return ""; var v=VERD[s.verdict]||["acc",s.verdict]; return '<span class="pill '+v[0]+'">'+v[1]+' · '+s.overall+'</span>'; }
  function thumb(v){ return v.video_id?'<img loading="lazy" src="https://i.ytimg.com/vi/'+v.video_id+'/mqdefault.jpg" alt="">':""; }

  // ===== Gráfica de barras PRO (método dataviz) =====
  function svgBars(rows,color){
    var n=rows.length; if(!n) return "";
    var slot=44,W=Math.max(300,n*slot),H=164,padB=24,padT=18,padL=36,padR=6;
    var max=Math.max.apply(null,rows.map(function(r){return r.value||0;}).concat([1]));
    var bw=(W-padL-padR)/n,barW=Math.min(24,Math.max(2,bw*0.62)),plotH=H-padT-padB;
    function nice(v){var p=Math.pow(10,Math.floor(Math.log(v||1)/Math.LN10));var m=v/p;var r=m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10;return r*p;}
    var top=nice(max); if(top<max) top=max;
    var yOf=function(v){return H-padB-Math.round((v/top)*plotH);};
    var grid=[top/2,top].map(function(t){var yy=yOf(t);return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="var(--line)" stroke-width="1"/><text x="'+(padL-6)+'" y="'+(yy+4)+'" font-size="10" fill="var(--hint)" text-anchor="end">'+num(t)+'</text>';}).join("");
    var base='<line x1="'+padL+'" y1="'+(H-padB)+'" x2="'+(W-padR)+'" y2="'+(H-padB)+'" stroke="var(--line)" stroke-width="1"/>';
    var maxIdx=0; rows.forEach(function(r,i){if((r.value||0)>(rows[maxIdx].value||0))maxIdx=i;});
    var lastIdx=n-1,emphIdx=-1; for(var k=n-1;k>=0;k--){if(!rows[k].partial){emphIdx=k;break;}}
    var bars=rows.map(function(r,i){
      var val=r.value||0,yy=yOf(val),hh=Math.max(2,(H-padB)-yy); yy=(H-padB)-hh;
      var x=padL+i*bw+(bw-barW)/2,cx=x+barW/2,rr=Math.min(4,barW/2);
      var d='M'+x.toFixed(1)+' '+(H-padB)+' V'+(yy+rr).toFixed(1)+' Q'+x.toFixed(1)+' '+yy.toFixed(1)+' '+(x+rr).toFixed(1)+' '+yy.toFixed(1)+' H'+(x+barW-rr).toFixed(1)+' Q'+(x+barW).toFixed(1)+' '+yy.toFixed(1)+' '+(x+barW).toFixed(1)+' '+(yy+rr).toFixed(1)+' V'+(H-padB)+' Z';
      var op=r.partial?0.55:(i===emphIdx?1:0.5);
      var lbl=(val>0&&(i===lastIdx||i===maxIdx||i===emphIdx))?'<text x="'+cx.toFixed(1)+'" y="'+(yy-5).toFixed(1)+'" font-size="11" fill="var(--txt)" text-anchor="middle" font-weight="700">'+num(val)+'</text>':"";
      var dl='<text x="'+cx.toFixed(1)+'" y="'+(H-8)+'" font-size="10" fill="var(--hint)" text-anchor="middle">'+esc(r.label)+'</text>'+(r.partial?'<text x="'+cx.toFixed(1)+'" y="'+(H-1)+'" font-size="7" fill="var(--am)" text-anchor="middle">parcial</text>':"");
      return '<path d="'+d+'" fill="'+(r.partial?"url(#hb)":color)+'" opacity="'+op+'"><title>'+esc(r.label)+': '+num(val)+'</title></path>'+lbl+dl;
    }).join("");
    return '<div class="wksc"><svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="display:block;max-width:none"><defs><pattern id="hb" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" stroke="'+color+'" stroke-width="2"/></pattern></defs>'+grid+base+bars+'</svg></div>';
  }
  function weeklyChartHtml(ch){
    var Wk=ST.weekly&&ST.weekly.channels; if(!Wk) return "";
    var W=null; (CH[ch]||{wk:[]}).wk.forEach(function(k){ if(!W&&Wk[k]) W=Wk[k]; });
    if(!W||!(W.weeks&&W.weeks.length)) return "";
    var d=new Date(); var b=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-b); var curW=d.toISOString().slice(0,10);
    var rows=W.weeks.map(function(w){ var p=(w.week||"").split("-"); return {label:p.length===3?(p[2]+"/"+p[1]):w.week,value:w.views||0,partial:(w.week===curW||(w.days||7)<7)}; });
    var last=rows[rows.length-1].value, prev=rows.length>1?rows[rows.length-2].value:0, df=last-prev, pc=prev?Math.round(df/prev*100):0;
    return '<div class="card" style="padding:10px 8px"><div class="row" style="margin-bottom:6px"><b style="font-size:13px">👁 Vistas por semana</b><span class="muted">últ: '+num(last)+' <span style="color:'+(df>=0?"var(--gr)":"var(--am)")+';font-weight:700">'+(df>=0?"▲":"▼")+(pc>=0?"+":"")+pc+'%</span></span></div>'+svgBars(rows,"var(--acc)")+'</div>';
  }

  // ===== HOY =====
  function goalHero(ch){
    var d=chData(ch), g=d.monet, m=(BR&&BR.monetization&&BR.monetization.channels&&BR.monetization.channels[ch])||null;
    var rd=(m&&m.readiness)||g, wr=(m&&m.war_room)||null;
    if(!rd||!rd.reqs) return '<div class="card muted">Sin meta de monetización aún.</div>';
    var S={done:["gr","🎉 Meta cumplida"],ontrack:["gr","🟢 En camino"],measuring:["acc","📈 Midiendo el ritmo"],behind:["am","🔴 Vamos atrás"]}[rd.status]||["acc",""];
    var focusKey=wr&&wr.focus, focusReq=null; (rd.reqs||[]).forEach(function(r){ if(!focusReq&&(focusKey?r.key===focusKey:!r.done)) focusReq=r; });
    var primary=focusReq||rd.reqs[0];
    var rows=(rd.reqs||[]).map(function(r){ var c=r.done?"gr":(r.on_track===false?"rd":(r.on_track?"gr":"am"));
      return '<div style="margin-top:8px"><div class="row" style="font-size:12px"><span>'+esc(r.label)+'</span><span class="muted num">'+num(r.cur)+' / '+num(r.target)+' · '+(r.pct||0)+'%</span></div><div class="bar"><i class="'+c+'" style="width:'+Math.max(2,Math.min(100,r.pct||0))+'%"></i></div></div>'; }).join("");
    var risk=wr&&wr.risk?' <span class="pill '+(wr.risk==="alto"?"rd":wr.risk==="medio"?"am":"gr")+'">riesgo '+esc(wr.risk)+'</span>':"";
    return '<div class="card hero"><div class="row" style="flex-wrap:wrap"><div class="hero-h" style="color:var(--'+S[0]+')">'+S[1]+'</div><div class="muted">quedan <b>'+(rd.days_left!=null?rd.days_left:"—")+'</b> días'+risk+'</div></div>'
      +'<div class="big" style="margin-top:10px">'+num(primary.cur)+' <small>/ '+num(primary.target)+' '+esc(primary.label||"")+'</small></div>'
      +rows
      +(wr&&wr.next_action?'<div class="card" style="background:var(--bg);padding:9px 11px;margin:10px 0 0;font-size:12.5px;box-shadow:none"><b style="color:var(--acc)">🎯 Foco:</b> '+esc(wr.focus_label||"")+' — '+esc(wr.next_action)+'</div>':"")
      +'</div>';
  }
  function kpiBento(ch){
    var d=chData(ch), sched=scheduledOf(ch), today=sched.filter(function(v){return dayKey(v.publish_at)===TODAY;}).length;
    var q=(ch==="auto2"&&BR&&BR.queue)||null; var cola=q?q.scheduled_ahead:sched.length;
    return '<div class="bento">'
      +'<div class="stat"><div class="n">'+num(d.subs)+'</div><div class="l">Suscriptores</div></div>'
      +'<div class="stat"><div class="n">'+num(d.views)+'</div><div class="l">Vistas</div></div>'
      +'<div class="stat"><div class="n">'+cola+'</div><div class="l">En cola</div><div class="d">'+(q&&q.produced_today===0&&cola>0?"drenando · ~1 día":"publica solo")+'</div></div>'
      +'<div class="stat"><div class="n">'+today+'</div><div class="l">Publica hoy</div><div class="d">automático</div></div>'
      +'</div>';
  }
  function alertsHtml(ch){
    var a=(brCh(ch).alerts&&brCh(ch).alerts.alerts)||[]; a=a.filter(function(x){return x.severity==="critical"||x.severity==="warn";});
    if(!a.length) return "";
    return '<h2>🚨 Alertas <span class="cnt">'+a.length+'</span></h2>'+a.map(function(x){ return '<div class="card alert'+(x.severity==="critical"?" rd":"")+'"><b>'+esc(x.title)+'</b><div class="muted" style="margin-top:3px">'+esc(x.detail)+'</div></div>'; }).join("");
  }
  function todayChangesHtml(ch){
    var d=chData(ch); var pub=d.list.filter(function(v){return isPublic(v)&&pubDate(v)&&dayKey(pubDate(v))===TODAY;});
    var best=d.list.filter(isPublic).sort(function(a,b){return (b.views||0)-(a.views||0);})[0];
    var sc=brCh(ch).scores; var scale=(sc&&sc.scale&&sc.scale.length)?sc.scale[0]:null;
    var items=[];
    items.push('<div class="row"><span>📤 Publicados hoy</span><b class="num">'+pub.length+'</b></div>');
    if(best) items.push('<div class="row" style="margin-top:8px;gap:10px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🏆 '+esc(best.title||"")+'</span><b class="num" style="white-space:nowrap">'+num(best.views||0)+'</b></div>');
    if(scale) items.push('<div class="row" style="margin-top:8px;gap:10px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🚀 Escalar: '+esc(scale.title||"")+'</span>'+verdictPill(scale)+'</div>');
    return '<h2>Qué pasa hoy</h2><div class="card">'+items.join("")+'</div>';
  }
  function hoyHtml(){
    if(curCh==="resumen"){
      return ["auto2","data-lens"].map(function(ch){ return '<h2><span class="live"></span>'+esc(CH[ch].name)+'</h2>'+goalHero(ch)+kpiBento(ch)+alertsHtml(ch); }).join("");
    }
    return goalHero(curCh)+kpiBento(curCh)+alertsHtml(curCh)+todayChangesHtml(curCh)+weeklyChartHtml(curCh);
  }

  // ===== VIDEOS =====
  function vcard(ch,v,estado){
    var s=scoreOf(ch,v.video_id);
    return '<div class="card vcard tap" data-vid="'+esc(v.video_id||"")+'" data-vch="'+ch+'"><div class="vthumb">'+thumb(v)+'</div><div class="vmeta">'
      +'<div class="vtitle">'+esc((v.title||"").slice(0,70))+'</div>'
      +(v.niche_label?'<div class="muted">🎬 '+esc(v.niche_label)+'</div>':"")
      +'<div class="vstatus">'+estado+(s?verdictPill(s):"")+' <span class="muted num">· '+num(v.views||0)+' vistas</span></div></div></div>';
  }
  function videosHtml(){
    var chs=curCh==="resumen"?["auto2","data-lens"]:[curCh]; var out="";
    chs.forEach(function(ch){
      var d=chData(ch); var fl=d.list.filter(inFlight); var pub=d.list.filter(isPublic).sort(function(a,b){return Date.parse(pubDate(b)||0)-Date.parse(pubDate(a)||0);}).slice(0,12);
      if(chs.length>1) out+='<h2>'+esc(CH[ch].name)+'</h2>';
      if(fl.length) out+='<h2>⏳ En marcha <span class="cnt">'+fl.length+'</span></h2><div class="muted" style="margin:-4px 4px 6px">Se programan solos a su mejor hora.</div>'+fl.slice(0,8).map(function(v){return vcard(ch,v,'<span class="pill am">programándose</span>');}).join("");
      out+='<h2>📤 Últimos publicados <span class="cnt">'+pub.length+'</span></h2>'+(pub.length?pub.map(function(v){return vcard(ch,v,'<span class="pill gr">público</span>');}).join(""):'<div class="card muted">Aún no hay publicados.</div>');
    });
    return out;
  }
  function videoSheet(ch,vid){
    var d=chData(ch); var v=null; d.list.forEach(function(x){ if(x.video_id===vid) v=x; }); if(!v) return;
    var s=scoreOf(ch,vid); var ab=brCh(ch).ab;
    var html='<div class="vthumb" style="width:100%;aspect-ratio:16/9;margin-bottom:10px">'+thumb(v)+'</div><b style="font-size:15px">'+esc(v.title||"")+'</b>'
      +'<div class="muted" style="margin:4px 0 10px">'+(isPublic(v)?"público · publicado "+fmtD(pubDate(v)):(isFuture(v)?"programado · "+fmtDT(v.publish_at):"en marcha"))+' · '+num(v.views||0)+' vistas'+(v.video_id?' · <a href="https://youtu.be/'+v.video_id+'" target="_blank">abrir ↗</a>':"")+'</div>';
    if(s){
      html+='<div class="bento" style="margin:8px 0"><div class="stat"><div class="n">'+s.overall+'</div><div class="l">Score</div></div><div class="stat"><div class="n">'+(s.vs_baseline_pct!=null?(s.vs_baseline_pct>=0?"+":"")+Math.round(s.vs_baseline_pct)+"%":"—")+'</div><div class="l">vs mediana</div></div></div>'
        +'<div class="row" style="margin-bottom:6px"><span class="muted">Veredicto</span>'+verdictPill(s)+'</div>'
        +'<div class="muted">'+(s.reasons||[]).map(esc).join(" · ")+'</div>'
        +(s.hook_type?'<div class="muted" style="margin-top:6px">Hook: <b>'+esc(s.hook_type)+'</b>'+(s.retention_score!=null?' · retención '+Math.round(s.retention_score*100)+'%':"")+'</div>':"");
    } else html+='<div class="card muted" style="margin:8px 0">Aún sin score (madura a los ~5 días).</div>';
    html+='<button class="btn ghost" data-close="1" style="margin-top:12px">Cerrar</button>';
    openSheet(html);
  }

  // ===== AGENDA =====
  function horizonCard(ch){
    var s=scheduledOf(ch); if(!s.length) return '<div class="card muted">Nada programado. El cerebro produce y programa solo.</div>';
    var last=Date.parse(s[s.length-1].publish_at), days=Math.round((last-Date.now())/DAY*10)/10, ok=days<=2;
    return '<div class="card"><div class="row"><div><b>🗓️ '+s.length+' programados</b><div class="muted num" style="margin-top:2px">hasta '+fmtD(last)+' · ~'+days+' días</div></div><span class="pill '+(ok?"gr":"am")+'">'+(ok?"al día ~1 día":"drenando")+'</span></div>'
      +'<div class="muted" style="margin-top:8px">🧠 El cerebro programa el <b>día antes</b> (buffer ~1 día) para aprender rápido.</div></div>';
  }
  function calendarHtml(ch){
    var s=scheduledOf(ch); if(!s.length) return "";
    var byDay={}; s.forEach(function(v){ var k=dayKey(v.publish_at); (byDay[k]=byDay[k]||[]).push(v); });
    return Object.keys(byDay).sort().map(function(k){
      var items=byDay[k]; var lab=k===TODAY?"Hoy · ":(k===dayKey(new Date(Date.now()+DAY).toISOString())?"Mañana · ":"");
      return '<div class="card" style="padding:10px 12px"><div class="row" style="font-weight:700;font-size:13px"><span>'+lab+fmtD(k+"T12:00:00")+'</span><span style="color:var(--acc)" class="num">'+items.length+'</span></div>'
        +items.map(function(v){ return '<div class="row" style="padding:6px 0;border-top:1px solid var(--line);gap:8px"><span style="font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(v.manual?"🟣":"🎬")+' '+esc(v.title||"")+'</span><span class="num" style="font-size:11px;color:var(--acc);white-space:nowrap">🕒 '+new Date(v.publish_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+'</span></div>'; }).join("")+'</div>';
    }).join("");
  }
  function agendaHtml(){
    var chs=curCh==="resumen"?["auto2","data-lens"]:[curCh];
    return chs.map(function(ch){ return (chs.length>1?'<h2>'+esc(CH[ch].name)+'</h2>':"")+horizonCard(ch)+'<h2>📅 Calendario</h2>'+calendarHtml(ch); }).join("");
  }

  // ===== CEREBRO =====
  function decisionHtml(){
    var d=BR&&BR.decision; if(!d||!d.candidates||!d.candidates.length) return "";
    return '<h2>🎛️ Reparto por confianza <span class="cnt">'+esc(d.week||"")+'</span></h2><div class="card"><div class="muted" style="margin-bottom:8px">Oddly · score = valor × certeza (no proporcional-ciego).</div><table><tr><th>Nicho</th><th style="text-align:right">Score</th><th style="text-align:right">Slots</th></tr>'
      +d.candidates.map(function(c){ return '<tr><td>'+esc(c.label||c.key)+'</td><td class="num" style="text-align:right">'+(c.score!=null?c.score:"—")+'</td><td class="num" style="text-align:right"><b>'+((d.recommended_allocation||{})[c.key]||0)+'</b></td></tr>'; }).join("")+'</table></div>';
  }
  function outliersHtml(ch){
    var sc=brCh(ch).scores; if(!sc) return "";
    var c=sc.counts||{}, o=sc.outliers||{};
    return '<h2>🎬 Veredictos</h2><div class="bento" style="margin-top:6px"><div class="stat"><div class="n" style="color:var(--gr)">'+(c.SCALE||0)+'</div><div class="l">Escalar</div></div><div class="stat"><div class="n" style="color:var(--am)">'+(c.ITERATE||0)+'</div><div class="l">Iterar</div></div><div class="stat"><div class="n">'+(c.TEST_AGAIN||0)+'</div><div class="l">Midiendo</div></div><div class="stat"><div class="n" style="color:var(--rd)">'+(c.STOP||0)+'</div><div class="l">Cortar</div></div></div>'
      +(o.count?'<div class="card"><b>✨ Outliers <span class="pill acc">'+o.count+'</span></b><div class="muted" style="margin-top:4px">'+esc(o.suggestion||"")+'</div></div>':"");
  }
  function abHtml(ch){
    var ab=brCh(ch).ab; var ex=(ab&&ab.experiments)||[]; if(!ex.length) return "";
    return '<h2>⚗️ A/B por cohortes</h2><div class="card">'+ex.map(function(e){ var w=String(e.verdict||"").indexOf("WINNER")===0;
      return '<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><span style="font-size:12.5px">'+esc(e.variants.join(" vs "))+'</span><span class="pill '+(w?"gr":(e.verdict==="RUNNING"?"acc":"am"))+'">'+(w?"🏆 "+esc(e.leader)+" +"+e.lift:(e.verdict==="RUNNING"?"midiendo":"empate"))+'</span></div>'; }).join("")
      +'<div class="muted" style="margin-top:6px">Decide por mediana (no se deja engañar por virales).</div></div>';
  }
  function hypsHtml(){
    var hs=(BR&&BR.hypotheses)||[]; if(!hs.length) return "";
    return '<h2>🧪 Hipótesis</h2><div class="card">'+hs.slice(0,5).map(function(x){ var n=(x.evidence||[]).length; return '<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><span style="font-size:12.5px">'+esc(x.id)+'</span><span class="muted num">'+esc(x.status)+' · conf '+Math.round((x.confidence||0)*100)+'% · n'+n+'</span></div>'; }).join("")+'</div>';
  }
  function bankHtml(ch){
    var b=brCh(ch).bank; var items=(Array.isArray(b)?b:(b&&b.items)||[]).filter(function(i){return i.state==="BACKLOG";}).sort(function(a,c){return (c.priority||0)-(a.priority||0);}).slice(0,3);
    if(!items.length) return "";
    return '<h2>💡 Próximo a probar</h2><div class="card">'+items.map(function(i){ return '<div class="row" style="padding:6px 0;border-top:1px solid var(--line);gap:8px"><span style="font-size:12.5px">'+esc(i.text)+'</span><span class="pill acc">'+esc(i.bucket||"")+'</span></div>'; }).join("")+'</div>';
  }
  function planHtml(ch){
    var r=brCh(ch).report; if(!r||!(r.plan||[]).length) return "";
    return '<h2>📋 Plan de la semana</h2><div class="card">'+r.plan.map(function(p,i){ return '<div style="padding:5px 0;font-size:12.5px">'+(i+1)+'. '+esc(p)+'</div>'; }).join("")+'</div>';
  }
  function crossHtml(ch){
    var c=brCh(ch).cross; if(!c||!c.summary) return "";
    var s=c.summary; var ic={CONFIRMADA:"✅",PROBABLE:"🟢",CONTRADICTORIA:"⛔",REQUIERE_EXPERIMENTO:"🧪",INCIERTA:"❔"};
    return '<h2>🔬 Validación cruzada</h2><div class="card"><div class="muted" style="margin-bottom:6px">Investigación externa vs nuestra data.</div>'+Object.keys(s).map(function(k){return '<span class="pill" style="margin:2px 4px 2px 0">'+(ic[k]||"")+' '+esc(k)+' '+s[k]+'</span>';}).join("")+'</div>';
  }
  function cerebroHtml(){
    if(!BR) return '<div class="card"><div class="sk-l" style="width:60%"></div><div class="sk-l s"></div></div><div class="card"><div class="sk-l" style="width:80%"></div><div class="sk-l s"></div></div>';
    var chs=curCh==="resumen"?["auto2","data-lens"]:[curCh];
    var when=BR.monetization&&BR.monetization.at?'<div class="muted" style="margin:-4px 2px 6px">Actualizado '+esc(String(BR.monetization.at).slice(5,16).replace("T"," "))+'</div>':"";
    return when+chs.map(function(ch){ return (chs.length>1?'<h2><span class="live"></span>'+esc(CH[ch].name)+'</h2>':"")+outliersHtml(ch)+abHtml(ch)+bankHtml(ch)+planHtml(ch)+crossHtml(ch)+weeklyChartHtml(ch); }).join("")+decisionHtml()+hypsHtml();
  }

  // ===== MÁS =====
  function masHtml(){
    var t=ST.tools_health||{}, prob=(ST.problems||[]).length, r2=ST.r2||{};
    var gb=r2.bytes?(r2.bytes/1073741824).toFixed(2):null;
    return '<h2>🩺 Salud</h2><div class="card"><div class="row"><span>🧰 Herramientas</span><span class="pill '+(t.down>0?"am":"gr")+'">'+(t.tools&&t.tools.length?(t.ok+"/"+t.total+" OK"):"OK")+'</span></div><div class="row" style="margin-top:8px"><span>⚠️ Problemas</span><span class="pill '+(prob?"rd":"gr")+'">'+prob+'</span></div>'+(gb?'<div class="row" style="margin-top:8px"><span>💾 R2</span><span class="muted num">'+gb+' GB / 10</span></div>':"")+'</div>'
      +'<h2>🛠️ Herramientas</h2><div class="card"><div class="muted" style="margin-bottom:8px">Despublicar un dud (privado + oculto, reversible).</div><input type="text" id="unpubId" placeholder="ID del video de YouTube"><div class="row" style="margin-top:8px;gap:8px"><button class="btn mini ghost" data-unpub="data-lens">Data Lens</button><button class="btn mini ghost" data-unpub="auto2">Oddly</button></div></div>'
      +'<div class="card"><b>✋ Mis Clips</b><div class="muted" style="margin-top:3px">Subir un clip a mano sigue en la app clásica por ahora.</div><a class="btn ghost" href="/app" style="text-align:center;text-decoration:none">Abrir Mis Clips ↗</a></div>'
      +'<div class="muted" style="text-align:center;margin-top:10px">Video Forge v2 · monitor · '+(ST.inventory_at?'inventario '+esc(String(ST.inventory_at).slice(5,16).replace("T"," ")):"")+'</div>';
  }

  // ===== Render / navegación =====
  function render(){
    var hd=el("hd"); if(hd) hd.innerHTML=(ST.error?esc(ST.error):'<span class="live"></span>Monitor del cerebro · todo automático');
    var map={hoy:hoyHtml,videos:videosHtml,agenda:agendaHtml,cerebro:cerebroHtml,mas:masHtml};
    var sec=el("s-"+curTab); if(!sec) return;
    try{ sec.innerHTML=map[curTab](); }catch(e){ sec.innerHTML='<div class="card muted">No pude pintar esta vista.</div>'; }
    sec.classList.remove("fadein"); void sec.offsetWidth; sec.classList.add("fadein");
    mainButton();
  }
  function tab(name){
    curTab=name; ["hoy","videos","agenda","cerebro","mas"].forEach(function(t){ el("s-"+t).classList.toggle("hide",t!==name); });
    document.querySelectorAll(".nav button").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-t")===name); });
    if(name==="cerebro"||name==="hoy"||name==="videos") loadBrain(false);
    h("sel"); render(); backSync();
  }
  function setChannel(ch){ curCh=ch; applyChannelTheme(ch); document.querySelectorAll(".seg button").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-ch")===ch); }); h("sel"); render(); backSync(); }
  function backSync(){ try{ if(!tg||!tg.BackButton) return; if(curTab!=="hoy"||curCh!=="resumen") tg.BackButton.show(); else tg.BackButton.hide(); }catch(e){} }
  try{ tg&&tg.BackButton&&tg.BackButton.onClick(function(){ if(sheetOpen){ closeSheet(); return; } if(curTab!=="hoy"){ tab("hoy"); return; } if(curCh!=="resumen") setChannel("resumen"); }); }catch(e){}
  // MainButton nativo: UNA acción principal (actualizar).
  function mainButton(){ try{ if(!tg||!tg.MainButton) return; var MB=tg.MainButton; MB.setText("↻ Actualizar"); MB.show(); }catch(e){} }
  try{ tg&&tg.MainButton&&tg.MainButton.onClick(function(){ h("medium"); load(true); }); }catch(e){}
  // Sheet
  var sheetOpen=false;
  function openSheet(html){ el("sheetBody").innerHTML=html; el("shade").classList.add("on"); el("sheet").classList.add("on"); sheetOpen=true; h("light"); backSync(); }
  function closeSheet(){ el("shade").classList.remove("on"); el("sheet").classList.remove("on"); sheetOpen=false; backSync(); }
  // Delegación de eventos (sin onclick inline)
  document.addEventListener("click",function(ev){
    var t=ev.target.closest("[data-t]"); if(t&&t.closest(".nav")){ tab(t.getAttribute("data-t")); return; }
    var c=ev.target.closest("[data-ch]"); if(c&&c.closest(".seg")){ setChannel(c.getAttribute("data-ch")); return; }
    var v=ev.target.closest("[data-vid]"); if(v){ videoSheet(v.getAttribute("data-vch"),v.getAttribute("data-vid")); return; }
    if(ev.target.closest("[data-close]")||ev.target.id==="shade"){ closeSheet(); return; }
    var u=ev.target.closest("[data-unpub]"); if(u){ unpublish(u.getAttribute("data-unpub")); return; }
    if(ev.target.closest("#btnRefresh")){ h("light"); load(true); }
  });
  function unpublish(ch){
    var id=(el("unpubId")&&el("unpubId").value||"").trim(); if(!/^[\\w-]{6,}$/.test(id)){ toast("Pega un ID de video válido"); return; }
    if(tg&&tg.showConfirm){ tg.showConfirm("¿Despublicar "+id+" en "+(CH[ch]||{}).name+"? Queda privado y oculto (reversible).",function(ok){ if(ok) doUnpub(ch,id); }); } else if(confirm("¿Despublicar "+id+"?")) doUnpub(ch,id);
  }
  function doUnpub(ch,id){
    api("/api/dispatch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workflow:"youtube_unpublish.yml",inputs:{video_id:id,channel:ch==="auto2"?"oddly":"data-lens"}})})
      .then(function(r){return r.json();}).then(function(j){ if(j.ok){ h("ok"); toast("🚫 Despublicando "+id+"… te aviso al chat"); } else { h("err"); toast("❌ "+(j.error||"no pude")); } }).catch(function(){ h("err"); toast("❌ Error de red"); });
  }

  // ===== Datos =====
  function loadBrain(force){
    if(BR&&!force) return; if(brLoading) return; brLoading=true;
    api("/api/brain").then(function(r){return r.json();}).then(function(j){ BR=j; brLoading=false; render(); }).catch(function(){ brLoading=false; });
  }
  function scheduleRefresh(){ clearTimeout(refT); refT=setTimeout(function(){ load(false); },60000); }
  function load(withBrain){
    api("/api/state").then(function(r){return r.json();}).then(function(j){
      if(j.error){ ST.error=(j.error==="no autorizado"?"No autorizado":"⚠️ "+(j.detail||j.error)); render(); scheduleRefresh(); return; }
      ST=j; render(); scheduleRefresh(); if(withBrain) loadBrain(true);
    }).catch(function(){ ST.error="Sin conexión — reintentando…"; render(); scheduleRefresh(); });
  }
  // Skeleton al abrir (percepción de velocidad) + tema inicial
  (function boot(){ var s=""; for(var i=0;i<3;i++){ s+='<div class="card"><div class="sk-l" style="width:'+(50+i*12)+'%"></div><div class="sk-l s"></div></div>'; } el("s-hoy").innerHTML=s; })();
  applyChannelTheme(curCh);
  load(true);
</script>
</body></html>`;
