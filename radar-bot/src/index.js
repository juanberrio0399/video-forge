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
  const repos = await Promise.all(REPOS.map(async (repo) => {
    const issues = [];
    try {
      const [map, r] = await Promise.all([prMap(env, repo), gh(env, `/repos/${repo}/issues?labels=radar&state=open&per_page=50`)]);
      if (r.ok) {
        const list = (await r.json()).filter((is) => !is.pull_request);
        for (const is of list) issues.push({ number: is.number, title: is.title, url: is.html_url, prio: prioOf(is.body), pr: map[String(is.number)] || null });
        issues.sort((a, b) => rank(a.prio) - rank(b.prio));
      }
    } catch {}
    return { repo, short: short(repo), issues };
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

// ---------- Mini App (HTML) ----------
const APP_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<title>Radar</title><style>
:root{--bg:var(--tg-theme-bg-color,#0f1115);--fg:var(--tg-theme-text-color,#e8eaed);--hint:var(--tg-theme-hint-color,#8a8f98);--card:var(--tg-theme-secondary-bg-color,#191c22);--btn:var(--tg-theme-button-color,#2ea6ff);--btnfg:var(--tg-theme-button-text-color,#fff);--line:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 -apple-system,system-ui,sans-serif;padding:10px}
h1{font-size:16px;margin:2px 0 10px}.tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px}
.tab{white-space:nowrap;padding:6px 12px;border-radius:999px;background:var(--card);color:var(--fg);border:1px solid var(--line);font-size:13px}
.tab.on{background:var(--btn);color:var(--btnfg);border-color:var(--btn)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 12px;margin-bottom:9px}
.prio{font-size:11px;font-weight:700}.title{font-weight:600;font-size:14px;margin:3px 0 8px}
.muted{color:var(--hint);font-size:12px}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.btn{flex:1;min-width:44%;padding:9px;border:0;border-radius:10px;background:var(--btn);color:var(--btnfg);font-weight:700;font-size:13px}
.btn.g{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn.d{background:transparent;color:#ff5c5c;border:1px solid rgba(255,92,92,.4)}
a{color:var(--btn);text-decoration:none}.empty{text-align:center;color:var(--hint);padding:30px 10px}
.sec{font-weight:700;font-size:13px;margin:14px 2px 6px}
.home{cursor:pointer}.hrow{display:flex;justify-content:space-between;align-items:center;gap:8px}
.rname{font-weight:700;font-size:14px}.chips{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
.chip{padding:5px 10px;border-radius:999px;background:var(--bg);border:1px solid var(--line);font-size:13px;font-weight:700}
.chip.z{opacity:.35;font-weight:400}.sum{color:var(--hint);font-size:12px;margin:0 2px 11px}
.fbar{display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:7px 11px;margin-bottom:9px;font-size:13px}
.fbar button{background:transparent;color:var(--btn);border:0;font-weight:700;font-size:13px}
#toast{position:fixed;left:10px;right:10px;bottom:10px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;display:none;z-index:9}
</style></head><body>
<h1>📡 Radar</h1><div class="tabs" id="tabs"></div><div id="list"></div><div id="toast"></div>
<script>
var TG=window.Telegram.WebApp;TG.ready();TG.expand();
var INIT=TG.initData||"";var ST={repos:[]},CUR=-1,FILTER=null,REVIEWED={};
try{REVIEWED=JSON.parse(localStorage.getItem("radar_reviewed")||"{}");}catch(e){}
function saveReviewed(){try{localStorage.setItem("radar_reviewed",JSON.stringify(REVIEWED));}catch(e){}}
function api(path,body){return fetch(path,{method:"POST",headers:{"content-type":"application/json","x-init-data":INIT},body:JSON.stringify(body||{})}).then(function(r){return r.json();});}
function toast(t){var e=document.getElementById("toast");e.textContent=t;e.style.display="block";clearTimeout(window._tt);window._tt=setTimeout(function(){e.style.display="none";},4000);}
function esc(s){return (s||"").replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
function prioBadge(p){var m={alta:["🔴","Alta"],media:["🟡","Media"],baja:["🟢","Baja"]}[p]||["⚪","Sin prioridad"];return '<span class="prio">'+m[0]+' '+m[1]+'</span>';}
function load(){api("/api/state").then(function(s){if(s.error){document.getElementById("list").innerHTML='<div class="empty">'+esc(s.error)+'</div>';return;}ST=s;render();});}
function card(r,is){
  var k=r.repo+"#"+is.number;var btns;
  if(!is.pr){
    btns='<button class="btn" onclick="act(\\''+r.repo+'\\','+is.number+',\\'run\\')">⚙️ Ejecutar</button>'
      +'<button class="btn d" onclick="act(\\''+r.repo+'\\','+is.number+',\\'close\\')">🗑️ Descartar</button>';
  } else if(!REVIEWED[k]){
    btns='<button class="btn" onclick="review(\\''+r.repo+'\\','+is.number+',\\''+is.pr.url+'\\')">👀 Revisar PR #'+is.pr.number+'</button>'
      +'<button class="btn d" onclick="act(\\''+r.repo+'\\','+is.number+',\\'close\\')">🗑️ Descartar</button>';
  } else {
    btns='<button class="btn" onclick="act(\\''+r.repo+'\\','+is.number+',\\'merge\\')">🔀 Merge (ya lo revisé)</button>'
      +'<button class="btn g" onclick="openPR(\\''+is.pr.url+'\\')">📄 Ver PR de nuevo</button>';
  }
  return '<div class="card">'+prioBadge(is.prio)+' · <span class="muted">#'+is.number+'</span>'
    +'<div class="title">'+esc(is.title)+'</div>'
    +(is.pr?'<div class="muted">🔧 PR #'+is.pr.number+' listo'+(REVIEWED[k]?' · revisado ✓':' — revísalo antes de mergear')+'</div>':'')
    +'<div class="muted"><a href="'+is.url+'" target="_blank">Abrir issue ↗</a></div>'
    +'<div class="row">'+btns+'</div></div>';
}
function counts(r){var c={alta:0,media:0,baja:0,none:0};r.issues.forEach(function(x){var k=x.prio||'none';c[k]=(c[k]||0)+1;});return c;}
function chip(i,prio,emoji,n){return '<span class="chip'+(n?'':' z')+'" onclick="event.stopPropagation();go('+i+',\\''+prio+'\\')">'+emoji+' '+n+'</span>';}
function go(i,prio){CUR=i;FILTER=(prio==null)?null:prio;render();}
function tabsHtml(){
  var t='<div class="tab '+(CUR<0?'on':'')+'" onclick="CUR=-1;FILTER=null;render()">🏠 Inicio</div>';
  t+=ST.repos.map(function(r,i){var pend=r.issues.filter(function(x){return x.pr;}).length;return '<div class="tab '+(i===CUR?'on':'')+'" onclick="go('+i+',null)">📦 '+esc(r.short)+' ('+r.issues.length+(pend?' · 🔧'+pend:'')+')</div>';}).join("");
  return t;
}
function renderHome(){
  var total=0,pend=0,alta=0;
  var cards=ST.repos.map(function(r,i){
    var c=counts(r);total+=r.issues.length;alta+=c.alta;
    var p=r.issues.filter(function(x){return x.pr;}).length;pend+=p;
    return '<div class="card home" onclick="go('+i+',null)">'
      +'<div class="hrow"><span class="rname">📦 '+esc(r.short)+'</span><span class="muted">'+r.issues.length+' issue'+(r.issues.length===1?'':'s')+(p?' · 🔧'+p+' PR':'')+'</span></div>'
      +'<div class="chips">'+chip(i,'alta','🔴',c.alta)+chip(i,'media','🟡',c.media)+chip(i,'baja','🟢',c.baja)+(c.none?chip(i,'none','⚪',c.none):'')+'</div>'
    +'</div>';
  }).join("");
  document.getElementById("tabs").innerHTML=tabsHtml();
  var head='<div class="sum">'+ST.repos.length+' repos · '+total+' mejora'+(total===1?'':'s')+' · 🔴 '+alta+' alta'+(pend?' · 🔧 '+pend+' por merge':'')+'</div>';
  document.getElementById("list").innerHTML=total?(head+cards):'<div class="empty">✅ Sin issues del radar todavía.<br>El barrido semanal irá dejando novedades.</div>';
}
function render(){
  if(CUR>=ST.repos.length)CUR=ST.repos.length?0:-1;
  if(CUR<0){renderHome();return;}
  document.getElementById("tabs").innerHTML=tabsHtml();
  var r=ST.repos[CUR]||{issues:[]};
  var items=r.issues;
  if(FILTER!==null)items=items.filter(function(x){return (x.prio||'none')===FILTER;});
  var pend=items.filter(function(x){return x.pr;});
  var todo=items.filter(function(x){return !x.pr;});
  var html="";
  if(FILTER!==null){var lbl={alta:'🔴 Alta',media:'🟡 Media',baja:'🟢 Baja',none:'⚪ Sin prioridad'}[FILTER]||FILTER;html+='<div class="fbar"><span>Filtrando: '+lbl+' ('+items.length+')</span><button onclick="FILTER=null;render()">Quitar ✕</button></div>';}
  if(pend.length){ html+='<div class="sec">🔧 Pendientes por merge ('+pend.length+')</div>'+pend.map(function(is){return card(r,is);}).join(""); }
  if(todo.length){ html+='<div class="sec">🆕 Por trabajar ('+todo.length+')</div>'+todo.map(function(is){return card(r,is);}).join(""); }
  if(!html) html='<div class="empty">✅ Nada aquí'+(FILTER!==null?' con ese filtro.':'.<br>El barrido semanal irá dejando novedades.')+'</div>';
  document.getElementById("list").innerHTML=html;
}
function openPR(u){TG.openLink(u);}
function review(repo,n,prUrl){REVIEWED[repo+"#"+n]=true;saveReviewed();TG.openLink(prUrl);render();toast("Abrí el PR. Revísalo y VUELVE aquí — abajo aparece 🔀 Merge.");}
function doAct(repo,n,action){toast("Procesando…");api("/api/action",{action:action,repo:repo,number:n}).then(function(res){toast(res.msg||"Listo");setTimeout(load,1500);});}
function act(repo,n,action){
  if(action==="merge"&&TG.showConfirm){TG.showConfirm("¿Mergear el PR del #"+n+"? Ya lo revisaste.",function(ok){if(ok)doAct(repo,n,action);});return;}
  doAct(repo,n,action);
}
load();
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
        await tg(env, "sendMessage", { chat_id: chatId, text: "📡 Radar — control de novedades por repo. Ábrelo:", reply_markup: { inline_keyboard: [[{ text: "📡 Abrir Radar", web_app: { url: appUrl } }]] } });
        return new Response("ok");
      }
      return new Response("ok");
    }
    return new Response("radar-bot up", { status: 200 });
  },
};
