// llm.mjs — Generación de TEXTO con CADENA de proveedores de IA GRATIS (sin tarjeta), para máxima
// capacidad y CERO frenos por cuota. Prueba en orden y usa el primero que tenga key y responda:
//   Gemini -> Cerebras -> Groq -> Cloudflare Workers AI -> SambaNova -> OpenRouter -> GitHub Models.
// Los proveedores SIN key se saltan solos: Juan va agregando keys (secrets) y se activan automáticamente.
// Casi todos son OpenAI-compatible; Gemini y Cloudflare son nativos. Con json=true pide JSON válido.
//
//   import { genText } from "./llm.mjs";
//   const raw = await genText(PROMPT, { json: true });
//
// Env (todas opcionales): GEMINI_API_KEY(,2), CLOUDFLARE_ACCOUNT_ID+CLOUDFLARE_API_TOKEN,
//   GROQ_API_KEY, CEREBRAS_API_KEY, SAMBANOVA_API_KEY, OPENROUTER_API_KEY, GITHUB_MODELS_TOKEN.
import { TEXT_MODELS } from "./_models.mjs";

const tf = (u, o = {}, ms = 60000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });
function cleanJson(t) { t = String(t || "").replace(/```json|```/g, "").trim(); const a = t.indexOf("{"), b = t.lastIndexOf("}"); return (a >= 0 && b > a) ? t.slice(a, b + 1) : t; }

// ---- Gemini (nativo)
const GKEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
async function gemini(prompt, json) {
  for (let r = 0; r < 2; r++) for (const k of GKEYS) for (const m of TEXT_MODELS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: json ? { responseMimeType: "application/json", temperature: 0.9 } : { temperature: 0.9 } }) }, 45000);
      if (res.status === 429) { await new Promise((s) => setTimeout(s, 1000)); continue; }
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      if (t) return t;
    } catch {}
  }
  return null;
}

// ---- Cloudflare Workers AI (nativo)
async function cloudflare(prompt, json) {
  const A = process.env.CLOUDFLARE_ACCOUNT_ID, T = process.env.CLOUDFLARE_API_TOKEN;
  if (!A || !T) return null;
  for (const m of ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast", "@cf/meta/llama-3.1-8b-instruct"]) {
    try {
      const res = await tf(`https://api.cloudflare.com/client/v4/accounts/${A}/ai/run/${m}`, { method: "POST", headers: { Authorization: `Bearer ${T}`, "content-type": "application/json" }, body: JSON.stringify({ messages: [...(json ? [{ role: "system", content: "Respond ONLY with a single valid, minified JSON object. No markdown, no prose." }] : []), { role: "user", content: prompt }], temperature: 0.9, max_tokens: 2048 }) });
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.result?.response || "").trim();
      if (t) return json ? cleanJson(t) : t;
    } catch {}
  }
  return null;
}

// ---- OpenAI-compatible genérico (Groq, Cerebras, SambaNova, OpenRouter, GitHub Models)
function oai(name, url, key, model, extra = {}) {
  if (!key) return null;
  return { name, async run(prompt, json) {
    try {
      const body = { model, messages: [...(json ? [{ role: "system", content: "Respond ONLY with a single valid, minified JSON object. No markdown, no code fences, no prose." }] : []), { role: "user", content: prompt }], temperature: 0.9 };
      if (json) body.response_format = { type: "json_object" };
      const r = await tf(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
      if (!r.ok) return null;
      const j = await r.json();
      const t = j?.choices?.[0]?.message?.content || "";
      return t ? (json ? cleanJson(t) : t.trim()) : null;
    } catch { return null; }
  } };
}

// Cadena de proveedores GRATIS (orden por generosidad/velocidad). Se saltan los que no tengan key.
const PROVIDERS = [
  { name: "Gemini", run: gemini, on: GKEYS.length ? 1 : 0 },
  oai("Cerebras", "https://api.cerebras.ai/v1/chat/completions", process.env.CEREBRAS_API_KEY, "llama-3.3-70b"),
  oai("Groq", "https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, "llama-3.3-70b-versatile"),
  { name: "Cloudflare", run: cloudflare, on: (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) ? 1 : 0 },
  oai("SambaNova", "https://api.sambanova.ai/v1/chat/completions", process.env.SAMBANOVA_API_KEY, "Meta-Llama-3.3-70B-Instruct"),
  oai("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, "meta-llama/llama-3.3-70b-instruct:free", { "HTTP-Referer": "https://github.com/juanberrio0399/video-forge", "X-Title": "video-forge" }),
  oai("GitHub Models", "https://models.inference.ai.azure.com/chat/completions", process.env.GITHUB_MODELS_TOKEN, "gpt-4o-mini"),
].filter(Boolean).filter((p) => p.on !== 0);

// Genera texto probando la cadena de proveedores gratis. Devuelve string o null.
export async function genText(prompt, { json = true } = {}) {
  for (const p of PROVIDERS) {
    try { const t = await p.run(prompt, json); if (t) { if (p.name !== "Gemini") console.error(`Texto por ${p.name} (proveedor gratis de respaldo)`); return t; } } catch {}
  }
  console.error("Ningún proveedor de IA respondió (revisa keys/cuotas).");
  return null;
}
