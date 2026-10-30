// produccion_oddly.mjs — agrega al estado del canal (auto2_state.json) cuantas corridas de
// produce_oddly sacaron video en las ultimas 24 h, y deja el texto de la alerta en
// produccion_alerta_msg.txt si menos de la mitad produjo (una vez al dia; lo manda el workflow).
//
// Lee GitHub (no R2): las corridas, el paso de subida de cada una y la advertencia
// "Oddly sin video" que deja el paso del guion. Asi no hay escrituras que choquen entre
// corridas simultaneas. Nunca tumba el reporte: ante cualquier error sale 0 sin tocar nada.
//
// Env: GH_TOKEN (github.token con actions:read y checks:read), GITHUB_REPOSITORY.
import fs from "node:fs";
import { PASO_SUBIDA, TITULO_AVISO, resumir, mensaje } from "./lib/produccion.mjs";

const HORAS = 24;
const TOKEN = process.env.GH_TOKEN, REPO = process.env.GITHUB_REPOSITORY;
// GitHub responde 502/503 de vez en cuando: hasta 3 intentos antes de rendirse.
const api = async (ruta) => {
  for (let intento = 1; ; intento++) {
    const r = await fetch(`https://api.github.com/repos/${REPO}${ruta}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(20000),
    }).catch((e) => ({ ok: false, status: e.name }));
    if (r.ok) return r.json();
    if (intento >= 3 || (typeof r.status === "number" && r.status < 500)) throw new Error(`${ruta} -> ${r.status}`);
    await new Promise((s) => setTimeout(s, 2000 * intento));
  }
};

async function main() {
  if (!TOKEN || !REPO) { console.log("produccion: sin GH_TOKEN/GITHUB_REPOSITORY; salto"); return; }
  const desde = new Date(Date.now() - HORAS * 3600e3).toISOString();
  const { workflow_runs: runs = [] } = await api(
    `/actions/workflows/produce_oddly.yml/runs?status=completed&per_page=60&created=>${desde}`);

  const corridas = [];
  let sinLeer = 0;
  for (const run of runs) {
    let jobs;
    try { ({ jobs = [] } = await api(`/actions/runs/${run.id}/jobs`)); }
    catch (e) { sinLeer++; console.log(`  corrida ${run.id}: no se pudo leer (${e.message}); no se cuenta`); continue; }
    let subida = null, motivo = "";
    for (const job of jobs) {
      const paso = (job.steps || []).find((s) => s.name.startsWith(PASO_SUBIDA));
      if (paso) subida = paso.conclusion;
      if (run.conclusion === "success" && subida !== "success") {
        const avisos = await api(`/check-runs/${job.id}/annotations`).catch(() => []);
        const a = avisos.find((x) => x.title === TITULO_AVISO);
        if (a) motivo = a.message;
      }
    }
    corridas.push({ conclusion: run.conclusion, subida, motivo });
  }

  const r = resumir(corridas);
  r.sin_leer = sinLeer;
  console.log(`Produccion ${HORAS} h: ${r.videos} video(s) de ${r.corridas} corridas` +
    ` · ${r.sin_video} sin video · ${r.fallidas} fallida(s) · ${r.canceladas} cancelada(s)`);
  for (const [m, n] of Object.entries(r.motivos)) console.log(`  ${n}x ${m}`);

  try {
    const st = JSON.parse(fs.readFileSync("auto2_state.json", "utf8"));
    st.produccion_24h = { ...r, revisado: new Date().toISOString() };
    fs.writeFileSync("auto2_state.json", JSON.stringify(st, null, 2));
  } catch (e) { console.log(`produccion: no pude escribir auto2_state.json (${e.message})`); }

  // Una alerta por dia: produccion_alerta.txt (de R2) guarda la fecha de la ultima.
  const hoy = new Date().toISOString().slice(0, 10);
  let ultima = ""; try { ultima = fs.readFileSync("produccion_alerta.txt", "utf8").trim(); } catch {}
  if (r.alerta && ultima !== hoy) {
    fs.writeFileSync("produccion_alerta_msg.txt", mensaje(r, HORAS));
    fs.writeFileSync("produccion_alerta.txt", hoy);
  }
}

main().catch((e) => console.log(`produccion: no se pudo revisar (${e.message}); el reporte sigue`));
