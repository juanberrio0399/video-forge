// gen_image.mjs — Generación de imagen: Flux.1-schnell (HuggingFace, alta fidelidad,
// PRIORITARIO en prompts con texto/realismo) + Gemini nativo, con fallback a Pollinations (Flux).
// Todo gratis. Uso: node pipeline/gen_image.mjs "PROMPT" [salida.png]

import fs from "node:fs";
import path from "node:path";

const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY2,
].filter(Boolean);

async function dlPollinations(prompt, dest) {
  console.log(`[gen_image] Fallback a Pollinations (flux) para: "${prompt.slice(0, 60)}..."`);
  const enhanced = `${prompt}, cinematic 8k, high detail, sharp focus`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced)}?width=1280&height=720&nologo=true&model=flux`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`Pollinations HTTP ${r.status}: ${r.statusText}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const dir = path.dirname(dest);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log(`[gen_image] Guardado (Pollinations) en ${dest} (${buf.length} bytes)`);
  return dest;
}

// Flux.1-schnell vía Hugging Face Inference API (gratis con HF_TOKEN). Alta fidelidad,
// especialmente para TEXTO en la imagen y REALISMO. Lanza si no hay token o si falla.
async function generateFluxImage(prompt, dest) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("sin HF_TOKEN");
  console.log(`[gen_image] Flux.1-schnell (HuggingFace) para: "${prompt.slice(0, 60)}..."`);
  const res = await fetch("https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "image/png" },
    body: JSON.stringify({ inputs: prompt, parameters: { width: 1280, height: 720 } }),
    signal: AbortSignal.timeout(60000),
  });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.startsWith("image/")) {
    // HF devuelve JSON (p.ej. {error, estimated_time}) mientras el modelo "despierta" o si falla.
    const t = await res.text().catch(() => "");
    throw new Error(`HF ${res.status} (${ct}): ${t.slice(0, 140)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error(`imagen muy chica (${buf.length}b)`);
  const dir = path.dirname(dest);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log(`[gen_image] Guardado (Flux.1-schnell) en ${dest} (${buf.length} bytes)`);
  return dest;
}

// ¿Conviene Flux primero? Sí en prompts con TEXTO o REALISMO (donde Flux.1-schnell brilla).
const FLUX_HINT = /\b(text|words?|sign|signage|label|poster|logo|number|title|caption|typography|realistic|realism|photo(graph|realistic)?|portrait|face|product|hyperrealistic)\b/i;

export async function generateImage(prompt, outPath = "out.png") {
  const dir = path.dirname(outPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

  // 1) Flux PRIMERO si hay token y el prompt pide texto/realismo.
  const HF = process.env.HF_TOKEN;
  let triedFlux = false;
  if (HF && FLUX_HINT.test(prompt)) {
    triedFlux = true;
    try { return await generateFluxImage(prompt, outPath); }
    catch (err) { console.warn(`[gen_image] Flux (prioritario) falló: ${err.message}`); }
  }

  const IMG_MODELS = ["gemini-2.5-flash-image", "gemini-3.1-flash-lite-image", "gemini-2.0-flash-preview-image-generation"];
  for (const key of API_KEYS) for (const model of IMG_MODELS) {
    try {
      console.log(`[gen_image] Solicitando imagen a Gemini (${model})...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"]
        }
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.warn(`[gen_image] Gemini API HTTP ${res.status}: ${await res.text().catch(() => "")}`);
        continue;
      }

      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p) => p.inlineData && p.inlineData.data);

      if (imgPart && imgPart.inlineData.data) {
        const buf = Buffer.from(imgPart.inlineData.data, "base64");
        fs.writeFileSync(outPath, buf);
        console.log(`[gen_image] Generada con Gemini 2.5 Flash Image -> ${outPath} (${buf.length} bytes)`);
        return outPath;
      } else {
        console.warn(`[gen_image] Gemini no devolvió inlineData con imagen`);
      }
    } catch (err) {
      console.warn(`[gen_image] Error llamando a Gemini: ${err.message}`);
    }
  }

  // Flux como fallback de alta fidelidad antes de Pollinations (si hay token y no se probó ya).
  if (HF && !triedFlux) {
    try { return await generateFluxImage(prompt, outPath); }
    catch (err) { console.warn(`[gen_image] Flux (fallback) falló: ${err.message}`); }
  }

  // Fallback seguro a Pollinations
  try {
    return await dlPollinations(prompt, outPath);
  } catch (err) {
    console.error(`[gen_image] Fallback a Pollinations falló: ${err.message}`);
    const fallbackBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(outPath, fallbackBuffer);
    return outPath;
  }
}

const isDirect = process.argv[1] && (
  process.argv[1].endsWith("gen_image.mjs") ||
  process.argv[1].endsWith("gen_image")
);

if (isDirect) {
  const prompt = process.argv[2] || "cinematic financial data glowing chart 8k";
  const dest = process.argv[3] || "out.png";
  await generateImage(prompt, dest);
}
