// llm.mjs — Generación de TEXTO con FALLBACK multi-proveedor GRATIS, para que la cuota nunca frene
// el pipeline: 1) Gemini (Flash) -> 2) Cloudflare Workers AI (Llama 3.3, ya lo tienes). Ambos gratis.
// OpenAI-compatible por dentro; devuelve el texto (string) o null. Con json=true pide JSON válido.
//
//   import { genText } from "./llm.mjs";
//   const raw = await genText(PROMPT, { json: true });
//
// Env: GEMINI_API_KEY(,2) y/o CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.
import { TEXT_MODELS } from "./_models.mjs";

const GKEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const CF_ACCT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast", "@cf/meta/llama-3.1-8b-instruct"];
const tf = (u, o = {}, ms = 45000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

// Si viene JSON envuelto en texto/markdown, recorta al primer objeto {...} válido.
function cleanJson(t) {
  t = String(t || "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return t.slice(a, b + 1);
  return t;
}

async function tryGemini(prompt, json) {
  for (let round = 0; round < 2; round++) for (const k of GKEYS) for (const m of TEXT_MODELS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: json ? { responseMimeType: "application/json", temperature: 0.9 } : { temperature: 0.9 } }),
      });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 1200)); continue; } // cuota/límite -> reintenta/otro modelo
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      if (t) return t;
    } catch {}
  }
  return null;
}

async function tryCloudflare(prompt, json) {
  if (!CF_ACCT || !CF_TOKEN) return null;
  const messages = [
    ...(json ? [{ role: "system", content: "Respond ONLY with a single valid, minified JSON object. No markdown, no code fences, no prose before or after." }] : []),
    { role: "user", content: prompt },
  ];
  for (const m of CF_MODELS) {
    try {
      const res = await tf(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/ai/run/${m}`, {
        method: "POST", headers: { Authorization: `Bearer ${CF_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messages, temperature: 0.9, max_tokens: 2048 }),
      }, 60000);
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.result?.response || "").trim();
      if (t) return json ? cleanJson(t) : t;
    } catch {}
  }
  return null;
}

// Genera texto probando Gemini y, si falla/cuota, Cloudflare Workers AI (gratis). Devuelve string o null.
export async function genText(prompt, { json = true } = {}) {
  let t = await tryGemini(prompt, json);
  if (t) return t;
  console.error("Gemini no respondió (cuota/límite) -> fallback Cloudflare Workers AI");
  t = await tryCloudflare(prompt, json);
  if (t) { console.error("Texto generado por Cloudflare Workers AI (fallback gratis)"); return t; }
  return null;
}
