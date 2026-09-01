// gen_image.mjs — Generación de imagen nativa con Gemini (gemini-2.5-flash-image) con fallback a Pollinations (Flux)
// Uso: node pipeline/gen_image.mjs "PROMPT" [salida.png]

import fs from "node:fs";
import path from "node:path";

const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY2,
].filter(Boolean);

async function generateFluxImage(prompt, dest) {
  console.log(`[gen_image] Usando Flux.1 [schnell] (Hugging Face) para: "${prompt.slice(0, 60)}..."`);
  const token = process.env.HF_TOKEN;
  const url = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ inputs: prompt })
  });
  if (!r.ok) {
    throw new Error(`Hugging Face API HTTP ${r.status}: ${r.statusText}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const dir = path.dirname(dest);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: /true/ });
  fs.writeFileSync(dest, buf);
  console.log(`[gen_image] Guardado (Flux HF) en ${dest} (${buf.length} bytes)`);
  return dest;
}

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

export async function generateImage(prompt, outPath = "out.png") {
  const dir = path.dirname(outPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

  const lowerPrompt = prompt.toLowerCase();
  const isTextOrRealism = /\b(texto|text|realismo|realism|fotorealista|photorealistic|lettering|words|letras)\b/i.test(lowerPrompt);

  if (isTextOrRealism) {
    try {
      return await generateFluxImage(prompt, outPath);
    } catch (err) {
      console.warn(`[gen_image] Flux.1 prioritario falló, continuando con flujo normal: ${err.message}`);
    }
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
