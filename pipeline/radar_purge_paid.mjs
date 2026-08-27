// radar_purge_paid.mjs — limpieza ONE-SHOT: cierra los issues `radar` ABIERTOS cuya solución
// DEPENDE de algo de PAGO. Clasifica con la cadena de IA GRATIS (llm.mjs). CONSERVADOR: solo cierra
// si es imposible hacerlo gratis. Deja comentario y cierra como "not planned". Reporta a Telegram.
// Env: GH_TOKEN (PAT con acceso a los repos), keys de IA (GEMINI/GROQ/…), TELEGRAM_* (resumen).
import { genText } from "./llm.mjs";
import fs from "node:fs";

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "radar-purge" };
const REPOS = ["video-forge", "serverless-rag-assistant", "panel-marketing-cloud", "dataforge-cloud", "validador-cloud", "ugpp-shield-pro", "Hearthwood", "claude-config", "dockerized-data-tool", "aws-labs", "juanberrio0399.github.io"].map((r) => (r.includes("/") ? r : `juanberrio0399/${r}`));
const DRY = process.env.DRY_RUN === "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let closed = 0, kept = 0, errors = 0;
const closedList = [];

for (const repo of REPOS) {
  let issues = [];
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/issues?labels=radar&state=open&per_page=100`, { headers: H });
    issues = await r.json();
    if (!Array.isArray(issues)) { console.error(repo, "→ no pude listar:", JSON.stringify(issues).slice(0, 120)); continue; }
  } catch (e) { console.error(repo, "→", e.message); continue; }
  issues = issues.filter((i) => !i.pull_request); // la API de issues incluye PRs
  console.log(`\n=== ${repo}: ${issues.length} issues radar abiertos ===`);
  for (const it of issues) {
    const body = (it.body || "").slice(0, 2500);
    const q = `Un "issue" propone una mejora para un repositorio. ¿La solución propuesta REQUIERE OBLIGATORIAMENTE pagar para funcionar (servicio/API/plan de pago, suscripción, créditos que se compran, o algo que pida tarjeta de crédito)? Responde paid=true SOLO si es IMPOSIBLE lograrlo gratis (ni open-source ni free tier sin tarjeta). Si hay una forma gratis, o el cambio no implica costo (código, config, docs, seguridad, SEO con herramientas gratis), responde paid=false. Sé conservador: ante la duda, paid=false. Devuelve SOLO JSON: {"paid": true|false, "reason": "motivo breve"}.

Título: ${it.title}

Cuerpo:
${body}`;
    let v = {};
    try { const t = await genText(q, { json: true }); v = typeof t === "string" ? JSON.parse(t) : (t || {}); } catch { v = {}; }
    if (v && v.paid === true) {
      if (DRY) { console.log(`  [DRY] cerraría #${it.number}: ${it.title} — ${v.reason || ""}`); closed++; closedList.push(`${repo}#${it.number} ${it.title}`); }
      else {
        try {
          await fetch(`https://api.github.com/repos/${repo}/issues/${it.number}/comments`, { method: "POST", headers: H, body: JSON.stringify({ body: `Closed by the project radar: the proposed solution depends on a paid tool/service, and the radar is now free-only. Reason: ${v.reason || "paid dependency"}.` }) });
          const cr = await fetch(`https://api.github.com/repos/${repo}/issues/${it.number}`, { method: "PATCH", headers: H, body: JSON.stringify({ state: "closed", state_reason: "not_planned" }) });
          if (cr.ok) { closed++; closedList.push(`${repo}#${it.number} ${it.title}`); console.log(`  ✖ cerrado #${it.number}: ${it.title} (${v.reason || ""})`); }
          else { errors++; console.error("  no pude cerrar", it.number, cr.status); }
        } catch (e) { errors++; console.error("  error", it.number, e.message); }
      }
    } else { kept++; }
    await sleep(1200); // no saturar la IA gratis
  }
}

const summary = `🧹 Radar — limpieza de issues DE PAGO:\n${DRY ? "(simulación) " : ""}${closed} cerrados (de pago) · ${kept} conservados (gratis) · ${errors} errores.`;
console.log(`\n${summary}`);
fs.writeFileSync("purge_report.txt", summary + "\n" + closedList.map((x) => "• " + x).join("\n"));
