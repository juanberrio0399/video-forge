// os_pulse_radar.mjs — PULSE de Radar para el AI OS, desde GitHub real: issues `radar`, PRs del motor con su CI,
// fallos del motor y ejecuciones de escaneo, groom, motor y CodeQL. Radar pide aprobación para merge.
// Opportunity score: se estima SOLO con lo que trae el issue (prioridad y esfuerzo); no hay evidencia de impacto,
// así que la confianza queda en "datos insuficientes" (no se inventa).
// Uso: node pipeline/os_pulse_radar.mjs <out.json>   Env: GH_TOKEN, RADAR_REPOS (coma), MOTOR_REPO
import fs from "node:fs";
import { makePulse, validatePulse } from "./lib/os_contract.mjs";

const out = process.argv[2] || "os_pulse_radar.json";
const TOKEN = process.env.GH_TOKEN;
const MOTOR = process.env.MOTOR_REPO || "juanberrio0399/video-forge";
const REPOS = (process.env.RADAR_REPOS || "juanberrio0399/video-forge,juanberrio0399/ugpp-shield-pro,juanberrio0399/serverless-rag-assistant,juanberrio0399/Hearthwood,juanberrio0399/claude-config,juanberrio0399/panel-marketing-cloud").split(",").map((s) => s.trim()).filter(Boolean);
if (!TOKEN) { console.error("falta GH_TOKEN"); process.exit(1); }
const now = Date.now();
const errors = [];

async function gh(path) {
  try {
    const r = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "ai-os-radar" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { errors.push(`${path.split("?")[0]}: HTTP ${r.status}`); return null; }
    return await r.json();
  } catch (e) { errors.push(`${path.split("?")[0]}: ${e.message}`); return null; }
}
const short = (repo) => repo.split("/").pop();
const PRIO = { alta: 3, media: 2, baja: 1 };
const EFF = { S: 3, M: 2, L: 1 };

