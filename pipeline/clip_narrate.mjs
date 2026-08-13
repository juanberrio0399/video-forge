// clip_narrate.mjs — NARRACIÓN (voz) para los shorts clipeados, TODO en Node (sin Python/Kokoro):
// la IA escribe un guion corto por categoría y Gemini TTS lo convierte a voz -> voice.wav. Si algo
// falla, el clipper cae a solo música. Así los clips llevan VOZ de comentario, no solo música.
import fs from "node:fs";
import { execSync } from "node:child_process";

const TONE = {
  graciosos: "GRACIOSO y con energía, comenta el gag con humor",
  ciencia_humor: "asombroso, estilo '¿sabías que...?', datos que sorprenden",
  naturaleza_relax: "calmado y evocador",
  cine_clasico: "dramático/cinematográfico, como tráiler",
  deporte_momentos: "épico, con adrenalina",
  narrativas: "con tensión y misterio",
};
const tfetch = (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(40000) });

// Guion corto (~28s) por categoría. Devuelve el texto plano de la narración.
export async function narrationText(KEYS, category, title, topic) {
  const fb = "Wait for it. This one's worth the watch. Follow for more.";
  if (!KEYS || !KEYS.length) return fb;
  const tone = TONE[category] || "con energía y gancho";
  const prompt = `Eres guionista de SHORTS faceless en INGLÉS (audiencia EEUU). Escribe una narración MUY CORTA (~28 segundos, 3-4 frases cortas) para un short de la categoría "${category}" basado en "${title}" (tema: ${topic}). Tono: ${tone}. La 1a frase engancha en 2s; la última es un CTA de 3 palabras a suscribirse. Natural, hablado, no robótico. Devuelve SOLO el texto de la narración (sin comillas, sin viñetas).`;
  for (let r = 0; r < 2; r++) for (const k of KEYS) for (const m of ["gemini-flash-latest", "gemini-2.5-flash"]) {
    try {
      const res = await tfetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/["*#]/g, "").replace(/\s+/g, " ").trim();
      if (t) return t.slice(0, 500);
    } catch {}
  }
  return fb;
}

// Gemini TTS -> voice.wav (PCM 24k mono). Devuelve true si lo generó.
export async function synthVoice(KEYS, text, outWav = "voice.wav") {
  if (!KEYS || !KEYS.length || !text) return false;
  for (const k of KEYS) {
    try {
      const res = await tfetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${k}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } } }) });
      if (!res.ok) continue;
      const j = await res.json();
      const b64 = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) continue;
      fs.writeFileSync("voice.pcm", Buffer.from(b64, "base64"));
      execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i voice.pcm "${outWav}"`, { stdio: "ignore" });
      fs.rmSync("voice.pcm", { force: true });
      if (fs.existsSync(outWav) && fs.statSync(outWav).size > 2000) return true;
    } catch {}
  }
  return false;
}

// Mezcla final: voz (protagonista) + música baja bajo el video del clip -> outPath. Cae a solo música
// o solo video si falta algo. loudnorm -14 LUFS (nivel YouTube).
export function muxVoiceMusic(silentVideo, voiceWav, outPath) {
  const hasVoice = voiceWav && fs.existsSync(voiceWav) && fs.statSync(voiceWav).size > 2000;
  const hasMusic = fs.existsSync("music.mp3");
  const LN = "loudnorm=I=-14:TP=-1.5";
  if (hasVoice && hasMusic) {
    execSync(`ffmpeg -y -i "${silentVideo}" -i "${voiceWav}" -stream_loop -1 -i music.mp3 -filter_complex "[1:a]volume=1.0[v];[2:a]volume=0.14[m];[v][m]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,${LN}[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
  } else if (hasVoice) {
    execSync(`ffmpeg -y -i "${silentVideo}" -i "${voiceWav}" -filter_complex "[1:a]${LN}[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
  } else if (hasMusic) {
    execSync(`ffmpeg -y -i "${silentVideo}" -stream_loop -1 -i music.mp3 -filter_complex "[1:a]volume=0.5,afade=t=in:st=0:d=1[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "${outPath}"`, { stdio: "inherit" });
  } else {
    execSync(`ffmpeg -y -i "${silentVideo}" -map 0:v -an -c:v copy "${outPath}"`, { stdio: "inherit" });
  }
  return hasVoice;
}
