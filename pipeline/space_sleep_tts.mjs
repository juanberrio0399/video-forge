// space_sleep_tts.mjs — TTS por PARTES para narraciones LARGAS (sueño). Gemini TTS trunca textos
// largos, así que troceamos por los marcadores de pausa ("..."), narramos cada trozo con voz CALMADA
// (rotando llaves/modelos ante 429), metemos un silencio suave entre trozos y concatenamos en un mp3.
//
// Uso: node pipeline/space_sleep_tts.mjs <narration.txt> <out.mp3> [voz]
// Env: GEMINI_API_KEY(,2). Voz recomendada: Charon (calmado).
import fs from "node:fs";
import { execSync } from "node:child_process";

const [textFile, outMp3 = "narration.mp3", voice = "Charon"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
if (!KEYS.length) { console.error("Falta GEMINI_API_KEY"); process.exit(1); }
const raw = fs.readFileSync(textFile, "utf8").trim();
if (!raw) { console.error("Texto vacío"); process.exit(1); }
const work = "ttswork"; fs.mkdirSync(work, { recursive: true });
const abs = (p) => `${process.cwd()}/${p}`;

const STYLE = "Read the following text in a very slow, soft, calm and soothing late-night bedtime voice — gentle, quiet, warm, unhurried, with relaxed pacing and soft natural pauses, as if helping someone drift off to sleep. Do not read this instruction out loud:\n\n";

// Trocear por los marcadores de pausa "..." (los puso el guion), agrupando hasta ~1000 chars por trozo.
const blocks = raw.split(/\n*\.\.\.\n*/).map((s) => s.trim()).filter(Boolean);
const MAXLEN = 1000, chunks = [];
let cur = "";
for (const b of blocks) {
  if (cur && (cur.length + b.length + 2) > MAXLEN) { chunks.push(cur.trim()); cur = b; }
  else cur = cur ? cur + "\n\n" + b : b;
  while (cur.length > MAXLEN * 1.6) {
    const cut = cur.lastIndexOf(". ", MAXLEN);
    const at = cut > 200 ? cut + 1 : MAXLEN;
    chunks.push(cur.slice(0, at).trim()); cur = cur.slice(at).trim();
  }
}
if (cur.trim()) chunks.push(cur.trim());
console.log(`TTS por partes: ${chunks.length} trozos (voz ${voice})`);

const models = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];
async function ttsChunk(text) {
  for (let round = 0; round < 3; round++) for (const KEY of KEYS) for (const m of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: STYLE + text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
        signal: AbortSignal.timeout(120000),
      });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 2500)); continue; }
      if (!r.ok) { console.error(`${m}: ${r.status} ${(await r.text()).slice(0, 120)}`); continue; }
      const j = await r.json();
      const part = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
      if (part && part.inlineData.data) { const mm = /rate=(\d+)/.exec(part.inlineData.mimeType || ""); return { b64: part.inlineData.data, rate: mm ? +mm[1] : 24000 }; }
    } catch (e) { console.error(`${m}: ${e.message}`); }
  }
  return null;
}

const parts = []; let rate = 24000;
for (let i = 0; i < chunks.length; i++) {
  const res = await ttsChunk(chunks[i]);
  if (!res) { console.error(`  trozo ${i + 1} falló tras reintentos -> lo omito`); continue; }
  rate = res.rate;
  const pcm = `${work}/p${i}.pcm`; fs.writeFileSync(pcm, Buffer.from(res.b64, "base64"));
  const wav = `${work}/p${i}.wav`;
  execSync(`ffmpeg -y -f s16le -ar ${rate} -ac 1 -i "${pcm}" -c:a pcm_s16le "${wav}"`, { stdio: "ignore" });
  fs.rmSync(pcm, { force: true });
  parts.push(wav);
  console.log(`  trozo ${i + 1}/${chunks.length} ✓`);
}
if (!parts.length) { console.error("Ningún trozo de TTS salió -> aborto"); process.exit(1); }

// Silencio de 0.8s entre partes (respiración natural de sueño).
const sil = `${work}/sil.wav`;
execSync(`ffmpeg -y -f lavfi -i "anullsrc=r=${rate}:cl=mono" -t 0.8 -c:a pcm_s16le "${sil}"`, { stdio: "ignore" });
const lines = [];
parts.forEach((p, i) => { if (i) lines.push(`file '${abs(sil)}'`); lines.push(`file '${abs(p)}'`); });
const listFile = `${work}/list.txt`;
fs.writeFileSync(listFile, lines.join("\n"));
execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -af "loudnorm=I=-16:TP=-1.5" -c:a libmp3lame -b:a 192k "${outMp3}"`, { stdio: "inherit" });
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${outMp3}"`).toString().trim()) || 0;
console.log(`Narración larga lista -> ${outMp3} · ${parts.length}/${chunks.length} partes · ${dur.toFixed(0)}s`);
