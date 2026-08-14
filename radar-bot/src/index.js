// radar-bot — Worker de Telegram + MINI APP (UI web) para controlar el Radar.
// /radar abre la Mini App: PESTAÑAS POR REPO, badge de prioridad, y flujo por etapas
// (⚙️ Ejecutar → 👀 Revisar → 🔀 Merge). El Merge solo aparece tras Revisar (no mergear sin ver).
// Autenticación segura vía Telegram initData (HMAC con el token del bot); solo el dueño.

const GH = "https://api.github.com";
// El motor CENTRAL vive en video-forge e implementa en cualquier repo objetivo (usa el PAT).
const MOTOR = "juanberrio0399/video-forge";
const REPOS = [
  "juanberrio0399/video-forge",
  "juanberrio0399/ugpp-shield-pro",
  "juanberrio0399/serverless-rag-assistant",
  "juanberrio0399/Hearthwood",
  "juanberrio0399/claude-config",
];

const gh = (env, path, opts = {}) =>
  fetch(`${GH}${path}`, { ...opts, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "radar-bot", ...(opts.headers || {}) } });
const tg = (env, method, body) =>
  fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

const prioOf = (body) => { const m = (body || "").match(/Prioridad:\**\s*(Alta|Media|Baja)/i); return m ? m[1].toLowerCase() : ""; };
const rank = (p) => (p === "alta" ? 0 : p === "media" ? 1 : p === "baja" ? 2 : 3);
const short = (repo) => repo.split("/").pop();

