// tts_gemini_directed.mjs — narra el video LARGO con voz de LOCUTOR (Gemini TTS, gratis),
// beat por beat, con pausas, y produce el MISMO formato que el TTS anterior (WAV + timing
// por beat) para que la voz combinada y el render funcionen igual. Corre por PEDAZOS en
// paralelo (como el pipeline de Chatterbox).
//
// Uso: node pipeline/tts_gemini_directed.mjs <voicemap.json> <out.wav> <chunkIndex> <numChunks>
// Env: GEMINI_API_KEY, VOICE (default Charon).
import fs from "node:fs";
import { execSync } from "node:child_process";

const [mapPath, outWav, ciArg = "0", ncArg = "1"] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
const VOICE = process.env.VOICE || "Charon";
const SR = 24000;
const spec = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const beats = spec.beats || [];
const ci = parseInt(ciArg, 10) || 0, nc = parseInt(ncArg, 10) || 1;
const size = Math.ceil(beats.length / nc);
const offset = ci * size;
const chunk = beats.slice(offset, offset + size);
console.log(`CHUNK ${ci + 1}/${nc}: ${chunk.length} beats (offset ${offset}), voz ${VOICE}`);
if (!chunk.length) {
  fs.writeFileSync("chunk.pcm", Buffer.alloc(Math.round(0.05 * SR) * 2));
  execSync(`ffmpeg -y -f s16le -ar ${SR} -ac 1 -i chunk.pcm "${outWav}"`, { stdio: "ignore" });
  fs.writeFileSync(outWav + ".timing.json", JSON.stringify({ sr: SR, beats: [] }));
  process.exit(0);
}

async function tts(text) {
  for (const m of ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
          }),
        });
        if (r.status === 429) { await new Promise((s) => setTimeout(s, 12000)); continue; }
        if (!r.ok) { console.error(`${m}: ${r.status}`); break; }
        const j = await r.json();
        const p = (j?.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData);
        if (p) return Buffer.from(p.inlineData.data, "base64");
        break;
      } catch (e) { console.error(`${m}: ${e.message}`); }
    }
  }
  return null;
}

const parts = [], timings = [];
for (let i = 0; i < chunk.length; i++) {
  const b = chunk[i];
  const text = (b.text || "").trim();
  if (!text) continue;
  let pcm = await tts(text);
  if (!pcm) { console.error("TTS fallo beat", offset + i, "-> silencio"); pcm = Buffer.alloc(SR * 2); }
  const pause = Math.round((b.pause_after != null ? b.pause_after : 0.25) * SR) * 2;
  const sil = Buffer.alloc(pause);
  parts.push(pcm, sil);
  timings.push({ index: offset + i, tipo: b.tipo || "-", text, dur: Math.round(((pcm.length + sil.length) / 2 / SR) * 1000) / 1000 });
  console.log(`  beat ${offset + i} [${b.tipo || "-"}] -> ${((pcm.length + sil.length) / 2 / SR).toFixed(2)}s`);
  await new Promise((s) => setTimeout(s, 700)); // respira el rate limit gratis
}
fs.writeFileSync("chunk.pcm", Buffer.concat(parts));
execSync(`ffmpeg -y -f s16le -ar ${SR} -ac 1 -i chunk.pcm "${outWav}"`, { stdio: "ignore" });
fs.writeFileSync(outWav + ".timing.json", JSON.stringify({ sr: SR, beats: timings }));
console.log(`OK chunk ${ci}: ${timings.length} beats -> ${outWav}`);