const opportunities = [], prs = [], failures = [];
for (const repo of REPOS) {
  const issues = await gh(`/repos/${repo}/issues?labels=radar&state=open&per_page=100`);
  for (const is of issues || []) {
    if (is.pull_request || /resumen de la corrida/i.test(is.title || "")) continue;
    const body = is.body || "";
    const prio = ((body.match(/Prioridad:\**\s*(Alta|Media|Baja)/i) || [])[1] || "").toLowerCase();
    const eff = ((body.match(/Esfuerzo:\**\s*([SML])\b/i) || [])[1] || "").toUpperCase();
    const labels = (is.labels || []).map((l) => l.name);
    if (labels.includes("radar-descartado")) continue;   // descartado en revisión: ya no es oportunidad
    if (labels.includes("motor-fallo") || labels.includes("radar-no-valida")) failures.push({ repo, number: is.number, title: is.title, url: is.html_url, at: is.updated_at });
    const score = prio && eff ? Math.round(((PRIO[prio] / 3) * 0.65 + (EFF[eff] / 3) * 0.35) * 100) : null;
    opportunities.push({ repo, number: is.number, title: is.title, url: is.html_url, prio, eff, manual: labels.includes("manual"), score, created: is.created_at });
  }
  const pulls = await gh(`/repos/${repo}/pulls?state=open&per_page=50`);
  for (const pr of (pulls || []).filter((p) => /^radar\//.test((p.head && p.head.ref) || ""))) {
    const checks = await gh(`/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=50`);
    const runs = (checks && checks.check_runs) || [];
    const failed = runs.filter((c) => c.status === "completed" && !["success", "neutral", "skipped"].includes(c.conclusion)).length;
    const pending = runs.filter((c) => c.status !== "completed").length;
    const ci = checks == null ? "unknown" : failed ? "failed" : pending ? "pending" : runs.length ? "passed" : "none";
    const blocked = !!pr.draft || (pr.labels || []).some((l) => l.name === "radar-ci-rojo");
    prs.push({ repo, number: pr.number, title: pr.title, url: pr.html_url, incomplete: /\[INCOMPLETO\]/i.test(pr.title || ""), blocked, ci, created: pr.created_at });
  }
}

const wfRuns = async (file) => { const j = await gh(`/repos/${MOTOR}/actions/workflows/${file}/runs?per_page=5`); return (j && j.workflow_runs) || []; };
const [scan, groom, impl, codeql] = await Promise.all([wfRuns("radar_scan.yml"), wfRuns("radar_groom.yml"), wfRuns("radar_implement.yml"), wfRuns("codeql.yml")]);
const st = (r, active) => !r ? "idle" : r.status !== "completed" ? active : r.conclusion === "success" ? "completed" : r.conclusion === "failure" ? "failed" : "warning";

const agents = [
  { id: "research", name: "Research Agent", state: st(scan[0], "researching"), since: scan[0] && scan[0].created_at, detail: scan[0] ? `Último escaneo ${scan[0].created_at.slice(0, 10)}` : "Sin escaneos" },
  { id: "repository", name: "Repository Agent", state: st(groom[0], "analyzing"), since: groom[0] && groom[0].created_at, detail: `${opportunities.length} oportunidades abiertas` },
  { id: "code", name: "Code Agent", state: impl.some((r) => r.status !== "completed") ? "executing" : st(impl[0], "executing"), since: impl[0] && impl[0].created_at, detail: `${prs.length} PR(s) del motor abiertos` },
  { id: "security", name: "Security Agent", state: st(codeql[0], "analyzing"), since: codeql[0] && codeql[0].created_at, detail: codeql[0] ? `CodeQL ${codeql[0].conclusion || codeql[0].status}` : "Sin análisis" },
];

const activity = [];
for (const r of [...scan, ...groom, ...impl].filter((x) => x.status === "completed")) activity.push({ at: r.updated_at, agent: r.name.includes("barrido") ? "Research Agent" : r.name.includes("groomer") || r.name.includes("consolidar") ? "Repository Agent" : "Code Agent", text: `${r.name}: ${r.conclusion === "success" ? "terminó" : "falló"}`, kind: "run", trust: "executed" });
for (const p of prs) activity.push({ at: p.created, agent: "Code Agent", text: `Preparó PR #${p.number} en ${short(p.repo)}: ${p.title}`, kind: "pr", trust: "prepared" });

const tasks = impl.slice(0, 5).map((r) => ({ id: String(r.id), name: r.display_title || "Implementar issue", agent: "Code Agent", status: r.status === "queued" ? "QUEUED" : r.status !== "completed" ? "RUNNING" : r.conclusion === "success" ? "COMPLETED" : r.conclusion === "cancelled" ? "CANCELLED" : "FAILED", started: r.created_at, updated: r.updated_at, url: r.html_url }));

const needs = [];
const CI_TXT = { passed: "CI en verde", none: "El repo no tiene CI: revisa el diff antes de mergear", pending: "CI todavía corriendo", failed: "El CI falla", unknown: "No se pudo leer el CI" };
const mergeable = (x) => !x.incomplete && !x.blocked && (x.ci === "passed" || x.ci === "none");
for (const p of prs.filter(mergeable).slice(0, 6)) needs.push({ id: `radar-merge-${short(p.repo)}-${p.number}`, title: `Merge PR #${p.number} · ${short(p.repo)}`, why: p.title, evidence: `${CI_TXT[p.ci]} · preparado por el motor`, severity: "info", autonomy: "APPROVAL", risk: p.ci === "passed" ? "low" : "medium", actions: [{ id: "review", label: "Revisar", kind: "open" }], url: p.url, created_at: p.created });
for (const p of prs.filter((x) => x.incomplete || x.blocked || x.ci === "failed").slice(0, 4)) needs.push({ id: `radar-fix-${short(p.repo)}-${p.number}`, title: `PR #${p.number} necesita arreglo · ${short(p.repo)}`, why: p.title, evidence: p.incomplete ? "El motor lo marcó [INCOMPLETO]" : p.blocked ? "Borrador: no pasó toda la validación" : CI_TXT.failed, severity: "warn", autonomy: "REVIEW", actions: [{ id: "open", label: "Ver PR", kind: "open" }], url: p.url, created_at: p.created });
for (const f of failures.slice(0, 4)) needs.push({ id: `radar-fail-${short(f.repo)}-${f.number}`, title: `El motor falló en #${f.number} · ${short(f.repo)}`, why: f.title, evidence: "Etiqueta motor-fallo", severity: "warn", autonomy: "REVIEW", actions: [{ id: "open", label: "Ver", kind: "open" }], url: f.url, created_at: f.at });

const top = opportunities.filter((o) => o.score != null && !o.manual).sort((a, b) => b.score - a.score).slice(0, 3);
const insights = top.map((o) => ({ what: `${o.title}`, why: `${short(o.repo)} · prioridad ${o.prio}, esfuerzo ${o.eff}`, impact: `Score estimado ${o.score}/100 (prioridad × esfuerzo)`, action: "Preparar el plan desde Radar", confidence: null }));

const metrics = [
  { key: "opportunities", label: "Oportunidades", value: opportunities.length, timeframe: "abiertas", context: `${REPOS.length} repos` },
  { key: "prs_ready", label: "PRs listos", value: prs.filter(mergeable).length, timeframe: "ahora", context: `${prs.length} abiertos` },
  { key: "motor_failures", label: "Fallos del motor", value: failures.length, timeframe: "abiertos" },
];

const status = errors.length > REPOS.length ? "degraded" : failures.length >= 3 ? "attention" : needs.length ? "attention" : "normal";
const readyN = metrics[1].value;
const headline = readyN ? `${readyN} mejora${readyN > 1 ? "s" : ""} lista${readyN > 1 ? "s" : ""} para merge` : opportunities.length ? `${opportunities.length} oportunidades por trabajar` : "Sin oportunidades nuevas";
const sub = `${REPOS.length} repos vigilados${failures.length ? ` · ${failures.length} fallo${failures.length > 1 ? "s" : ""} del motor` : ""}`;

const pulse = makePulse({ system: "radar", status, headline, sub, agents, activity, tasks, needs, insights, metrics }, now);
const v = validatePulse(pulse);
fs.writeFileSync(out, JSON.stringify({ ...pulse, source_errors: errors.slice(0, 10) }, null, 2));
console.log(`pulse radar: ${pulse.status} · "${pulse.headline}" · oportunidades ${opportunities.length} · PRs ${prs.length} · fallos ${failures.length} · decisiones ${pulse.needs.length} · errores de fuente ${errors.length} · válido ${v.ok}`);