// ---------- Autenticación de la Mini App (Telegram initData) ----------
async function hmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
const toHex = (buf) => [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
async function validInit(initData, token) {
  try {
    if (!initData) return null;
    const p = new URLSearchParams(initData);
    const hash = p.get("hash"); if (!hash) return null;
    p.delete("hash");
    const dcs = [...p.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
    const secret = await hmac(new TextEncoder().encode("WebAppData"), token);
    const computed = toHex(await hmac(secret, dcs));
    if (computed !== hash) return null;
    const authDate = +(p.get("auth_date") || 0);
    if (authDate && (Date.now() / 1000 - authDate) > 86400) return null; // 24h
    return JSON.parse(p.get("user") || "{}");
  } catch { return null; }
}
async function ownerFromReq(request, env) {
  const initData = request.headers.get("x-init-data") || "";
  const user = await validInit(initData, env.TELEGRAM_BOT_TOKEN);
  if (!user || !user.id) return null;
  if (env.OWNER_CHAT_ID && String(user.id) !== String(env.OWNER_CHAT_ID)) return null;
  return user;
}

// ---------- Datos del radar ----------
// Vínculo PR<->issue con la API OFICIAL (GraphQL closingIssuesReferences): GitHub ya parsea
// "Closes #N" de forma fiable. Devuelve { issueNumber: {number,url,title} } de los PR abiertos.
async function ghGraphQL(env, query, variables) {
  const r = await fetch(`${GH}/graphql`, { method: "POST", headers: { Authorization: `Bearer ${env.GH_TOKEN}`, "User-Agent": "radar-bot", "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const j = await r.json().catch(() => ({}));
  return j.data;
}
async function prMap(env, repo) {
  const [owner, name] = repo.split("/");
  const q = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){pullRequests(states:OPEN,first:100){nodes{number title url closingIssuesReferences(first:20){nodes{number}}}}}}`;
  const map = {};
  try {
    const d = await ghGraphQL(env, q, { owner, name });
    for (const pr of (d?.repository?.pullRequests?.nodes || [])) for (const is of (pr.closingIssuesReferences?.nodes || [])) map[String(is.number)] = { number: pr.number, url: pr.url, title: pr.title };
  } catch {}
  return map;
}
async function buildState(env) {
  // En paralelo por repo (5 repos) para que la app cargue rápido.
  // error=true si GitHub no respondió (NO se traga en silencio: la UI lo muestra).
  // err por issue = el motor falló (etiqueta `motor-fallo` que pone el workflow al romperse).
  const repos = await Promise.all(REPOS.map(async (repo) => {
    let error = false; const issues = [];
    try {
      const [map, r] = await Promise.all([prMap(env, repo), gh(env, `/repos/${repo}/issues?labels=radar&state=open&per_page=50`)]);
      if (r.ok) {
        const list = (await r.json()).filter((is) => !is.pull_request);
        for (const is of list) issues.push({ number: is.number, title: is.title, url: is.html_url, prio: prioOf(is.body), err: (is.labels || []).some((l) => l.name === "motor-fallo"), pr: map[String(is.number)] || null });
        issues.sort((a, b) => rank(a.prio) - rank(b.prio));
      } else { error = true; }
    } catch { error = true; }
    return { repo, short: short(repo), issues, error };
  }));
  return { repos };
}
async function doAction(env, action, repo, number) {
  if (action === "run") {
    // Motor CENTRAL en video-forge, implementa en el repo objetivo (repo) usando el PAT.
    const r = await gh(env, `/repos/${MOTOR}/actions/workflows/radar_implement.yml/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main", inputs: { issue: String(number), repo } }) });
    return (r.ok || r.status === 204) ? "⚙️ Motor lanzado. En 1-2 min queda el PR — refresca y usa 👀 Revisar." : "❌ No pude lanzar el motor.";
  }
  if (action === "merge") {
    const pr = (await prMap(env, repo))[String(number)];
    if (!pr) return `🔎 No hay PR abierto para el #${number}.`;
    const m = await gh(env, `/repos/${repo}/pulls/${pr.number}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "squash" }) });
    if (m.ok) return `✅ PR #${pr.number} mergeado. El issue #${number} se cierra solo.`;
    const e = await m.json().catch(() => ({}));
    return `❌ No pude mergear el PR #${pr.number}: ${e.message || m.status}.`;
  }
  if (action === "close") {
    const r = await gh(env, `/repos/${repo}/issues/${number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
    return r.ok ? `🗑️ Issue #${number} cerrado.` : "❌ No pude cerrar el issue.";
  }
  return "Acción desconocida.";
}

// ---------- Mini App (HTML) — diseño pro, nativo de Telegram ----------
const APP_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<title>Radar</title><style>
:root{
  --bg:var(--tg-theme-bg-color,#0f1115);--fg:var(--tg-theme-text-color,#e9eaed);
  --hint:var(--tg-theme-hint-color,#8b909a);--card:var(--tg-theme-secondary-bg-color,#181b21);
  --acc:var(--tg-theme-button-color,#3a92ff);--accfg:var(--tg-theme-button-text-color,#fff);
  --line:rgba(128,132,140,.24);--soft:rgba(128,132,140,.10);
  --r:#ff5a5a;--y:#f2b234;--g:#33c46e;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;padding:0 13px calc(28px + env(safe-area-inset-bottom))}
#app{max-width:560px;margin:0 auto}
.hd{position:sticky;top:0;z-index:6;background:var(--bg);display:flex;align-items:center;justify-content:space-between;padding:13px 2px 9px}
.hd-l{display:flex;align-items:center;gap:10px;min-width:0}
.logo{font-size:22px;line-height:1}
.h-t{font-weight:800;font-size:18px;letter-spacing:.2px}
.h-s{font-size:12px;color:var(--hint);margin-top:-1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60vw}
.icon{background:var(--card);border:1px solid var(--line);color:var(--fg);min-width:36px;height:36px;border-radius:11px;font-size:17px;display:flex;align-items:center;justify-content:center;transition:transform .1s}
.icon:active{transform:scale(.9) rotate(-30deg)}
.tabs{position:sticky;top:53px;z-index:5;background:var(--bg);display:flex;gap:7px;overflow-x:auto;padding:3px 0 11px;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{white-space:nowrap;padding:7px 14px;border-radius:999px;background:var(--card);color:var(--fg);border:1px solid var(--line);font-size:13px;font-weight:600;transition:transform .08s}
.tab:active{transform:scale(.95)}
.tab.on{background:var(--acc);color:var(--accfg);border-color:var(--acc)}
.tab b{opacity:.9;font-weight:800;margin-left:1px}
.kpi{display:flex;gap:9px;margin-bottom:13px}
.k{flex:1;background:var(--card);border:1px solid var(--line);border-radius:15px;padding:12px 6px;text-align:center}
.kn{display:block;font-size:23px;font-weight:800;line-height:1}
.kl{display:block;font-size:11px;color:var(--hint);margin-top:5px;letter-spacing:.2px}
.card{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:14px;margin-bottom:11px}
.tap{cursor:pointer;transition:transform .09s,border-color .15s}
.tap:active{transform:scale(.984)}
.repo .rhead{display:flex;justify-content:space-between;align-items:center;gap:8px}
.rn{font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.meta{color:var(--hint);font-size:13px;display:flex;align-items:center;gap:7px;flex-shrink:0}
.badge{background:var(--soft);color:var(--acc);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.chev{font-size:19px;opacity:.5;margin-left:1px}
.pills{display:flex;gap:7px;margin-top:12px;flex-wrap:wrap}
.pill{display:inline-flex;align-items:center;gap:3px;padding:5px 11px;border-radius:999px;background:var(--bg);border:1px solid var(--line);font-size:13px;font-weight:700;transition:transform .08s}
.pill.z{opacity:.38;font-weight:500}
.pill.tapp:active{transform:scale(.9)}
.sec{display:flex;align-items:center;gap:8px;font-weight:700;font-size:12px;color:var(--hint);letter-spacing:.4px;text-transform:uppercase;margin:18px 3px 9px}
.cnt{background:var(--card);border:1px solid var(--line);color:var(--fg);padding:1px 8px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0}
.issue{border-left:3px solid var(--pc)}
.itop{display:flex;justify-content:space-between;align-items:center}
.ip{font-size:12px;font-weight:800;letter-spacing:.2px}
.inum{color:var(--hint);font-size:12px;font-weight:600}
.ititle{font-weight:650;font-size:15px;margin:6px 0 0;line-height:1.32}
.st{color:var(--hint);font-size:12px;margin-top:7px}
.ilink{display:inline-block;color:var(--acc);font-size:12px;font-weight:600;margin-top:8px;text-decoration:none}
.acts{display:flex;gap:8px;margin-top:12px}
.b{flex:1;padding:11px;border:0;border-radius:12px;background:var(--acc);color:var(--accfg);font-weight:700;font-size:13px;transition:transform .09s}
.b:active{transform:scale(.97)}
.b.g{background:transparent;color:var(--fg);border:1px solid var(--line)}
.b.d{background:transparent;color:var(--r);border:1px solid rgba(255,90,90,.42);flex:0 0 auto;padding:11px 15px}
.fbar{display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin-bottom:11px;font-size:13px;font-weight:600}
.link{background:transparent;border:0;color:var(--acc);font-weight:700;font-size:13px;padding:0}
.empty{text-align:center;padding:52px 18px;color:var(--hint)}
.ei{font-size:42px;margin-bottom:12px}
.et{font-weight:700;color:var(--fg);font-size:15px}
.es{font-size:13px;margin-top:6px;line-height:1.5}
.sk{pointer-events:none}
.sk-l{height:13px;border-radius:7px;background:var(--soft);margin:5px 0;animation:pulse 1.15s ease-in-out infinite}
.sk-l.s{height:11px;width:55%!important;opacity:.7}
@keyframes pulse{0%,100%{opacity:.45}50%{opacity:.95}}
#view.in{animation:fadein .26s ease}
@keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
#toast{position:fixed;left:13px;right:13px;bottom:calc(16px + env(safe-area-inset-bottom));max-width:534px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px 15px;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.32);transform:translateY(160%);opacity:0;transition:transform .3s cubic-bezier(.2,.9,.3,1),opacity .3s;z-index:9}
#toast.show{transform:none;opacity:1}
</style></head><body>
<div id="app">
  <div class="hd">
    <div class="hd-l"><span class="logo">📡</span><div style="min-width:0"><div class="h-t">Radar</div><div class="h-s" id="hsub">Vigila tus repos</div></div></div>
    <button class="icon" data-act="refresh" aria-label="Actualizar">⟳</button>
  </div>
  <div class="tabs" id="tabs"></div>
  <div id="view"></div>
</div>
<div id="toast"></div>
<script>
var TG=window.Telegram.WebApp;TG.ready();TG.expand();
try{TG.setHeaderColor&&TG.setHeaderColor("bg_color");}catch(e){}
var INIT=TG.initData||"";
var ST={repos:[]},CUR=-1,FILTER=null,REVIEWED={};
try{REVIEWED=JSON.parse(localStorage.getItem("radar_reviewed")||"{}");}catch(e){}
function saveRev(){try{localStorage.setItem("radar_reviewed",JSON.stringify(REVIEWED));}catch(e){}}
function h(t){try{var H=TG.HapticFeedback;if(!H)return;if(t==="sel")H.selectionChanged();else if(t==="ok")H.notificationOccurred("success");else if(t==="err")H.notificationOccurred("error");else H.impactOccurred(t||"light");}catch(e){}}
function api(p,b){return fetch(p,{method:"POST",headers:{"content-type":"application/json","x-init-data":INIT},body:JSON.stringify(b||{})}).then(function(r){return r.json();});}
function esc(s){return (s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function toast(t){var e=document.getElementById("toast");e.textContent=t;e.className="show";clearTimeout(window._t);window._t=setTimeout(function(){e.className="";},3400);}
var PR={alta:{e:"🔴",l:"Alta",c:"var(--r)"},media:{e:"🟡",l:"Media",c:"var(--y)"},baja:{e:"🟢",l:"Baja",c:"var(--g)"},none:{e:"⚪",l:"Sin prioridad",c:"var(--hint)"}};
function counts(r){var c={alta:0,media:0,baja:0,none:0};r.issues.forEach(function(x){c[x.prio||"none"]++;});return c;}
function pill(prio,n,i){return '<span class="pill'+(n?" tapp":" z")+'" data-act="chip" data-i="'+i+'" data-prio="'+prio+'">'+PR[prio].e+" "+n+"</span>";}
function empty(ic,t,s){return '<div class="empty"><div class="ei">'+ic+'</div><div class="et">'+esc(t)+"</div>"+(s?'<div class="es">'+esc(s)+"</div>":"")+"</div>";}
function sec(t,n){return '<div class="sec">'+t+' <span class="cnt">'+n+"</span></div>";}

function skeleton(){var s="";for(var i=0;i<4;i++)s+='<div class="card sk"><div class="sk-l" style="width:'+(42+i*11)+'%"></div><div class="sk-l s"></div></div>';document.getElementById("view").innerHTML=s;}
function backBtn(){try{if(CUR<0)TG.BackButton.hide();else TG.BackButton.show();}catch(e){}}

function tabsHtml(){
  var t='<button class="tab '+(CUR<0?"on":"")+'" data-act="home">🏠</button>';
  t+=ST.repos.map(function(r,i){var p=r.issues.filter(function(x){return x.pr;}).length;return '<button class="tab '+(i===CUR?"on":"")+'" data-act="tab" data-i="'+i+'">'+esc(r.short)+(p?' <b>'+p+'</b>':"")+"</button>";}).join("");
  document.getElementById("tabs").innerHTML=t;
}
function homeView(){
  var total=0,alta=0,pend=0,fails=0,anyErr=false;
  ST.repos.forEach(function(r){var c=counts(r);total+=r.issues.length;alta+=c.alta;pend+=r.issues.filter(function(x){return x.pr;}).length;fails+=r.issues.filter(function(x){return x.err;}).length;if(r.error)anyErr=true;});
  if(!total&&!anyErr){document.getElementById("view").innerHTML=empty("✨","Sin novedades del radar","El barrido semanal irá dejando hallazgos aquí. Vuelve el lunes.");return;}
  var kpi='<div class="kpi">'
    +'<div class="k"><span class="kn">'+total+'</span><span class="kl">mejoras</span></div>'
    +'<div class="k"><span class="kn" style="color:var(--r)">'+alta+'</span><span class="kl">alta</span></div>'
    +'<div class="k"><span class="kn" style="color:var(--acc)">'+pend+'</span><span class="kl">por merge</span></div>'
    +(fails?'<div class="k"><span class="kn" style="color:var(--r)">'+fails+'</span><span class="kl">fallos</span></div>':"")+'</div>';
  var cards=ST.repos.map(function(r,i){
    var c=counts(r),p=r.issues.filter(function(x){return x.pr;}).length,f=r.issues.filter(function(x){return x.err;}).length;
    return '<div class="card repo tap" data-act="repo" data-i="'+i+'">'
      +'<div class="rhead"><span class="rn">'+esc(r.short)+'</span><span class="meta">'+(r.error?'<span class="badge" style="color:var(--r)">⚠️</span>':"")+(f?'<span class="badge" style="color:var(--r)">❌ '+f+'</span>':"")+(p?'<span class="badge">🔧 '+p+'</span>':"")+r.issues.length+'<span class="chev">›</span></span></div>'
      +'<div class="pills">'+pill("alta",c.alta,i)+pill("media",c.media,i)+pill("baja",c.baja,i)+(c.none?pill("none",c.none,i):"")+'</div></div>';
  }).join("");
  document.getElementById("view").innerHTML=kpi+cards;
}
function issueCard(r,is){
  var k=r.repo+"#"+is.number,p=PR[is.prio||"none"],acts;
  if(!is.pr){
    acts='<button class="b" data-act="run" data-repo="'+esc(r.repo)+'" data-n="'+is.number+'">'+(is.err?"🔁 Reintentar":"⚙️ Ejecutar")+'</button>'
      +'<button class="b d" data-act="close" data-repo="'+esc(r.repo)+'" data-n="'+is.number+'">Descartar</button>';
  }else if(!REVIEWED[k]){
    acts='<button class="b" data-act="review" data-repo="'+esc(r.repo)+'" data-n="'+is.number+'" data-url="'+esc(is.pr.url)+'">👀 Revisar PR #'+is.pr.number+'</button>'
      +'<button class="b d" data-act="close" data-repo="'+esc(r.repo)+'" data-n="'+is.number+'">Descartar</button>';
  }else{
    acts='<button class="b" data-act="merge" data-repo="'+esc(r.repo)+'" data-n="'+is.number+'">🔀 Merge</button>'
      +'<button class="b g" data-act="open" data-url="'+esc(is.pr.url)+'">📄 Ver PR</button>';
  }
  var st=is.pr?'<div class="st">🔧 PR #'+is.pr.number+(REVIEWED[k]?" · revisado ✓":" · revísalo antes de mergear")+'</div>':(is.err?'<div class="st" style="color:var(--r)">❌ El motor falló aquí — reintenta o impleméntalo manual</div>':"");
  return '<div class="card issue" style="--pc:'+p.c+'">'
    +'<div class="itop"><span class="ip" style="color:'+p.c+'">'+p.e+" "+p.l+'</span><span class="inum">#'+is.number+'</span></div>'
    +'<div class="ititle">'+esc(is.title)+"</div>"+st
    +'<a class="ilink" data-act="open" data-url="'+esc(is.url)+'">Abrir issue ↗</a>'
    +'<div class="acts">'+acts+"</div></div>";
}
function repoView(){
  var r=ST.repos[CUR]||{issues:[]},items=r.issues;
  if(FILTER!==null)items=items.filter(function(x){return (x.prio||"none")===FILTER;});
  var pend=items.filter(function(x){return x.pr;}),fail=items.filter(function(x){return !x.pr&&x.err;}),todo=items.filter(function(x){return !x.pr&&!x.err;}),html="";
  if(r.error)html+='<div class="fbar" style="color:var(--r)"><span>⚠️ No pude cargar este repo (GitHub no respondió)</span><button class="link" data-act="refresh">Reintentar ⟳</button></div>';
  if(FILTER!==null){var p=PR[FILTER];html+='<div class="fbar"><span>'+p.e+" "+p.l+" · "+items.length+'</span><button class="link" data-act="clear">Quitar ✕</button></div>';}
  if(fail.length)html+=sec("❌ Falló el motor",fail.length)+fail.map(function(is){return issueCard(r,is);}).join("");
  if(pend.length)html+=sec("🔧 Pendientes por merge",pend.length)+pend.map(function(is){return issueCard(r,is);}).join("");
  if(todo.length)html+=sec("🆕 Por trabajar",todo.length)+todo.map(function(is){return issueCard(r,is);}).join("");
  if(!html&&!r.error)html=empty("✅","Nada por aquí"+(FILTER!==null?" con ese filtro":""),FILTER!==null?"Quita el filtro para ver todo.":"El barrido semanal irá dejando novedades.");
  document.getElementById("view").innerHTML=html;
}
function render(){
  if(CUR>=ST.repos.length)CUR=ST.repos.length?0:-1;
  document.getElementById("hsub").textContent=CUR<0?"Vigila tus repos":("📦 "+ST.repos[CUR].short);
  tabsHtml();backBtn();
  var v=document.getElementById("view");
  if(CUR<0)homeView();else repoView();
  v.classList.remove("in");void v.offsetWidth;v.classList.add("in");
}
function go(i,prio){CUR=i;FILTER=(prio==null?null:prio);h("sel");render();}
function load(first){
  if(first)skeleton();
  api("/api/state").then(function(s){
    if(s.error){document.getElementById("view").innerHTML=empty("🔒",s.error,"Abre la app desde el botón del bot.");return;}
    ST=s;render();
  }).catch(function(){document.getElementById("view").innerHTML=empty("⚠️","No pude cargar","Revisa la conexión y toca ⟳ para reintentar.");});
}
function doAct(repo,n,action){h("medium");toast("Procesando…");api("/api/action",{action:action,repo:repo,number:n}).then(function(res){h(action==="merge"?"ok":"light");toast(res.msg||"Listo");setTimeout(function(){load(false);},1500);});}
try{TG.BackButton.onClick(function(){CUR=-1;FILTER=null;h("light");render();});}catch(e){}
document.addEventListener("click",function(ev){
  var el=ev.target.closest("[data-act]");if(!el)return;var a=el.getAttribute("data-act");
  if(a==="home"){CUR=-1;FILTER=null;h("sel");render();return;}
  if(a==="tab"||a==="repo"){go(+el.getAttribute("data-i"),null);return;}
  if(a==="chip"){go(+el.getAttribute("data-i"),el.getAttribute("data-prio"));return;}
  if(a==="clear"){FILTER=null;h("light");render();return;}
  if(a==="refresh"){h("light");toast("Actualizando…");load(true);return;}
  if(a==="open"){TG.openLink(el.getAttribute("data-url"));return;}
  var repo=el.getAttribute("data-repo"),n=+el.getAttribute("data-n");
  if(a==="review"){REVIEWED[repo+"#"+n]=true;saveRev();h("light");TG.openLink(el.getAttribute("data-url"));render();toast("Abrí el PR. Revísalo y vuelve — abajo sale 🔀 Merge.");return;}
  if(a==="run"||a==="close"){doAct(repo,n,a);return;}
  if(a==="merge"){if(TG.showConfirm){TG.showConfirm("¿Mergear el PR del #"+n+"? Ya lo revisaste.",function(ok){if(ok)doAct(repo,n,"merge");});}else doAct(repo,n,"merge");return;}
});
load(true);
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Mini App
    if (url.pathname === "/app" || url.pathname === "/") {
      return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    // API de la Mini App (auth por initData)
    if (url.pathname.startsWith("/api/") && request.method === "POST") {
      const user = await ownerFromReq(request, env);
      if (!user) return json({ error: "No autorizado (abre desde el bot)." }, 401);
      if (url.pathname === "/api/state") return json(await buildState(env));
      if (url.pathname === "/api/action") {
        const b = await request.json().catch(() => ({}));
        if (!REPOS.includes(b.repo) || !/^\d+$/.test(String(b.number)) || !["run", "merge", "close"].includes(b.action)) return json({ msg: "Petición inválida" }, 400);
        return json({ msg: await doAction(env, b.action, b.repo, b.number) });
      }
      return json({ error: "no encontrado" }, 404);
    }

    // Webhook de Telegram -> /radar abre la Mini App
    if (url.pathname === "/webhook" && request.method === "POST") {
      if (env.TELEGRAM_WEBHOOK_SECRET && request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });
      const upd = await request.json().catch(() => ({}));
      const owner = env.OWNER_CHAT_ID ? String(env.OWNER_CHAT_ID) : null;
      if (upd.message) {
        const chatId = String(upd.message.chat.id);
        if (owner && chatId !== owner) return new Response("ok");
        const appUrl = url.origin + "/app";
        await tg(env, "sendMessage", { chat_id: chatId, text: "📡 *Radar del proyecto*\nTus repos, en una sola vista: novedades, mejoras y PRs listos para revisar.\n\nToca abajo para abrirlo 👇", parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📡 Abrir Radar", web_app: { url: appUrl } }]] } });
        return new Response("ok");
      }
      return new Response("ok");
    }
    return new Response("radar-bot up", { status: 200 });
  },
};
