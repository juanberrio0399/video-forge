// freeai_probe.mjs — SONDA: descubre el contrato real de la API de video de Free.ai (modelos,
// formato de request/response, sincrono vs asincrono, campo de uso). Imprime todo en crudo.
// Uso: node pipeline/freeai_probe.mjs
// Env: FREEAI_API_KEY
const KEY = process.env.FREEAI_API_KEY;
const BASE = "https://api.free.ai";
if (!KEY) { console.log("Falta FREEAI_API_KEY"); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const show = (t, s) => console.log(`\n===== ${t} =====\n${s}`);

// 1) Modelos disponibles (para saber el string exacto de CogVideoX / video self-hosted).
try {
  const r = await fetch(`${BASE}/v1/models`, { headers: H });
  const t = await r.text();
  show(`GET /v1/models  [${r.status}]`, t.slice(0, 4000));
} catch (e) { show("GET /v1/models ERROR", e.message); }

// 2) Intentar generar un video corto con candidatos de modelo self-hosted.
const prompt = "cinematic aerial establishing shot of a modern city skyline at golden hour, film look, smooth camera push in";
for (const model of ["CogVideoX", "cogvideox", "cogvideox-5b", "self-hosted/cogvideox", "cogvideox-2b"]) {
  try {
    const r = await fetch(`${BASE}/v1/video/generate/`, {
      method: "POST", headers: H,
      body: JSON.stringify({ prompt, duration: 4, model }),
    });
    const t = await r.text();
    show(`POST /v1/video/generate  model=${model}  [${r.status}]`, t.slice(0, 3000));
    // Si arranca bien (2xx) o da un error claro de "modelo no existe", ya aprendimos.
    if (r.ok) { console.log(`\n>>> MODELO QUE FUNCIONA: ${model}`); break; }
    // 400 con "unknown model" -> probar el siguiente; otros errores -> parar (no gastar).
    if (r.status !== 400 && r.status !== 404 && r.status !== 422) break;
  } catch (e) { show(`POST video model=${model} ERROR`, e.message); }
}
