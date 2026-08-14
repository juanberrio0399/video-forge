// error_learn.mjs — IDENTIFICA los errores (runs fallidos), los ANALIZA con IA, los REGISTRA en un
// ledger que crece, detecta PATRONES recurrentes y sugiere la mejora. Asi el sistema "aprende dia
// con dia": lo transitorio ya lo reintenta el watchdog; lo recurrente/codigo sale como patron para
// resolverlo de raiz.
// Uso: node pipeline/error_learn.mjs <ledger_in.json> <ledger_out.json>
// Env: GH_TOKEN, GH_REPO (owner/repo), GEMINI_API_KEY
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [inLedger = "error_log.json", outLedger = "error_log.json"] = process.argv.slice(2);
const { GH_TOKEN, GH_REPO, GEMINI_API_KEY } = process.env;
const H = { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "video-forge" };
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function gh(path) { try { const r = await fetch(`https://api.github.com${path}`, { headers: H }); return r.ok ? await r.json() : null; } catch { return null; } }
async function gemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  for (const m of TEXT_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      });
      if (r.status === 429 || r.status === 503) { await sleep(6000); continue; }
      if (!r.ok) continue;
      const j = await r.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      return JSON.parse(t);
    } catch {}
  }
  return null;
}

let ledger = { incidents: [], patterns: [], updated_at: null };
try { ledger = JSON.parse(fs.readFileSync(inLedger, "utf8")); } catch {}
if (!Array.isArray(ledger.incidents)) ledger.incidents = [];

// 1) Runs fallidos recientes (48h), uno por workflow (el ultimo).
const runsJson = await gh(`/repos/${GH_REPO}/actions/runs?per_page=50`);
const failed = (runsJson?.workflow_runs || []).filter((r) => r.conclusion === "failure" && (Date.now() - Date.parse(r.updated_at)) < 48 * 3600 * 1000);
const seen = new Set(); const fresh = [];
for (const r of failed) { if (seen.has(r.path)) continue; seen.add(r.path); fresh.push(r); }

async function errTail(runId) {
  const jobs = await gh(`/repos/${GH_REPO}/actions/runs/${runId}/jobs`);
  const job = (jobs?.jobs || []).find((j) => j.conclusion === "failure") || (jobs?.jobs || []).find((j) => j.conclusion === "cancelled");
  if (!job) return { step: "", tail: "" };
  const step = ((job.steps || []).find((s) => s.conclusion === "failure") || {}).name || job.name;
  try {
    const lr = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/jobs/${job.id}/logs`, { headers: H });
    if (!lr.ok) return { step, tail: `(sin log HTTP ${lr.status})` };
    const t = await lr.text();
    const lines = t.split("\n").map((l) => l.replace(/^\S+\s/, "")).filter((l) => l.trim());
    return { step, tail: lines.slice(-25).join("\n").slice(-1500) };
  } catch { return { step, tail: "" }; }
}

const newInc = [];
for (const r of fresh) {
  if (ledger.incidents.some((i) => i.run_id === r.id)) continue; // ya analizado
  const { step, tail } = await errTail(r.id);
  const cls = await gemini(
    `Eres SRE. Un workflow de GitHub Actions FALLO. Devuelve SOLO JSON: {"cause":"1 frase en ESPAÑOL de la causa raiz","category":"transitorio|config|codigo|datos","fix":"1 frase en ESPAÑOL de como resolverlo/prevenirlo"}.\nWorkflow: ${r.name}\nPaso: ${step}\nLog (cola):\n${tail || "(vacio)"}`
  );
  const c = (cls && (Array.isArray(cls) ? cls[0] : cls)) || {};
  const inc = { run_id: r.id, workflow: (r.path || "").split("/").pop(), name: r.name, step, at: r.updated_at, url: r.html_url, cause: c.cause || "(sin analisis)", category: c.category || "desconocido", fix: c.fix || "" };
  ledger.incidents.push(inc); newInc.push(inc);
}

ledger.incidents = ledger.incidents.slice(-60); // historial acotado
// Patrones: cuenta por (workflow · categoria); recurrente = >=2.
const counts = {};
for (const i of ledger.incidents) { const k = i.workflow + " · " + i.category; counts[k] = (counts[k] || 0) + 1; }
ledger.patterns = Object.entries(counts).map(([key, count]) => ({ key, count })).filter((p) => p.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8);
ledger.updated_at = new Date().toISOString();
fs.writeFileSync(outLedger, JSON.stringify(ledger, null, 2));

console.log(`Errores: ${newInc.length} nuevos analizados. Incidentes en el ledger: ${ledger.incidents.length}. Patrones recurrentes: ${ledger.patterns.length}.`);
newInc.forEach((i) => console.log(`  - ${i.workflow} [${i.category}]: ${i.cause} -> ${i.fix}`));
if (newInc.length) fs.writeFileSync("error_new.txt", newInc.map((i) => `⚠️ ${i.name} [${i.category}]: ${i.cause}\n   → ${i.fix}`).join("\n\n"));
if (ledger.patterns.length) fs.writeFileSync("error_patterns.txt", ledger.patterns.map((p) => `🔁 ${p.key} (${p.count} veces)`).join("\n"));
