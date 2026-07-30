// gemini_tts.mjs — narra un texto con Gemini TTS (voz de LOCUTOR profesional, gratis).
// Devuelve un MP3. Gemini TTS entrega PCM 16-bit base64; se convierte a mp3 con ffmpeg.
//
// Uso: node pipeline/gemini_tts.mjs <texto.txt> <salida.mp3> [voz]
// Voces de locutor recomendadas (Google): Charon (informativo), Rasalgethi (informativo),
// Iapetus (claro), Alnilam (firme), Orus (firme). Default: Charon.
import fs from "node:fs";
import { execSync } from "node:child_process";

const [textFile, outMp3, voice = "Charon"] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("Falta GEMINI_API_KEY"); process.exit(1); }
const text = fs.readFileSync(textFile, "utf8").trim();
if (!text) { console.error("Texto vacio"); process.exit(1); }

const models = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];
let b64 = null, rate = 24000;
for (const m of models) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (!r.ok) { console.error(`${m}: ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
    const j = await r.json();
    const part = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
    if (part && part.inlineData.data) {
      b64 = part.inlineData.data;
      const mm = /rate=(\d+)/.exec(part.inlineData.mimeType || "");
      if (mm) rate = +mm[1];
      console.log(`TTS OK con ${m} · voz ${voice} · ${rate} Hz`);
      break;
    }
    console.error(`${m}: sin audio en la respuesta`);
  } catch (e) { console.error(`${m}: ${e.message}`); }
}
if (!b64) { console.error("Gemini TTS fallo en todos los modelos"); process.exit(1); }

fs.writeFileSync("tts.pcm", Buffer.from(b64, "base64"));
execSync(`ffmpeg -y -f s16le -ar ${rate} -ac 1 -i tts.pcm -af "loudnorm=I=-14:TP=-1.5" -c:a libmp3lame -b:a 192k "${outMp3}"`, { stdio: "inherit" });
fs.rmSync("tts.pcm", { force: true });
console.log("audio ->", outMp3);
