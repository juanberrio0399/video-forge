// tts_health.mjs — prueba UNA llamada a Gemini TTS. Imprime "gemini" si responde bien,
// o "kokoro" si está saturado/caído (para elegir el motor de voz del run).
const KEY = process.env.GEMINI_API_KEY;
const VOICE = process.env.VOICE || "Charon";
async function ok() {
  if (!KEY) return false;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Test." }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
      }),
    });
    if (r.status === 429 || r.status >= 500) return false;
    if (!r.ok) return false;
    const j = await r.json();
    return !!(j?.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData);
  } catch { return false; }
}
process.stdout.write((await ok()) ? "gemini" : "kokoro");
